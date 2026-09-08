import prisma from '../../infrastructure/prisma';
import { GithubIntegrationDto, GithubRepositoryDto } from '@forgeboard/types';

export class GithubRepository {
  async upsertIntegration(
    projectId: string,
    workspaceId: string,
    installedByUserId: string,
    encryptedAccessToken: string,
    githubAccountLogin: string
  ): Promise<GithubIntegrationDto> {
    return prisma.githubIntegration.upsert({
      where: { projectId },
      create: {
        projectId,
        workspaceId,
        installedByUserId,
        accessToken: encryptedAccessToken,
        githubAccountLogin,
      },
      update: {
        accessToken: encryptedAccessToken,
        githubAccountLogin,
        installedByUserId,
      },
    });
  }

  async getWorkspaceIdForProject(projectId: string): Promise<string | null> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    return project?.workspaceId || null;
  }

  async getIntegrationByProjectId(projectId: string): Promise<{ id: string; accessToken: string; workspaceId: string } | null> {
    return prisma.githubIntegration.findUnique({
      where: { projectId },
      select: { id: true, accessToken: true, workspaceId: true },
    });
  }

  async createRepository(
    integrationId: string,
    projectId: string,
    githubRepoId: number,
    owner: string,
    name: string,
    fullName: string
  ): Promise<GithubRepositoryDto> {
    return prisma.githubRepository.upsert({
      where: { projectId_githubRepoId: { projectId, githubRepoId } },
      create: {
        integrationId,
        projectId,
        githubRepoId,
        owner,
        name,
        fullName,
      },
      update: {
        owner,
        name,
        fullName,
      },
    });
  }

  
  async createIssuePullRequest(issueId: string, repositoryId: string, prNumber: number, prStatus: string, prUrl: string) {
    return prisma.issuePullRequest.upsert({
      where: {
        issueId_githubRepositoryId_prNumber: {
          issueId,
          githubRepositoryId: repositoryId,
          prNumber
        }
      },
      create: {
        issueId,
        githubRepositoryId: repositoryId,
        prNumber,
        prStatus,
        prUrl
      },
      update: {
        prStatus,
        prUrl
      }
    });
  }


  async getRepositories(projectId: string): Promise<GithubRepositoryDto[]> {
    return prisma.githubRepository.findMany({
      where: { projectId },
    });
  }

  async getRepositoryById(projectId: string, repoId: string) {
    return prisma.githubRepository.findUnique({
      where: { id: repoId },
    });
  }
}

export const githubRepository = new GithubRepository();
