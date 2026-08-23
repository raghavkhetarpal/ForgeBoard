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

// Project Role Enum
export type ProjectRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

export const PROJECT_ROLES: Record<ProjectRole, ProjectRole> = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
};

export const PROJECT_ROLE_HIERARCHY: Record<ProjectRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
};

// Project Status Enum
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';

// Project DTO
export interface ProjectDto {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  deadline: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Project Member DTO
export interface ProjectMemberDto {
  id: string;
  projectId: string;
  workspaceId: string;
  userId: string;
  role: ProjectRole;
  createdAt: Date | string;
  updatedAt: Date | string;
  user?: UserDto;
  project?: ProjectDto;
}

// Project Membership Context
export interface ProjectMembershipContext {
  projectId: string;
  workspaceId: string;
  userId: string;
  role: ProjectRole;
  isImplicitAdmin: boolean;
}

// Issue Status Enum
export type IssueStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';

// Issue Priority Enum
export type IssuePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// Issue DTO
export interface IssueDto {
  id: string;
  workspaceId: string;
  projectId: string;
  creatorId: string;
  assigneeId: string | null;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  dueDate: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  creator?: UserDto;
  assignee?: UserDto;
}
