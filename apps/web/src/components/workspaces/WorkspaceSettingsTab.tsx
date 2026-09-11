"use client";

import React, { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { WorkspaceDto, WorkspaceRole } from '@forgeboard/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Settings, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface WorkspaceSettingsTabProps {
  workspace: WorkspaceDto;
  currentUserRole: WorkspaceRole;
  onWorkspaceUpdate: (updated: WorkspaceDto) => void;
}

export function WorkspaceSettingsTab({
  workspace,
  currentUserRole,
  onWorkspaceUpdate,
}: WorkspaceSettingsTabProps) {
  const router = useRouter();

  // General settings state
  const [name, setName] = useState(workspace.name);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Danger zone state
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canEditSettings =
    currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';
  const isOwner = currentUserRole === 'OWNER';

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditSettings) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await apiFetch<{ data: { workspace: WorkspaceDto } }>(
        `/workspaces/${workspace.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ name: name.trim() }),
        }
      );

      onWorkspaceUpdate(res.data.workspace);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSaveError(err.message || 'Failed to update workspace.');
      } else if (err instanceof Error) {
        setSaveError(err.message);
      } else {
        setSaveError('An unexpected error occurred.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || confirmSlug !== workspace.name) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await apiFetch(`/workspaces/${workspace.id}`, {
        method: 'DELETE',
      });
      router.push('/dashboard');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setDeleteError(err.message || 'Failed to delete workspace.');
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
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Settings className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">
            General Settings
          </h3>
        </div>

        <form onSubmit={handleSaveGeneral} className="space-y-4">
          {saveError && (
            <div className="p-3 rounded-md bg-red-50 text-red-600 border border-red-200 text-xs flex items-center gap-2 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs flex items-center gap-2 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Workspace settings updated successfully.</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Workspace Name
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEditSettings || isSaving}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground/70">
              Workspace Slug (Identifier)
            </label>
            <Input
              type="text"
              value={workspace.slug}
              disabled
              className="bg-foreground/5 font-mono text-xs cursor-not-allowed opacity-75"
            />
            <p className="text-[11px] text-foreground/50">
              Slugs are permanent canonical identifiers used in API routes and URL paths.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground/70">
              Created At
            </label>
            <p className="text-xs text-foreground/60 font-mono">
              {new Date(workspace.createdAt).toLocaleString()}
            </p>
          </div>

          {canEditSettings && (
            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSaving || name.trim() === workspace.name}
                className="text-xs"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* Danger Zone */}
      <div className="p-6 rounded-xl border border-red-200 bg-red-50/20 dark:bg-red-950/10 dark:border-red-900/40 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400">
          <ShieldAlert className="h-5 w-5" />
          <h3 className="text-base font-semibold">Danger Zone</h3>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-0.5">
            <h4 className="text-xs font-semibold text-foreground">
              Delete this workspace
            </h4>
            <p className="text-xs text-foreground/60 max-w-md">
              Once deleted, all projects, issues, comments, labels, and associated data will be permanently removed. This action cannot be undone.
            </p>
          </div>

          {isOwner ? (
            <Button
              variant="danger"
              onClick={() => setIsDeleteOpen(true)}
              className="text-xs shrink-0"
            >
              Delete Workspace
            </Button>
          ) : (
            <p className="text-xs text-foreground/50 italic shrink-0">
              Only the workspace Owner can delete this workspace.
            </p>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => !isDeleting && setIsDeleteOpen(false)}
        title="Permanently Delete Workspace"
      >
        <form onSubmit={handleDeleteWorkspace} className="space-y-4">
          <p className="text-xs text-foreground/70">
            This action is irreversible. To confirm deletion, please type the workspace name:{' '}
            <strong className="text-foreground font-mono bg-foreground/5 px-1 py-0.5 rounded">
              {workspace.name}
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
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder="Enter workspace name"
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
              disabled={isDeleting || confirmSlug !== workspace.name}
              className="text-xs"
            >
              {isDeleting ? 'Deleting...' : 'I understand, delete workspace'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
