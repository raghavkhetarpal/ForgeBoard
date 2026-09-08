import { githubRepository } from './github.repository';
import { AppError } from '../../infrastructure/errors';
import { GithubClient } from '../../infrastructure/github-client';
import { encryptString, decryptString } from '../../infrastructure/encryption';
import { signOAuthState, verifyOAuthState } from './github.utils';

export class GithubService {
  async getConnectUrl(projectId: string, userId: string): Promise<string> {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) throw new AppError('GitHub integration is not configured (missing Client ID)', 500, 'SERVER_ERROR');
    
    const workspaceId = await githubRepository.getWorkspaceIdForProject(projectId);
    if (!workspaceId) throw new AppError('Project not found', 404, 'NOT_FOUND');

    const state = signOAuthState(projectId, userId, workspaceId);
    
    const params = new URLSearchParams({
      client_id: clientId,
      state,
      scope: 'repo', // Minimum scope required for PRs and repo metadata
    });
    
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<{ projectId: string }> {
    const parsedState = verifyOAuthState(state);
    if (!parsedState) {
      throw new AppError('Invalid or expired OAuth state', 400, 'BAD_REQUEST');
    }

    const { projectId, userId, workspaceId } = parsedState;

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new AppError('GitHub integration is not configured', 500, 'SERVER_ERROR');
    }

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json() as { error?: string; error_description?: string; access_token: string };
    if (tokenData.error) {
      throw new AppError(`GitHub OAuth Error: ${tokenData.error_description}`, 400, 'OAUTH_ERROR');
    }

    const accessToken = tokenData.access_token;
    
    // Fetch authenticated user details to store login
    const client = new GithubClient(accessToken);
    const githubUser = await client.getAuthenticatedUser();

    // Encrypt token
    const encryptedToken = encryptString(accessToken);

    await githubRepository.upsertIntegration(
      projectId,
      workspaceId,
      userId,
      encryptedToken,
      githubUser.login
    );

    return { projectId };
  }

  async listAvailableRepositories(projectId: string) {
    const integration = await githubRepository.getIntegrationByProjectId(projectId);
    if (!integration) {
      throw new AppError('GitHub is not connected to this project', 400, 'BAD_REQUEST');
    }

    const decryptedToken = decryptString(integration.accessToken);
    const client = new GithubClient(decryptedToken);
    
    return client.listUserRepositories();
  }

  async connectRepository(projectId: string, owner: string, repo: string) {
    const integration = await githubRepository.getIntegrationByProjectId(projectId);
    if (!integration) {
      throw new AppError('GitHub is not connected to this project', 400, 'BAD_REQUEST');
    }

    const decryptedToken = decryptString(integration.accessToken);
    const client = new GithubClient(decryptedToken);
    
    const githubRepo = await client.getRepository(owner, repo);

    return githubRepository.createRepository(
      integration.id,
      projectId,
      githubRepo.id,
      githubRepo.owner.login,
      githubRepo.name,
      githubRepo.full_name
    );
  }

  async listConnectedRepositories(projectId: string) {
    return githubRepository.getRepositories(projectId);
  }

  async listPullRequests(projectId: string, repoId: string) {
    const integration = await githubRepository.getIntegrationByProjectId(projectId);
    if (!integration) {
      throw new AppError('GitHub is not connected to this project', 400, 'BAD_REQUEST');
    }

    const repo = await githubRepository.getRepositoryById(projectId, repoId);
    if (!repo || repo.projectId !== projectId) {
      throw new AppError('Repository not found in this project', 404, 'NOT_FOUND');
    }

    const decryptedToken = decryptString(integration.accessToken);
    const client = new GithubClient(decryptedToken);
    
    return client.listPullRequests(repo.owner, repo.name);
  }
}

export const githubService = new GithubService();
