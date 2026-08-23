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
import { AppError } from '../../infrastructure/errors';
import { UserDto } from '@forgeboard/types';

export class AuthService {
  constructor(private repo: AuthRepository = authRepository) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await this.repo.findUserByEmail(input.email);
    if (existing) {
      throw new AppError('A user with this email already exists.', 409, 'CONFLICT');
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
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
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
      throw new AppError('Session is invalid or expired.', 401, 'UNAUTHORIZED');
    }

    const user = await this.repo.findUserById(session.userId);
    if (!user) {
      throw new AppError('User no longer exists.', 401, 'UNAUTHORIZED');
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
  }

  async confirmPasswordReset(input: ConfirmPasswordResetInput): Promise<void> {
    const userId = await this.repo.getPasswordResetTokenUserId(input.token);
    if (!userId) {
      throw new AppError('Password reset token is invalid or has expired.', 400, 'INVALID_TOKEN');
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
      throw new AppError('User not found.', 404, 'NOT_FOUND');
    }
    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserDto> {
    const user = await this.repo.updateUser(userId, input);
    return user;
  }
}

export const authService = new AuthService();
