import { Request, Response, NextFunction } from 'express';
import { AuthService, authService } from './auth.service';
import {
  registerSchema,
  loginSchema,
  requestPasswordResetSchema,
  confirmPasswordResetSchema,
  updateProfileSchema,
} from './auth.validation';
import { SESSION_COOKIE_NAME, DEFAULT_SESSION_TTL_SECONDS } from '../../infrastructure/session';

export class AuthController {
  constructor(private service: AuthService = authService) {}

  private setSessionCookie(res: Response, sessionId: string): void {
    res.cookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      signed: true,
      maxAge: DEFAULT_SESSION_TTL_SECONDS * 1000,
      path: '/',
    });
  }

  private clearSessionCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = registerSchema.parse(req.body);
      const result = await this.service.register(parsed);

      if (result.session) {
        this.setSessionCookie(res, result.session.sessionId);
      }

      res.status(201).json({
        data: {
          user: result.user,
          ...(process.env.NODE_ENV !== 'production' && result.session
            ? { session: result.session }
            : {}),
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: error.errors } });
        return;
      }
      if (error.statusCode) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = loginSchema.parse(req.body);
      const result = await this.service.login(parsed);

      if (result.session) {
        this.setSessionCookie(res, result.session.sessionId);
      }

      res.status(200).json({
        data: {
          user: result.user,
          ...(process.env.NODE_ENV !== 'production' && result.session
            ? { session: result.session }
            : {}),
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: error.errors } });
        return;
      }
      if (error.statusCode) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.sessionId) {
        await this.service.logout(req.sessionId);
      }
      this.clearSessionCookie(res);
      res.status(200).json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  };

  session = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.sessionId) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No active session' } });
        return;
      }
      const result = await this.service.refreshSession(req.sessionId);
      this.setSessionCookie(res, req.sessionId);

      res.status(200).json({
        data: {
          user: result.user,
          session: {
            expiresAt: result.session.expiresAt,
          },
        },
      });
    } catch (error: any) {
      if (error.statusCode) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      next(error);
    }
  };

  requestPasswordReset = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const parsed = requestPasswordResetSchema.parse(req.body);
      await this.service.requestPasswordReset(parsed);

      res.status(200).json({
        data: {
          success: true,
          message: 'If an account exists with this email, a password reset link has been dispatched.',
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: error.errors } });
        return;
      }
      next(error);
    }
  };

  confirmPasswordReset = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const parsed = confirmPasswordResetSchema.parse(req.body);
      await this.service.confirmPasswordReset(parsed);

      this.clearSessionCookie(res);

      res.status(200).json({
        data: {
          success: true,
          message: 'Password has been updated. Please log in with your new password.',
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: error.errors } });
        return;
      }
      if (error.statusCode) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      next(error);
    }
  };

  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }
      const user = await this.service.getProfile(req.user.id);
      res.status(200).json({ data: { user } });
    } catch (error: any) {
      if (error.statusCode) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      next(error);
    }
  };

  updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }
      const parsed = updateProfileSchema.parse(req.body);
      const user = await this.service.updateProfile(req.user.id, parsed);
      res.status(200).json({ data: { user } });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: error.errors } });
        return;
      }
      if (error.statusCode) {
        res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
        return;
      }
      next(error);
    }
  };
}

export const authController = new AuthController();
