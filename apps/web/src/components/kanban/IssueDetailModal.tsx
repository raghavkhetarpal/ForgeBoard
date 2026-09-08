"use client";

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormError } from '@/components/ui/FormError';
import { apiFetch, ApiError } from '@/lib/api';
import { IssueDto, IssueStatus, IssuePriority } from '@forgeboard/types';
import { Trash2, Clock, Calendar, User as UserIcon } from 'lucide-react';

interface IssueDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  issue: IssueDto | null;
  onIssueUpdated: (issue: IssueDto) => void;
  onIssueDeleted: (issueId: string) => void;
  canEdit?: boolean;
}

interface UpdateIssueResponse {
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

export function IssueDetailModal({
  isOpen,
  onClose,
  projectId,
  issue,
  onIssueUpdated,
  onIssueDeleted,
  canEdit = true,
}: IssueDetailModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<IssueStatus>('TODO');
  const [priority, setPriority] = useState<IssuePriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    if (issue) {
      setTitle(issue.title);
      setDescription(issue.description || '');
      setStatus(issue.status);
      setPriority(issue.priority);
      setDueDate(
        issue.dueDate
          ? new Date(issue.dueDate).toISOString().substring(0, 10)
          : ''
      );
      setError('');
      setShowConfirmDelete(false);
    }
  }, [issue]);

  if (!issue) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Title cannot be empty.');
      return;
    }

    setIsSaving(true);

    try {
      const payload: {
        title: string;
        description: string | null;
        status: IssueStatus;
        priority: IssuePriority;
        dueDate: string | null;
      } = {
        title: trimmedTitle,
        description: description.trim() || null,
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      };

      const res = await apiFetch<UpdateIssueResponse>(
        `/projects/${projectId}/issues/${issue.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      );

      onIssueUpdated(res.issue);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You do not have permission to edit issues in this project.');
        } else {
          setError(err.message || 'Failed to update issue.');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setError('');
    setIsDeleting(true);

    try {
      await apiFetch<{ success: boolean }>(
        `/projects/${projectId}/issues/${issue.id}`,
        {
          method: 'DELETE',
        }
      );

      onIssueDeleted(issue.id);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You do not have permission to delete issues in this project.');
        } else {
          setError(err.message || 'Failed to delete issue.');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Issue Details"
      description={`ID: ${issue.id}`}
      className="max-w-xl"
    >
      <FormError message={error} />

      <form onSubmit={handleSave} className="space-y-4 pt-1">
        {/* Title */}
        <div className="space-y-1.5">
          <label htmlFor="edit-title" className="text-sm font-medium text-foreground">
            Title
          </label>
          <Input
            id="edit-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canEdit || isSaving || isDeleting}
            required
            maxLength={100}
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label htmlFor="edit-desc" className="text-sm font-medium text-foreground">
            Description
          </label>
          <textarea
            id="edit-desc"
            rows={4}
            className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Add details, markdown, or notes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit || isSaving || isDeleting}
            maxLength={2000}
          />
        </div>

        {/* Status & Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="edit-status" className="text-sm font-medium text-foreground">
              Status
            </label>
            <select
              id="edit-status"
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              value={status}
              onChange={(e) => setStatus(e.target.value as IssueStatus)}
              disabled={!canEdit || isSaving || isDeleting}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-priority" className="text-sm font-medium text-foreground">
              Priority
            </label>
            <select
              id="edit-priority"
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              value={priority}
              onChange={(e) => setPriority(e.target.value as IssuePriority)}
              disabled={!canEdit || isSaving || isDeleting}
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Due Date */}
        <div className="space-y-1.5">
          <label htmlFor="edit-due" className="text-sm font-medium text-foreground">
            Due Date
          </label>
          <Input
            id="edit-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={!canEdit || isSaving || isDeleting}
          />
        </div>

        {/* Metadata Footer */}
        <div className="p-3 rounded-lg bg-foreground/[0.02] border border-border/60 text-xs text-foreground/60 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <UserIcon className="h-3.5 w-3.5 text-foreground/40" />
              <span>Created by: {issue.creator?.name || issue.creatorId}</span>
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-foreground/40" />
              <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <span>Position index: {Math.round(issue.position)}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-foreground/40" />
              <span>Updated {new Date(issue.updatedAt).toLocaleDateString()}</span>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          {canEdit ? (
            showConfirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">Confirm delete?</span>
                <Button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="h-8 px-2.5 bg-red-600 hover:bg-red-700 text-white text-xs"
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={isDeleting}
                  className="h-8 px-2 text-xs"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowConfirmDelete(true)}
                disabled={isSaving || isDeleting}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Issue</span>
              </Button>
            )
          ) : (
            <div />
          )}

          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving || isDeleting}
            >
              {canEdit ? 'Cancel' : 'Close'}
            </Button>
            {canEdit && (
              <Button type="submit" disabled={isSaving || isDeleting}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
