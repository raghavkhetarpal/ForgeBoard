"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AppHeader } from '@/components/navigation/AppHeader';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { ProjectDto, WorkspaceDto, WorkspaceMemberDto } from '@forgeboard/types';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { ProjectMilestones } from '@/components/milestones/ProjectMilestones';
import { ProjectActivityFeed } from '@/components/activity/ProjectActivityFeed';
import { ProjectGithubSettings } from '@/components/github/ProjectGithubSettings';
import {
  FolderKanban,
  AlertCircle,
  RefreshCw,
  Clock,
  Calendar,
  Layers,
  Flag,
  Activity as ActivityIcon,
  Settings as SettingsIcon,
  Info,
  Building2,
  Users,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

interface ProjectResponse {
  project: ProjectDto;
}

interface WorkspaceDetailResponse {
  workspace: WorkspaceDto;
  members: WorkspaceMemberDto[];
}

type TabType = 'overview' | 'board' | 'milestones' | 'activity' | 'settings';

const STATUS_COLORS: Record<string, string> = {
  PLANNING: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  ON_HOLD: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  COMPLETED: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  ARCHIVED: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700',
};

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const workspaceId = params.workspaceId as string;
  const projectId = params.projectId as string;

  const [project, setProject] = useState<ProjectDto | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceDto | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberDto[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('board');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync tab from query parameters if present (e.g. from OAuth redirect)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'settings' || tab === 'board' || tab === 'overview' || tab === 'activity' || tab === 'milestones') {
      setActiveTab(tab as TabType);
    } else if (searchParams.get('github')) {
      setActiveTab('settings');
    }
  }, [searchParams]);

  // Authentication Route Protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const loadData = useCallback(async () => {
    if (!projectId || !workspaceId) return;
    setLoading(true);
    setError(null);

    try {
      const [projRes, wsRes] = await Promise.all([
        apiFetch<ProjectResponse>(`/projects/${projectId}`),
        apiFetch<WorkspaceDetailResponse>(`/workspaces/${workspaceId}`).catch(() => null),
      ]);

      setProject(projRes.project);
      if (wsRes) {
        setWorkspace(wsRes.workspace);
        setMembers(wsRes.members || []);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You do not have permission to view this project.');
        } else if (err.status === 404) {
          setError('Project not found.');
        } else {
          setError(err.message || 'Failed to load project.');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while loading project.');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, workspaceId]);

  useEffect(() => {
    if (user && projectId && workspaceId) {
      loadData();
    }
  }, [user, projectId, workspaceId, loadData]);

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

  const breadcrumbs: { label: string; href?: string }[] = [
    { label: 'Workspaces', href: '/dashboard' },
    {
      label: workspace?.name || 'Workspace',
      href: `/workspaces/${workspaceId}`,
    },
    { label: project?.name || 'Project' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader breadcrumbs={breadcrumbs} />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-foreground/50">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">Loading project...</p>
          </div>
        ) : error ? (
          <div className="p-8 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50 flex flex-col items-center justify-center text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-red-800 dark:text-red-300">
                Project Error
              </h2>
              <p className="text-sm text-red-600 dark:text-red-400 max-w-md">{error}</p>
            </div>
            <div className="flex space-x-3 pt-2">
              <Link href={`/workspaces/${workspaceId}`}>
                <Button variant="outline" className="text-xs flex items-center gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Workspace</span>
                </Button>
              </Link>
              <Button onClick={loadData} className="text-xs">
                Retry
              </Button>
            </div>
          </div>
        ) : project ? (
          <>
            {/* Top Workspace Context */}
            <div className="flex items-center justify-between text-xs text-foreground/60 pb-1">
              <Link
                href={`/workspaces/${workspaceId}`}
                className="hover:text-primary transition-colors flex items-center gap-1.5 font-medium"
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>{workspace?.name || 'Workspace'}</span>
              </Link>
              <span className="font-mono">ID: {project.id}</span>
            </div>

            {/* Project Header Shell */}
            <div className="p-6 rounded-xl border border-border bg-background shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      <FolderKanban className="h-6 w-6" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        {project.name}
                      </h1>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                            STATUS_COLORS[project.status] || STATUS_COLORS.PLANNING
                          }`}
                        >
                          {project.status}
                        </span>
                        {project.deadline && (
                          <span className="text-xs text-foreground/60 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Due {new Date(project.deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {project.description && (
                    <p className="text-sm text-foreground/70 max-w-2xl pt-1">
                      {project.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-foreground/60 shrink-0">
                  <div className="flex items-center gap-1.5 bg-foreground/5 px-3 py-1.5 rounded-lg border border-border">
                    <Calendar className="h-3.5 w-3.5 text-foreground/50" />
                    <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center space-x-1 border-t border-border pt-4 -mb-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                    activeTab === 'overview'
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
                  }`}
                >
                  <Info className="h-4 w-4" />
                  <span>Overview</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('board')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                    activeTab === 'board'
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  <span>Board</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('milestones')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                    activeTab === 'milestones'
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
                  }`}
                >
                  <Flag className="h-4 w-4" />
                  <span>Milestones</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('activity')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                    activeTab === 'activity'
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
                  }`}
                >
                  <ActivityIcon className="h-4 w-4" />
                  <span>Activity</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                    activeTab === 'settings'
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
                  }`}
                >
                  <SettingsIcon className="h-4 w-4" />
                  <span>Settings</span>
                </button>
              </div>
            </div>

            {/* Tab Contents */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  {/* About Section */}
                  <div className="p-6 rounded-xl border border-border bg-background space-y-3">
                    <h2 className="text-base font-semibold text-foreground">
                      About Project
                    </h2>
                    <p className="text-sm text-foreground/70 leading-relaxed">
                      {project.description ||
                        'No detailed description has been provided for this project yet.'}
                    </p>
                  </div>

                  {/* Kanban Quick Action */}
                  <div className="p-6 rounded-xl border border-border bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                        <Layers className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-semibold text-foreground">
                          Interactive Issue Board
                        </h3>
                        <p className="text-xs text-foreground/60 leading-relaxed">
                          Manage tasks, drag issues between backlog, todo, in progress, and done columns.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setActiveTab('board')}
                      className="text-xs shrink-0 flex items-center gap-1.5"
                    >
                      <span>Open Kanban Board</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Sidebar Details */}
                <div className="space-y-6">
                  <div className="p-5 rounded-xl border border-border bg-background space-y-4">
                    <h2 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                      Project Details
                    </h2>

                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-foreground/50 block mb-1">Status</span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                            STATUS_COLORS[project.status] || STATUS_COLORS.PLANNING
                          }`}
                        >
                          {project.status}
                        </span>
                      </div>

                      <div>
                        <span className="text-foreground/50 block mb-0.5">Workspace</span>
                        <span className="font-medium text-foreground">
                          {workspace?.name || workspaceId}
                        </span>
                      </div>

                      <div>
                        <span className="text-foreground/50 block mb-0.5">Created Date</span>
                        <span className="text-foreground/80">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {project.deadline && (
                        <div>
                          <span className="text-foreground/50 block mb-0.5">Deadline</span>
                          <span className="text-foreground/80">
                            {new Date(project.deadline).toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      <div>
                        <span className="text-foreground/50 block mb-0.5">Workspace Members</span>
                        <div className="flex items-center gap-1.5 text-foreground/80 font-medium">
                          <Users className="h-3.5 w-3.5 text-foreground/50" />
                          <span>{members.length} members with workspace access</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'board' && (
              <KanbanBoard
                projectId={projectId}
                canMutateIssues={
                  members.find((m) => m.userId === user?.id)?.role !== 'VIEWER'
                }
                members={members}
                currentUserId={user?.id}
                isProjectAdmin={
                  members.find((m) => m.userId === user?.id)?.role === 'OWNER' ||
                  members.find((m) => m.userId === user?.id)?.role === 'ADMIN'
                }
              />
            )}

            {activeTab === 'milestones' && (
              <ProjectMilestones
                projectId={projectId}
                canMutateMilestones={
                  members.find((m) => m.userId === user?.id)?.role !== 'VIEWER'
                }
              />
            )}

            {activeTab === 'activity' && (
              <ProjectActivityFeed projectId={projectId} />
            )}

            {activeTab === 'settings' && (
              <ProjectGithubSettings
                projectId={projectId}
                isProjectAdmin={
                  members.find((m) => m.userId === user?.id)?.role === 'OWNER' ||
                  members.find((m) => m.userId === user?.id)?.role === 'ADMIN'
                }
                initialAlert={
                  searchParams.get('github') === 'success'
                    ? {
                        type: 'success',
                        message: 'GitHub account connected successfully!',
                      }
                    : searchParams.get('github') === 'error'
                    ? {
                        type: 'error',
                        message: 'Failed to complete GitHub authorization.',
                      }
                    : null
                }
              />
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
