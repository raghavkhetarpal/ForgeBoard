import { AppError } from './errors';
import { GithubPullRequestDto } from '@forgeboard/types';

export class GithubClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request(path: string, options?: RequestInit) {
    const url = `https://api.github.com${path}`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options?.headers,
    };

    const res = await fetch(url, { ...options, headers });
    
    if (!res.ok) {
      let message = 'GitHub API Error';
      try {
        const errData = await res.json() as { message?: string };
        message = errData.message || message;
      } catch {
        /* ignore */
      }
      throw new AppError(`GitHub API Error: ${message}`, res.status, 'GITHUB_API_ERROR');
    }
    
    return res.json();
  }

  async getAuthenticatedUser(): Promise<{ login: string; id: number }> {
    return this.request('/user') as Promise<{ login: string; id: number }>;
  }

  async listUserRepositories(): Promise<{ id: number; owner: { login: string }; name: string; full_name: string }[]> {
    return this.request('/user/repos?sort=updated&per_page=100') as Promise<{ id: number; owner: { login: string }; name: string; full_name: string }[]>;
  }

  async getRepository(owner: string, repo: string): Promise<{ id: number; owner: { login: string }; name: string; full_name: string }> {
    return this.request(`/repos/${owner}/${repo}`) as Promise<{ id: number; owner: { login: string }; name: string; full_name: string }>;
  }

  async listPullRequests(owner: string, repo: string): Promise<GithubPullRequestDto[]> {
    const prs = await this.request(`/repos/${owner}/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=50`) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    
    return prs.map((pr: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      number: pr.number,
      title: pr.title,
      author: pr.user.login,
      status: pr.state === 'open' ? 'open' : pr.merged_at ? 'merged' : 'closed',
      url: pr.html_url,
      createdAt: new Date(pr.created_at),
      updatedAt: new Date(pr.updated_at),
    }));
  }
}
