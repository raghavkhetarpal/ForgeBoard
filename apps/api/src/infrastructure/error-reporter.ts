import { env } from './env';
import { logger } from './logger';

export interface ErrorReportContext {
  userId?: string;
  requestId?: string;
  route?: string;
  method?: string;
  extra?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ErrorReportingProvider {
  name: string;
  captureException(error: unknown, context?: ErrorReportContext): void;
  captureMessage(message: string, level?: 'info' | 'warning' | 'error', context?: ErrorReportContext): void;
}

/**
 * Built-in local fallback provider that formats and logs through the structured JSON logger.
 */
export class LocalLoggerProvider implements ErrorReportingProvider {
  name = 'local-logger';

  captureException(error: unknown, context?: ErrorReportContext): void {
    const errorDetails = error instanceof Error
      ? { message: error.message, name: error.name, stack: error.stack }
      : { message: String(error) };

    logger.error('Unhandled exception captured', error, {
      provider: this.name,
      ...context,
      errorDetails,
    });
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorReportContext): void {
    if (level === 'error') {
      logger.error(message, undefined, context);
    } else if (level === 'warning') {
      logger.warn(message, context);
    } else {
      logger.info(message, context);
    }
  }
}

/**
 * Sentry-compatible webhook/DSN provider stub that activates only when SENTRY_DSN is set.
 */
export class SentryReportingProvider implements ErrorReportingProvider {
  name = 'sentry';

  constructor(private dsn: string) {
    logger.info('Sentry error reporting provider registered', {
      dsn: `${this.dsn.substring(0, 8)}...`,
      environment: env.NODE_ENV,
    });
  }

  captureException(error: unknown, context?: ErrorReportContext): void {
    // When external monitoring client (@sentry/node) is linked, it forwards to Sentry:
    // Sentry.captureException(error, { extra: context });
    logger.error('Forwarding exception to external error reporting provider', error, {
      provider: this.name,
      ...context,
    });
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorReportContext): void {
    // Sentry.captureMessage(message, level);
    if (level === 'error') {
      logger.error(`[${this.name}] ${message}`, undefined, context);
    } else if (level === 'warning') {
      logger.warn(`[${this.name}] ${message}`, context);
    } else {
      logger.info(`[${this.name}] ${message}`, context);
    }
  }
}

export class CentralizedErrorReporter {
  private providers: ErrorReportingProvider[] = [];

  constructor() {
    // Always attach the reliable local structured logger provider
    this.registerProvider(new LocalLoggerProvider());

    // Automatically attach external provider if Sentry DSN is present
    if (env.SENTRY_DSN) {
      this.registerProvider(new SentryReportingProvider(env.SENTRY_DSN));
    }
  }

  registerProvider(provider: ErrorReportingProvider): void {
    this.providers.push(provider);
  }

  getProviders(): ErrorReportingProvider[] {
    return [...this.providers];
  }

  captureException(error: unknown, context?: ErrorReportContext): void {
    for (const provider of this.providers) {
      try {
        provider.captureException(error, context);
      } catch (err) {
        logger.error(`Error reporting provider '${provider.name}' failed`, err);
      }
    }
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorReportContext): void {
    for (const provider of this.providers) {
      try {
        provider.captureMessage(message, level, context);
      } catch (err) {
        logger.error(`Error reporting provider '${provider.name}' failed`, err);
      }
    }
  }
}

export const errorReporter = new CentralizedErrorReporter();
export default errorReporter;
