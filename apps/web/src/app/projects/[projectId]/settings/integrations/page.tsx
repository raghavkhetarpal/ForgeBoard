"use client";

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { ProjectDto } from '@forgeboard/types';
import { RefreshCw } from 'lucide-react';

interface ProjectResponse {
  project: ProjectDto;
}

export default function GithubOAuthRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const projectId = params.projectId as string;
  const githubStatus = searchParams.get('github') || 'success';

  useEffect(() => {
    async function resolveAndRedirect() {
      try {
        const res = await apiFetch<ProjectResponse>(`/projects/${projectId}`);
        if (res?.project?.workspaceId) {
          router.replace(
            `/workspaces/${res.project.workspaceId}/projects/${projectId}?tab=settings&github=${githubStatus}`
          );
          return;
        }
      } catch {
        // Fallback to dashboard if project cannot be resolved
        router.replace('/dashboard');
      }
    }

    if (projectId) {
      resolveAndRedirect();
    }
  }, [projectId, githubStatus, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-3 bg-background">
      <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      <p className="text-xs text-foreground/60">
        Completing GitHub connection and redirecting...
      </p>
    </div>
  );
}
