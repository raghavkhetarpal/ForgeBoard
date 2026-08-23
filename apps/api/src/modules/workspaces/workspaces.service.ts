import { WorkspacesRepository, workspacesRepository } from './workspaces.repository';
import {
  CreateWorkspaceInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
} from './workspaces.types';
import { WorkspaceRole, ROLE_HIERARCHY, WorkspaceDto, WorkspaceMemberDto } from '@forgeboard/types';
import { sendWorkspaceInviteEmail } from '../../infrastructure/mailer';
import { AppError } from '../../infrastructure/errors';

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
      throw new AppError(`Workspace with slug "${slug}" already exists.`, 409, 'CONFLICT');
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
      throw new AppError('You are not a member of this workspace.', 403, 'FORBIDDEN');
    }

    const workspace = await this.repo.findWorkspaceById(workspaceId);
    if (!workspace) {
      throw new AppError('Workspace not found.', 404, 'NOT_FOUND');
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
      throw new AppError('Only Workspace Owners and Admins can invite new members.', 403, 'FORBIDDEN');
    }

    const roleToAssign = input.role || 'MEMBER';
    if (roleToAssign === 'OWNER' && requesterMembership.role !== 'OWNER') {
      throw new AppError('Only the workspace owner can assign the OWNER role.', 403, 'FORBIDDEN');
    }

    const workspace = await this.repo.findWorkspaceById(workspaceId);
    if (!workspace) {
      throw new AppError('Workspace not found.', 404, 'NOT_FOUND');
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
      throw new AppError('User is already a member of this workspace.', 409, 'CONFLICT');
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
      throw new AppError('Only Workspace Owners and Admins can modify member roles.', 403, 'FORBIDDEN');
    }

    const targetMember = await this.repo.findMemberById(memberId);
    if (!targetMember || targetMember.workspaceId !== workspaceId) {
      throw new AppError('Member not found in this workspace.', 404, 'NOT_FOUND');
    }

    const requesterRole = requesterMembership.role as WorkspaceRole;
    const targetRole = targetMember.role as WorkspaceRole;

    // Rule: Admins cannot modify role of an Owner or fellow Admin, and cannot promote to Owner
    if (requesterRole === 'ADMIN') {
      if (targetRole === 'OWNER' || targetRole === 'ADMIN') {
        throw new AppError('Admins cannot modify roles of other Admins or Owners.', 403, 'FORBIDDEN');
      }
      if (input.role === 'OWNER') {
        throw new AppError('Admins cannot promote members to Owner.', 403, 'FORBIDDEN');
      }
    }

    // If target is currently OWNER and being changed to a non-OWNER role, ensure another OWNER exists
    if (targetRole === 'OWNER' && input.role !== 'OWNER') {
      const ownerCount = await this.repo.countWorkspaceOwners(workspaceId);
      if (ownerCount <= 1) {
        throw new AppError('Cannot downgrade the only workspace owner.', 400, 'BAD_REQUEST');
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
      throw new AppError('Only Workspace Owners and Admins can remove members.', 403, 'FORBIDDEN');
    }

    const targetMember = await this.repo.findMemberById(memberId);
    if (!targetMember || targetMember.workspaceId !== workspaceId) {
      throw new AppError('Member not found in this workspace.', 404, 'NOT_FOUND');
    }

    if (targetMember.role === 'OWNER') {
      throw new AppError('Workspace Owner cannot be removed from workspace.', 400, 'BAD_REQUEST');
    }

    if (requesterMembership.role === 'ADMIN' && targetMember.role === 'ADMIN') {
      throw new AppError('Admins cannot remove other Admins from the workspace.', 403, 'FORBIDDEN');
    }

    await this.repo.deleteMember(memberId);

    // Invalidating Redis sessions for the removed user is the cornerstone of server-side sessions
    await this.repo.invalidateUserSessions(targetMember.userId);

    return { success: true, message: 'Member removed from workspace successfully.' };
  }

  async leaveWorkspace(workspaceId: string, userId: string) {
    const membership = await this.repo.findMember(workspaceId, userId);
    if (!membership) {
      throw new AppError('You are not a member of this workspace.', 404, 'NOT_FOUND');
    }

    if (membership.role === 'OWNER') {
      const ownerCount = await this.repo.countWorkspaceOwners(workspaceId);
      if (ownerCount <= 1) {
        throw new AppError('You are the sole Owner of this workspace. Transfer ownership before leaving.', 400, 'BAD_REQUEST');
      }
    }

    await this.repo.deleteMember(membership.id);
    await this.repo.invalidateUserSessions(userId);

    return { success: true, message: 'You have left the workspace.' };
  }
}

export const workspacesService = new WorkspacesService();
