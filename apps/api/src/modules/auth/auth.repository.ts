import prisma from '../../infrastructure/prisma';
import redis from '../../infrastructure/redis';
import {
  createSession as createRedisSession,
  getSession as getRedisSession,
  touchSession as touchRedisSession,
  deleteSession as deleteRedisSession,
  invalidateUserSessions as invalidateUserRedisSessions,
} from '../../infrastructure/session';
import { SessionData } from '@forgeboard/types';

const RESET_TOKEN_PREFIX = 'pwd_reset:';
const DEFAULT_RESET_TOKEN_TTL = 3600; // 1 hour

export class AuthRepository {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createUser(data: { email: string; passwordHash: string; name: string }) {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateUser(
    id: string,
    data: { name?: string; avatarUrl?: string | null; passwordHash?: string },
  ) {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createSession(userId: string, email: string): Promise<SessionData> {
    return createRedisSession(userId, email);
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    return getRedisSession(sessionId);
  }

  async touchSession(sessionId: string): Promise<void> {
    return touchRedisSession(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    return deleteRedisSession(sessionId);
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    return invalidateUserRedisSessions(userId);
  }

  async storePasswordResetToken(
    token: string,
    userId: string,
    ttlSeconds: number = DEFAULT_RESET_TOKEN_TTL,
  ): Promise<void> {
    const key = `${RESET_TOKEN_PREFIX}${token}`;
    await redis.set(key, userId, 'EX', ttlSeconds);
  }

  async getPasswordResetTokenUserId(token: string): Promise<string | null> {
    const key = `${RESET_TOKEN_PREFIX}${token}`;
    return redis.get(key);
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    const key = `${RESET_TOKEN_PREFIX}${token}`;
    await redis.del(key);
  }
}

export const authRepository = new AuthRepository();
