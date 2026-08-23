import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './modules/auth/auth.routes';
import workspacesRoutes from './modules/workspaces/workspaces.routes';
import { workspaceProjectsRouter, projectRouter } from './modules/projects/projects.routes';
import { AppError } from './infrastructure/errors';

dotenv.config({ path: '../../.env' });

const app: Express = express();
const port = process.env.PORT || 4000;
const sessionSecret = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'forgeboard-dev-session-secret';

app.use(
  cors({
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser(sessionSecret));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'api' });
});

import issuesRouter from './modules/issues/issues.routes';

// Mount modules
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspacesRoutes);
app.use('/api/workspaces/:workspaceId/projects', workspaceProjectsRouter);
app.use('/api/projects', projectRouter);
app.use('/api/projects/:projectId/issues', issuesRouter);

// Global error handler envelope per docs/ARCHITECTURE.md §8
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
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

  console.error('Unhandled API Error:', err);
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

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`ForgeBoard API running on port ${port}`);
  });
}

export default app;
