import { WorkspaceDto, WorkspaceMemberDto, WorkspaceRole } from '@forgeboard/types';

export interface CreateWorkspaceInput {
  name: string;
  slug?: string;
}

export interface InviteMemberInput {
  email: string;
  role?: WorkspaceRole;
}

export interface UpdateMemberRoleInput {
  role: WorkspaceRole;
}

export interface WorkspaceWithMembers extends WorkspaceDto {
  members: WorkspaceMemberDto[];
}

export interface UserWorkspaceListItem extends WorkspaceDto {
  role: WorkspaceRole;
  joinedAt: Date | string;
}
