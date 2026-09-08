"use client";

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormError } from '@/components/ui/FormError';
import { apiFetch, ApiError } from '@/lib/api';
import { ProjectDto, ProjectStatus } from '@forgeboard/types';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onProjectCreated: (project: ProjectDto) => void;
}

interface CreateProjectResponse {
  project: ProjectDto;
}

const PROJECT_STATUSES: { label: string; value: ProjectStatus }[] = [
  { label: 'Planning', value: 'PLANNING' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'On Hold', value: 'ON_HOLD' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Archived', value: 'ARCHIVED' },
];

export function CreateProjectModal({
  isOpen,
  onClose,
  workspaceId,
  onProjectCreated,
}: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('PLANNING');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setDescription('');
    setStatus('PLANNING');
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
      setError('Project name is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: {
        name: string;
        description?: string | null;
        status: ProjectStatus;
      } = {
        name: trimmedName,
        description: description.trim() || null,
        status,
      };

      const res = await apiFetch<CreateProjectResponse>(
        `/workspaces/${workspaceId}/projects`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      resetForm();
      onClose();
      onProjectCreated(res.project);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You do not have permission to create projects in this workspace (Admin or Owner required).');
        } else {
          setError(err.message || 'Failed to create project.');
        }
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
      title="Create New Project"
      description="Projects organize your issues, sprints, and team workflows within this workspace."
    >
      <FormError message={error} />

      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <label htmlFor="proj-name" className="text-sm font-medium text-foreground">
            Project Name <span className="text-red-500">*</span>
          </label>
          <Input
            id="proj-name"
            type="text"
            placeholder="e.g. Mobile App Redesign"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            disabled={isSubmitting}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="proj-desc" className="text-sm font-medium text-foreground">
            Description <span className="text-xs text-foreground/50 font-normal">(Optional)</span>
          </label>
          <textarea
            id="proj-desc"
            rows={3}
            className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Briefly describe the objectives or scope of this project..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="proj-status" className="text-sm font-medium text-foreground">
            Initial Status
          </label>
          <select
            id="proj-status"
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            disabled={isSubmitting}
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
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
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
