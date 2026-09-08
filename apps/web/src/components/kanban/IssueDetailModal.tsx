"use client";

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormError } from '@/components/ui/FormError';
import { apiFetch, ApiError } from '@/lib/api';
import { IssueDto, IssueStatus, IssuePriority, WorkspaceMemberDto, LabelDto, IssuePullRequestDto, GithubRepositoryDto, GithubPullRequestDto } from '@forgeboard/types';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { Trash2, Clock, Calendar, User as UserIcon, Tag, Plus, X, GitPullRequest, ExternalLink, Loader2 } from 'lucide-react';

interface IssueDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  issue: IssueDto | null;
  onIssueUpdated: (issue: IssueDto) => void;
  onIssueDeleted: (issueId: string) => void;
  canEdit?: boolean;
  members?: WorkspaceMemberDto[];
  currentUserId?: string;
  isProjectAdmin?: boolean;
  projectLabels?: LabelDto[];
  onOpenManageLabels?: () => void;
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
  members = [],
  currentUserId,
  isProjectAdmin = false,
  projectLabels = [],
  onOpenManageLabels,
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

  // Label attachment state
  const [attachedLabels, setAttachedLabels] = useState<LabelDto[]>([]);
  const [isLabelDropdownOpen, setIsLabelDropdownOpen] = useState(false);
  const [isLabelMutating, setIsLabelMutating] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);

  // Pull request linking state
  const [attachedPrs, setAttachedPrs] = useState<IssuePullRequestDto[]>([]);
  const [connectedRepos, setConnectedRepos] = useState<GithubRepositoryDto[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isLinkPrOpen, setIsLinkPrOpen] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [repoPrs, setRepoPrs] = useState<GithubPullRequestDto[]>([]);
  const [isLoadingPrs, setIsLoadingPrs] = useState(false);
  const [selectedPrNumber, setSelectedPrNumber] = useState<string>('');
  const [customPrNumber, setCustomPrNumber] = useState<string>('');
  const [isLinkingPr, setIsLinkingPr] = useState(false);
  const [linkPrError, setLinkPrError] = useState<string | null>(null);

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
      setAttachedLabels(issue.labels || []);
      setAttachedPrs(issue.pullRequests || []);
      setError('');
      setLabelError(null);
      setLinkPrError(null);
      setShowConfirmDelete(false);
      setIsLabelDropdownOpen(false);
      setIsLinkPrOpen(false);
      setSelectedPrNumber('');
      setCustomPrNumber('');
    }
  }, [issue]);

  useEffect(() => {
    if (!isOpen || !projectId) return;
    let mounted = true;
    setIsLoadingRepos(true);
    apiFetch<GithubRepositoryDto[]>(`/projects/${projectId}/github/repos`)
      .then((repos) => {
        if (mounted) {
          setConnectedRepos(repos || []);
          if (repos?.length > 0) {
            setSelectedRepoId((prev) => (prev ? prev : repos[0].id));
          }
        }
      })
      .catch(() => {
        if (mounted) setConnectedRepos([]);
      })
      .finally(() => {
        if (mounted) setIsLoadingRepos(false);
      });
    return () => {
      mounted = false;
    };
  }, [isOpen, projectId]);

  useEffect(() => {
    if (!isLinkPrOpen || !selectedRepoId || !projectId) return;
    let mounted = true;
    setIsLoadingPrs(true);
    setRepoPrs([]);
    apiFetch<GithubPullRequestDto[]>(
      `/projects/${projectId}/github/repos/${selectedRepoId}/pulls`
    )
      .then((prs) => {
        if (mounted) setRepoPrs(prs || []);
      })
      .catch(() => {
        if (mounted) setRepoPrs([]);
      })
      .finally(() => {
        if (mounted) setIsLoadingPrs(false);
      });
    return () => {
      mounted = false;
    };
  }, [isLinkPrOpen, selectedRepoId, projectId]);

  const handleLinkPullRequest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!issue || !selectedRepoId || isLinkingPr) return;
    const rawNum = selectedPrNumber || customPrNumber;
    const prNum = parseInt(rawNum, 10);
    if (!prNum || isNaN(prNum)) {
      setLinkPrError('Please select or specify a valid PR number.');
      return;
    }

    setLinkPrError(null);
    setIsLinkingPr(true);
    try {
      const linked = await apiFetch<IssuePullRequestDto>(
        `/projects/${projectId}/issues/${issue.id}/link-pr`,
        {
          method: 'POST',
          body: JSON.stringify({
            repoId: selectedRepoId,
            prNumber: prNum,
          }),
        }
      );

      const nextPrs = attachedPrs.some((p) => p.id === linked.id)
        ? attachedPrs.map((p) => (p.id === linked.id ? linked : p))
        : [...attachedPrs, linked];

      setAttachedPrs(nextPrs);
      onIssueUpdated({ ...issue, pullRequests: nextPrs });
      setIsLinkPrOpen(false);
      setSelectedPrNumber('');
      setCustomPrNumber('');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setLinkPrError(err.message || 'Failed to link pull request.');
      } else if (err instanceof Error) {
        setLinkPrError(err.message);
      } else {
        setLinkPrError('Failed to link pull request.');
      }
    } finally {
      setIsLinkingPr(false);
    }
  };

  const handleAttachLabel = async (labelToAttach: LabelDto) => {
    if (!issue || isLabelMutating) return;
    setLabelError(null);
    setIsLabelMutating(true);
    const previous = attachedLabels;
    const nextLabels = [...previous, labelToAttach];
    setAttachedLabels(nextLabels);
    setIsLabelDropdownOpen(false);

    try {
      await apiFetch<{ success: boolean }>(
        `/projects/${projectId}/issues/${issue.id}/labels`,
        {
          method: 'POST',
          body: JSON.stringify({ labelId: labelToAttach.id }),
        }
      );
      onIssueUpdated({ ...issue, labels: nextLabels });
    } catch (err: unknown) {
      setAttachedLabels(previous);
      if (err instanceof ApiError) {
        setLabelError(err.message || 'Failed to attach label.');
      } else if (err instanceof Error) {
        setLabelError(err.message);
      } else {
        setLabelError('Failed to attach label.');
      }
    } finally {
      setIsLabelMutating(false);
    }
  };

  const handleDetachLabel = async (labelId: string) => {
    if (!issue || isLabelMutating) return;
    setLabelError(null);
    setIsLabelMutating(true);
    const previous = attachedLabels;
    const nextLabels = previous.filter((l) => l.id !== labelId);
    setAttachedLabels(nextLabels);

    try {
      await apiFetch<{ success: boolean }>(
        `/projects/${projectId}/issues/${issue.id}/labels/${labelId}`,
        {
          method: 'DELETE',
        }
      );
      onIssueUpdated({ ...issue, labels: nextLabels });
    } catch (err: unknown) {
      setAttachedLabels(previous);
      if (err instanceof ApiError) {
        setLabelError(err.message || 'Failed to remove label.');
      } else if (err instanceof Error) {
        setLabelError(err.message);
      } else {
        setLabelError('Failed to remove label.');
      }
    } finally {
      setIsLabelMutating(false);
    }
  };

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
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
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

        {/* Labels Section */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-primary" />
              <span>Labels</span>
            </span>

            {canEdit && onOpenManageLabels && (
              <button
                type="button"
                onClick={onOpenManageLabels}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
              >
                <span>Manage labels</span>
              </button>
            )}
          </div>

          {labelError && <FormError message={labelError} />}

          <div className="flex flex-wrap items-center gap-1.5">
            {attachedLabels.map((l) => (
              <span
                key={l.id}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border transition-colors"
                style={{
                  backgroundColor: `${l.color}18`,
                  borderColor: `${l.color}44`,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: l.color }}
                />
                <span className="text-foreground/90 font-medium">{l.name}</span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleDetachLabel(l.id)}
                    disabled={isLabelMutating}
                    className="text-foreground/40 hover:text-red-500 rounded-full p-0.5 ml-0.5 transition-colors cursor-pointer"
                    title="Remove label"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}

            {canEdit && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsLabelDropdownOpen(!isLabelDropdownOpen)}
                  disabled={isLabelMutating}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-dashed border-border hover:border-primary/60 bg-background text-xs font-medium text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Label</span>
                </button>

                {isLabelDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsLabelDropdownOpen(false)}
                    />
                    <div className="absolute left-0 mt-1 w-48 rounded-lg border border-border bg-background shadow-lg z-20 p-1 space-y-0.5 max-h-48 overflow-y-auto">
                      {projectLabels.filter(
                        (pl) => !attachedLabels.some((al) => al.id === pl.id)
                      ).length === 0 ? (
                        <div className="px-2 py-2 text-xs text-foreground/50 text-center">
                          {projectLabels.length === 0
                            ? 'No labels in project yet.'
                            : 'All project labels attached.'}
                        </div>
                      ) : (
                        projectLabels
                          .filter(
                            (pl) =>
                              !attachedLabels.some((al) => al.id === pl.id)
                          )
                          .map((pl) => (
                            <button
                              key={pl.id}
                              type="button"
                              onClick={() => handleAttachLabel(pl)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left hover:bg-foreground/5 transition-colors cursor-pointer"
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: pl.color }}
                              />
                              <span className="truncate text-foreground/80 font-medium">
                                {pl.name}
                              </span>
                            </button>
                          ))
                      )}

                      {onOpenManageLabels && (
                        <div className="pt-1 border-t border-border/60">
                          <button
                            type="button"
                            onClick={() => {
                              setIsLabelDropdownOpen(false);
                              onOpenManageLabels();
                            }}
                            className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs text-primary hover:bg-primary/5 transition-colors font-medium cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Create / Manage</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Linked Pull Requests Section */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70 flex items-center gap-1.5">
              <GitPullRequest className="h-3.5 w-3.5 text-primary" />
              <span>Linked Pull Requests</span>
            </span>

            {canEdit && connectedRepos.length > 0 && !isLinkPrOpen && (
              <button
                type="button"
                onClick={() => {
                  setIsLinkPrOpen(true);
                  if (!selectedRepoId && connectedRepos.length > 0) {
                    setSelectedRepoId(connectedRepos[0].id);
                  }
                }}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>Link PR</span>
              </button>
            )}
          </div>

          {linkPrError && <FormError message={linkPrError} />}

          {/* PR Link Form Box */}
          {isLinkPrOpen && (
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/[0.03] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <GitPullRequest className="h-3.5 w-3.5 text-primary" />
                  <span>Link GitHub Pull Request</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsLinkPrOpen(false);
                    setLinkPrError(null);
                  }}
                  className="text-foreground/50 hover:text-foreground p-0.5 rounded"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {connectedRepos.length > 1 && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-foreground/70">Repository</label>
                    <select
                      value={selectedRepoId}
                      onChange={(e) => {
                        setSelectedRepoId(e.target.value);
                        setSelectedPrNumber('');
                      }}
                      disabled={isLinkingPr}
                      className="flex h-8 w-full rounded border border-border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    >
                      {connectedRepos.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground/70">
                    {isLoadingPrs ? 'Loading open pull requests...' : 'Select Open Pull Request'}
                  </label>
                  {isLoadingPrs ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-foreground/60">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span>Fetching pull requests from GitHub...</span>
                    </div>
                  ) : repoPrs.length > 0 ? (
                    <select
                      value={selectedPrNumber}
                      onChange={(e) => {
                        setSelectedPrNumber(e.target.value);
                        setCustomPrNumber('');
                      }}
                      disabled={isLinkingPr}
                      className="flex h-8 w-full rounded border border-border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    >
                      <option value="">-- Select a pull request --</option>
                      {repoPrs.map((pr) => (
                        <option key={pr.number} value={pr.number}>
                          #{pr.number} {pr.title} ({pr.author})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-foreground/50 italic py-1">
                      No open pull requests found in this repository.
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground/70">
                    Or enter PR number manually
                  </label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g. 42"
                    value={customPrNumber}
                    onChange={(e) => {
                      setCustomPrNumber(e.target.value);
                      setSelectedPrNumber('');
                    }}
                    disabled={isLinkingPr}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsLinkPrOpen(false);
                      setLinkPrError(null);
                    }}
                    disabled={isLinkingPr}
                    className="h-7 px-2 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleLinkPullRequest()}
                    disabled={isLinkingPr || (!selectedPrNumber && !customPrNumber)}
                    className="h-7 px-3 text-xs"
                  >
                    {isLinkingPr ? 'Linking...' : 'Link PR'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Linked PR list */}
          {attachedPrs.length > 0 ? (
            <div className="space-y-1.5">
              {attachedPrs.map((pr) => {
                const status = pr.prStatus?.toLowerCase() || 'open';
                let statusBadgeClasses = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';
                if (status === 'merged') {
                  statusBadgeClasses = 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800/60';
                } else if (status === 'closed') {
                  statusBadgeClasses = 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700';
                }

                return (
                  <div
                    key={pr.id}
                    className="flex items-center justify-between p-2 rounded-md border border-border bg-foreground/[0.02] text-xs hover:bg-foreground/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GitPullRequest className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-semibold text-foreground">
                        #{pr.prNumber}
                      </span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase border ${statusBadgeClasses}`}>
                        {status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {pr.linkedAt && (
                        <span className="text-[11px] text-foreground/50">
                          Linked {new Date(pr.linkedAt).toLocaleDateString()}
                        </span>
                      )}
                      <a
                        href={pr.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                        title="Open in GitHub"
                      >
                        <span>View</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-foreground/50 italic py-1">
              {connectedRepos.length === 0 && !isLoadingRepos ? (
                <span>
                  No pull requests linked.{' '}
                  {isProjectAdmin && (
                    <span>Connect a repository in Project Settings to link PRs.</span>
                  )}
                </span>
              ) : (
                <span>No pull requests linked to this issue.</span>
              )}
            </div>
          )}
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

      <CommentsSection
        projectId={projectId}
        issueId={issue.id}
        members={members}
        currentUserId={currentUserId}
        canComment={Boolean(currentUserId)}
        isProjectAdmin={isProjectAdmin}
      />
    </Modal>
  );
}
