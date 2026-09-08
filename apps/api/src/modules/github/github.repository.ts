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

  async getIntegrationByProjectId(projectId: string): Promise<{ id: string, accessToken: string } | null> {
    return prisma.githubIntegration.findUnique({
      where: { projectId },
      select: { id: true, accessToken: true },
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
