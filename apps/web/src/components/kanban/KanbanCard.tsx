"use client";

import React from 'react';
import { IssueDto, IssuePriority } from '@forgeboard/types';
import { Clock, AlertTriangle, ArrowUp, ArrowRight, ArrowDown, GitPullRequest, Flag } from 'lucide-react';

interface KanbanCardProps {
  issue: IssueDto;
  index: number;
  onClick: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, issue: IssueDto, index: number) => void;
}

const PRIORITY_CONFIG: Record<
  IssuePriority,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  URGENT: {
    label: 'Urgent',
    color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    icon: AlertTriangle,
  },
  HIGH: {
    label: 'High',
    color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
    icon: ArrowUp,
  },
  MEDIUM: {
    label: 'Medium',
    color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    icon: ArrowRight,
  },
  LOW: {
    label: 'Low',
    color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-700',
    icon: ArrowDown,
  },
};

export function KanbanCard({ issue, index, onClick, onDragStart }: KanbanCardProps) {
  const priority = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.MEDIUM;
  const PriorityIcon = priority.icon;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    onDragStart(e, issue, index);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group p-3.5 bg-background rounded-lg border border-border hover:border-primary/50 shadow-xs hover:shadow-md transition-all duration-150 cursor-grab active:cursor-grabbing space-y-2.5 select-none"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          {issue.title}
        </h4>
      </div>

      {issue.description && (
        <p className="text-xs text-foreground/60 line-clamp-2 leading-relaxed">
          {issue.description}
        </p>
      )}

      {issue.labels && issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center pt-0.5">
          {issue.labels.slice(0, 3).map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border"
              style={{
                backgroundColor: `${l.color}18`,
                borderColor: `${l.color}44`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: l.color }}
              />
              <span className="truncate max-w-[100px] text-foreground/80 font-medium">
                {l.name}
              </span>
            </span>
          ))}
          {issue.labels.length > 3 && (
            <span className="text-[10px] font-medium text-foreground/50 px-0.5">
              +{issue.labels.length - 3}
            </span>
          )}
        </div>
      )}

      {issue.pullRequests && issue.pullRequests.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center pt-0.5">
          {issue.pullRequests.map((pr) => (
            <span
              key={pr.id}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                pr.prStatus === 'merged'
                  ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                  : pr.prStatus === 'closed'
                  ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              }`}
            >
              <GitPullRequest className="h-3 w-3 shrink-0" />
              <span>#{pr.prNumber}</span>
              <span className="capitalize text-[9px] opacity-75">
                ({pr.prStatus})
              </span>
            </span>
          ))}
        </div>
      )}

      {issue.milestone && (
        <div className="flex items-center gap-1 text-[11px] font-medium text-amber-800 dark:text-amber-300">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 truncate max-w-full">
            <Flag className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="truncate">{issue.milestone.name}</span>
          </span>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 text-xs text-foreground/50 border-t border-border/40">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border ${priority.color}`}
        >
          <PriorityIcon className="h-3 w-3" />
          <span>{priority.label}</span>
        </span>

        {issue.dueDate ? (
          <span className="flex items-center gap-1 text-[11px] text-foreground/60">
            <Clock className="h-3 w-3" />
            <span>{new Date(issue.dueDate).toLocaleDateString()}</span>
          </span>
        ) : (
          <span className="text-[11px] font-mono text-foreground/40">
            pos:{Math.round(issue.position)}
          </span>
        )}
      </div>
    </div>
  );
}
