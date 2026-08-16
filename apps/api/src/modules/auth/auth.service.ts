import crypto from 'crypto';
import { AuthRepository, authRepository } from './auth.repository';
import {
  RegisterInput,
  LoginInput,
  RequestPasswordResetInput,
  ConfirmPasswordResetInput,
  UpdateProfileInput,
  AuthResponse,
  SessionResponse,
} from './auth.types';
import { hashPassword, verifyPassword } from '../../infrastructure/password';
import { sendPasswordResetEmail } from '../../infrastructure/mailer';
import { UserDto } from '@forgeboard/types';

export class AuthService {
  constructor(private repo: AuthRepository = authRepository) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await this.repo.findUserByEmail(input.email);
    if (existing) {
      const error: any = new Error('A user with this email already exists.');
      error.statusCode = 409;
      error.code = 'CONFLICT';
      throw error;
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.repo.createUser({
      email: input.email,
      passwordHash,
      name: input.name,
    });

    const session = await this.repo.createSession(user.id, user.email);

    return {
      user,
      session: {
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
      },
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.repo.findUserByEmail(input.email);
    if (!user) {
      const error: any = new Error('Invalid email or password.');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      const error: any = new Error('Invalid email or password.');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    const session = await this.repo.createSession(user.id, user.email);

    const userDto: UserDto = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      user: userDto,
      session: {
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
      },
    };
  }

  async logout(sessionId: string): Promise<void> {
    if (sessionId) {
      await this.repo.deleteSession(sessionId);
    }
  }

  async refreshSession(sessionId: string): Promise<SessionResponse> {
    const session = await this.repo.getSession(sessionId);
    if (!session) {
      const error: any = new Error('Session is invalid or expired.');
      error.statusCode = 401;
      error.code = 'UNAUTHORIZED';
      throw error;
    }

    const user = await this.repo.findUserById(session.userId);
    if (!user) {
      const error: any = new Error('User no longer exists.');
      error.statusCode = 401;
      error.code = 'UNAUTHORIZED';
      throw error;
    }

    await this.repo.touchSession(sessionId);

    return {
      user,
      session,
    };
  }

  async requestPasswordReset(input: RequestPasswordResetInput): Promise<void> {
    const user = await this.repo.findUserByEmail(input.email);
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      await this.repo.storePasswordResetToken(resetToken, user.id);
      await sendPasswordResetEmail(user.email, resetToken);
    }
    // Always returns gracefully without leaking email existence
  }

  async confirmPasswordReset(input: ConfirmPasswordResetInput): Promise<void> {
    const userId = await this.repo.getPasswordResetTokenUserId(input.token);
    if (!userId) {
      const error: any = new Error('Password reset token is invalid or has expired.');
      error.statusCode = 400;
      error.code = 'INVALID_TOKEN';
      throw error;
    }

    const passwordHash = await hashPassword(input.newPassword);
    await this.repo.updateUser(userId, { passwordHash });
    await this.repo.deletePasswordResetToken(input.token);

    // Logging out or resetting password MUST invalidate all active sessions in Redis
    await this.repo.invalidateUserSessions(userId);
  }

  async getProfile(userId: string): Promise<UserDto> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      const error: any = new Error('User not found.');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserDto> {
    const user = await this.repo.updateUser(userId, input);
    return user;
  }
}

export const authService = new AuthService();
