"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { CommentDto, WorkspaceMemberDto } from '@forgeboard/types';
import { CommentItem } from './CommentItem';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { MessageSquare, RefreshCw, Send, AtSign, AlertCircle } from 'lucide-react';

interface CommentsSectionProps {
  projectId: string;
  issueId: string;
  members?: WorkspaceMemberDto[];
  currentUserId?: string;
  canComment?: boolean;
  isProjectAdmin?: boolean;
}

interface CommentsResponse {
  comments: CommentDto[];
}

interface CreateCommentResponse {
  comment: CommentDto;
}

export function CommentsSection({
  projectId,
  issueId,
  members = [],
  currentUserId,
  canComment = true,
  isProjectAdmin = false,
}: CommentsSectionProps) {
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New comment state
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Mentions autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number>(0);
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadComments = useCallback(async () => {
    if (!projectId || !issueId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<CommentsResponse>(
        `/projects/${projectId}/issues/${issueId}/comments`
      );
      setComments(res.comments || []);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You do not have permission to view comments on this issue.');
        } else {
          setError(err.message || 'Failed to load comments.');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while loading comments.');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, issueId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Autocomplete matching members
  const matchingMembers = React.useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members.filter((m) => {
      const user = m.user;
      if (!user) return false;
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q)
      );
    });
  }, [mentionQuery, members]);

  // Handle textarea text change and detect '@'
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const pos = e.target.selectionStart || 0;
    setNewCommentText(text);
    setCursorPosition(pos);

    // Look back from current cursor position for '@'
    const textBeforeCursor = text.substring(0, pos);
    const lastAtMatch = /@([a-zA-Z0-9._%+-]*)$/.exec(textBeforeCursor);

    if (lastAtMatch) {
      setMentionQuery(lastAtMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  // Insert selected mention
  const handleSelectMention = (userEmail: string) => {
    if (!textareaRef.current) return;
    const text = newCommentText;
    const pos = cursorPosition;

    const textBeforeCursor = text.substring(0, pos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex === -1) return;

    const newText =
      text.substring(0, atIndex) +
      `@${userEmail} ` +
      text.substring(pos);

    setNewCommentText(newText);
    setMentionQuery(null);

    // Refocus textarea and place cursor after inserted mention
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = atIndex + userEmail.length + 2;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  // Handle keyboard navigation for mentions popup
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && matchingMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % matchingMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(
          (prev) => (prev - 1 + matchingMembers.length) % matchingMembers.length
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = matchingMembers[mentionIndex];
        if (selected?.user?.email) {
          handleSelectMention(selected.user.email);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    // Command/Control + Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handlePostComment();
    }
  };

  // Submit comment
  const handlePostComment = async () => {
    const trimmed = newCommentText.trim();
    if (!trimmed || isSubmitting) return;

    setSubmitError('');
    setIsSubmitting(true);

    try {
      const res = await apiFetch<CreateCommentResponse>(
        `/projects/${projectId}/issues/${issueId}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({ content: trimmed }),
        }
      );

      setComments((prev) => [...prev, res.comment]);
      setNewCommentText('');
      setMentionQuery(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setSubmitError(
            'Permission denied: You must be a project Member to post comments.'
          );
        } else {
          setSubmitError(err.message || 'Failed to post comment.');
        }
      } else if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError('An unexpected error occurred while posting comment.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update comment callback
  const handleUpdateComment = async (commentId: string, content: string) => {
    const res = await apiFetch<{ comment: CommentDto }>(
      `/projects/${projectId}/issues/${issueId}/comments/${commentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      }
    );

    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? res.comment : c))
    );
  };

  // Delete comment callback
  const handleDeleteComment = async (commentId: string) => {
    await apiFetch<{ success: boolean }>(
      `/projects/${projectId}/issues/${issueId}/comments/${commentId}`,
      {
        method: 'DELETE',
      }
    );

    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-4 w-4 text-foreground/60" />
          <h3 className="text-sm font-semibold text-foreground">Activity & Comments</h3>
          <span className="px-1.5 py-0.2 rounded-full text-xs font-medium bg-foreground/10 text-foreground/70">
            {comments.length}
          </span>
        </div>

        <button
          type="button"
          onClick={loadComments}
          disabled={loading}
          className="p-1 text-foreground/40 hover:text-foreground hover:bg-foreground/5 rounded transition-colors"
          title="Refresh comments"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Comment List */}
      {loading ? (
        <div className="py-6 flex flex-col items-center justify-center space-y-2 text-foreground/40 text-xs">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span>Loading comments...</span>
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 text-center space-y-2">
          <AlertCircle className="h-5 w-5 text-red-500 mx-auto" />
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          <Button variant="outline" onClick={loadComments} className="h-7 px-2 text-xs">
            Retry
          </Button>
        </div>
      ) : comments.length === 0 ? (
        <div className="py-6 text-center text-xs text-foreground/40 border border-dashed border-border rounded-lg">
          No comments on this issue yet. Start the discussion below.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              isProjectAdmin={isProjectAdmin}
              onUpdate={handleUpdateComment}
              onDelete={handleDeleteComment}
            />
          ))}
        </div>
      )}

      {/* New Comment Box */}
      {canComment ? (
        <div className="space-y-2 relative">
          <FormError message={submitError} />

          {/* Mentions Autocomplete Popover */}
          {mentionQuery !== null && matchingMembers.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-64 bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden text-xs max-h-48 overflow-y-auto animate-in fade-in duration-100">
              <div className="p-1.5 bg-foreground/5 text-[11px] font-semibold text-foreground/50 border-b border-border flex items-center gap-1">
                <AtSign className="h-3 w-3" />
                <span>Mention Member</span>
              </div>
              {matchingMembers.map((member, idx) => {
                const user = member.user!;
                const isSelected = idx === mentionIndex;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent blur
                      handleSelectMention(user.email);
                    }}
                    className={`w-full text-left p-2 flex items-center space-x-2 transition-colors ${
                      isSelected
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-foreground/5 text-foreground'
                    }`}
                  >
                    <div className="h-5 w-5 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="font-medium truncate">{user.name}</div>
                      <div className="text-[10px] text-foreground/50 truncate">
                        {user.email}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="relative">
            <textarea
              ref={textareaRef}
              rows={3}
              value={newCommentText}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
              placeholder="Leave a comment... (Type @ to mention a team member, ⌘+Enter to send)"
              maxLength={10000}
              className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-xs placeholder:text-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[11px] text-foreground/40">
              <AtSign className="h-3 w-3" />
              <span>Mentions supported (@email)</span>
            </div>

            <Button
              type="button"
              onClick={handlePostComment}
              disabled={!newCommentText.trim() || isSubmitting}
              className="h-8 px-3 text-xs flex items-center gap-1.5"
            >
              <Send className="h-3 w-3" />
              <span>{isSubmitting ? 'Posting...' : 'Comment'}</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-2 text-xs text-foreground/40 italic">
          Viewing mode only. Join project as Member to post comments.
        </div>
      )}
    </div>
  );
}
