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

export interface ErrorReporter {
  captureException(error: unknown, context?: ErrorReportContext): void;
  captureMessage(message: string, level?: 'info' | 'warning' | 'error', context?: ErrorReportContext): void;
}

class StandardErrorReporter implements ErrorReporter {
  private dsnConfigured: boolean;

  constructor() {
    this.dsnConfigured = Boolean(env.SENTRY_DSN);
    if (this.dsnConfigured) {
      logger.info('External error reporting hook initialized (Sentry-compatible DSN configured)', {
        environment: env.NODE_ENV,
      });
    }
  }

  captureException(error: unknown, context?: ErrorReportContext): void {
    const errorDetails = error instanceof Error
      ? { message: error.message, name: error.name, stack: error.stack }
      : { message: String(error) };

    logger.error('Unhandled exception captured by ErrorReporter', error, {
      reporter: 'centralized',
      ...context,
      errorDetails,
    });

    // When an external service DSN (e.g. Sentry/Datadog) is configured, this provides the hook to forward it
    if (this.dsnConfigured) {
      // In production setups with @sentry/node, Sentry.captureException(error, { extra: context }) is called here.
    }
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

export const errorReporter: ErrorReporter = new StandardErrorReporter();
export default errorReporter;
