"use client";

import React, { useState } from 'react';
import { IssueDto, IssueStatus } from '@forgeboard/types';
import { KanbanCard } from './KanbanCard';
import { Plus, Circle, CheckCircle2, AlertCircle, Clock, Ban } from 'lucide-react';

interface KanbanColumnProps {
  status: IssueStatus;
  label: string;
  issues: IssueDto[];
  onCardClick: (issue: IssueDto) => void;
  onAddClick: (status: IssueStatus) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, issue: IssueDto, index: number) => void;
  onDropOnColumn: (targetStatus: IssueStatus, targetIndex: number) => void;
  canCreateIssue?: boolean;
}

const STATUS_ICONS: Record<
  IssueStatus,
  React.ComponentType<{ className?: string }>
> = {
  BACKLOG: Circle,
  TODO: Clock,
  IN_PROGRESS: AlertCircle,
  IN_REVIEW: Clock,
  DONE: CheckCircle2,
  CANCELLED: Ban,
};

const STATUS_ACCENT: Record<IssueStatus, string> = {
  BACKLOG: 'text-slate-500 bg-slate-500/10',
  TODO: 'text-blue-500 bg-blue-500/10',
  IN_PROGRESS: 'text-amber-500 bg-amber-500/10',
  IN_REVIEW: 'text-purple-500 bg-purple-500/10',
  DONE: 'text-emerald-500 bg-emerald-500/10',
  CANCELLED: 'text-rose-500 bg-rose-500/10',
};

export function KanbanColumn({
  status,
  label,
  issues,
  onCardClick,
  onAddClick,
  onDragStart,
  onDropOnColumn,
  canCreateIssue = true,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const StatusIcon = STATUS_ICONS[status] || Circle;
  const accentClass = STATUS_ACCENT[status] || 'text-primary bg-primary/10';

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDropOnContainer = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    // If dropped on the column background, append to the end of the column
    onDropOnColumn(status, issues.length);
  };

  const handleDropOnCard = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Determine drop position relative to the card's bounding box
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const finalIndex = e.clientY > midpoint ? targetIndex + 1 : targetIndex;

    onDropOnColumn(status, finalIndex);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropOnContainer}
      className={`flex flex-col w-80 shrink-0 rounded-xl bg-foreground/[0.02] border transition-all duration-150 max-h-[calc(100vh-14rem)] ${
        isDragOver
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-border/80'
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-border/70 bg-background/50 backdrop-blur-xs rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-md ${accentClass}`}>
            <StatusIcon className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-foreground tracking-tight">
            {label}
          </h3>
          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-foreground/10 text-foreground/70">
            {issues.length}
          </span>
        </div>

        {canCreateIssue && (
          <button
            type="button"
            onClick={() => onAddClick(status)}
            className="p-1 rounded-md text-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors"
            title={`Add issue to ${label}`}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Cards List Drop Area */}
      <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto min-h-[140px]">
        {issues.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 text-center p-3 text-xs text-foreground/40 space-y-1">
            <span>No issues</span>
            <span className="text-[11px] text-foreground/30">Drag issues here</span>
          </div>
        ) : (
          issues.map((issue, idx) => (
            <div
              key={issue.id}
              onDrop={(e) => handleDropOnCard(e, idx)}
              className="relative"
            >
              <KanbanCard
                issue={issue}
                index={idx}
                onClick={() => onCardClick(issue)}
                onDragStart={onDragStart}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
