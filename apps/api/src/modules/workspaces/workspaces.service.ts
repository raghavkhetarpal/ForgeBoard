import { WorkspacesRepository, workspacesRepository } from './workspaces.repository';
import {
  CreateWorkspaceInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
} from './workspaces.types';
import { WorkspaceRole, ROLE_HIERARCHY, WorkspaceDto, WorkspaceMemberDto } from '@forgeboard/types';
import { sendWorkspaceInviteEmail } from '../../infrastructure/mailer';

export class WorkspacesService {
  constructor(private repo: WorkspacesRepository = workspacesRepository) {}

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const suffix = Math.random().toString(36).substring(2, 6);
    return base ? `${base}-${suffix}` : `ws-${suffix}`;
  }

  async createWorkspace(userId: string, input: CreateWorkspaceInput) {
    let slug = input.slug?.toLowerCase().trim();
    if (!slug) {
      slug = this.generateSlug(input.name);
    }

    const existing = await this.repo.findWorkspaceBySlug(slug);
    if (existing) {
      const error: any = new Error(`Workspace with slug "${slug}" already exists.`);
      error.statusCode = 409;
      error.code = 'CONFLICT';
      throw error;
    }

    const { workspace, member } = await this.repo.createWorkspaceWithOwner({
      name: input.name.trim(),
      slug,
      ownerUserId: userId,
    });

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      } as WorkspaceDto,
      member: {
        id: member.id,
        workspaceId: member.workspaceId,
        userId: member.userId,
        role: member.role as WorkspaceRole,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
        user: member.user,
      } as WorkspaceMemberDto,
    };
  }

  async getUserWorkspaces(userId: string) {
    return this.repo.listUserWorkspaces(userId);
  }

  async getWorkspace(workspaceId: string, userId: string) {
    const membership = await this.repo.findMember(workspaceId, userId);
    if (!membership) {
      const error: any = new Error('You are not a member of this workspace.');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    const workspace = await this.repo.findWorkspaceById(workspaceId);
    if (!workspace) {
      const error: any = new Error('Workspace not found.');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
      members: workspace.members.map((m) => ({
        id: m.id,
        workspaceId: m.workspaceId,
        userId: m.userId,
        role: m.role as WorkspaceRole,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        user: m.user,
      })),
    };
  }

  async inviteMember(
    workspaceId: string,
    requesterUserId: string,
    requesterName: string,
    input: InviteMemberInput,
  ) {
    // Re-verify requester role server-side directly from DB
    const requesterMembership = await this.repo.findMember(workspaceId, requesterUserId);
    if (!requesterMembership || ROLE_HIERARCHY[requesterMembership.role as WorkspaceRole] < ROLE_HIERARCHY.ADMIN) {
      const error: any = new Error('Only Workspace Owners and Admins can invite new members.');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    const roleToAssign = input.role || 'MEMBER';
    if (roleToAssign === 'OWNER' && requesterMembership.role !== 'OWNER') {
      const error: any = new Error('Only the workspace owner can assign the OWNER role.');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    const workspace = await this.repo.findWorkspaceById(workspaceId);
    if (!workspace) {
      const error: any = new Error('Workspace not found.');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    const targetUser = await this.repo.findUserByEmail(input.email);
    if (!targetUser) {
      // Stub invite for non-existing user (dispatches email)
      await sendWorkspaceInviteEmail(input.email, workspace.name, requesterName);
      return {
        invited: true,
        email: input.email,
        role: roleToAssign,
        message: `Invitation email sent to ${input.email}`,
      };
    }

    // Check if target user is already a member
    const existingMember = await this.repo.findMember(workspaceId, targetUser.id);
    if (existingMember) {
      const error: any = new Error('User is already a member of this workspace.');
      error.statusCode = 409;
      error.code = 'CONFLICT';
      throw error;
    }

    const member = await this.repo.addMember(workspaceId, targetUser.id, roleToAssign);
    await sendWorkspaceInviteEmail(input.email, workspace.name, requesterName);

    return {
      member: {
        id: member.id,
        workspaceId: member.workspaceId,
        userId: member.userId,
        role: member.role as WorkspaceRole,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
        user: member.user,
      },
    };
  }

  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    requesterUserId: string,
    input: UpdateMemberRoleInput,
  ) {
    // Re-verify requester role server-side directly from DB
    const requesterMembership = await this.repo.findMember(workspaceId, requesterUserId);
    if (!requesterMembership || ROLE_HIERARCHY[requesterMembership.role as WorkspaceRole] < ROLE_HIERARCHY.ADMIN) {
      const error: any = new Error('Only Workspace Owners and Admins can modify member roles.');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    const targetMember = await this.repo.findMemberById(memberId);
    if (!targetMember || targetMember.workspaceId !== workspaceId) {
      const error: any = new Error('Member not found in this workspace.');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    const requesterRole = requesterMembership.role as WorkspaceRole;
    const targetRole = targetMember.role as WorkspaceRole;

    // Rule: Admins cannot modify role of an Owner or fellow Admin, and cannot promote to Owner
    if (requesterRole === 'ADMIN') {
      if (targetRole === 'OWNER' || targetRole === 'ADMIN') {
        const error: any = new Error('Admins cannot modify roles of other Admins or Owners.');
        error.statusCode = 403;
        error.code = 'FORBIDDEN';
        throw error;
      }
      if (input.role === 'OWNER') {
        const error: any = new Error('Admins cannot promote members to Owner.');
        error.statusCode = 403;
        error.code = 'FORBIDDEN';
        throw error;
      }
    }

    // If target is currently OWNER and being changed to a non-OWNER role, ensure another OWNER exists
    if (targetRole === 'OWNER' && input.role !== 'OWNER') {
      const ownerCount = await this.repo.countWorkspaceOwners(workspaceId);
      if (ownerCount <= 1) {
        const error: any = new Error('Cannot downgrade the only workspace owner.');
        error.statusCode = 400;
        error.code = 'BAD_REQUEST';
        throw error;
      }
    }

    const updated = await this.repo.updateMemberRole(memberId, input.role);

    // Invalidate Redis sessions for the modified member so their role change takes effect immediately
    await this.repo.invalidateUserSessions(targetMember.userId);

    return {
      member: {
        id: updated.id,
        workspaceId: updated.workspaceId,
        userId: updated.userId,
        role: updated.role as WorkspaceRole,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        user: updated.user,
      },
    };
  }

  async removeMember(workspaceId: string, memberId: string, requesterUserId: string) {
    // Re-verify requester role server-side directly from DB
    const requesterMembership = await this.repo.findMember(workspaceId, requesterUserId);
    if (!requesterMembership || ROLE_HIERARCHY[requesterMembership.role as WorkspaceRole] < ROLE_HIERARCHY.ADMIN) {
      const error: any = new Error('Only Workspace Owners and Admins can remove members.');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    const targetMember = await this.repo.findMemberById(memberId);
    if (!targetMember || targetMember.workspaceId !== workspaceId) {
      const error: any = new Error('Member not found in this workspace.');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    if (targetMember.role === 'OWNER') {
      const error: any = new Error('Workspace Owner cannot be removed from workspace.');
      error.statusCode = 400;
      error.code = 'BAD_REQUEST';
      throw error;
    }

    if (requesterMembership.role === 'ADMIN' && targetMember.role === 'ADMIN') {
      const error: any = new Error('Admins cannot remove other Admins from the workspace.');
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    await this.repo.deleteMember(memberId);

    // Invalidating Redis sessions for the removed user is the cornerstone of server-side sessions
    await this.repo.invalidateUserSessions(targetMember.userId);

    return { success: true, message: 'Member removed from workspace successfully.' };
  }

  async leaveWorkspace(workspaceId: string, userId: string) {
    const membership = await this.repo.findMember(workspaceId, userId);
    if (!membership) {
      const error: any = new Error('You are not a member of this workspace.');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    if (membership.role === 'OWNER') {
      const ownerCount = await this.repo.countWorkspaceOwners(workspaceId);
      if (ownerCount <= 1) {
        const error: any = new Error('You are the sole Owner of this workspace. Transfer ownership before leaving.');
        error.statusCode = 400;
        error.code = 'BAD_REQUEST';
        throw error;
      }
    }

    await this.repo.deleteMember(membership.id);
    await this.repo.invalidateUserSessions(userId);

    return { success: true, message: 'You have left the workspace.' };
  }
}

export const workspacesService = new WorkspacesService();
