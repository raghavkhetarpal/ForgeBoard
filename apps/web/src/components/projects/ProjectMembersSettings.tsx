"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import {
  ProjectMemberDto,
  WorkspaceMemberDto,
  ProjectRole,
  ListProjectMembersResponse,
  AddProjectMemberResponse,
  UpdateProjectMemberResponse,
} from '@forgeboard/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  AlertCircle,
  Clock,
  Mail,
  User,
  RefreshCw,
} from 'lucide-react';

interface ProjectMembersSettingsProps {
  projectId: string;
  workspaceMembers: WorkspaceMemberDto[];
  currentUserId?: string;
  isProjectAdmin: boolean;
}

const PROJECT_ROLE_BADGES: Record<ProjectRole, string> = {
  ADMIN: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  MEMBER: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  VIEWER: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700',
};

export function ProjectMembersSettings({
  projectId,
  workspaceMembers,
  currentUserId,
  isProjectAdmin,
}: ProjectMembersSettingsProps) {
  const [projectMembers, setProjectMembers] = useState<ProjectMemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Member Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<ProjectRole>('MEMBER');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Remove Member Modal State
  const [memberToRemove, setMemberToRemove] = useState<ProjectMemberDto | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Mutation error
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchProjectMembers = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<ListProjectMembersResponse>(`/projects/${projectId}/members`);
      setProjectMembers(res.members || []);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to load project members.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectMembers();
  }, [fetchProjectMembers]);

  // Candidates who belong to the workspace but not yet explicitly assigned to this project
  const candidateMembers = workspaceMembers.filter(
    (wm) => !projectMembers.some((pm) => pm.userId === wm.userId)
  );

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !isProjectAdmin) return;

    setAddLoading(true);
    setAddError(null);

    try {
      const res = await apiFetch<AddProjectMemberResponse>(`/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: selectedUserId, role: selectedRole }),
      });

      setProjectMembers((prev) => [...prev, res.member]);
      setIsAddOpen(false);
      setSelectedUserId('');
      setSelectedRole('MEMBER');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setAddError(err.message || 'Failed to add project member.');
      } else if (err instanceof Error) {
        setAddError(err.message);
      } else {
        setAddError('An unexpected error occurred.');
      }
    } finally {
      setAddLoading(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: ProjectRole) => {
    setActionError(null);

    try {
      const res = await apiFetch<UpdateProjectMemberResponse>(
        `/projects/${projectId}/members/${targetUserId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ role: newRole }),
        }
      );

      setProjectMembers((prev) =>
        prev.map((pm) => (pm.userId === targetUserId ? res.member : pm))
      );
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(err.message || 'Failed to update member role.');
      } else if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError('An unexpected error occurred.');
      }
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove || !isProjectAdmin) return;

    setRemoveLoading(true);
    setRemoveError(null);

    try {
      await apiFetch(`/projects/${projectId}/members/${memberToRemove.userId}`, {
        method: 'DELETE',
      });

      setProjectMembers((prev) => prev.filter((pm) => pm.id !== memberToRemove.id));
      setMemberToRemove(null);
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

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span>Project Team & Access</span>
          </h2>
          <p className="text-xs text-foreground/60">
            Explicitly assign roles and permissions to workspace members for this project.
          </p>
        </div>

        {isProjectAdmin && (
          <Button
            onClick={() => {
              if (candidateMembers.length > 0) {
                setSelectedUserId(candidateMembers[0].userId);
              }
              setIsAddOpen(true);
            }}
            className="h-8 px-3 text-xs flex items-center gap-1.5 shadow-xs"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Member</span>
          </Button>
        )}
      </div>

      {actionError && (
        <div className="p-3.5 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-3 text-foreground/50">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs">Loading project members...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 text-xs text-red-600 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400">
          {error}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-background overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-foreground/5 border-b border-border text-foreground/60 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Project Role</th>
                  <th className="py-3 px-4">Assigned</th>
                  {isProjectAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {projectMembers.map((member) => {
                  const isCurrentUser = member.userId === currentUserId;
                  const canModify = isProjectAdmin && !isCurrentUser;

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
                        {canModify ? (
                          <select
                            value={member.role}
                            onChange={(e) =>
                              handleRoleChange(member.userId, e.target.value as ProjectRole)
                            }
                            className="text-xs font-semibold rounded-md border border-border bg-background px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="ADMIN">ADMIN</option>
                            <option value="MEMBER">MEMBER</option>
                            <option value="VIEWER">VIEWER</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              PROJECT_ROLE_BADGES[member.role] || PROJECT_ROLE_BADGES.VIEWER
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

                      {isProjectAdmin && (
                        <td className="py-3 px-4 text-right">
                          {canModify && (
                            <Button
                              variant="outline"
                              onClick={() => setMemberToRemove(member)}
                              className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:border-red-300 dark:text-red-400"
                              title="Remove member from project"
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
      )}

      {/* Add Member Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => !addLoading && setIsAddOpen(false)}
        title="Add Team Member to Project"
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <p className="text-xs text-foreground/60">
            Select a member from the workspace to assign to this project with specific role permissions.
          </p>

          {addError && (
            <div className="p-3 rounded-md bg-red-50 text-red-600 border border-red-200 text-xs flex items-center gap-2 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          {candidateMembers.length === 0 ? (
            <p className="text-xs text-foreground/50 italic py-2">
              All workspace members have already been added to this project.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Workspace Member</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={addLoading}
                  className="w-full text-xs rounded-md border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  {candidateMembers.map((wm) => (
                    <option key={wm.userId} value={wm.userId}>
                      {wm.user?.name || wm.user?.email} ({wm.user?.email}) — {wm.role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Project Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as ProjectRole)}
                  disabled={addLoading}
                  className="w-full text-xs rounded-md border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="MEMBER">MEMBER — create, edit, move issues and post comments</option>
                  <option value="ADMIN">ADMIN — manage project settings, milestones, and members</option>
                  <option value="VIEWER">VIEWER — view issues and kanban board (read-only)</option>
                </select>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              disabled={addLoading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addLoading || candidateMembers.length === 0}
              className="text-xs"
            >
              {addLoading ? 'Adding...' : 'Add to Project'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Remove Confirmation Modal */}
      <Modal
        isOpen={Boolean(memberToRemove)}
        onClose={() => !removeLoading && setMemberToRemove(null)}
        title="Remove Member from Project"
      >
        <div className="space-y-4">
          <p className="text-xs text-foreground/70">
            Are you sure you want to remove{' '}
            <strong className="text-foreground">{memberToRemove?.user?.name || 'this member'}</strong>{' '}
            from this project? They will lose access to the project board, issues, and discussions.
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
    </div>
  );
}
