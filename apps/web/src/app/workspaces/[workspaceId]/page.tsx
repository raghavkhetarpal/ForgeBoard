"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AppHeader } from '@/components/navigation/AppHeader';
import { Button } from '@/components/ui/Button';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { apiFetch, ApiError } from '@/lib/api';
import {
  WorkspaceDto,
  WorkspaceMemberDto,
  ProjectDto,
  WorkspaceRole,
} from '@forgeboard/types';
import {
  FolderKanban,
  Plus,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Users,
  Shield,
  Clock,
  Settings,
} from 'lucide-react';
import { WorkspaceMembersTab } from '@/components/workspaces/WorkspaceMembersTab';
import { WorkspaceSettingsTab } from '@/components/workspaces/WorkspaceSettingsTab';

interface WorkspaceDetailResponse {
  workspace: WorkspaceDto;
  members: WorkspaceMemberDto[];
}

interface ProjectsResponse {
  projects: ProjectDto[];
}

const STATUS_COLORS: Record<string, string> = {
  PLANNING: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  ON_HOLD: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  COMPLETED: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  ARCHIVED: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700',
};

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const workspaceId = params.workspaceId as string;

  const [workspace, setWorkspace] = useState<WorkspaceDto | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'projects' | 'members' | 'settings'>('projects');

  // Authentication Route Protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const loadWorkspaceData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);

    try {
      // Load workspace detail and projects concurrently
      const [wsData, projData] = await Promise.all([
        apiFetch<WorkspaceDetailResponse>(`/workspaces/${workspaceId}`),
        apiFetch<ProjectsResponse>(`/workspaces/${workspaceId}/projects`),
      ]);

      setWorkspace(wsData.workspace);
      setMembers(wsData.members || []);
      setProjects(projData.projects || []);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You do not have access to view this workspace.');
        } else if (err.status === 404) {
          setError('Workspace not found.');
        } else {
          setError(err.message || 'Failed to load workspace.');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (user && workspaceId) {
      loadWorkspaceData();
    }
  }, [user, workspaceId, loadWorkspaceData]);

  // Determine the authenticated user's role in this workspace
  const currentUserMember = members.find((m) => m.userId === user?.id);
  const currentUserRole: WorkspaceRole = currentUserMember?.role || 'VIEWER';
  const canCreateProject = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';

  const handleProjectCreated = (newProject: ProjectDto) => {
    setProjects((prev) => [newProject, ...prev]);
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
        breadcrumbs={[
          { label: 'Workspaces', href: '/dashboard' },
          { label: workspace?.name || 'Workspace' },
        ]}
        actions={
          canCreateProject && (
            <Button
              onClick={() => setIsCreateProjectOpen(true)}
              className="h-8 px-3 text-xs flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Project</span>
            </Button>
          )
        }
      />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-foreground/50">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">Loading workspace and projects...</p>
          </div>
        ) : error ? (
          <div className="p-8 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50 flex flex-col items-center justify-center text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-red-800 dark:text-red-300">
                Workspace Error
              </h2>
              <p className="text-sm text-red-600 dark:text-red-400 max-w-md">{error}</p>
            </div>
            <div className="flex space-x-3 pt-2">
              <Link href="/dashboard">
                <Button variant="outline" className="text-xs">
                  Back to Dashboard
                </Button>
              </Link>
              <Button onClick={loadWorkspaceData} className="text-xs">
                Retry
              </Button>
            </div>
          </div>
        ) : workspace ? (
          <>
            {/* Workspace Banner */}
            <div className="p-6 rounded-xl border border-border bg-background shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {workspace.name}
                  </h1>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                    <Shield className="h-3 w-3 mr-1" />
                    {currentUserRole}
                  </span>
                </div>
                <p className="text-xs text-foreground/50 font-mono">
                  Slug: /{workspace.slug} • Created {new Date(workspace.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs text-foreground/70">
                <div className="flex items-center gap-1.5 bg-foreground/5 px-3 py-1.5 rounded-lg border border-border">
                  <Users className="h-4 w-4 text-foreground/50" />
                  <span className="font-semibold text-foreground">{members.length}</span>
                  <span>{members.length === 1 ? 'member' : 'members'}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-foreground/5 px-3 py-1.5 rounded-lg border border-border">
                  <FolderKanban className="h-4 w-4 text-foreground/50" />
                  <span className="font-semibold text-foreground">{projects.length}</span>
                  <span>{projects.length === 1 ? 'project' : 'projects'}</span>
                </div>
              </div>
            </div>

            {/* Workspace Navigation Tabs */}
            <div className="flex items-center space-x-1 border-b border-border pb-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('projects')}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'projects'
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
                }`}
              >
                <FolderKanban className="h-4 w-4" />
                <span>Projects</span>
                <span className="text-xs bg-foreground/10 px-1.5 py-0.5 rounded-full font-mono">
                  {projects.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('members')}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'members'
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Members</span>
                <span className="text-xs bg-foreground/10 px-1.5 py-0.5 rounded-full font-mono">
                  {members.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'settings'
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
                }`}
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </button>
            </div>

            {/* Tab Contents */}
            {activeTab === 'projects' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      Projects
                    </h2>
                    <p className="text-xs text-foreground/60">
                      Active projects and boards in this workspace.
                    </p>
                  </div>
                  {canCreateProject && (
                    <Button
                      onClick={() => setIsCreateProjectOpen(true)}
                      className="h-8 px-3 text-xs flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>New Project</span>
                    </Button>
                  )}
                </div>

                {projects.length === 0 ? (
                  <div className="py-16 px-4 rounded-xl border border-dashed border-border bg-background/50 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="p-3 rounded-full bg-primary/10 text-primary">
                      <FolderKanban className="h-8 w-8" />
                    </div>
                    <div className="max-w-md space-y-1">
                      <h3 className="text-base font-semibold text-foreground">
                        No projects in this workspace
                      </h3>
                      <p className="text-sm text-foreground/60">
                        {canCreateProject
                          ? 'Create your first project to organize tasks, assign issues, and track progress.'
                          : 'No projects have been created yet. An Admin or Owner can create projects.'}
                      </p>
                    </div>
                    {canCreateProject && (
                      <Button
                        onClick={() => setIsCreateProjectOpen(true)}
                        className="flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Create Project</span>
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.map((project) => {
                      const statusClass =
                        STATUS_COLORS[project.status] || STATUS_COLORS.PLANNING;

                      return (
                        <Link
                          key={project.id}
                          href={`/workspaces/${workspaceId}/projects/${project.id}`}
                          className="group p-5 rounded-xl border border-border bg-background hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 group-hover:scale-105 transition-transform">
                                <FolderKanban className="h-5 w-5" />
                              </div>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${statusClass}`}
                              >
                                {project.status}
                              </span>
                            </div>

                            <div>
                              <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                {project.name}
                              </h3>
                              {project.description ? (
                                <p className="text-xs text-foreground/60 line-clamp-2 mt-1">
                                  {project.description}
                                </p>
                              ) : (
                                <p className="text-xs text-foreground/40 italic mt-1">
                                  No description provided.
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-foreground/50">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(project.createdAt).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1 font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                              View <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'members' && (
              <WorkspaceMembersTab
                workspaceId={workspaceId}
                members={members}
                currentUserId={user?.id}
                currentUserRole={currentUserRole}
                onMembersChange={loadWorkspaceData}
              />
            )}

            {activeTab === 'settings' && (
              <WorkspaceSettingsTab
                workspace={workspace}
                currentUserRole={currentUserRole}
                onWorkspaceUpdate={(updated) => setWorkspace(updated)}
              />
            )}
          </>
        ) : null}
      </main>

      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        workspaceId={workspaceId}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
}
