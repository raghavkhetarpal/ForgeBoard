import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './modules/auth/auth.routes';
import workspacesRoutes from './modules/workspaces/workspaces.routes';

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

// Mount modules
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspacesRoutes);

// Global error handler envelope per docs/ARCHITECTURE.md §8
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API Error:', err);
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'An internal error occurred.'
      : err.message || 'Internal server error';

  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`ForgeBoard API running on port ${port}`);
  });
}

export default app;
