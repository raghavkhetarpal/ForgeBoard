"use client";

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormError } from '@/components/ui/FormError';
import { apiFetch, ApiError } from '@/lib/api';
import { IssueDto, IssueStatus, IssuePriority, MilestoneWithProgressDto } from '@forgeboard/types';
import { Flag } from 'lucide-react';

interface CreateIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  initialStatus?: IssueStatus;
  onIssueCreated: (issue: IssueDto) => void;
  milestones?: MilestoneWithProgressDto[];
}

interface CreateIssueResponse {
  issue: IssueDto;
}

const STATUS_OPTIONS: { label: string; value: IssueStatus }[] = [
  { label: 'Backlog', value: 'BACKLOG' },
  { label: 'To Do', value: 'TODO' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'In Review', value: 'IN_REVIEW' },
  { label: 'Done', value: 'DONE' },
  { label: 'Canceled', value: 'CANCELLED' },
];

const PRIORITY_OPTIONS: { label: string; value: IssuePriority }[] = [
  { label: 'Low', value: 'LOW' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'High', value: 'HIGH' },
  { label: 'Urgent', value: 'URGENT' },
];

export function CreateIssueModal({
  isOpen,
  onClose,
  projectId,
  initialStatus = 'TODO',
  onIssueCreated,
  milestones = [],
}: CreateIssueModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<IssueStatus>(initialStatus);
  const [priority, setPriority] = useState<IssuePriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStatus(initialStatus);
    }
  }, [isOpen, initialStatus]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStatus(initialStatus);
    setPriority('MEDIUM');
    setDueDate('');
    setMilestoneId('');
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

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Title is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: {
        title: string;
        description?: string | null;
        status: IssueStatus;
        priority: IssuePriority;
        dueDate?: string | null;
        milestoneId?: string | null;
      } = {
        title: trimmedTitle,
        description: description.trim() || null,
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        milestoneId: milestoneId ? milestoneId : null,
      };

      const res = await apiFetch<CreateIssueResponse>(
        `/projects/${projectId}/issues`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      resetForm();
      onClose();
      onIssueCreated(res.issue);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You do not have permission to create issues in this project (Member role required).');
        } else {
          setError(err.message || 'Failed to create issue.');
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
      title="Create Issue"
      description="Add a task, bug, or feature ticket to the project board."
    >
      <FormError message={error} />

      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <label htmlFor="issue-title" className="text-sm font-medium text-foreground">
            Title <span className="text-red-500">*</span>
          </label>
          <Input
            id="issue-title"
            type="text"
            placeholder="Issue summary or action title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            disabled={isSubmitting}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="issue-desc" className="text-sm font-medium text-foreground">
            Description <span className="text-xs text-foreground/50 font-normal">(Optional)</span>
          </label>
          <textarea
            id="issue-desc"
            rows={3}
            className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Detailed description, reproduction steps, or context..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            disabled={isSubmitting}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="issue-status" className="text-sm font-medium text-foreground">
              Status
            </label>
            <select
              id="issue-status"
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              value={status}
              onChange={(e) => setStatus(e.target.value as IssueStatus)}
              disabled={isSubmitting}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="issue-priority" className="text-sm font-medium text-foreground">
              Priority
            </label>
            <select
              id="issue-priority"
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              value={priority}
              onChange={(e) => setPriority(e.target.value as IssuePriority)}
              disabled={isSubmitting}
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="issue-due" className="text-sm font-medium text-foreground">
              Due Date <span className="text-xs text-foreground/50 font-normal">(Optional)</span>
            </label>
            <Input
              id="issue-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="issue-milestone" className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Flag className="h-3.5 w-3.5 text-primary" />
              <span>Milestone</span>
              <span className="text-xs text-foreground/50 font-normal">(Optional)</span>
            </label>
            <select
              id="issue-milestone"
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="">None (No milestone)</option>
              {milestones
                .filter((m) => m.status === 'OPEN')
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </div>
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
            {isSubmitting ? 'Creating...' : 'Create Issue'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
