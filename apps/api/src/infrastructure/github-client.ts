import { AppError } from './errors';
import { GithubPullRequestDto } from '@forgeboard/types';

export interface GithubApiUser {
  login: string;
  id: number;
}

export interface GithubApiRepo {
  id: number;
  owner: {
    login: string;
  };
  name: string;
  full_name: string;
}

export interface GithubApiPullRequest {
  number: number;
  title: string;
  user: {
    login: string;
  };
  state: string;
  merged_at: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export class GithubClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
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
    
    return res.json() as Promise<T>;
  }

  async getAuthenticatedUser(): Promise<GithubApiUser> {
    return this.request<GithubApiUser>('/user');
  }

  async listUserRepositories(): Promise<GithubApiRepo[]> {
    return this.request<GithubApiRepo[]>('/user/repos?sort=updated&per_page=100');
  }

  async getRepository(owner: string, repo: string): Promise<GithubApiRepo> {
    return this.request<GithubApiRepo>(`/repos/${owner}/${repo}`);
  }

  async listPullRequests(owner: string, repo: string): Promise<GithubPullRequestDto[]> {
    const prs = await this.request<GithubApiPullRequest[]>(`/repos/${owner}/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=50`);
    
    return prs.map((pr: GithubApiPullRequest) => ({
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
