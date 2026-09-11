"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import {
  IssueDto,
  IssueStatus,
  WorkspaceMemberDto,
  LabelDto,
  IssueCreatedSocketEvent,
  IssueUpdatedSocketEvent,
  IssueDeletedSocketEvent,
} from '@forgeboard/types';
import { useProjectSocket } from '@/hooks/useProjectSocket';
import { KanbanColumn } from './KanbanColumn';
import { CreateIssueModal } from './CreateIssueModal';
import { IssueDetailModal } from './IssueDetailModal';
import { ManageLabelsModal } from '@/components/labels/ManageLabelsModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Plus,
  RefreshCw,
  AlertCircle,
  Search,
  Filter,
  X,
  Tag,
} from 'lucide-react';

interface KanbanBoardProps {
  projectId: string;
  canMutateIssues?: boolean;
  members?: WorkspaceMemberDto[];
  currentUserId?: string;
  isProjectAdmin?: boolean;
}

interface ListIssuesResponse {
  issues: IssueDto[];
}

interface ListLabelsResponse {
  labels: LabelDto[];
}

interface MoveIssueResponse {
  issue: IssueDto;
}

const COLUMNS: { status: IssueStatus; label: string }[] = [
  { status: 'BACKLOG', label: 'Backlog' },
  { status: 'TODO', label: 'To Do' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'IN_REVIEW', label: 'In Review' },
  { status: 'DONE', label: 'Done' },
  { status: 'CANCELLED', label: 'Canceled' },
];

export function KanbanBoard({
  projectId,
  canMutateIssues = true,
  members = [],
  currentUserId,
  isProjectAdmin = false,
}: KanbanBoardProps) {
  const [issues, setIssues] = useState<IssueDto[]>([]);
  const [labels, setLabels] = useState<LabelDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [labelFilter, setLabelFilter] = useState<string>('ALL');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isManageLabelsModalOpen, setIsManageLabelsModalOpen] = useState(false);
  const [createInitialStatus, setCreateInitialStatus] = useState<IssueStatus>('TODO');
  const [selectedIssue, setSelectedIssue] = useState<IssueDto | null>(null);

  // Drag and drop tracking
  const [draggedItem, setDraggedItem] = useState<{
    issue: IssueDto;
    sourceIndex: number;
  } | null>(null);

  const loadBoardData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    setActionError(null);

    try {
      const [issuesRes, labelsRes] = await Promise.all([
        apiFetch<ListIssuesResponse>(`/projects/${projectId}/issues`),
        apiFetch<ListLabelsResponse>(`/projects/${projectId}/labels`).catch(
          () => ({ labels: [] })
        ),
      ]);
      setIssues(issuesRes.issues || []);
      setLabels(labelsRes.labels || []);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You do not have permission to view issues for this project.');
        } else {
          setError(err.message || 'Failed to load project issues.');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while loading issues.');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadBoardData();
  }, [loadBoardData]);

  // Real-time project room subscription and reconnect reconciliation
  const { socket, isConnected } = useProjectSocket({
    projectId,
    onReconnect: loadBoardData,
  });

  useEffect(() => {
    if (!socket || !projectId) return;

    const handleIssueCreated = (data: IssueCreatedSocketEvent) => {
      if (data?.issue && data.issue.projectId === projectId) {
        setIssues((prev) => {
          if (prev.some((i) => i.id === data.issue.id)) return prev;
          return [...prev, data.issue];
        });
      }
    };

    const handleIssueUpdated = (data: IssueUpdatedSocketEvent) => {
      if (data?.issue && data.issue.projectId === projectId) {
        setIssues((prev) =>
          prev.map((i) => (i.id === data.issue.id ? data.issue : i))
        );
        setSelectedIssue((prev) =>
          prev?.id === data.issue.id ? data.issue : prev
        );
      }
    };

    const handleIssueDeleted = (data: IssueDeletedSocketEvent) => {
      if (data?.projectId === projectId && data.issueId) {
        setIssues((prev) => prev.filter((i) => i.id !== data.issueId));
        setSelectedIssue((prev) => (prev?.id === data.issueId ? null : prev));
      }
    };

    socket.on('issue:created', handleIssueCreated);
    socket.on('issue:updated', handleIssueUpdated);
    socket.on('issue:deleted', handleIssueDeleted);

    return () => {
      socket.off('issue:created', handleIssueCreated);
      socket.off('issue:updated', handleIssueUpdated);
      socket.off('issue:deleted', handleIssueDeleted);
    };
  }, [socket, projectId]);

  // Drag-and-drop start
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    issue: IssueDto,
    index: number
  ) => {
    if (!canMutateIssues) return;
    setDraggedItem({ issue, sourceIndex: index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', issue.id);
  };

  // Drag-and-drop drop on column with optimistic update and rollback
  const handleDropOnColumn = async (
    targetStatus: IssueStatus,
    targetIndex: number
  ) => {
    if (!draggedItem || !canMutateIssues) return;
    const { issue: movingIssue } = draggedItem;
    setDraggedItem(null);
    setActionError(null);

    // Get current issues in target column
    const targetColumnIssues = issues.filter(
      (i) => i.status === targetStatus && i.id !== movingIssue.id
    );

    // If dropped in same column at same position, no-op
    const sourceColumnIssues = issues.filter(
      (i) => i.status === movingIssue.status
    );
    const currentIndex = sourceColumnIssues.findIndex(
      (i) => i.id === movingIssue.id
    );
    if (
      movingIssue.status === targetStatus &&
      (currentIndex === targetIndex || currentIndex === targetIndex - 1)
    ) {
      return;
    }

    // 1. Snapshot for rollback
    const previousIssues = [...issues];

    // 2. Compute optimistic state
    const updatedMovingIssue: IssueDto = {
      ...movingIssue,
      status: targetStatus,
    };

    // Remove from old location
    const remaining = issues.filter((i) => i.id !== movingIssue.id);

    // Insert into target column at targetIndex
    const boundedIndex = Math.max(
      0,
      Math.min(targetIndex, targetColumnIssues.length)
    );
    const newTargetList = [...targetColumnIssues];
    newTargetList.splice(boundedIndex, 0, updatedMovingIssue);

    // Combine remaining issues from other columns with the reordered target column
    const otherIssues = remaining.filter((i) => i.status !== targetStatus);
    const optimisticIssues = [...otherIssues, ...newTargetList];

    setIssues(optimisticIssues);

    // 3. Dispatch backend API call
    try {
      const res = await apiFetch<MoveIssueResponse>(
        `/projects/${projectId}/issues/${movingIssue.id}/move`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: targetStatus,
            position: boundedIndex,
          }),
        }
      );

      // Succeeded: update with exact returned server issue
      setIssues((prev) =>
        prev.map((i) => (i.id === res.issue.id ? res.issue : i))
      );
    } catch (err: unknown) {
      // 4. Failed: Rollback to snapshot
      setIssues(previousIssues);

      if (err instanceof ApiError) {
        if (err.status === 403) {
          setActionError(
            'Permission denied: Only project Members or Admins can move issues.'
          );
        } else {
          setActionError(err.message || 'Failed to move issue.');
        }
      } else if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError('Failed to move issue.');
      }
    }
  };

  // Issue creation handler
  const handleOpenCreateModal = (status: IssueStatus = 'TODO') => {
    setCreateInitialStatus(status);
    setIsCreateModalOpen(true);
  };

  const handleIssueCreated = (newIssue: IssueDto) => {
    setIssues((prev) => [...prev, newIssue]);
  };

  // Issue edit/delete handlers
  const handleIssueUpdated = (updated: IssueDto) => {
    setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  const handleIssueDeleted = (deletedId: string) => {
    setIssues((prev) => prev.filter((i) => i.id !== deletedId));
  };

  // Filtered issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = issue.title.toLowerCase().includes(query);
        const matchesDesc = issue.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return false;
      }
      if (priorityFilter !== 'ALL' && issue.priority !== priorityFilter) {
        return false;
      }
      if (labelFilter !== 'ALL') {
        if (!issue.labels || !issue.labels.some((l) => l.id === labelFilter)) {
          return false;
        }
      }
      return true;
    });
  }, [issues, searchQuery, priorityFilter, labelFilter]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3 text-foreground/50">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm">Loading board issues...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50 flex flex-col items-center justify-center text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-300">
            Board Error
          </h2>
          <p className="text-sm text-red-600 dark:text-red-400 max-w-md">{error}</p>
        </div>
        <Button onClick={loadBoardData} className="text-xs">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action Error Banner (e.g. 403 on move) */}
      {actionError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300 flex items-center justify-between text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="p-0.5 hover:opacity-75"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Board Controls Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-background p-3 rounded-xl border border-border">
        {/* Left: Search & Filter */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[160px] flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-foreground/40" />
            <Input
              type="text"
              placeholder="Search issues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="h-3.5 w-3.5 text-foreground/40 hidden sm:block" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <select
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary max-w-[140px]"
            >
              <option value="ALL">All Labels</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-foreground/[0.03] border border-border text-[11px] text-foreground/70"
            title={
              isConnected
                ? 'Real-time board synchronization active'
                : 'Connecting to real-time server...'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="font-medium hidden sm:inline">
              {isConnected ? 'Live' : 'Connecting'}
            </span>
          </div>

          <Button
            variant="outline"
            onClick={() => setIsManageLabelsModalOpen(true)}
            className="h-9 px-2.5 text-xs flex items-center gap-1.5"
            title="Manage Labels"
          >
            <Tag className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Labels</span>
            {labels.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-foreground/10 text-[10px] font-mono">
                {labels.length}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={loadBoardData}
            className="h-9 px-2.5 text-xs flex items-center gap-1.5"
            title="Refresh Board"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {canMutateIssues && (
            <Button
              onClick={() => handleOpenCreateModal('TODO')}
              className="h-9 px-3 text-xs flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Issue</span>
            </Button>
          )}
        </div>
      </div>

      {/* Kanban Columns Horizontal Scroll Area */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 items-start scrollbar-thin">
        {COLUMNS.map((col) => {
          const columnIssues = filteredIssues
            .filter((i) => i.status === col.status)
            .sort((a, b) => a.position - b.position);

          return (
            <KanbanColumn
              key={col.status}
              status={col.status}
              label={col.label}
              issues={columnIssues}
              onCardClick={(issue) => setSelectedIssue(issue)}
              onAddClick={handleOpenCreateModal}
              onDragStart={handleDragStart}
              onDropOnColumn={handleDropOnColumn}
              canCreateIssue={canMutateIssues}
            />
          );
        })}
      </div>

      {/* Modals */}
      <CreateIssueModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        projectId={projectId}
        initialStatus={createInitialStatus}
        onIssueCreated={handleIssueCreated}
      />

      <IssueDetailModal
        isOpen={Boolean(selectedIssue)}
        onClose={() => setSelectedIssue(null)}
        projectId={projectId}
        issue={selectedIssue}
        onIssueUpdated={(updated) => {
          handleIssueUpdated(updated);
          setSelectedIssue(updated);
        }}
        onIssueDeleted={handleIssueDeleted}
        canEdit={canMutateIssues}
        members={members}
        currentUserId={currentUserId}
        isProjectAdmin={isProjectAdmin}
        projectLabels={labels}
        onOpenManageLabels={() => setIsManageLabelsModalOpen(true)}
      />

      <ManageLabelsModal
        isOpen={isManageLabelsModalOpen}
        onClose={() => setIsManageLabelsModalOpen(false)}
        projectId={projectId}
        labels={labels}
        onLabelsChanged={(updatedLabels) => setLabels(updatedLabels)}
        onLabelUpdated={(updatedLabel) => {
          setIssues((prev) =>
            prev.map((i) => ({
              ...i,
              labels: i.labels?.map((l) =>
                l.id === updatedLabel.id ? updatedLabel : l
              ),
            }))
          );
          if (selectedIssue?.labels?.some((l) => l.id === updatedLabel.id)) {
            setSelectedIssue((prev) =>
              prev
                ? {
                    ...prev,
                    labels: prev.labels?.map((l) =>
                      l.id === updatedLabel.id ? updatedLabel : l
                    ),
                  }
                : null
            );
          }
        }}
        onLabelDeleted={(deletedLabelId) => {
          setIssues((prev) =>
            prev.map((i) => ({
              ...i,
              labels: i.labels?.filter((l) => l.id !== deletedLabelId),
            }))
          );
          if (selectedIssue?.labels?.some((l) => l.id === deletedLabelId)) {
            setSelectedIssue((prev) =>
              prev
                ? {
                    ...prev,
                    labels: prev.labels?.filter((l) => l.id !== deletedLabelId),
                  }
                : null
            );
          }
          if (labelFilter === deletedLabelId) {
            setLabelFilter('ALL');
          }
        }}
        canManage={canMutateIssues}
      />
    </div>
  );
}
