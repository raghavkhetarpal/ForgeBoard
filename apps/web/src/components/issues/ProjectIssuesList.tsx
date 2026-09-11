"use client";

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import {
  IssueDto,
  IssueStatus,
  IssuePriority,
  WorkspaceMemberDto,
  LabelDto,
  MilestoneWithProgressDto,
  PaginationMeta,
  IssueCreatedSocketEvent,
  IssueUpdatedSocketEvent,
  IssueDeletedSocketEvent,
} from '@forgeboard/types';
import { useProjectSocket } from '@/hooks/useProjectSocket';
import { CreateIssueModal } from '@/components/kanban/CreateIssueModal';
import { IssueDetailModal } from '@/components/kanban/IssueDetailModal';
import { ManageLabelsModal } from '@/components/labels/ManageLabelsModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Search,
  X,
  Plus,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  ArrowUpDown,
  Tag,
  Flag,
  HelpCircle,
} from 'lucide-react';

type SortByField = 'createdAt' | 'updatedAt' | 'priority' | 'position' | 'dueDate' | 'title';

interface ProjectIssuesListProps {
  projectId: string;
  canMutateIssues?: boolean;
  members?: WorkspaceMemberDto[];
  currentUserId?: string;
  isProjectAdmin?: boolean;
}

interface ListIssuesResponse {
  issues: IssueDto[];
  pagination: PaginationMeta;
}

const STATUS_CONFIG: Record<
  IssueStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  BACKLOG: {
    label: 'Backlog',
    bg: 'bg-zinc-100 dark:bg-zinc-800',
    text: 'text-zinc-700 dark:text-zinc-300',
    border: 'border-zinc-300 dark:border-zinc-700',
  },
  TODO: {
    label: 'To Do',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  IN_REVIEW: {
    label: 'In Review',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
  },
  DONE: {
    label: 'Done',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  CANCELLED: {
    label: 'Canceled',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
  },
};

const PRIORITY_CONFIG: Record<
  IssuePriority,
  { label: string; color: string; dotColor: string }
> = {
  LOW: { label: 'Low', color: 'text-zinc-500', dotColor: 'bg-zinc-400' },
  MEDIUM: { label: 'Medium', color: 'text-blue-500', dotColor: 'bg-blue-500' },
  HIGH: { label: 'High', color: 'text-amber-500', dotColor: 'bg-amber-500' },
  URGENT: { label: 'Urgent', color: 'text-rose-500', dotColor: 'bg-rose-500' },
};

export function ProjectIssuesList({
  projectId,
  canMutateIssues = true,
  members = [],
  currentUserId,
  isProjectAdmin = false,
}: ProjectIssuesListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Initial filter values from URL params
  const initialQ = searchParams.get('q') || '';
  const initialStatus = searchParams.get('status') || 'ALL';
  const initialPriority = searchParams.get('priority') || 'ALL';
  const initialAssignee = searchParams.get('assigneeId') || 'ALL';
  const initialLabel = searchParams.get('labelId') || 'ALL';
  const initialMilestone = searchParams.get('milestoneId') || 'ALL';
  const initialSortBy = (searchParams.get('sortBy') as SortByField) || 'createdAt';
  const initialSortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
  const initialLimit = parseInt(searchParams.get('limit') || '20', 10);

  // Search and Filter States
  const [searchInput, setSearchInput] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState<string>(initialPriority);
  const [assigneeFilter, setAssigneeFilter] = useState<string>(initialAssignee);
  const [labelFilter, setLabelFilter] = useState<string>(initialLabel);
  const [milestoneFilter, setMilestoneFilter] = useState<string>(initialMilestone);
  const [sortBy, setSortBy] = useState<SortByField>(initialSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
  const [pageSize, setPageSize] = useState<number>(initialLimit);

  // Pagination Stack State for deterministic cursor pagination
  const [cursorsStack, setCursorsStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState<number>(0);

  // Data States
  const [issues, setIssues] = useState<IssueDto[]>([]);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>({
    total: 0,
    limit: pageSize,
    nextCursor: null,
    hasNextPage: false,
  });
  const [labels, setLabels] = useState<LabelDto[]>([]);
  const [milestones, setMilestones] = useState<MilestoneWithProgressDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isManageLabelsModalOpen, setIsManageLabelsModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<IssueDto | null>(null);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Sync state with URL query parameters
  const updateUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      const current = new URLSearchParams(Array.from(searchParams.entries()));
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === 'ALL' || (key === 'sortBy' && value === 'createdAt') || (key === 'sortOrder' && value === 'desc') || (key === 'limit' && value === '20')) {
          current.delete(key);
        } else {
          current.set(key, value);
        }
      }
      current.set('tab', 'issues');
      const search = current.toString();
      const query = search ? `?${search}` : '';
      startTransition(() => {
        router.replace(`${pathname}${query}`, { scroll: false });
      });
    },
    [router, pathname, searchParams]
  );

  // Fetch project metadata (labels, milestones) once
  const loadMetadata = useCallback(async () => {
    if (!projectId) return;
    try {
      const [labelsRes, milestonesRes] = await Promise.all([
        apiFetch<{ labels: LabelDto[] }>(`/projects/${projectId}/labels`).catch(() => ({ labels: [] })),
        apiFetch<{ milestones: MilestoneWithProgressDto[] }>(`/projects/${projectId}/milestones`).catch(() => ({
          milestones: [],
        })),
      ]);
      setLabels(labelsRes.labels || []);
      setMilestones(milestonesRes.milestones || []);
    } catch {
      // Non-blocking metadata failures
    }
  }, [projectId]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Load paginated issues from server
  const loadIssues = useCallback(
    async (cursor: string | null = null) => {
      if (!projectId) return;
      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();
        if (debouncedQ.trim()) queryParams.set('q', debouncedQ.trim());
        if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
        if (priorityFilter !== 'ALL') queryParams.set('priority', priorityFilter);
        if (assigneeFilter !== 'ALL') queryParams.set('assigneeId', assigneeFilter);
        if (labelFilter !== 'ALL') queryParams.set('labelId', labelFilter);
        if (milestoneFilter !== 'ALL') queryParams.set('milestoneId', milestoneFilter);
        queryParams.set('sortBy', sortBy);
        queryParams.set('sortOrder', sortOrder);
        queryParams.set('limit', pageSize.toString());
        if (cursor) queryParams.set('cursor', cursor);

        const res = await apiFetch<ListIssuesResponse>(
          `/projects/${projectId}/issues?${queryParams.toString()}`
        );

        setIssues(res.issues || []);
        if (res.pagination) {
          setPaginationMeta(res.pagination);
        }
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          if (err.status === 403) {
            setError('You do not have permission to view issues for this project.');
          } else {
            setError(err.message || 'Failed to load issues.');
          }
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred.');
        }
      } finally {
        setLoading(false);
      }
    },
    [
      projectId,
      debouncedQ,
      statusFilter,
      priorityFilter,
      assigneeFilter,
      labelFilter,
      milestoneFilter,
      sortBy,
      sortOrder,
      pageSize,
    ]
  );

  // Trigger search / filter changes and reset pagination cursor stack
  useEffect(() => {
    setCursorsStack([null]);
    setPageIndex(0);
    loadIssues(null);

    // Update URL
    updateUrlParams({
      q: debouncedQ || null,
      status: statusFilter,
      priority: priorityFilter,
      assigneeId: assigneeFilter,
      labelId: labelFilter,
      milestoneId: milestoneFilter,
      sortBy,
      sortOrder,
      limit: pageSize.toString(),
    });
  }, [
    debouncedQ,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    labelFilter,
    milestoneFilter,
    sortBy,
    sortOrder,
    pageSize,
  ]);

  // Handle Page Navigation
  const handleNextPage = () => {
    if (!paginationMeta.hasNextPage || !paginationMeta.nextCursor) return;
    const nextCursor = paginationMeta.nextCursor;
    setCursorsStack((prev) => [...prev.slice(0, pageIndex + 1), nextCursor]);
    setPageIndex((prev) => prev + 1);
    loadIssues(nextCursor);
  };

  const handlePrevPage = () => {
    if (pageIndex <= 0) return;
    const prevPageIndex = pageIndex - 1;
    const targetCursor = cursorsStack[prevPageIndex] || null;
    setPageIndex(prevPageIndex);
    loadIssues(targetCursor);
  };

  // Reset all filters
  const handleClearFilters = () => {
    setSearchInput('');
    setDebouncedQ('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setAssigneeFilter('ALL');
    setLabelFilter('ALL');
    setMilestoneFilter('ALL');
    setSortBy('createdAt');
    setSortOrder('desc');
  };

  const hasActiveFilters =
    debouncedQ.trim().length > 0 ||
    statusFilter !== 'ALL' ||
    priorityFilter !== 'ALL' ||
    assigneeFilter !== 'ALL' ||
    labelFilter !== 'ALL' ||
    milestoneFilter !== 'ALL';

  // Real-time socket events for project room
  const { socket } = useProjectSocket({
    projectId,
    onReconnect: () => loadIssues(cursorsStack[pageIndex] || null),
  });

  useEffect(() => {
    if (!socket || !projectId) return;

    const handleCreated = (data: IssueCreatedSocketEvent) => {
      if (data?.issue?.projectId === projectId) {
        // Refetch current page to reflect new total and items
        loadIssues(cursorsStack[pageIndex] || null);
      }
    };

    const handleUpdated = (data: IssueUpdatedSocketEvent) => {
      if (data?.issue?.projectId === projectId) {
        setIssues((prev) =>
          prev.map((i) => (i.id === data.issue.id ? data.issue : i))
        );
        setSelectedIssue((prev) =>
          prev?.id === data.issue.id ? data.issue : prev
        );
      }
    };

    const handleDeleted = (data: IssueDeletedSocketEvent) => {
      if (data?.projectId === projectId) {
        setIssues((prev) => prev.filter((i) => i.id !== data.issueId));
        setSelectedIssue((prev) => (prev?.id === data.issueId ? null : prev));
        // Refetch to fill page if an issue was removed
        loadIssues(cursorsStack[pageIndex] || null);
      }
    };

    socket.on('issue:created', handleCreated);
    socket.on('issue:updated', handleUpdated);
    socket.on('issue:deleted', handleDeleted);

    return () => {
      socket.off('issue:created', handleCreated);
      socket.off('issue:updated', handleUpdated);
      socket.off('issue:deleted', handleDeleted);
    };
  }, [socket, projectId, pageIndex, cursorsStack, loadIssues]);

  // Item numbering calculation
  const startItem = issues.length > 0 ? pageIndex * pageSize + 1 : 0;
  const endItem = issues.length > 0 ? pageIndex * pageSize + issues.length : 0;

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Project Issues
          </h2>
          <p className="text-xs text-foreground/60 mt-0.5">
            Search, filter, and inspect issues across the project
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => loadIssues(cursorsStack[pageIndex] || null)}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs h-8 px-2.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          {isProjectAdmin && (
            <Button
              variant="outline"
              onClick={() => setIsManageLabelsModalOpen(true)}
              className="flex items-center gap-1.5 text-xs h-8 px-2.5"
            >
              <Tag className="h-3.5 w-3.5" />
              <span>Labels</span>
            </Button>
          )}

          {canMutateIssues && (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 text-xs h-8 px-2.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Issue</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="p-4 rounded-xl border border-border bg-background space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
            <Input
              type="text"
              placeholder="Search title or description..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 pr-8 text-xs py-1.5 h-9"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setDebouncedQ('');
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 h-9 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="BACKLOG">Backlog</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
              <option value="CANCELLED">Canceled</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="md:col-span-2">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 h-9 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          {/* Assignee Filter */}
          <div className="md:col-span-2">
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 h-9 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Assignees</option>
              <option value="UNASSIGNED">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.name || m.user?.email || m.userId}
                </option>
              ))}
            </select>
          </div>

          {/* Label Filter */}
          <div className="md:col-span-2">
            <select
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 h-9 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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

        {/* Secondary Filter & Sort Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Milestone Filter */}
            <div className="flex items-center gap-1.5">
              <Flag className="h-3.5 w-3.5 text-foreground/50" />
              <select
                value={milestoneFilter}
                onChange={(e) => setMilestoneFilter(e.target.value)}
                className="text-xs px-2 py-1 h-8 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Milestones</option>
                <option value="NO_MILESTONE">No Milestone</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="flex items-center gap-1 text-primary hover:underline font-medium"
              >
                <X className="h-3.5 w-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-3 ml-auto">
            <div className="flex items-center gap-1.5 text-foreground/70">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortByField)}
                className="text-xs px-2 py-1 h-8 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="createdAt">Created Date</option>
                <option value="updatedAt">Updated Date</option>
                <option value="priority">Priority</option>
                <option value="dueDate">Due Date</option>
                <option value="title">Title</option>
              </select>

              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 rounded-lg border border-border hover:bg-foreground/5 transition-colors"
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Page Size */}
            <div className="flex items-center gap-1.5 text-foreground/70">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                className="text-xs px-2 py-1 h-8 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            variant="outline"
            onClick={() => loadIssues(cursorsStack[pageIndex] || null)}
            className="h-8 px-2.5 text-xs"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Issues Table / List */}
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        {loading && issues.length === 0 ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="h-12 rounded-lg bg-foreground/5 animate-pulse"
              />
            ))}
          </div>
        ) : issues.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3">
            <div className="p-3 rounded-full bg-foreground/5 inline-flex text-foreground/40">
              <HelpCircle className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              No issues found
            </h3>
            <p className="text-xs text-foreground/60 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'No issues match your current search query or filter criteria. Try broadening your filters.'
                : 'There are no issues in this project yet.'}
            </p>
            {hasActiveFilters ? (
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="text-xs mt-2 h-8 px-3"
              >
                Clear all filters
              </Button>
            ) : canMutateIssues ? (
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="text-xs mt-2 h-8 px-3"
              >
                Create first issue
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-foreground/[0.02] text-foreground/60 font-medium select-none">
                  <th className="py-3 px-4 w-24">Priority</th>
                  <th className="py-3 px-4">Title & Details</th>
                  <th className="py-3 px-4 w-32">Status</th>
                  <th className="py-3 px-4 w-36">Milestone</th>
                  <th className="py-3 px-4 w-36">Assignee</th>
                  <th className="py-3 px-4 w-28 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {issues.map((issue) => {
                  const statusInfo = STATUS_CONFIG[issue.status];
                  const priorityInfo = PRIORITY_CONFIG[issue.priority];

                  return (
                    <tr
                      key={issue.id}
                      onClick={() => setSelectedIssue(issue)}
                      className="hover:bg-foreground/[0.03] transition-colors cursor-pointer group"
                    >
                      {/* Priority */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-2 w-2 rounded-full ${priorityInfo.dotColor}`}
                          />
                          <span className={`font-medium ${priorityInfo.color}`}>
                            {priorityInfo.label}
                          </span>
                        </div>
                      </td>

                      {/* Title, Labels, Description */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                              {issue.title}
                            </span>
                            {issue.labels && issue.labels.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                {issue.labels.map((lbl) => (
                                  <span
                                    key={lbl.id}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-medium border"
                                    style={{
                                      backgroundColor: `${lbl.color}15`,
                                      color: lbl.color,
                                      borderColor: `${lbl.color}30`,
                                    }}
                                  >
                                    {lbl.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {issue.description && (
                            <p className="text-foreground/60 line-clamp-1 text-xs">
                              {issue.description}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Milestone */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-foreground/70">
                        {issue.milestone ? (
                          <div className="flex items-center gap-1.5">
                            <Flag className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="truncate max-w-[120px] font-medium">
                              {issue.milestone.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-foreground/30">—</span>
                        )}
                      </td>

                      {/* Assignee */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {issue.assignee ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                              {issue.assignee.name?.[0]?.toUpperCase() ||
                                issue.assignee.email[0].toUpperCase()}
                            </div>
                            <span className="text-foreground/80 truncate max-w-[110px]">
                              {issue.assignee.name || issue.assignee.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-foreground/40 italic">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right text-foreground/50">
                        {new Date(issue.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Deterministic Cursor Pagination Footer */}
        <div className="p-3.5 border-t border-border bg-foreground/[0.01] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-foreground/60">
          <div>
            {paginationMeta.total > 0 ? (
              <span>
                Showing <strong className="text-foreground">{startItem}</strong> to{' '}
                <strong className="text-foreground">{endItem}</strong> of{' '}
                <strong className="text-foreground">{paginationMeta.total}</strong> issues
              </span>
            ) : (
              <span>No issues to display</span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              onClick={handlePrevPage}
              disabled={pageIndex <= 0 || loading}
              className="h-8 px-2.5 text-xs flex items-center gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </Button>

            <span className="px-2 font-medium text-foreground">
              Page {pageIndex + 1}
            </span>

            <Button
              variant="outline"
              onClick={handleNextPage}
              disabled={!paginationMeta.hasNextPage || loading}
              className="h-8 px-2.5 text-xs flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateIssueModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        projectId={projectId}
        onIssueCreated={() => {
          // Re-fetch page to reflect new issue in sorted query
          loadIssues(cursorsStack[pageIndex] || null);
          setIsCreateModalOpen(false);
        }}
        milestones={milestones}
      />

      <IssueDetailModal
        isOpen={Boolean(selectedIssue)}
        onClose={() => setSelectedIssue(null)}
        projectId={projectId}
        issue={selectedIssue}
        onIssueUpdated={(updated) => {
          setIssues((prev) =>
            prev.map((i) => (i.id === updated.id ? updated : i))
          );
          setSelectedIssue(updated);
        }}
        onIssueDeleted={(deletedId) => {
          setIssues((prev) => prev.filter((i) => i.id !== deletedId));
          setSelectedIssue(null);
          loadIssues(cursorsStack[pageIndex] || null);
        }}
        canEdit={canMutateIssues}
        members={members}
        currentUserId={currentUserId}
        isProjectAdmin={isProjectAdmin}
        projectLabels={labels}
        onOpenManageLabels={() => setIsManageLabelsModalOpen(true)}
        milestones={milestones}
      />

      <ManageLabelsModal
        isOpen={isManageLabelsModalOpen}
        onClose={() => setIsManageLabelsModalOpen(false)}
        projectId={projectId}
        labels={labels}
        onLabelsChanged={(updatedLabels) => setLabels(updatedLabels)}
        onLabelUpdated={(updatedLabel) =>
          setLabels((prev) =>
            prev.map((l) => (l.id === updatedLabel.id ? updatedLabel : l))
          )
        }
        onLabelDeleted={(deletedLabelId) =>
          setLabels((prev) => prev.filter((l) => l.id !== deletedLabelId))
        }
        canManage={isProjectAdmin}
      />
    </div>
  );
}
