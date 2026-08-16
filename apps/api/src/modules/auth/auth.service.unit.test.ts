import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import * as passwordUtils from '../../infrastructure/password';

describe('AuthService Unit Tests', () => {
  let authService: AuthService;
  let mockRepo: Partial<AuthRepository>;

  beforeEach(() => {
    mockRepo = {
      findUserByEmail: vi.fn(),
      findUserById: vi.fn(),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn(),
      touchSession: vi.fn(),
      deleteSession: vi.fn(),
      invalidateUserSessions: vi.fn(),
      storePasswordResetToken: vi.fn(),
      getPasswordResetTokenUserId: vi.fn(),
      deletePasswordResetToken: vi.fn(),
    };
    authService = new AuthService(mockRepo as AuthRepository);
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('registers a new user and generates a session', async () => {
      (mockRepo.findUserByEmail as any).mockResolvedValue(null);
      (mockRepo.createUser as any).mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (mockRepo.createSession as any).mockResolvedValue({
        sessionId: 'sess_123',
        userId: 'u1',
        email: 'test@example.com',
        createdAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      const res = await authService.register({
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      });

      expect(res.user.email).toBe('test@example.com');
      expect(res.session?.sessionId).toBe('sess_123');
      expect(mockRepo.createUser).toHaveBeenCalled();
      expect(mockRepo.createSession).toHaveBeenCalledWith('u1', 'test@example.com');
    });

    it('throws 409 conflict when email is already registered', async () => {
      (mockRepo.findUserByEmail as any).mockResolvedValue({ id: 'u1', email: 'test@example.com' });

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'Password123!',
          name: 'Test User',
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT',
      });
    });
  });

  describe('login', () => {
    it('authenticates user with valid credentials', async () => {
      (mockRepo.findUserByEmail as any).mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        passwordHash: 'hashed_pw',
        name: 'Test User',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.spyOn(passwordUtils, 'verifyPassword').mockResolvedValue(true);
      (mockRepo.createSession as any).mockResolvedValue({
        sessionId: 'sess_login',
        userId: 'u1',
        email: 'test@example.com',
        createdAt: Date.now(),
        expiresAt: Date.now() + 10000,
      });

      const res = await authService.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(res.user.id).toBe('u1');
      expect(res.session?.sessionId).toBe('sess_login');
    });

    it('rejects invalid password with 401', async () => {
      (mockRepo.findUserByEmail as any).mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        passwordHash: 'hashed_pw',
      });
      vi.spyOn(passwordUtils, 'verifyPassword').mockResolvedValue(false);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
      });
    });
  });

  describe('logout & password reset', () => {
    it('deletes session from repository on logout', async () => {
      await authService.logout('sess_123');
      expect(mockRepo.deleteSession).toHaveBeenCalledWith('sess_123');
    });

    it('invalidates all user sessions when confirming password reset', async () => {
      (mockRepo.getPasswordResetTokenUserId as any).mockResolvedValue('u1');
      (mockRepo.updateUser as any).mockResolvedValue({ id: 'u1' });

      await authService.confirmPasswordReset({
        token: 'valid_token',
        newPassword: 'NewPassword123!',
      });

      expect(mockRepo.updateUser).toHaveBeenCalledWith('u1', expect.any(Object));
      expect(mockRepo.deletePasswordResetToken).toHaveBeenCalledWith('valid_token');
      expect(mockRepo.invalidateUserSessions).toHaveBeenCalledWith('u1');
    });
  });
});
