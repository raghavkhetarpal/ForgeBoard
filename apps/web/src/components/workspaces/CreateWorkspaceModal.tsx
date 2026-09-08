"use client";

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormError } from '@/components/ui/FormError';
import { apiFetch, ApiError } from '@/lib/api';
import { WorkspaceDto, WorkspaceMemberDto } from '@forgeboard/types';
import { useRouter } from 'next/navigation';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkspaceCreated?: (workspace: WorkspaceDto) => void;
}

interface CreateWorkspaceResponse {
  workspace: WorkspaceDto;
  member: WorkspaceMemberDto;
}

export function CreateWorkspaceModal({
  isOpen,
  onClose,
  onWorkspaceCreated,
}: CreateWorkspaceModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setSlug('');
    setError('');
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Workspace name is required.');
      return;
    }

    if (slug.trim() && !/^[a-z0-9-]+$/.test(slug.trim())) {
      setError('Slug must only contain lowercase letters, numbers, and hyphens.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: { name: string; slug?: string } = { name: trimmedName };
      if (slug.trim()) {
        payload.slug = slug.trim().toLowerCase();
      }

      const res = await apiFetch<CreateWorkspaceResponse>('/workspaces', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      resetForm();
      onClose();

      if (onWorkspaceCreated) {
        onWorkspaceCreated(res.workspace);
      } else {
        router.push(`/workspaces/${res.workspace.id}`);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to create workspace.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Workspace"
      description="Workspaces are top-level environments that contain your team's projects and members."
    >
      <FormError message={error} />

      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <label htmlFor="ws-name" className="text-sm font-medium text-foreground">
            Workspace Name <span className="text-red-500">*</span>
          </label>
          <Input
            id="ws-name"
            type="text"
            placeholder="e.g. Acme Engineering"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            disabled={isSubmitting}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="ws-slug" className="text-sm font-medium text-foreground">
              Slug <span className="text-xs text-foreground/50 font-normal">(Optional)</span>
            </label>
            <span className="text-xs text-foreground/50">Auto-generated if left blank</span>
          </div>
          <Input
            id="ws-slug"
            type="text"
            placeholder="e.g. acme-engineering"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            maxLength={50}
            disabled={isSubmitting}
          />
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Workspace'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
