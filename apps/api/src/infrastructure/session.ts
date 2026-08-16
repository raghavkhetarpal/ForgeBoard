import crypto from 'crypto';
import { SessionData } from '@forgeboard/types';
import redis from './redis';

export const SESSION_COOKIE_NAME = 'forgeboard_session';
export const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

const SESSION_PREFIX = 'session:';
const USER_SESSIONS_PREFIX = 'user_sessions:';

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.JWT_SECRET || 'forgeboard-dev-session-secret';
}

/**
 * Sign a raw session ID using HMAC-SHA256 matching cookie-parser format (s:<id>.<signature>)
 */
export function signSessionCookie(sessionId: string): string {
  const secret = getSessionSecret();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(sessionId)
    .digest('base64')
    .replace(/=+$/, '');
  return `s:${sessionId}.${signature}`;
}

/**
 * Unsign a cookie-parser formatted signed cookie value
 */
export function unsignSessionCookie(signedValue: string): string | false {
  if (!signedValue || !signedValue.startsWith('s:')) {
    return false;
  }
  const secret = getSessionSecret();
  const raw = signedValue.slice(2);
  const lastDotIndex = raw.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return false;
  }

  const sessionId = raw.slice(0, lastDotIndex);
  const providedSignature = raw.slice(lastDotIndex + 1);

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(sessionId)
    .digest('base64')
    .replace(/=+$/, '');

  const providedBuf = Buffer.from(providedSignature);
  const expectedBuf = Buffer.from(expectedSignature);

  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  if (crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return sessionId;
  }

  return false;
}

/**
 * Generates a random cryptographic session ID.
 */
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Stores a new session in Redis and registers it in the user's active session set.
 */
export async function createSession(
  userId: string,
  email: string,
  ttlSeconds: number = DEFAULT_SESSION_TTL_SECONDS,
): Promise<SessionData> {
  const sessionId = generateSessionId();
  const now = Date.now();
  const expiresAt = now + ttlSeconds * 1000;

  const sessionData: SessionData = {
    sessionId,
    userId,
    email,
    createdAt: now,
    expiresAt,
  };

  const sessionKey = `${SESSION_PREFIX}${sessionId}`;
  const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;

  try {
    const pipeline = redis.pipeline();
    pipeline.set(sessionKey, JSON.stringify(sessionData), 'EX', ttlSeconds);
    pipeline.sadd(userSessionsKey, sessionId);
    pipeline.expire(userSessionsKey, ttlSeconds);
    await pipeline.exec();
  } catch (error) {
    console.error('Failed to create session in Redis:', error);
    throw error;
  }

  return sessionData;
}

/**
 * Fetches session data from Redis by session ID.
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  if (!sessionId) return null;
  const sessionKey = `${SESSION_PREFIX}${sessionId}`;

  try {
    const raw = await redis.get(sessionKey);
    if (!raw) return null;
    const session: SessionData = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      await deleteSession(sessionId);
      return null;
    }
    return session;
  } catch (error) {
    console.error('Failed to fetch session from Redis:', error);
    return null;
  }
}

/**
 * Touches/refreshes the expiration time of an existing session.
 */
export async function touchSession(
  sessionId: string,
  ttlSeconds: number = DEFAULT_SESSION_TTL_SECONDS,
): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;

  session.expiresAt = Date.now() + ttlSeconds * 1000;
  const sessionKey = `${SESSION_PREFIX}${sessionId}`;
  const userSessionsKey = `${USER_SESSIONS_PREFIX}${session.userId}`;

  try {
    const pipeline = redis.pipeline();
    pipeline.set(sessionKey, JSON.stringify(session), 'EX', ttlSeconds);
    pipeline.expire(userSessionsKey, ttlSeconds);
    await pipeline.exec();
  } catch (error) {
    console.error('Failed to touch session in Redis:', error);
  }
}

/**
 * Deletes a session by session ID.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  const sessionKey = `${SESSION_PREFIX}${sessionId}`;

  try {
    const raw = await redis.get(sessionKey);
    if (raw) {
      const session: SessionData = JSON.parse(raw);
      const userSessionsKey = `${USER_SESSIONS_PREFIX}${session.userId}`;
      await redis.pipeline().del(sessionKey).srem(userSessionsKey, sessionId).exec();
    } else {
      await redis.del(sessionKey);
    }
  } catch (error) {
    console.error('Failed to delete session from Redis:', error);
  }
}

/**
 * Invalidates all active sessions for a given user (used upon password reset / member revocation).
 */
export async function invalidateUserSessions(userId: string): Promise<void> {
  if (!userId) return;
  const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;

  try {
    const sessionIds = await redis.smembers(userSessionsKey);
    if (sessionIds && sessionIds.length > 0) {
      const pipeline = redis.pipeline();
      for (const sId of sessionIds) {
        pipeline.del(`${SESSION_PREFIX}${sId}`);
      }
      pipeline.del(userSessionsKey);
      await pipeline.exec();
    } else {
      await redis.del(userSessionsKey);
    }
  } catch (error) {
    console.error(`Failed to invalidate sessions for user ${userId}:`, error);
  }
}
