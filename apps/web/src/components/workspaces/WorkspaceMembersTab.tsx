"use client";

import React, { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { WorkspaceMemberDto, WorkspaceRole, ROLE_HIERARCHY } from '@forgeboard/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  LogOut,
  AlertCircle,
  Clock,
  Mail,
  User,
  CheckCircle2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface WorkspaceMembersTabProps {
  workspaceId: string;
  members: WorkspaceMemberDto[];
  currentUserId?: string;
  currentUserRole: WorkspaceRole;
  onMembersChange: () => void;
}

const ROLE_BADGE_STYLES: Record<WorkspaceRole, string> = {
  OWNER: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  ADMIN: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  MEMBER: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  VIEWER: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700',
};

export function WorkspaceMembersTab({
  workspaceId,
  members,
  currentUserId,
  currentUserRole,
  onMembersChange,
}: WorkspaceMembersTabProps) {
  const router = useRouter();

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('MEMBER');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Remove confirmation modal state
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMemberDto | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Leave confirmation modal state
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  // Mutation error
  const [actionError, setActionError] = useState<string | null>(null);

  const canManageMembers =
    currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    setInviteLoading(true);

    try {
      await apiFetch(`/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      setInviteSuccess(`Invitation successfully processed for ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('MEMBER');
      onMembersChange();
      setTimeout(() => {
        setIsInviteOpen(false);
        setInviteSuccess(null);
      }, 1200);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setInviteError(err.message || 'Failed to invite member.');
      } else if (err instanceof Error) {
        setInviteError(err.message);
      } else {
        setInviteError('An unexpected error occurred.');
      }
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: WorkspaceRole) => {
    setActionError(null);
    try {
      await apiFetch(`/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      onMembersChange();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(err.message || 'Failed to update member role.');
      } else if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError('An unexpected error occurred while updating role.');
      }
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setRemoveLoading(true);
    setRemoveError(null);

    try {
      await apiFetch(`/workspaces/${workspaceId}/members/${memberToRemove.id}`, {
        method: 'DELETE',
      });
      setMemberToRemove(null);
      onMembersChange();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setRemoveError(err.message || 'Failed to remove member.');
      } else if (err instanceof Error) {
        setRemoveError(err.message);
      } else {
        setRemoveError('An unexpected error occurred.');
      }
    } finally {
      setRemoveLoading(false);
    }
  };

  const handleLeaveWorkspace = async () => {
    setLeaveLoading(true);
    setLeaveError(null);

    try {
      await apiFetch(`/workspaces/${workspaceId}/leave`, {
        method: 'POST',
      });
      router.push('/dashboard');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setLeaveError(err.message || 'Failed to leave workspace.');
      } else if (err instanceof Error) {
        setLeaveError(err.message);
      } else {
        setLeaveError('An unexpected error occurred.');
      }
    } finally {
      setLeaveLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span>Workspace Members</span>
          </h2>
          <p className="text-xs text-foreground/60">
            Manage team members, roles, and administrative access for this workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManageMembers && (
            <Button
              onClick={() => setIsInviteOpen(true)}
              className="h-8 px-3 text-xs flex items-center gap-1.5 shadow-xs"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Invite Member</span>
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => setIsLeaveOpen(true)}
            className="h-8 px-3 text-xs flex items-center gap-1.5 text-foreground/70 hover:text-red-600 hover:border-red-300 dark:hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Leave Workspace</span>
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Members List Table */}
      <div className="rounded-xl border border-border bg-background overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-foreground/5 border-b border-border text-foreground/60 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Joined</th>
                {canManageMembers && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => {
                const isCurrentUser = member.userId === currentUserId;
                const memberRoleRank = ROLE_HIERARCHY[member.role];

                // Permission rules:
                // 1. Can change role if requester rank > target member rank, OR if requester is OWNER.
                // 2. Admins cannot modify Owner or Admin.
                const canModifyThisMember =
                  canManageMembers &&
                  !isCurrentUser &&
                  (currentUserRole === 'OWNER' ||
                    (currentUserRole === 'ADMIN' && memberRoleRank < ROLE_HIERARCHY.ADMIN));

                return (
                  <tr key={member.id} className="hover:bg-foreground/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary shrink-0">
                          {member.user?.name?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <span>{member.user?.name || 'Unknown User'}</span>
                            {isCurrentUser && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-medium">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-foreground/50 flex items-center gap-1 mt-0.5 font-mono text-[11px]">
                            <Mail className="h-3 w-3" />
                            <span>{member.user?.email || 'No email'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {canModifyThisMember ? (
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleRoleChange(member.id, e.target.value as WorkspaceRole)
                          }
                          className="text-xs font-semibold rounded-md border border-border bg-background px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {currentUserRole === 'OWNER' && (
                            <option value="OWNER">OWNER</option>
                          )}
                          <option value="ADMIN">ADMIN</option>
                          <option value="MEMBER">MEMBER</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            ROLE_BADGE_STYLES[member.role] || ROLE_BADGE_STYLES.VIEWER
                          }`}
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          {member.role}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-foreground/50">
                      <div className="flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(member.createdAt).toLocaleDateString()}</span>
                      </div>
                    </td>

                    {canManageMembers && (
                      <td className="py-3 px-4 text-right">
                        {canModifyThisMember && member.role !== 'OWNER' && (
                          <Button
                            variant="outline"
                            onClick={() => setMemberToRemove(member)}
                            className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:border-red-300 dark:text-red-400"
                            title="Remove member"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => !inviteLoading && setIsInviteOpen(false)}
        title="Invite Workspace Member"
      >
        <form onSubmit={handleInviteSubmit} className="space-y-4">
          <p className="text-xs text-foreground/60">
            Invite a teammate by email. If they already have an account, they will be granted immediate access; otherwise an invitation email will be dispatched.
          </p>

          {inviteError && (
            <div className="p-3 rounded-md bg-red-50 text-red-600 border border-red-200 text-xs flex items-center gap-2 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{inviteError}</span>
            </div>
          )}

          {inviteSuccess && (
            <div className="p-3 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs flex items-center gap-2 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{inviteSuccess}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Email Address</label>
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              required
              disabled={inviteLoading}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Assigned Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
              disabled={inviteLoading}
              className="w-full text-xs rounded-md border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="MEMBER">MEMBER — standard read & write permissions</option>
              <option value="ADMIN">ADMIN — project creation & team management</option>
              <option value="VIEWER">VIEWER — read-only access</option>
              {currentUserRole === 'OWNER' && (
                <option value="OWNER">OWNER — full control & ownership</option>
              )}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsInviteOpen(false)}
              disabled={inviteLoading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={inviteLoading} className="text-xs">
              {inviteLoading ? 'Inviting...' : 'Send Invitation'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Remove Member Confirmation Modal */}
      <Modal
        isOpen={Boolean(memberToRemove)}
        onClose={() => !removeLoading && setMemberToRemove(null)}
        title="Remove Member from Workspace"
      >
        <div className="space-y-4">
          <p className="text-xs text-foreground/70">
            Are you sure you want to remove{' '}
            <strong className="text-foreground">{memberToRemove?.user?.name || 'this member'}</strong>{' '}
            ({memberToRemove?.user?.email}) from the workspace? They will immediately lose access to all projects and issues within this workspace.
          </p>

          {removeError && (
            <div className="p-3 rounded-md bg-red-50 text-red-600 border border-red-200 text-xs flex items-center gap-2 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{removeError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setMemberToRemove(null)}
              disabled={removeLoading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRemoveMember}
              disabled={removeLoading}
              className="text-xs"
            >
              {removeLoading ? 'Removing...' : 'Remove Member'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Leave Workspace Confirmation Modal */}
      <Modal
        isOpen={isLeaveOpen}
        onClose={() => !leaveLoading && setIsLeaveOpen(false)}
        title="Leave Workspace"
      >
        <div className="space-y-4">
          <p className="text-xs text-foreground/70">
            Are you sure you want to leave this workspace? You will lose access until another team member re-invites you.
          </p>

          {leaveError && (
            <div className="p-3 rounded-md bg-red-50 text-red-600 border border-red-200 text-xs flex items-center gap-2 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{leaveError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setIsLeaveOpen(false)}
              disabled={leaveLoading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleLeaveWorkspace}
              disabled={leaveLoading}
              className="text-xs"
            >
              {leaveLoading ? 'Leaving...' : 'Leave Workspace'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
