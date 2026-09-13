import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../infrastructure/logger';
import { metrics } from '../infrastructure/metrics';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  req.id = requestId;
  req.startTime = Date.now();

  res.setHeader('X-Request-Id', requestId);
  metrics.incrementRequests();

  res.on('finish', () => {
    metrics.decrementActiveRequests();
    const durationMs = Date.now() - (req.startTime || Date.now());
    metrics.recordRequest(res.statusCode, durationMs);

    const logContext: Record<string, unknown> = {
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip || req.socket.remoteAddress,
      userId: req.user?.id,
    };

    // Filter out chatty health check polls from verbose info logs unless error
    if (req.path === '/health' && res.statusCode < 400) {
      logger.debug('Health check probe', logContext);
      return;
    }

    if (res.statusCode >= 500) {
      logger.error(`HTTP ${req.method} ${req.originalUrl || req.url} completed with error`, undefined, logContext);
    } else if (res.statusCode >= 400) {
      logger.warn(`HTTP ${req.method} ${req.originalUrl || req.url} completed with client error`, logContext);
    } else {
      logger.info(`HTTP ${req.method} ${req.originalUrl || req.url} completed`, logContext);
    }
  });

  next();
}
