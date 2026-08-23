/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  signSessionCookie,
  unsignSessionCookie,
  generateSessionId,
  createSession,
  getSession,
  invalidateUserSessions,
} from './session';
import redis from './redis';

describe('Session Infrastructure', () => {
  describe('Cookie Signing and Unsigning', () => {
    it('signs and correctly unsigns a valid session ID', () => {
      const sessionId = generateSessionId();
      const signed = signSessionCookie(sessionId);

      expect(signed.startsWith('s:')).toBe(true);
      expect(signed).toContain('.');

      const unsigned = unsignSessionCookie(signed);
      expect(unsigned).toBe(sessionId);
    });

    it('returns false when trying to unsign a tampered cookie', () => {
      const sessionId = generateSessionId();
      const signed = signSessionCookie(sessionId);
      const tampered = signed.slice(0, -4) + 'abcd';

      const result = unsignSessionCookie(tampered);
      expect(result).toBe(false);
    });

    it('returns false for malformed cookie strings', () => {
      expect(unsignSessionCookie('invalid_string')).toBe(false);
      expect(unsignSessionCookie('')).toBe(false);
      expect(unsignSessionCookie('s:nosignature')).toBe(false);
    });
  });

  describe('Redis Session Operations', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('creates a session with TTL and records user session mapping', async () => {
      const mockPipeline = {
        set: vi.fn().mockReturnThis(),
        sadd: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      vi.spyOn(redis, 'pipeline').mockReturnValue(mockPipeline as any);

      const userId = 'user_123';
      const email = 'test@example.com';
      const session = await createSession(userId, email, 3600);

      expect(session.userId).toBe(userId);
      expect(session.email).toBe(email);
      expect(session.sessionId).toBeDefined();
      expect(mockPipeline.set).toHaveBeenCalledWith(
        `session:${session.sessionId}`,
        expect.any(String),
        'EX',
        3600,
      );
      expect(mockPipeline.sadd).toHaveBeenCalledWith(`user_sessions:${userId}`, session.sessionId);
    });

    it('retrieves an active session from Redis', async () => {
      const sampleSession = {
        sessionId: 'test_session_123',
        userId: 'user_123',
        email: 'test@example.com',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      vi.spyOn(redis, 'get').mockResolvedValue(JSON.stringify(sampleSession));

      const session = await getSession('test_session_123');
      expect(session).toEqual(sampleSession);
    });

    it('returns null if session is expired or not found', async () => {
      vi.spyOn(redis, 'get').mockResolvedValue(null);
      const session = await getSession('non_existent');
      expect(session).toBeNull();
    });

    it('invalidates all active sessions for a user', async () => {
      vi.spyOn(redis, 'smembers').mockResolvedValue(['sess_1', 'sess_2'] as any);
      const mockPipeline = {
        del: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      vi.spyOn(redis, 'pipeline').mockReturnValue(mockPipeline as any);

      await invalidateUserSessions('user_123');

      expect(mockPipeline.del).toHaveBeenCalledWith('session:sess_1');
      expect(mockPipeline.del).toHaveBeenCalledWith('session:sess_2');
      expect(mockPipeline.del).toHaveBeenCalledWith('user_sessions:user_123');
    });
  });
});
