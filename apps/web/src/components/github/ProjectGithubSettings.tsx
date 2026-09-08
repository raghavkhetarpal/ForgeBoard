"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import {
  GithubRepositoryDto,
  GithubAvailableRepoDto,
} from '@forgeboard/types';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import {
  GitPullRequest,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Plus,
  ShieldAlert,
  GitFork,
} from 'lucide-react';

interface ProjectGithubSettingsProps {
  projectId: string;
  isProjectAdmin: boolean;
  initialAlert?: { type: 'success' | 'error'; message: string } | null;
}

export function ProjectGithubSettings({
  projectId,
  isProjectAdmin,
  initialAlert = null,
}: ProjectGithubSettingsProps) {
  const [connectedRepos, setConnectedRepos] = useState<GithubRepositoryDto[]>(
    []
  );
  const [availableRepos, setAvailableRepos] = useState<
    GithubAvailableRepoDto[]
  >([]);
  const [isGithubConnected, setIsGithubConnected] = useState<boolean | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false);
  const [isLinkingRepo, setIsLinkingRepo] = useState(false);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    initialAlert?.type === 'success' ? initialAlert.message : null
  );

  useEffect(() => {
    if (initialAlert?.type === 'error') {
      setError(initialAlert.message);
    } else if (initialAlert?.type === 'success') {
      setSuccessMessage(initialAlert.message);
    }
  }, [initialAlert]);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch connected repositories for the project
      const repos = await apiFetch<GithubRepositoryDto[]>(
        `/projects/${projectId}/github/repos`
      );
      setConnectedRepos(Array.isArray(repos) ? repos : []);

      // 2. If project admin, check if GitHub account is connected by fetching available repos
      if (isProjectAdmin) {
        try {
          const avail = await apiFetch<GithubAvailableRepoDto[]>(
            `/projects/${projectId}/github/repos/available`
          );
          setAvailableRepos(Array.isArray(avail) ? avail : []);
          setIsGithubConnected(true);
        } catch (err: unknown) {
          if (err instanceof ApiError && err.status === 400) {
            // Not connected yet
            setIsGithubConnected(false);
          } else {
            // Other error or not authorized
            setIsGithubConnected(false);
          }
        }
      } else {
        // For non-admins, infer connection state from whether repos exist
        setIsGithubConnected(repos && repos.length > 0);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to load GitHub integration settings.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, isProjectAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Initiate OAuth flow
  const handleConnectOAuth = async () => {
    if (!isProjectAdmin || isConnectingOAuth) return;
    setError(null);
    setSuccessMessage(null);
    setIsConnectingOAuth(true);

    try {
      const res = await apiFetch<{ url: string }>(
        `/projects/${projectId}/github/connect`
      );
      if (res.url) {
        window.location.href = res.url;
      } else {
        setError('Failed to obtain GitHub authorization URL.');
        setIsConnectingOAuth(false);
      }
    } catch (err: unknown) {
      setIsConnectingOAuth(false);
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to connect to GitHub.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to initiate GitHub OAuth.');
      }
    }
  };

  // Link an available repository
  const handleLinkRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepoFullName || isLinkingRepo) return;

    const chosen = availableRepos.find(
      (r) => r.full_name === selectedRepoFullName
    );
    if (!chosen) {
      setError('Please select a valid repository from the list.');
      return;
    }

    setIsLinkingRepo(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const newRepo = await apiFetch<GithubRepositoryDto>(
        `/projects/${projectId}/github/repos`,
        {
          method: 'POST',
          body: JSON.stringify({
            owner: chosen.owner.login,
            repo: chosen.name,
          }),
        }
      );

      setConnectedRepos((prev) => [...prev, newRepo]);
      setSelectedRepoFullName('');
      setSuccessMessage(`Repository "${newRepo.fullName}" linked successfully!`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to link repository.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while linking repository.');
      }
    } finally {
      setIsLinkingRepo(false);
    }
  };

  // Unlinked available repos
  const unlinkedAvailableRepos = availableRepos.filter(
    (ar) => !connectedRepos.some((cr) => cr.fullName === ar.full_name)
  );

  return (
    <div className="space-y-6">
      {/* Settings Header */}
      <div className="p-6 rounded-xl border border-border bg-background shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300 shrink-0 mt-0.5">
              <GitPullRequest className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                GitHub Integration
              </h2>
              <p className="text-xs text-foreground/60 max-w-xl leading-relaxed">
                Connect your GitHub repository to link pull requests directly to
                ForgeBoard issues, automatically synchronize statuses, and
                streamline developer workflows.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Button
              variant="outline"
              onClick={loadData}
              disabled={loading}
              className="h-8 px-2.5 text-xs flex items-center gap-1.5"
              title="Refresh integration status"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            {isProjectAdmin && (
              <Button
                onClick={handleConnectOAuth}
                disabled={isConnectingOAuth || loading}
                className="h-8 px-3 text-xs flex items-center gap-1.5 shadow-xs"
              >
                <GitFork className="h-3.5 w-3.5" />
                <span>
                  {isConnectingOAuth
                    ? 'Connecting...'
                    : isGithubConnected
                    ? 'Reconnect GitHub'
                    : 'Connect GitHub'}
                </span>
              </Button>
            )}
          </div>
        </div>

        {/* Status Banners */}
        {successMessage && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        <FormError message={error || undefined} />
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 text-foreground/50">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs">Loading GitHub configuration...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Connected Repositories */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-5 rounded-xl border border-border bg-background shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Connected Repositories
                  </h3>
                  <p className="text-xs text-foreground/50">
                    Repositories configured for pull request linking in this
                    project.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-foreground/5 text-xs font-mono font-medium">
                  {connectedRepos.length}
                </span>
              </div>

              {connectedRepos.length === 0 ? (
                <div className="py-12 px-4 text-center text-foreground/50 space-y-2 border border-dashed border-border rounded-lg bg-foreground/[0.01]">
                  <GitPullRequest className="h-8 w-8 mx-auto text-foreground/30" />
                  <p className="text-xs font-medium text-foreground/70">
                    No repositories connected yet
                  </p>
                  <p className="text-[11px] text-foreground/40 max-w-sm mx-auto">
                    {isProjectAdmin
                      ? isGithubConnected
                        ? 'Select a repository from your GitHub account below to link it.'
                        : 'Click "Connect GitHub" above to authorize access to your repositories.'
                      : 'Ask a project administrator to connect a GitHub repository.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {connectedRepos.map((repo) => (
                    <div
                      key={repo.id}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground truncate">
                            {repo.fullName}
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                            Active
                          </span>
                        </div>
                        <p className="text-[11px] text-foreground/50">
                          Connected on{' '}
                          {new Date(repo.connectedAt).toLocaleDateString()}
                        </p>
                      </div>

                      <a
                        href={`https://github.com/${repo.fullName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                      >
                        <span>View on GitHub</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Link Repository Form (Admin only) */}
            {isProjectAdmin && isGithubConnected && (
              <form
                onSubmit={handleLinkRepository}
                className="p-5 rounded-xl border border-border bg-background shadow-xs space-y-4"
              >
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Link Another Repository
                  </h3>
                  <p className="text-xs text-foreground/50">
                    Choose from your authorized GitHub repositories to enable PR
                    linking.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                  <select
                    value={selectedRepoFullName}
                    onChange={(e) => setSelectedRepoFullName(e.target.value)}
                    disabled={isLinkingRepo || unlinkedAvailableRepos.length === 0}
                    className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                  >
                    <option value="">
                      {unlinkedAvailableRepos.length === 0
                        ? 'No new repositories available'
                        : '-- Select a repository to connect --'}
                    </option>
                    {unlinkedAvailableRepos.map((r) => (
                      <option key={r.id} value={r.full_name}>
                        {r.full_name}
                      </option>
                    ))}
                  </select>

                  <Button
                    type="submit"
                    disabled={!selectedRepoFullName || isLinkingRepo}
                    className="h-9 px-3 text-xs flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {isLinkingRepo ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        <span>Linking...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>Connect Repo</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Right Col: Connection Status & Help Sidebar */}
          <div className="space-y-6">
            <div className="p-5 rounded-xl border border-border bg-background shadow-xs space-y-4 text-xs">
              <h3 className="font-semibold text-foreground border-b border-border pb-2">
                Integration Status
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-foreground/60">OAuth Authorization</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                      isGithubConnected
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                    }`}
                  >
                    {isGithubConnected ? 'Authorized' : 'Disconnected'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-foreground/60">Active Webhooks</span>
                  <span className="text-foreground font-medium">
                    {connectedRepos.length > 0 ? 'Enabled' : 'None'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-foreground/60">Linked Repos</span>
                  <span className="text-foreground font-mono font-medium">
                    {connectedRepos.length}
                  </span>
                </div>
              </div>

              {!isProjectAdmin && (
                <div className="pt-2 border-t border-border flex items-start gap-2 text-foreground/50 text-[11px]">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
                  <span>
                    Only project administrators can connect accounts or add
                    repositories.
                  </span>
                </div>
              )}
            </div>

            <div className="p-5 rounded-xl border border-border bg-background shadow-xs space-y-3 text-xs">
              <h3 className="font-semibold text-foreground">How it works</h3>
              <ul className="space-y-2 text-foreground/70 text-[11px] list-disc pl-4 leading-relaxed">
                <li>
                  Project admins authorize ForgeBoard to access repository
                  metadata.
                </li>
                <li>
                  Connect repositories to make pull requests linkable on issues.
                </li>
                <li>
                  When pull requests are merged or closed on GitHub, webhooks
                  automatically update linked issue statuses and log activity.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
