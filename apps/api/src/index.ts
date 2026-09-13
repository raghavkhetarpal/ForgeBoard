import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './modules/auth/auth.routes';
import workspacesRoutes from './modules/workspaces/workspaces.routes';
import { workspaceProjectsRouter, projectRouter } from './modules/projects/projects.routes';
import { AppError } from './infrastructure/errors';
import http from 'http';
import { initSocketServer } from './infrastructure/socket';
import { env } from './infrastructure/env';
import { logger } from './infrastructure/logger';
import { errorReporter } from './infrastructure/error-reporter';
import { requestLogger } from './middleware/request-logger.middleware';
import healthRouter from './modules/health/health.routes';

dotenv.config({ path: '../../.env' });

const app: Express = express();
export const httpServer = http.createServer(app);
initSocketServer(httpServer);
const port = env.PORT;
const sessionSecret = env.SESSION_SECRET;

app.use(
  cors({
    origin: env.NEXT_PUBLIC_APP_URL,
    credentials: true,
  }),
);
app.use(requestLogger);
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf;
  }
}));
app.use(cookieParser(sessionSecret));

// Health and Readiness probes
app.use(healthRouter);

import issuesRouter from './modules/issues/issues.routes';
import notificationsRouter from './modules/notifications/notifications.routes';
import labelsRoutes from './modules/labels/labels.routes';
import milestonesRoutes from './modules/milestones/milestones.routes';
import webhooksRoutes from './modules/webhooks/webhooks.routes';
import githubRoutes from './modules/github/github.routes';

// Mount modules
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspacesRoutes);
app.use('/api/workspaces/:workspaceId/projects', workspaceProjectsRouter);
app.use('/api/projects', projectRouter);
app.use('/api/projects/:projectId/issues', issuesRouter);
app.use('/api/projects/:projectId/milestones', milestonesRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/projects/:projectId/labels', labelsRoutes);
app.use('/api/notifications', notificationsRouter);
app.use('/api/webhooks', webhooksRoutes);

// Global error handler envelope per docs/ARCHITECTURE.md §8
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Report internal / unhandled errors via centralized error reporter
  errorReporter.captureException(err, {
    requestId: req.id,
    route: req.originalUrl || req.url,
    method: req.method,
    userId: req.user?.id,
  });

  const message =
    process.env.NODE_ENV === 'production'
      ? 'An internal error occurred.'
      : err instanceof Error
        ? err.message
        : 'Internal server error';

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message,
    },
  });
});

if (process.env.NODE_ENV !== 'test' || process.env.PLAYWRIGHT_TEST === 'true' || process.env.START_SERVER === 'true') {
  httpServer.listen(port, () => {
    logger.info(`ForgeBoard API running on port ${port}`, {
      port,
      environment: env.NODE_ENV,
      nodeVersion: process.version,
    });
  });

  // Graceful shutdown handling
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    httpServer.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Global uncaught exception and unhandled promise rejection handlers
  process.on('uncaughtException', (err: Error) => {
    logger.error('Fatal Uncaught Exception detected', err, { fatal: true });
    errorReporter.captureException(err, { extra: { fatal: true, type: 'uncaughtException' } });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled Promise Rejection detected', reason instanceof Error ? reason : undefined, {
      fatal: false,
      reason: String(reason),
    });
    errorReporter.captureException(reason instanceof Error ? reason : new Error(String(reason)), {
      extra: { type: 'unhandledRejection' },
    });
  });
}

export default app;
