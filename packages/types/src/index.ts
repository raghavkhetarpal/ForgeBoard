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

// User Workspace DTO (returned by GET /api/workspaces for authenticated user)
export interface UserWorkspaceDto extends WorkspaceDto {
  role: WorkspaceRole;
  joinedAt: Date | string;
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

export interface IssuePullRequestDto {
  id: string;
  issueId: string;
  githubRepositoryId: string;
  prNumber: number;
  prStatus: string;
  prUrl: string;
  linkedAt: Date | string;
}

// Milestone Status Enum
export type MilestoneStatus = 'OPEN' | 'CLOSED';

export const MILESTONE_STATUSES: Record<MilestoneStatus, MilestoneStatus> = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
};

// Milestone DTO
export interface MilestoneDto {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: MilestoneStatus;
  startDate: Date | string | null;
  dueDate: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface MilestoneWithProgressDto extends MilestoneDto {
  totalIssues: number;
  completedIssues: number;
  openIssues: number;
  progress: number;
}

export interface CreateMilestoneInput {
  name: string;
  description?: string | null;
  status?: MilestoneStatus;
  startDate?: string | null;
  dueDate?: string | null;
}

export interface UpdateMilestoneInput {
  name?: string;
  description?: string | null;
  status?: MilestoneStatus;
  startDate?: string | null;
  dueDate?: string | null;
}

// Issue DTO
export interface IssueDto {
  id: string;
  workspaceId: string;
  projectId: string;
  creatorId: string;
  assigneeId: string | null;
  milestoneId?: string | null;
  title: string;
  description: string | null;
  status: IssueStatus;
  position: number;
  priority: IssuePriority;
  dueDate: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  creator?: UserDto;
  assignee?: UserDto;
  milestone?: MilestoneDto | null;
  labels?: LabelDto[];
  comments?: CommentDto[];
  pullRequests?: IssuePullRequestDto[];
}

export interface LinkPullRequestInput {
  repoId: string;
  prNumber: number;
}

export interface ConnectGithubRepoInput {
  owner: string;
  repo: string;
}

export interface CreateIssueInput {
  title: string;
  description?: string | null;
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeId?: string | null;
  milestoneId?: string | null;
  dueDate?: string | null;
}

export interface UpdateIssueInput {
  title?: string;
  description?: string | null;
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeId?: string | null;
  milestoneId?: string | null;
  dueDate?: string | null;
}

export interface MoveIssueInput {
  status: IssueStatus;
  position: number;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface PaginatedIssuesResponse {
  issues: IssueDto[];
  pagination: PaginationMeta;
}

export interface IssueQueryFilters {
  q?: string;
  status?: IssueStatus | 'ALL';
  priority?: IssuePriority | 'ALL';
  assigneeId?: string;
  labelId?: string;
  milestoneId?: string;
  cursor?: string;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'position' | 'dueDate' | 'title';
  sortOrder?: 'asc' | 'desc';
  all?: boolean;
}

// Label DTO
export interface LabelDto {
  id: string;
  projectId: string;
  name: string;
  color: string;
  createdAt: Date | string;
}

export interface CreateLabelInput {
  name: string;
  color: string;
}

export interface UpdateLabelInput {
  name?: string;
  color?: string;
}

export interface CommentDto {
  id: string;
  issueId: string;
  authorId: string;
  content: string;
  edited: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  author?: UserDto;
}

export interface CreateCommentInput {
  content: string;
}

export interface UpdateCommentInput {
  content: string;
}

export type NotificationType = 'MENTION' | 'ASSIGNMENT' | 'COMMENT';

export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  sourceType: string;
  sourceId: string;
  message: string;
  read: boolean;
  createdAt: Date | string;
}

export interface ActivityActorDto {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface ActivityDto {
  id: string;
  projectId: string;
  workspaceId: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date | string;
  actor?: ActivityActorDto | null;
}

export interface GithubIntegrationDto {
  id: string;
  projectId: string;
  workspaceId: string;
  installedByUserId: string;
  githubAccountLogin: string;
  connectedAt: Date;
}

export interface GithubRepositoryDto {
  id: string;
  integrationId: string;
  projectId: string;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  connectedAt: Date;
}

export interface GithubPullRequestDto {
  number: number;
  title: string;
  author: string;
  status: 'open' | 'closed' | 'merged';
  url: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GithubAvailableRepoDto {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
}

// Real-Time Socket.IO Event Payloads
export interface IssueCreatedSocketEvent {
  issue: IssueDto;
}

export interface IssueUpdatedSocketEvent {
  issue: IssueDto;
}

export interface IssueDeletedSocketEvent {
  issueId: string;
  projectId: string;
}

export interface CommentCreatedSocketEvent {
  comment: CommentDto;
}

export interface CommentUpdatedSocketEvent {
  comment: CommentDto;
}

export interface CommentDeletedSocketEvent {
  commentId: string;
  issueId: string;
  projectId: string;
}

export interface NotificationCreatedSocketEvent {
  notification: NotificationDto;
}

export interface ActivityCreatedSocketEvent {
  activity: ActivityDto;
}

export interface MilestoneCreatedSocketEvent {
  milestone: MilestoneWithProgressDto;
}

export interface MilestoneUpdatedSocketEvent {
  milestone: MilestoneWithProgressDto;
}

export interface MilestoneDeletedSocketEvent {
  milestoneId: string;
  projectId: string;
}

export interface LabelCreatedSocketEvent {
  label: LabelDto;
}

export interface LabelUpdatedSocketEvent {
  label: LabelDto;
}

export interface LabelDeletedSocketEvent {
  labelId: string;
  projectId: string;
}

// Workspace & Project Management Responses
export interface UpdateWorkspaceResponse {
  data: {
    workspace: WorkspaceDto;
  };
}

export interface ListProjectMembersResponse {
  members: ProjectMemberDto[];
}

export interface AddProjectMemberResponse {
  member: ProjectMemberDto;
}

export interface UpdateProjectMemberResponse {
  member: ProjectMemberDto;
}
