"use client";

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormError } from '@/components/ui/FormError';
import { apiFetch, ApiError } from '@/lib/api';
import { LabelDto } from '@forgeboard/types';
import { Tag, Plus, Edit2, Trash2, Check, X, RefreshCw } from 'lucide-react';

interface ManageLabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  labels: LabelDto[];
  onLabelsChanged: (labels: LabelDto[]) => void;
  onLabelDeleted?: (labelId: string) => void;
  onLabelUpdated?: (label: LabelDto) => void;
  canManage?: boolean;
}

interface CreateLabelResponse {
  label: LabelDto;
}

interface UpdateLabelResponse {
  label: LabelDto;
}

export const PRESET_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#64748b', // Slate
];

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export function ManageLabelsModal({
  isOpen,
  onClose,
  projectId,
  labels,
  onLabelsChanged,
  onLabelDeleted,
  onLabelUpdated,
  canManage = true,
}: ManageLabelsModalProps) {
  // New label state
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState('');

  // Deleting state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setGeneralError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setCreateError('Label name is required.');
      return;
    }

    if (!HEX_COLOR_REGEX.test(color)) {
      setCreateError('Color must be a valid 6-digit hex code (e.g. #3b82f6).');
      return;
    }

    setIsCreating(true);

    try {
      const res = await apiFetch<CreateLabelResponse>(
        `/projects/${projectId}/labels`,
        {
          method: 'POST',
          body: JSON.stringify({ name: trimmedName, color }),
        }
      );

      const updated = [...labels, res.label].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      onLabelsChanged(updated);
      setName('');
      setColor(PRESET_COLORS[0]);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setCreateError('You do not have permission to create labels.');
        } else {
          setCreateError(err.message || 'Failed to create label.');
        }
      } else if (err instanceof Error) {
        setCreateError(err.message);
      } else {
        setCreateError('An unexpected error occurred.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (label: LabelDto) => {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
    setEditError('');
    setConfirmDeleteId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('');
    setEditError('');
  };

  const handleUpdate = async (labelId: string) => {
    setEditError('');
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError('Label name is required.');
      return;
    }

    if (!HEX_COLOR_REGEX.test(editColor)) {
      setEditError('Color must be a valid 6-digit hex code.');
      return;
    }

    setIsUpdating(true);

    try {
      const res = await apiFetch<UpdateLabelResponse>(
        `/projects/${projectId}/labels/${labelId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ name: trimmedName, color: editColor }),
        }
      );

      const updated = labels
        .map((l) => (l.id === labelId ? res.label : l))
        .sort((a, b) => a.name.localeCompare(b.name));
      onLabelsChanged(updated);
      onLabelUpdated?.(res.label);
      setEditingId(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setEditError('You do not have permission to update labels.');
        } else {
          setEditError(err.message || 'Failed to update label.');
        }
      } else if (err instanceof Error) {
        setEditError(err.message);
      } else {
        setEditError('An unexpected error occurred.');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (labelId: string) => {
    setGeneralError('');
    setDeletingId(labelId);

    try {
      await apiFetch<{ success: boolean }>(
        `/projects/${projectId}/labels/${labelId}`,
        {
          method: 'DELETE',
        }
      );

      const updated = labels.filter((l) => l.id !== labelId);
      onLabelsChanged(updated);
      onLabelDeleted?.(labelId);
      setConfirmDeleteId(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setGeneralError('You do not have permission to delete labels.');
        } else {
          setGeneralError(err.message || 'Failed to delete label.');
        }
      } else if (err instanceof Error) {
        setGeneralError(err.message);
      } else {
        setGeneralError('An unexpected error occurred.');
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Project Labels"
      description="Create, edit, and organize labels for this project."
      className="max-w-xl max-h-[85vh] overflow-y-auto"
    >
      <div className="space-y-6 pt-1">
        <FormError message={generalError} />

        {/* Create New Label Form */}
        {canManage && (
          <form
            onSubmit={handleCreate}
            className="p-4 rounded-xl border border-border bg-foreground/[0.02] space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70 flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-primary" />
                <span>Create New Label</span>
              </span>

              {/* Preview badge */}
              {name.trim() && (
                <div
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border"
                  style={{
                    backgroundColor: `${color}18`,
                    borderColor: `${color}44`,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-foreground/90 font-medium">
                    {name.trim()}
                  </span>
                </div>
              )}
            </div>

            <FormError message={createError} />

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="label-name"
                  className="text-xs font-medium text-foreground/80 block mb-1"
                >
                  Label Name
                </label>
                <Input
                  id="label-name"
                  placeholder="e.g. Bug, Feature, Urgent"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  disabled={isCreating}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground/80 block mb-1.5">
                  Color
                </label>
                <div className="space-y-2">
                  {/* Preset swatches */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PRESET_COLORS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setColor(preset)}
                        className={`w-6 h-6 rounded-full border transition-all flex items-center justify-center ${
                          color.toLowerCase() === preset.toLowerCase()
                            ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: preset }}
                        title={preset}
                      >
                        {color.toLowerCase() === preset.toLowerCase() && (
                          <Check className="h-3 w-3 text-white drop-shadow-xs" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Custom Hex input + color picker */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="relative flex items-center">
                      <input
                        type="color"
                        value={HEX_COLOR_REGEX.test(color) ? color : '#3b82f6'}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-8 h-8 rounded border border-border cursor-pointer p-0.5 bg-background"
                        title="Pick custom color"
                      />
                    </div>
                    <Input
                      type="text"
                      placeholder="#3b82f6"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      maxLength={7}
                      className="h-8 w-28 text-xs font-mono"
                    />
                    <span className="text-[11px] text-foreground/50">
                      6-character hex code
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-1 flex justify-end">
                <Button
                  type="submit"
                  disabled={isCreating || !name.trim()}
                  className="h-8 px-3 text-xs flex items-center gap-1.5"
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Label</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Existing Labels List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
              Project Labels ({labels.length})
            </span>
          </div>

          {labels.length === 0 ? (
            <div className="py-8 text-center text-foreground/50 space-y-2">
              <Tag className="h-8 w-8 mx-auto text-foreground/30" />
              <p className="text-xs">No labels created for this project yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {labels.map((label) => {
                const isEditing = editingId === label.id;
                const isDeleting = deletingId === label.id;
                const isConfirming = confirmDeleteId === label.id;

                if (isEditing) {
                  return (
                    <div
                      key={label.id}
                      className="py-3 px-2 bg-foreground/[0.02] rounded-lg space-y-3"
                    >
                      <FormError message={editError} />
                      <div className="space-y-2">
                        <div>
                          <label className="text-[11px] font-medium text-foreground/70 block mb-1">
                            Label Name
                          </label>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            maxLength={50}
                            disabled={isUpdating}
                            className="h-8 text-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-foreground/70 block mb-1">
                            Color
                          </label>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {PRESET_COLORS.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setEditColor(preset)}
                                className={`w-5 h-5 rounded-full border transition-all flex items-center justify-center ${
                                  editColor.toLowerCase() ===
                                  preset.toLowerCase()
                                    ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-110'
                                    : 'border-transparent'
                                }`}
                                style={{ backgroundColor: preset }}
                              >
                                {editColor.toLowerCase() ===
                                  preset.toLowerCase() && (
                                  <Check className="h-2.5 w-2.5 text-white" />
                                )}
                              </button>
                            ))}
                            <input
                              type="color"
                              value={
                                HEX_COLOR_REGEX.test(editColor)
                                  ? editColor
                                  : '#3b82f6'
                              }
                              onChange={(e) => setEditColor(e.target.value)}
                              className="w-6 h-6 rounded border border-border cursor-pointer p-0.5 bg-background ml-1"
                            />
                            <Input
                              type="text"
                              value={editColor}
                              onChange={(e) => setEditColor(e.target.value)}
                              maxLength={7}
                              className="h-7 w-24 text-[11px] font-mono ml-1"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            disabled={isUpdating}
                            className="h-7 px-2 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handleUpdate(label.id)}
                            disabled={isUpdating || !editName.trim()}
                            className="h-7 px-2.5 text-xs flex items-center gap-1"
                          >
                            {isUpdating ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={label.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border shrink-0"
                        style={{
                          backgroundColor: `${label.color}18`,
                          borderColor: `${label.color}44`,
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: label.color }}
                        />
                        <span className="text-foreground/90 font-medium truncate max-w-[180px]">
                          {label.name}
                        </span>
                      </span>
                      <span className="text-[11px] font-mono text-foreground/40 hidden sm:inline">
                        {label.color}
                      </span>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        {isConfirming ? (
                          <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/40 p-1 rounded-md border border-red-200 dark:border-red-900">
                            <span className="text-[11px] text-red-600 font-medium px-1">
                              Delete?
                            </span>
                            <Button
                              type="button"
                              onClick={() => handleDelete(label.id)}
                              disabled={isDeleting}
                              className="h-6 px-2 bg-red-600 hover:bg-red-700 text-white text-[11px]"
                            >
                              {isDeleting ? '...' : 'Yes'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={isDeleting}
                              className="h-6 px-1.5 text-[11px]"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleStartEdit(label)}
                              className="h-7 w-7 p-0 text-foreground/60 hover:text-foreground"
                              title="Edit label"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setConfirmDeleteId(label.id)}
                              className="h-7 w-7 p-0 text-foreground/60 hover:text-red-600"
                              title="Delete label"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
