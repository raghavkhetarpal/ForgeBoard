"use client";

import React, { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { ProjectDto, ProjectStatus } from '@forgeboard/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Settings, ShieldAlert, CheckCircle2, AlertCircle, Archive, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProjectGeneralSettingsProps {
  project: ProjectDto;
  workspaceId: string;
  isProjectAdmin: boolean;
  onProjectUpdate: (updated: ProjectDto) => void;
}

const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'PLANNING', label: 'Planning' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export function ProjectGeneralSettings({
  project,
  workspaceId,
  isProjectAdmin,
  onProjectUpdate,
}: ProjectGeneralSettingsProps) {
  const router = useRouter();

  // Form state
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [deadline, setDeadline] = useState(
    project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : ''
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Danger zone delete modal
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isArchived = project.status === 'ARCHIVED';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProjectAdmin) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await apiFetch<{ project: ProjectDto }>(`/projects/${project.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          status,
          deadline: deadline ? new Date(deadline).toISOString() : null,
        }),
      });

      onProjectUpdate(res.project);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSaveError(err.message || 'Failed to update project settings.');
      } else if (err instanceof Error) {
        setSaveError(err.message);
      } else {
        setSaveError('An unexpected error occurred.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!isProjectAdmin) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      if (isArchived) {
        // Unarchive
        const res = await apiFetch<{ project: ProjectDto }>(`/projects/${project.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'ACTIVE' }),
        });
        setStatus('ACTIVE');
        onProjectUpdate(res.project);
      } else {
        // Archive
        const res = await apiFetch<{ project: ProjectDto }>(`/projects/${project.id}`, {
          method: 'DELETE',
        });
        setStatus('ARCHIVED');
        onProjectUpdate(res.project);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSaveError(err.message || 'Failed to update project status.');
      } else if (err instanceof Error) {
        setSaveError(err.message);
      } else {
        setSaveError('An unexpected error occurred.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePermanent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProjectAdmin || confirmName !== project.name) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await apiFetch(`/projects/${project.id}/permanent`, {
        method: 'DELETE',
      });
      router.push(`/workspaces/${workspaceId}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setDeleteError(err.message || 'Failed to delete project.');
      } else if (err instanceof Error) {
        setDeleteError(err.message);
      } else {
        setDeleteError('An unexpected error occurred.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* General Settings */}
      <div className="p-6 rounded-xl border border-border bg-background shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">
              General Project Details
            </h3>
          </div>

          {isProjectAdmin && (
            <Button
              type="button"
              variant="outline"
              onClick={handleToggleArchive}
              disabled={isSaving}
              className="h-8 px-3 text-xs flex items-center gap-1.5"
            >
              {isArchived ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Restore Project</span>
                </>
              ) : (
                <>
                  <Archive className="h-3.5 w-3.5 text-amber-600" />
                  <span>Archive Project</span>
                </>
              )}
            </Button>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {saveError && (
            <div className="p-3 rounded-md bg-red-50 text-red-600 border border-red-200 text-xs flex items-center gap-2 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs flex items-center gap-2 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Project settings saved successfully.</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Project Name</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isProjectAdmin || isSaving}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isProjectAdmin || isSaving}
              rows={3}
              placeholder="Brief summary of the project goals and deliverables..."
              className="w-full text-xs rounded-md border border-border bg-background p-3 text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                disabled={!isProjectAdmin || isSaving}
                className="w-full text-xs rounded-md border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {PROJECT_STATUSES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Deadline</label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={!isProjectAdmin || isSaving}
              />
            </div>
          </div>

          {isProjectAdmin && (
            <div className="pt-2">
              <Button type="submit" disabled={isSaving} className="text-xs">
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* Danger Zone */}
      {isProjectAdmin && (
        <div className="p-6 rounded-xl border border-red-200 bg-red-50/20 dark:bg-red-950/10 dark:border-red-900/40 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400">
            <ShieldAlert className="h-5 w-5" />
            <h3 className="text-base font-semibold">Danger Zone</h3>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-foreground">
                Permanently delete this project
              </h4>
              <p className="text-xs text-foreground/60 max-w-md">
                Permanently removes all issues, comments, labels, milestones, and member assignments associated with this project. This action cannot be undone.
              </p>
            </div>

            <Button
              variant="danger"
              onClick={() => setIsDeleteOpen(true)}
              className="text-xs shrink-0"
            >
              Delete Project
            </Button>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => !isDeleting && setIsDeleteOpen(false)}
        title="Permanently Delete Project"
      >
        <form onSubmit={handleDeletePermanent} className="space-y-4">
          <p className="text-xs text-foreground/70">
            This action is irreversible. To confirm deletion, please type the project name:{' '}
            <strong className="text-foreground font-mono bg-foreground/5 px-1 py-0.5 rounded">
              {project.name}
            </strong>
          </p>

          {deleteError && (
            <div className="p-3 rounded-md bg-red-50 text-red-600 border border-red-200 text-xs flex items-center gap-2 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="Enter project name"
              disabled={isDeleting}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isDeleting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={isDeleting || confirmName !== project.name}
              className="text-xs"
            >
              {isDeleting ? 'Deleting...' : 'I understand, delete project'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
