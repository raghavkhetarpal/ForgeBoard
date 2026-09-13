import { env } from './env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentMinLevel: LogLevel = env.LOG_LEVEL || (env.NODE_ENV === 'production' ? 'info' : 'debug');
const minSeverity = LOG_LEVEL_SEVERITY[currentMinLevel] ?? 20;

// Keys that must be masked to prevent credential or secret leakage
const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'accesstoken',
  'idtoken',
  'authorization',
  'auth',
  'cookie',
  'cookies',
  'signedcookies',
  'sessionsecret',
  'encryptionkey',
  'secret',
  'clientsecret',
  'webhooksecret',
  'code',
  'apikey',
  'api_key',
  'privatekey',
  'private_key',
  'cert',
  'jwt',
]);

/**
 * Recursively redacts sensitive fields and values.
 */
export function sanitizeLogData(data: unknown, depth = 0): unknown {
  if (depth > 5 || data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: env.NODE_ENV === 'production' ? undefined : data.stack,
      ...((data as unknown) as Record<string, unknown>),
    };
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (REDACTED_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('password')) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;
  context?: Record<string, unknown>;
  error?: unknown;
}

function emitLog(level: LogLevel, message: string, context?: Record<string, unknown>, error?: unknown) {
  if (LOG_LEVEL_SEVERITY[level] < minSeverity) {
    return;
  }

  const timestamp = new Date().toISOString();
  const entry: StructuredLogEntry = {
    timestamp,
    level,
    message,
    service: 'forgeboard-api',
    environment: env.NODE_ENV,
    ...(context ? { context: sanitizeLogData(context) as Record<string, unknown> } : {}),
    ...(error ? { error: sanitizeLogData(error) } : {}),
  };

  // In production, emit single-line machine-readable JSON for log aggregators (Datadog, Loki, CloudWatch, etc.)
  if (env.NODE_ENV === 'production') {
    const serialized = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(`${serialized}\n`);
    } else {
      process.stdout.write(`${serialized}\n`);
    }
  } else {
    // Human-readable format in development & test
    const color =
      level === 'error'
        ? '\x1b[31m'
        : level === 'warn'
        ? '\x1b[33m'
        : level === 'info'
        ? '\x1b[36m'
        : '\x1b[90m';
    const reset = '\x1b[0m';
    const contextStr = context ? ` ${JSON.stringify(sanitizeLogData(context))}` : '';
    const errStr = error instanceof Error ? `\n${error.stack || error.message}` : error ? ` ${JSON.stringify(sanitizeLogData(error))}` : '';
    const formatted = `[${timestamp}] ${color}${level.toUpperCase().padEnd(5)}${reset} ${message}${contextStr}${errStr}`;

    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else if (level === 'info') {
      console.info(formatted);
    } else {
      console.debug(formatted);
    }
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emitLog('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => emitLog('info', message, context),
  warn: (message: string, context?: Record<string, unknown>, error?: unknown) => emitLog('warn', message, context, error),
  error: (message: string, error?: unknown, context?: Record<string, unknown>) => emitLog('error', message, context, error),
};

export default logger;
