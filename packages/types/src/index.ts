// Workspace Role Enum
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export const WORKSPACE_ROLES: Record<WorkspaceRole, WorkspaceRole> = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
};

// Role hierarchy rank (higher number = more privileges)
export const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

// User DTO
export interface UserDto {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Workspace DTO
export interface WorkspaceDto {
  id: string;
  name: string;
  slug: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Workspace Member DTO
export interface WorkspaceMemberDto {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: Date | string;
  updatedAt: Date | string;
  user?: UserDto;
  workspace?: WorkspaceDto;
}

// Session Data
export interface SessionData {
  sessionId: string;
  userId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  workspaceRoles?: Record<string, WorkspaceRole>;
}

// Authenticated Request User Context
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

// Workspace Membership Context
export interface WorkspaceMembershipContext {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}
