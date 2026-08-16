import { Request, Response, NextFunction } from 'express';
import { AuthUser } from '@forgeboard/types';
import { getSession, unsignSessionCookie, SESSION_COOKIE_NAME } from '../infrastructure/session';
import prisma from '../infrastructure/prisma';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
    }
  }
}

/**
 * Extracts and verifies the session from the signed httpOnly cookie.
 * (In non-production environments only, Authorization: Bearer <sessionId> is permitted for testing convenience).
 * Attaches req.user and req.sessionId if valid.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  let sessionId: string | null = null;

  // 1. Primary path: signed httpOnly session cookie
  if (req.signedCookies && req.signedCookies[SESSION_COOKIE_NAME]) {
    sessionId = req.signedCookies[SESSION_COOKIE_NAME];
  }

  // 2. Fallback: manual unsigning if unsigned cookie map is used
  if (!sessionId && req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    const rawCookie = req.cookies[SESSION_COOKIE_NAME];
    const unsigned = unsignSessionCookie(rawCookie);
    sessionId = unsigned !== false ? unsigned : null;
  }

  // 3. Testing / Dev only: Bearer token header for automated test scripts and CLI testing
  if (!sessionId && process.env.NODE_ENV !== 'production' && req.headers.authorization) {
    const [scheme, token] = req.headers.authorization.split(' ');
    if (scheme === 'Bearer' && token) {
      sessionId = token;
    }
  }

  if (!sessionId) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. No active session cookie provided.',
      },
    });
    return;
  }

  const session = await getSession(sessionId);
  if (!session) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Session has expired or is invalid.',
      },
    });
    return;
  }

  // Fetch latest user data from DB to ensure user account is valid
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, avatarUrl: true },
  });

  if (!user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'User account no longer exists.',
      },
    });
    return;
  }

  req.user = user;
  req.sessionId = sessionId;
  next();
}
