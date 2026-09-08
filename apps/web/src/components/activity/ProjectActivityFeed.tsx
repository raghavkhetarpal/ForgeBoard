"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { ActivityDto } from '@forgeboard/types';
import { Button } from '@/components/ui/Button';
import {
  Activity as ActivityIcon,
  PlusCircle,
  ArrowRightLeft,
  UserPlus,
  UserMinus,
  AlertTriangle,
  MessageSquare,
  GitPullRequest,
  RefreshCw,
  AlertCircle,
  Clock,
  User,
} from 'lucide-react';

interface ProjectActivityFeedProps {
  projectId: string;
}

type ActivityFilter = 'ALL' | 'ISSUES' | 'COMMENTS' | 'GITHUB';

export function ProjectActivityFeed({ projectId }: ProjectActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>('ALL');

  const loadActivities = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<ActivityDto[]>(
        `/projects/${projectId}/activity`
      );
      setActivities(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You do not have permission to view this project activity.');
        } else {
          setError(err.message || 'Failed to load activity feed.');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while loading activity.');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const filteredActivities = useMemo(() => {
    if (filter === 'ALL') return activities;
    if (filter === 'ISSUES') {
      return activities.filter(
        (a) =>
          a.action.startsWith('ISSUE_') &&
          (a.metadata as Record<string, unknown> | null)?.reason !==
            'github_pr_closed'
      );
    }
    if (filter === 'COMMENTS') {
      return activities.filter((a) => a.action.startsWith('COMMENT_'));
    }
    if (filter === 'GITHUB') {
      return activities.filter(
        (a) =>
          a.action.startsWith('GITHUB_') ||
          (a.metadata as Record<string, unknown> | null)?.reason ===
            'github_pr_closed'
      );
    }
    return activities;
  }, [activities, filter]);

  const getActivityIcon = (activity: ActivityDto) => {
    const meta = activity.metadata as Record<string, unknown> | null;
    if (meta?.reason === 'github_pr_closed') {
      return {
        icon: GitPullRequest,
        color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      };
    }

    switch (activity.action) {
      case 'ISSUE_CREATED':
        return {
          icon: PlusCircle,
          color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        };
      case 'ISSUE_STATUS_CHANGED':
        return {
          icon: ArrowRightLeft,
          color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        };
      case 'ISSUE_ASSIGNED':
        return {
          icon: UserPlus,
          color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        };
      case 'ISSUE_UNASSIGNED':
        return {
          icon: UserMinus,
          color: 'text-slate-600 bg-slate-50 dark:bg-slate-900/40 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        };
      case 'ISSUE_PRIORITY_CHANGED':
        return {
          icon: AlertTriangle,
          color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        };
      case 'COMMENT_CREATED':
        return {
          icon: MessageSquare,
          color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200 dark:border-teal-800',
        };
      case 'GITHUB_PR_LINKED':
        return {
          icon: GitPullRequest,
          color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        };
      default:
        return {
          icon: ActivityIcon,
          color: 'text-foreground/70 bg-foreground/5 border-border',
        };
    }
  };

  const renderActivityDescription = (activity: ActivityDto) => {
    const meta = (activity.metadata || {}) as Record<string, unknown>;
    const actorName = activity.actor?.name || 'System';

    if (meta.reason === 'github_pr_closed') {
      return (
        <span className="text-xs text-foreground/80 leading-relaxed">
          <strong className="text-foreground font-semibold">
            GitHub Pull Request #{String(meta.prNumber || '')}
          </strong>{' '}
          closed and automatically transitioned issue status to{' '}
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            {String(meta.to)}
          </span>
          .
        </span>
      );
    }

    switch (activity.action) {
      case 'ISSUE_CREATED':
        return (
          <span className="text-xs text-foreground/80 leading-relaxed">
            <strong className="text-foreground font-semibold">{actorName}</strong>{' '}
            created issue{' '}
            {meta.title ? (
              <span className="font-semibold text-foreground">
                &ldquo;{String(meta.title)}&rdquo;
              </span>
            ) : (
              <span className="font-mono text-[11px]">#{activity.targetId}</span>
            )}
            {Boolean(meta.status) && (
              <>
                {' '}
                with status{' '}
                <span className="font-medium text-foreground">
                  {String(meta.status)}
                </span>
              </>
            )}
            {Boolean(meta.priority) && (
              <>
                {' '}
                and priority{' '}
                <span className="font-medium text-foreground">
                  {String(meta.priority)}
                </span>
              </>
            )}
            .
          </span>
        );

      case 'ISSUE_STATUS_CHANGED':
        return (
          <span className="text-xs text-foreground/80 leading-relaxed">
            <strong className="text-foreground font-semibold">{actorName}</strong>{' '}
            moved issue status from{' '}
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-foreground/5 border border-border">
              {String(meta.from || 'unknown')}
            </span>{' '}
            to{' '}
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
              {String(meta.to || 'unknown')}
            </span>
            .
          </span>
        );

      case 'ISSUE_ASSIGNED':
        return (
          <span className="text-xs text-foreground/80 leading-relaxed">
            <strong className="text-foreground font-semibold">{actorName}</strong>{' '}
            assigned issue{' '}
            <span className="font-mono text-[11px]">#{activity.targetId}</span>
            {meta.to ? (
              <>
                {' '}
                to user{' '}
                <span className="font-mono text-[11px]">{String(meta.to)}</span>
              </>
            ) : (
              ''
            )}
            .
          </span>
        );

      case 'ISSUE_UNASSIGNED':
        return (
          <span className="text-xs text-foreground/80 leading-relaxed">
            <strong className="text-foreground font-semibold">{actorName}</strong>{' '}
            unassigned issue{' '}
            <span className="font-mono text-[11px]">#{activity.targetId}</span>.
          </span>
        );

      case 'ISSUE_PRIORITY_CHANGED':
        return (
          <span className="text-xs text-foreground/80 leading-relaxed">
            <strong className="text-foreground font-semibold">{actorName}</strong>{' '}
            updated priority from{' '}
            <span className="font-medium text-foreground/70">
              {String(meta.from || 'none')}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-foreground">
              {String(meta.to)}
            </span>
            .
          </span>
        );

      case 'COMMENT_CREATED':
        return (
          <span className="text-xs text-foreground/80 leading-relaxed">
            <strong className="text-foreground font-semibold">{actorName}</strong>{' '}
            commented on issue{' '}
            <span className="font-mono text-[11px]">
              #{String(meta.issueId || activity.targetId)}
            </span>
            .
          </span>
        );

      case 'GITHUB_PR_LINKED':
        return (
          <span className="text-xs text-foreground/80 leading-relaxed">
            <strong className="text-foreground font-semibold">{actorName}</strong>{' '}
            linked GitHub Pull Request{' '}
            <a
              href={String(meta.prUrl || '#')}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              #{String(meta.prNumber || '')}
              {meta.prTitle ? ` "${String(meta.prTitle)}"` : ''}
            </a>
            {Boolean(meta.prStatus) && (
              <span className="ml-1 text-foreground/60 text-[11px]">
                ({String(meta.prStatus)})
              </span>
            )}
            .
          </span>
        );

      default:
        return (
          <span className="text-xs text-foreground/80 leading-relaxed">
            <strong className="text-foreground font-semibold">{actorName}</strong>{' '}
            performed{' '}
            <span className="font-mono text-[11px]">{activity.action}</span> on{' '}
            <span className="font-medium">{activity.targetType}</span>.
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="p-4 rounded-xl border border-border bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
            <ActivityIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Project Activity Feed
            </h2>
            <p className="text-xs text-foreground/60">
              Audit log of status changes, assignments, comments, and integrations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-foreground/5 p-1 rounded-lg border border-border text-xs">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                filter === 'ALL'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              All ({activities.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('ISSUES')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                filter === 'ISSUES'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              Issues
            </button>
            <button
              type="button"
              onClick={() => setFilter('COMMENTS')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                filter === 'COMMENTS'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              Comments
            </button>
            <button
              type="button"
              onClick={() => setFilter('GITHUB')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                filter === 'GITHUB'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              GitHub
            </button>
          </div>

          <Button
            variant="outline"
            onClick={loadActivities}
            disabled={loading}
            className="h-8 px-2.5 text-xs flex items-center gap-1.5"
            title="Refresh feed"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50 flex flex-col items-center justify-center text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
              Failed to load activity
            </h3>
            <p className="text-xs text-red-600 dark:text-red-400 max-w-md">
              {error}
            </p>
          </div>
          <Button onClick={loadActivities} className="text-xs">
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 text-foreground/50">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs">Loading activity timeline...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredActivities.length === 0 && (
        <div className="py-16 px-4 rounded-xl border border-dashed border-border bg-background/50 flex flex-col items-center justify-center text-center space-y-3">
          <div className="p-3 rounded-full bg-foreground/5 text-foreground/40">
            <ActivityIcon className="h-8 w-8" />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              No activity recorded yet
            </h3>
            <p className="text-xs text-foreground/60">
              Actions like creating or moving issues, leaving comments, and
              linking pull requests will automatically generate timeline events.
            </p>
          </div>
        </div>
      )}

      {/* Timeline Feed */}
      {!loading && !error && filteredActivities.length > 0 && (
        <div className="p-6 rounded-xl border border-border bg-background shadow-xs">
          <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
            {filteredActivities.map((activity) => {
              const iconConfig = getActivityIcon(activity);
              const Icon = iconConfig.icon;

              return (
                <div key={activity.id} className="relative flex items-start gap-4">
                  {/* Timeline marker */}
                  <div
                    className={`absolute -left-6 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border shadow-xs z-10 ${iconConfig.color}`}
                  >
                    <Icon className="h-3 w-3" />
                  </div>

                  {/* Activity Entry Content */}
                  <div className="flex-1 bg-foreground/[0.015] hover:bg-foreground/[0.03] p-3 rounded-lg border border-border/60 transition-colors space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      {renderActivityDescription(activity)}

                      <span className="text-[11px] text-foreground/50 flex items-center gap-1 shrink-0 font-medium">
                        <Clock className="h-3 w-3" />
                        <span>
                          {new Date(activity.createdAt).toLocaleDateString(
                            undefined,
                            {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }
                          )}
                        </span>
                      </span>
                    </div>

                    {/* Actor Details Footer */}
                    <div className="flex items-center gap-1.5 text-[11px] text-foreground/50 pt-1 border-t border-border/40">
                      <User className="h-3 w-3 text-foreground/40" />
                      <span>
                        Actor:{' '}
                        <span className="font-medium text-foreground/70">
                          {activity.actor?.name || 'System / Integration'}
                        </span>
                      </span>
                      {activity.actor?.email && (
                        <span className="text-foreground/40">
                          ({activity.actor.email})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
