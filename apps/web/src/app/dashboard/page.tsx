"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/navigation/AppHeader';
import { Button } from '@/components/ui/Button';
import { CreateWorkspaceModal } from '@/components/workspaces/CreateWorkspaceModal';
import { apiFetch, ApiError } from '@/lib/api';
import { UserWorkspaceDto } from '@forgeboard/types';
import { Plus, Building2, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';

interface WorkspacesResponse {
  workspaces: UserWorkspaceDto[];
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<UserWorkspaceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Authentication Route Protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<WorkspacesResponse>('/workspaces');
      setWorkspaces(res.workspaces || []);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to load workspaces.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while loading workspaces.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadWorkspaces();
    }
  }, [user, loadWorkspaces]);

  const handleWorkspaceCreated = (newWorkspace: { id: string }) => {
    router.push(`/workspaces/${newWorkspace.id}`);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2 text-foreground/60 text-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Authenticating...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader
        breadcrumbs={[{ label: 'Workspaces' }]}
        actions={
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="h-8 px-3 text-xs flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Workspace</span>
          </Button>
        }
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Welcome Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Workspaces
            </h1>
            <p className="text-sm text-foreground/60 mt-1">
              Select a workspace to view and manage projects, or create a new one.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={loadWorkspaces}
              disabled={loading}
              className="h-9 px-3 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-foreground/50">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">Loading workspaces...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50 flex flex-col items-center justify-center text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
            <Button variant="outline" onClick={loadWorkspaces} className="text-xs">
              Try Again
            </Button>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="py-16 px-4 rounded-xl border border-dashed border-border bg-background/50 flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-3 rounded-full bg-primary/10 text-primary">
              <Building2 className="h-8 w-8" />
            </div>
            <div className="max-w-md space-y-1">
              <h2 className="text-lg font-semibold text-foreground">No workspaces found</h2>
              <p className="text-sm text-foreground/60">
                You are not currently a member of any workspace. Create your first workspace to start collaborating on projects.
              </p>
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Create Workspace</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws) => (
              <Link
                key={ws.id}
                href={`/workspaces/${ws.id}`}
                className="group p-5 rounded-xl border border-border bg-background hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 group-hover:scale-105 transition-transform">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-foreground/5 text-foreground/70 border border-border">
                      {ws.role}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {ws.name}
                    </h3>
                    <p className="text-xs text-foreground/50 font-mono mt-0.5">
                      /{ws.slug}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-foreground/50">
                  <span>Joined {new Date(ws.joinedAt || ws.createdAt).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1 font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Open <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <CreateWorkspaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onWorkspaceCreated={handleWorkspaceCreated}
      />
    </div>
  );
}
