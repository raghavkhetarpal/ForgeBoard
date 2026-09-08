"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { NotificationDto, NotificationType } from '@forgeboard/types';
import { Button } from '@/components/ui/Button';
import {
  Bell,
  Check,
  CheckCheck,
  AtSign,
  UserCheck,
  MessageSquare,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface ListNotificationsResponse {
  notifications: NotificationDto[];
}

const TYPE_ICONS: Record<
  NotificationType,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  MENTION: {
    icon: AtSign,
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300',
  },
  ASSIGNMENT: {
    icon: UserCheck,
    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-300',
  },
  COMMENT: {
    icon: MessageSquare,
    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300',
  },
};

export function NotificationDropdown() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<ListNotificationsResponse>('/notifications');
      setNotifications(res.notifications || []);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to load notifications.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user, loadNotifications]);

  // Socket.IO event listener for incoming real-time notifications
  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    const handleNotificationCreated = (data: { notification: NotificationDto }) => {
      if (data?.notification) {
        setNotifications((prev) => [data.notification, ...prev]);
      }
    };

    socket.on('notification:created', handleNotificationCreated);

    return () => {
      socket.off('notification:created', handleNotificationCreated);
    };
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const prev = [...notifications];
    setNotifications((current) =>
      current.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    try {
      await apiFetch<{ notification: NotificationDto }>(
        `/notifications/${id}/read`,
        {
          method: 'PATCH',
        }
      );
    } catch {
      // Rollback on failure
      setNotifications(prev);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);
    const prev = [...notifications];
    setNotifications((current) => current.map((n) => ({ ...n, read: true })));

    try {
      await apiFetch<{ success: boolean }>('/notifications/read-all', {
        method: 'POST',
      });
    } catch {
      // Rollback on failure
      setNotifications(prev);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const displayedNotifications =
    filter === 'UNREAD'
      ? notifications.filter((n) => !n.read)
      : notifications;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-50 duration-150">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-background shadow-xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-foreground/[0.02]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                onClick={loadNotifications}
                disabled={loading}
                className="h-7 w-7 p-0 text-foreground/50 hover:text-foreground"
                title="Refresh"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                />
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleMarkAllAsRead}
                  disabled={isMarkingAll}
                  className="h-7 px-2 text-xs text-foreground/60 hover:text-foreground flex items-center gap-1"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5 text-primary" />
                  <span className="hidden sm:inline">Mark all read</span>
                </Button>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center px-4 py-2 border-b border-border text-xs gap-2 bg-foreground/[0.01]">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                filter === 'ALL'
                  ? 'bg-foreground/10 text-foreground'
                  : 'text-foreground/50 hover:text-foreground hover:bg-foreground/5'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('UNREAD')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                filter === 'UNREAD'
                  ? 'bg-foreground/10 text-foreground'
                  : 'text-foreground/50 hover:text-foreground hover:bg-foreground/5'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={loadNotifications}
                className="underline font-medium hover:opacity-80 ml-2 shrink-0 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
            {loading && notifications.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2 text-foreground/40 text-xs">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                <span>Loading notifications...</span>
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="py-12 px-4 text-center text-foreground/50 space-y-1.5">
                <Check className="h-6 w-6 mx-auto text-foreground/30" />
                <p className="text-xs font-medium text-foreground/70">
                  {filter === 'UNREAD'
                    ? 'No unread notifications.'
                    : 'No notifications yet.'}
                </p>
                <p className="text-[11px] text-foreground/40">
                  When you are mentioned or assigned, updates will appear here.
                </p>
              </div>
            ) : (
              displayedNotifications.map((notification) => {
                const typeConfig =
                  TYPE_ICONS[notification.type] || TYPE_ICONS.COMMENT;
                const Icon = typeConfig.icon;

                return (
                  <div
                    key={notification.id}
                    onClick={() => {
                      if (!notification.read) {
                        handleMarkAsRead(notification.id);
                      }
                    }}
                    className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer hover:bg-foreground/[0.03] ${
                      !notification.read ? 'bg-primary/[0.03]' : ''
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${typeConfig.color}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <p
                          className={`text-xs leading-snug break-words ${
                            !notification.read
                              ? 'font-semibold text-foreground'
                              : 'text-foreground/80'
                          }`}
                        >
                          {notification.message}
                        </p>
                        {!notification.read && (
                          <span
                            className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1"
                            title="Unread"
                          />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-foreground/40">
                        <span>
                          {new Date(notification.createdAt).toLocaleDateString(
                            undefined,
                            {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }
                          )}
                        </span>
                        {!notification.read && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(notification.id, e)}
                            className="text-primary hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                            title="Mark as read"
                          >
                            <Check className="h-3 w-3" />
                            <span>Mark read</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
