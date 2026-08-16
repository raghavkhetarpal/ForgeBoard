import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesRepository } from './workspaces.repository';

describe('WorkspacesService Unit Tests', () => {
  let workspacesService: WorkspacesService;
  let mockRepo: Partial<WorkspacesRepository>;

  beforeEach(() => {
    mockRepo = {
      findWorkspaceById: vi.fn(),
      findWorkspaceBySlug: vi.fn(),
      listUserWorkspaces: vi.fn(),
      createWorkspaceWithOwner: vi.fn(),
      findMember: vi.fn(),
      findMemberById: vi.fn(),
      findUserByEmail: vi.fn(),
      addMember: vi.fn(),
      updateMemberRole: vi.fn(),
      deleteMember: vi.fn(),
      countWorkspaceOwners: vi.fn(),
      invalidateUserSessions: vi.fn(),
    };
    workspacesService = new WorkspacesService(mockRepo as WorkspacesRepository);
    vi.clearAllMocks();
  });

  describe('createWorkspace', () => {
    it('creates workspace and assigns requester as OWNER', async () => {
      (mockRepo.findWorkspaceBySlug as any).mockResolvedValue(null);
      (mockRepo.createWorkspaceWithOwner as any).mockResolvedValue({
        workspace: {
          id: 'ws_1',
          name: 'Engineering',
          slug: 'engineering-1234',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        member: {
          id: 'mem_1',
          workspaceId: 'ws_1',
          userId: 'user_1',
          role: 'OWNER',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const res = await workspacesService.createWorkspace('user_1', { name: 'Engineering' });

      expect(res.workspace.id).toBe('ws_1');
      expect(res.member.role).toBe('OWNER');
      expect(mockRepo.createWorkspaceWithOwner).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Engineering', ownerUserId: 'user_1' }),
      );
    });

    it('rejects duplicate slug with 409 conflict', async () => {
      (mockRepo.findWorkspaceBySlug as any).mockResolvedValue({ id: 'ws_existing' });

      await expect(
        workspacesService.createWorkspace('user_1', { name: 'Engineering', slug: 'engineering' }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT',
      });
    });
  });

  describe('inviteMember', () => {
    it('invites an existing user and creates workspace membership', async () => {
      (mockRepo.findMember as any).mockImplementation((wsId: string, uId: string) => {
        if (uId === 'owner_1') return Promise.resolve({ role: 'OWNER' });
        return Promise.resolve(null);
      });
      (mockRepo.findWorkspaceById as any).mockResolvedValue({ id: 'ws_1', name: 'Engineering' });
      (mockRepo.findUserByEmail as any).mockResolvedValue({ id: 'target_user', email: 'colleague@example.com' });
      (mockRepo.addMember as any).mockResolvedValue({
        id: 'mem_2',
        workspaceId: 'ws_1',
        userId: 'target_user',
        role: 'MEMBER',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await workspacesService.inviteMember('ws_1', 'owner_1', 'Owner', {
        email: 'colleague@example.com',
        role: 'MEMBER',
      });

      expect(res.member?.role).toBe('MEMBER');
      expect(mockRepo.addMember).toHaveBeenCalledWith('ws_1', 'target_user', 'MEMBER');
    });

    it('denies invitation if requester is not OWNER or ADMIN', async () => {
      (mockRepo.findMember as any).mockResolvedValue({ role: 'MEMBER' });

      await expect(
        workspacesService.inviteMember('ws_1', 'member_1', 'Member', {
          email: 'colleague@example.com',
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });
  });

  describe('updateMemberRole', () => {
    it('updates role and invalidates Redis sessions for modified member', async () => {
      (mockRepo.findMember as any).mockResolvedValue({ role: 'OWNER' });
      (mockRepo.findMemberById as any).mockResolvedValue({
        id: 'mem_2',
        workspaceId: 'ws_1',
        userId: 'target_user_1',
        role: 'MEMBER',
      });
      (mockRepo.updateMemberRole as any).mockResolvedValue({
        id: 'mem_2',
        workspaceId: 'ws_1',
        userId: 'target_user_1',
        role: 'ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await workspacesService.updateMemberRole('ws_1', 'mem_2', 'owner_1', {
        role: 'ADMIN',
      });

      expect(res.member.role).toBe('ADMIN');
      expect(mockRepo.updateMemberRole).toHaveBeenCalledWith('mem_2', 'ADMIN');
      expect(mockRepo.invalidateUserSessions).toHaveBeenCalledWith('target_user_1');
    });

    it('prevents ADMIN from promoting someone to OWNER', async () => {
      (mockRepo.findMember as any).mockResolvedValue({ role: 'ADMIN' });
      (mockRepo.findMemberById as any).mockResolvedValue({
        id: 'mem_2',
        workspaceId: 'ws_1',
        userId: 'target_user_1',
        role: 'MEMBER',
      });

      await expect(
        workspacesService.updateMemberRole('ws_1', 'mem_2', 'admin_1', { role: 'OWNER' }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('prevents downgrading the only OWNER in workspace', async () => {
      (mockRepo.findMember as any).mockResolvedValue({ role: 'OWNER' });
      (mockRepo.findMemberById as any).mockResolvedValue({
        id: 'mem_owner',
        workspaceId: 'ws_1',
        userId: 'owner_1',
        role: 'OWNER',
      });
      (mockRepo.countWorkspaceOwners as any).mockResolvedValue(1);

      await expect(
        workspacesService.updateMemberRole('ws_1', 'mem_owner', 'owner_1', { role: 'ADMIN' }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'BAD_REQUEST',
      });
    });
  });

  describe('removeMember', () => {
    it('removes member and invalidates their Redis sessions', async () => {
      (mockRepo.findMember as any).mockResolvedValue({ role: 'OWNER' });
      (mockRepo.findMemberById as any).mockResolvedValue({
        id: 'mem_2',
        workspaceId: 'ws_1',
        userId: 'user_to_remove',
        role: 'MEMBER',
      });

      const res = await workspacesService.removeMember('ws_1', 'mem_2', 'owner_1');

      expect(res.success).toBe(true);
      expect(mockRepo.deleteMember).toHaveBeenCalledWith('mem_2');
      expect(mockRepo.invalidateUserSessions).toHaveBeenCalledWith('user_to_remove');
    });

    it('prevents removing the workspace OWNER', async () => {
      (mockRepo.findMember as any).mockResolvedValue({ role: 'OWNER' });
      (mockRepo.findMemberById as any).mockResolvedValue({
        id: 'mem_owner',
        workspaceId: 'ws_1',
        userId: 'owner_1',
        role: 'OWNER',
      });

      await expect(
        workspacesService.removeMember('ws_1', 'mem_owner', 'owner_1'),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'BAD_REQUEST',
      });
    });

    it('prevents an ADMIN from removing another ADMIN', async () => {
      (mockRepo.findMember as any).mockResolvedValue({ role: 'ADMIN' });
      (mockRepo.findMemberById as any).mockResolvedValue({
        id: 'mem_admin_2',
        workspaceId: 'ws_1',
        userId: 'admin_2',
        role: 'ADMIN',
      });

      await expect(
        workspacesService.removeMember('ws_1', 'mem_admin_2', 'admin_1'),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });
  });

  describe('leaveWorkspace', () => {
    it('prevents sole OWNER from leaving without transferring ownership', async () => {
      (mockRepo.findMember as any).mockResolvedValue({ id: 'mem_1', role: 'OWNER' });
      (mockRepo.countWorkspaceOwners as any).mockResolvedValue(1);

      await expect(
        workspacesService.leaveWorkspace('ws_1', 'owner_1'),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'BAD_REQUEST',
      });
    });
  });
});
