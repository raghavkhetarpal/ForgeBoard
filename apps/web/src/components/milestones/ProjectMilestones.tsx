"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import {
  MilestoneWithProgressDto,
  MilestoneStatus,
  MilestoneCreatedSocketEvent,
  MilestoneUpdatedSocketEvent,
  MilestoneDeletedSocketEvent,
} from '@forgeboard/types';
import { useProjectSocket } from '@/hooks/useProjectSocket';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { FormError } from '@/components/ui/FormError';
import {
  Flag,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  CircleDot,
  AlertCircle,
  RefreshCw,
  Edit2,
  Trash2,
  Check,
  RotateCcw,
  Search,
} from 'lucide-react';

interface ProjectMilestonesProps {
  projectId: string;
  canMutateMilestones?: boolean;
}

interface ListMilestonesResponse {
  milestones: MilestoneWithProgressDto[];
}

export function ProjectMilestones({
  projectId,
  canMutateMilestones = true,
}: ProjectMilestonesProps) {
  const [milestones, setMilestones] = useState<MilestoneWithProgressDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | MilestoneStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createStartDate, setCreateStartDate] = useState('');
  const [createDueDate, setCreateDueDate] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit Modal State
  const [editingMilestone, setEditingMilestone] = useState<MilestoneWithProgressDto | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<MilestoneStatus>('OPEN');
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editError, setEditError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMilestones = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    setActionError(null);

    try {
      const res = await apiFetch<ListMilestonesResponse>(`/projects/${projectId}/milestones`);
      setMilestones(res.milestones || []);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You do not have permission to view milestones for this project.');
        } else {
          setError(err.message || 'Failed to load milestones.');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while loading milestones.');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  // Real-time milestone synchronization
  const { socket } = useProjectSocket({
    projectId,
    onReconnect: fetchMilestones,
  });

  useEffect(() => {
    if (!socket || !projectId) return;

    const handleMilestoneCreated = (data: MilestoneCreatedSocketEvent) => {
      if (data?.milestone?.projectId === projectId) {
        setMilestones((prev) =>
          prev.some((m) => m.id === data.milestone.id)
            ? prev
            : [data.milestone, ...prev]
        );
      }
    };

    const handleMilestoneUpdated = (data: MilestoneUpdatedSocketEvent) => {
      if (data?.milestone?.projectId === projectId) {
        setMilestones((prev) =>
          prev.map((m) => (m.id === data.milestone.id ? data.milestone : m))
        );
      }
    };

    const handleMilestoneDeleted = (data: MilestoneDeletedSocketEvent) => {
      if (data?.projectId === projectId) {
        setMilestones((prev) =>
          prev.filter((m) => m.id !== data.milestoneId)
        );
      }
    };

    socket.on('milestone:created', handleMilestoneCreated);
    socket.on('milestone:updated', handleMilestoneUpdated);
    socket.on('milestone:deleted', handleMilestoneDeleted);

    return () => {
      socket.off('milestone:created', handleMilestoneCreated);
      socket.off('milestone:updated', handleMilestoneUpdated);
      socket.off('milestone:deleted', handleMilestoneDeleted);
    };
  }, [socket, projectId]);

  // Create Milestone Handler
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    const trimmedName = createName.trim();
    if (!trimmedName) {
      setCreateError('Milestone title is required.');
      return;
    }

    setIsCreating(true);

    try {
      const payload = {
        name: trimmedName,
        description: createDescription.trim() || null,
        startDate: createStartDate ? new Date(createStartDate).toISOString() : null,
        dueDate: createDueDate ? new Date(createDueDate).toISOString() : null,
      };

      const res = await apiFetch<{ milestone: MilestoneWithProgressDto }>(
        `/projects/${projectId}/milestones`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      setMilestones((prev) =>
        prev.some((m) => m.id === res.milestone.id)
          ? prev
          : [res.milestone, ...prev]
      );
      setIsCreateOpen(false);
      setCreateName('');
      setCreateDescription('');
      setCreateStartDate('');
      setCreateDueDate('');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setCreateError(err.message || 'Failed to create milestone.');
      } else if (err instanceof Error) {
        setCreateError(err.message);
      } else {
        setCreateError('An unexpected error occurred.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (m: MilestoneWithProgressDto) => {
    setEditingMilestone(m);
    setEditName(m.name);
    setEditDescription(m.description || '');
    setEditStatus(m.status);
    setEditStartDate(m.startDate ? new Date(m.startDate).toISOString().substring(0, 10) : '');
    setEditDueDate(m.dueDate ? new Date(m.dueDate).toISOString().substring(0, 10) : '');
    setEditError('');
  };

  // Edit Milestone Handler
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMilestone) return;
    setEditError('');

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError('Milestone title is required.');
      return;
    }

    setIsUpdating(true);

    try {
      const payload = {
        name: trimmedName,
        description: editDescription.trim() || null,
        status: editStatus,
        startDate: editStartDate ? new Date(editStartDate).toISOString() : null,
        dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
      };

      const res = await apiFetch<{ milestone: MilestoneWithProgressDto }>(
        `/projects/${projectId}/milestones/${editingMilestone.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      );

      setMilestones((prev) =>
        prev.map((m) => (m.id === res.milestone.id ? res.milestone : m))
      );
      setEditingMilestone(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setEditError(err.message || 'Failed to update milestone.');
      } else if (err instanceof Error) {
        setEditError(err.message);
      } else {
        setEditError('An unexpected error occurred.');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // Quick Toggle Status Handler
  const handleToggleStatus = async (m: MilestoneWithProgressDto) => {
    const nextStatus: MilestoneStatus = m.status === 'OPEN' ? 'CLOSED' : 'OPEN';
    setActionError(null);

    try {
      const res = await apiFetch<{ milestone: MilestoneWithProgressDto }>(
        `/projects/${projectId}/milestones/${m.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        }
      );

      setMilestones((prev) =>
        prev.map((item) => (item.id === res.milestone.id ? res.milestone : item))
      );
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(err.message || 'Failed to toggle milestone status.');
      } else if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError('Failed to toggle milestone status.');
      }
    }
  };

  // Delete Handler
  const handleDelete = async (milestoneId: string) => {
    setIsDeleting(true);
    setActionError(null);

    try {
      await apiFetch<{ success: boolean }>(
        `/projects/${projectId}/milestones/${milestoneId}`,
        {
          method: 'DELETE',
        }
      );

      setMilestones((prev) => prev.filter((m) => m.id !== milestoneId));
      setDeletingId(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(err.message || 'Failed to delete milestone.');
      } else if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError('Failed to delete milestone.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Milestones
  const filteredMilestones = useMemo(() => {
    return milestones.filter((m) => {
      if (statusFilter !== 'ALL' && m.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = m.name.toLowerCase().includes(q);
        const matchesDesc = m.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [milestones, statusFilter, searchQuery]);

  // Statistics
  const openCount = useMemo(() => milestones.filter((m) => m.status === 'OPEN').length, [milestones]);
  const closedCount = useMemo(() => milestones.filter((m) => m.status === 'CLOSED').length, [milestones]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3 text-foreground/50">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm">Loading project milestones...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50 flex flex-col items-center justify-center text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-300">
            Milestones Error
          </h2>
          <p className="text-sm text-red-600 dark:text-red-400 max-w-md">{error}</p>
        </div>
        <Button onClick={fetchMilestones} className="text-xs">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header / Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-background p-4 rounded-xl border border-border">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Flag className="h-4 w-4 text-primary" />
            <span>Milestones & Iterations</span>
          </h2>
          <p className="text-xs text-foreground/60 mt-0.5">
            Group issues into time-boxed sprints or target release goals to track team progress.
          </p>
        </div>

        {canMutateMilestones && (
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="text-xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Milestone</span>
          </Button>
        )}
      </div>

      {actionError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300 text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-500 hover:text-red-700 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-background p-3 rounded-xl border border-border">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
            }`}
          >
            All ({milestones.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('OPEN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              statusFilter === 'OPEN'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold'
                : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
            }`}
          >
            <CircleDot className="h-3 w-3" />
            <span>Open ({openCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('CLOSED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              statusFilter === 'CLOSED'
                ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-semibold'
                : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>Closed ({closedCount})</span>
          </button>
        </div>

        <div className="relative min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-foreground/40" />
          <Input
            type="text"
            placeholder="Search milestones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Milestones List */}
      {filteredMilestones.length === 0 ? (
        <div className="p-12 rounded-xl border border-dashed border-border bg-foreground/[0.01] flex flex-col items-center justify-center text-center space-y-3">
          <div className="p-3 rounded-full bg-primary/10 text-primary">
            <Flag className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              {searchQuery || statusFilter !== 'ALL'
                ? 'No matching milestones'
                : 'No milestones yet'}
            </h3>
            <p className="text-xs text-foreground/60 max-w-sm">
              {searchQuery || statusFilter !== 'ALL'
                ? 'Try adjusting your filters or search query to find what you are looking for.'
                : 'Create your first milestone to plan deliverables, organize sprints, and track completion progress.'}
            </p>
          </div>
          {!searchQuery && statusFilter === 'ALL' && canMutateMilestones && (
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="text-xs mt-2 flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Milestone</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMilestones.map((m) => {
            const isClosed = m.status === 'CLOSED';
            const isOverdue =
              !isClosed &&
              m.dueDate &&
              new Date(m.dueDate).getTime() < Date.now();

            return (
              <div
                key={m.id}
                className="p-5 rounded-xl border border-border bg-background hover:border-primary/40 shadow-xs transition-all space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-foreground">
                        {m.name}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          isClosed
                            ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        }`}
                      >
                        {isClosed ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Closed</span>
                          </>
                        ) : (
                          <>
                            <CircleDot className="h-3 w-3" />
                            <span>Open</span>
                          </>
                        )}
                      </span>

                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800">
                          <AlertCircle className="h-3 w-3" />
                          <span>Past Due</span>
                        </span>
                      )}
                    </div>

                    {m.description && (
                      <p className="text-xs text-foreground/70 leading-relaxed max-w-2xl">
                        {m.description}
                      </p>
                    )}
                  </div>

                  {/* Action Controls */}
                  {canMutateMilestones && (
                    <div className="flex items-center gap-1.5 shrink-0 self-start">
                      <Button
                        variant="outline"
                        onClick={() => handleToggleStatus(m)}
                        className="h-8 px-2.5 text-xs flex items-center gap-1"
                        title={isClosed ? 'Reopen milestone' : 'Close milestone'}
                      >
                        {isClosed ? (
                          <>
                            <RotateCcw className="h-3 w-3" />
                            <span className="hidden sm:inline">Reopen</span>
                          </>
                        ) : (
                          <>
                            <Check className="h-3 w-3" />
                            <span className="hidden sm:inline">Close</span>
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => handleOpenEdit(m)}
                        className="h-8 px-2.5 text-xs flex items-center gap-1"
                        title="Edit milestone"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>

                      {deletingId === m.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            onClick={() => handleDelete(m.id)}
                            disabled={isDeleting}
                            className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 h-8 px-2.5 text-xs"
                          >
                            {isDeleting ? 'Deleting...' : 'Confirm'}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setDeletingId(null)}
                            disabled={isDeleting}
                            className="h-8 px-2 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          onClick={() => setDeletingId(m.id)}
                          className="h-8 px-2 text-xs text-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                          title="Delete milestone"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress Bar & Statistics */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-foreground">
                        {m.progress}% complete
                      </span>
                      <span className="text-foreground/50">
                        {m.completedIssues} of {m.totalIssues} issues closed
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-foreground/60 text-[11px]">
                      <span>{m.openIssues} open</span>
                      <span>{m.completedIssues} done</span>
                    </div>
                  </div>

                  {/* Progress bar container */}
                  <div className="w-full h-2.5 rounded-full bg-foreground/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isClosed
                          ? 'bg-zinc-400'
                          : m.progress === 100
                          ? 'bg-emerald-500'
                          : 'bg-primary'
                      }`}
                      style={{ width: `${m.progress}%` }}
                    />
                  </div>
                </div>

                {/* Date Metadata Footer */}
                <div className="flex items-center gap-4 text-xs text-foreground/50 pt-2 border-t border-border/50 flex-wrap">
                  {m.startDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-foreground/40" />
                      <span>Starts {new Date(m.startDate).toLocaleDateString()}</span>
                    </span>
                  )}

                  {m.dueDate ? (
                    <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
                      <Clock className="h-3.5 w-3.5" />
                      <span>Due {new Date(m.dueDate).toLocaleDateString()}</span>
                    </span>
                  ) : (
                    <span className="text-foreground/40 italic">No due date</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Milestone Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Milestone"
        description="Define an iteration sprint or target version for your project."
      >
        <FormError message={createError} />

        <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label htmlFor="create-milestone-name" className="text-sm font-medium text-foreground">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              id="create-milestone-name"
              type="text"
              placeholder="e.g. Sprint 1, v1.0.0, Q4 Release"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              required
              maxLength={100}
              disabled={isCreating}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="create-milestone-desc" className="text-sm font-medium text-foreground">
              Description <span className="text-xs text-foreground/50 font-normal">(Optional)</span>
            </label>
            <textarea
              id="create-milestone-desc"
              rows={3}
              className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="What are the goals or release scope of this milestone?"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              maxLength={1000}
              disabled={isCreating}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="create-milestone-start" className="text-sm font-medium text-foreground">
                Start Date <span className="text-xs text-foreground/50 font-normal">(Optional)</span>
              </label>
              <Input
                id="create-milestone-start"
                type="date"
                value={createStartDate}
                onChange={(e) => setCreateStartDate(e.target.value)}
                disabled={isCreating}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="create-milestone-due" className="text-sm font-medium text-foreground">
                Due Date <span className="text-xs text-foreground/50 font-normal">(Optional)</span>
              </label>
              <Input
                id="create-milestone-due"
                type="date"
                value={createDueDate}
                onChange={(e) => setCreateDueDate(e.target.value)}
                disabled={isCreating}
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Milestone'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Milestone Modal */}
      {editingMilestone && (
        <Modal
          isOpen={true}
          onClose={() => setEditingMilestone(null)}
          title="Edit Milestone"
          description="Update milestone details, schedule, or status."
        >
          <FormError message={editError} />

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label htmlFor="edit-milestone-name" className="text-sm font-medium text-foreground">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                id="edit-milestone-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                maxLength={100}
                disabled={isUpdating}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-milestone-desc" className="text-sm font-medium text-foreground">
                Description <span className="text-xs text-foreground/50 font-normal">(Optional)</span>
              </label>
              <textarea
                id="edit-milestone-desc"
                rows={3}
                className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={1000}
                disabled={isUpdating}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-milestone-status" className="text-sm font-medium text-foreground">
                Status
              </label>
              <select
                id="edit-milestone-status"
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as MilestoneStatus)}
                disabled={isUpdating}
              >
                <option value="OPEN">Open</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="edit-milestone-start" className="text-sm font-medium text-foreground">
                  Start Date <span className="text-xs text-foreground/50 font-normal">(Optional)</span>
                </label>
                <Input
                  id="edit-milestone-start"
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  disabled={isUpdating}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-milestone-due" className="text-sm font-medium text-foreground">
                  Due Date <span className="text-xs text-foreground/50 font-normal">(Optional)</span>
                </label>
                <Input
                  id="edit-milestone-due"
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  disabled={isUpdating}
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingMilestone(null)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
