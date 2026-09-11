"use client";

import React, { useState } from 'react';
import { CommentDto } from '@forgeboard/types';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Edit2, Trash2, Clock, Check, X } from 'lucide-react';

interface CommentItemProps {
  comment: CommentDto;
  currentUserId?: string;
  isProjectAdmin?: boolean;
  onUpdate: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}

// Render comment text with @mention highlights
function renderCommentContent(content: string) {
  // Matches @email@domain.tld per backend extractMentions util
  const mentionRegex = /(@[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const parts = content.split(mentionRegex);

  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith('@') && part.includes('@', 1)) {
          return (
            <span
              key={index}
              className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium text-xs mx-0.5 border border-primary/20"
            >
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

export function CommentItem({
  comment,
  currentUserId,
  isProjectAdmin = false,
  onUpdate,
  onDelete,
}: CommentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(comment.content);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const isAuthor = Boolean(currentUserId && comment.authorId === currentUserId);
  const canDelete = isAuthor || isProjectAdmin;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editedContent.trim();
    if (!trimmed) {
      setError('Comment content cannot be empty.');
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      await onUpdate(comment.id, trimmed);
      setIsEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update comment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setError('');
    setIsDeleting(true);
    try {
      await onDelete(comment.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment.');
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  const authorName = comment.author?.name || 'User';
  const authorInitial = authorName.charAt(0).toUpperCase();

  return (
    <div className="p-3.5 bg-background rounded-lg border border-border space-y-2 text-xs">
      {/* Header: Author & Timestamp */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
            {authorInitial}
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-foreground">{authorName}</span>
            <span className="text-foreground/40">•</span>
            <span className="text-foreground/50 text-[11px]">
              {new Date(comment.createdAt).toLocaleDateString()} at{' '}
              {new Date(comment.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {comment.edited && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-foreground/40 italic">
                <Clock className="h-2.5 w-2.5" />
                <span>edited</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {!isEditing && (
          <div className="flex items-center space-x-1">
            {isAuthor && (
              <button
                type="button"
                onClick={() => {
                  setEditedContent(comment.content);
                  setIsEditing(true);
                }}
                disabled={isDeleting}
                className="p-1 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition-colors"
                title="Edit comment"
              >
                <Edit2 className="h-3 w-3" />
              </button>
            )}

            {canDelete && (
              showConfirmDelete ? (
                <div className="flex items-center space-x-1 text-[11px]">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-1.5 py-0.5 rounded bg-red-600 text-white hover:bg-red-700 transition-colors font-medium flex items-center gap-0.5"
                  >
                    <Check className="h-3 w-3" />
                    <span>Confirm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmDelete(false)}
                    disabled={isDeleting}
                    className="p-0.5 text-foreground/40 hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  disabled={isDeleting}
                  className="p-1 rounded text-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  title="Delete comment"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )
            )}
          </div>
        )}
      </div>

      <FormError message={error} />

      {/* Content or Edit Form */}
      {isEditing ? (
        <form onSubmit={handleSave} className="space-y-2 pt-1" data-testid="comment-edit-form">
          <textarea
            rows={3}
            className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-xs placeholder:text-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            disabled={isSaving}
            maxLength={10000}
            required
            autoFocus
            data-testid="comment-edit-textarea"
          />
          <div className="flex items-center justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              className="h-7 px-2 text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="h-7 px-2 text-xs" data-testid="comment-save-btn">
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="text-foreground/80 leading-relaxed whitespace-pre-wrap break-words pl-8">
          {renderCommentContent(comment.content)}
        </div>
      )}
    </div>
  );
}
