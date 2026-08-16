import { UserDto, SessionData } from '@forgeboard/types';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RequestPasswordResetInput {
  email: string;
}

export interface ConfirmPasswordResetInput {
  token: string;
  newPassword: string;
}

export interface UpdateProfileInput {
  name?: string;
  avatarUrl?: string | null;
}

export interface AuthResponse {
  user: UserDto;
  session?: {
    sessionId: string;
    expiresAt: number;
  };
}

export interface SessionResponse {
  user: UserDto;
  session: SessionData;
}
