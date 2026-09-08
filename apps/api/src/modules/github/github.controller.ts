import { Request, Response, NextFunction } from 'express';
import { githubService } from './github.service';
import z from 'zod';
import { AppError } from '../../infrastructure/errors';

const linkPrSchema = z.object({
  repoId: z.string(),
  prNumber: z.number().int().positive()
});

const connectRepoSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

export class GithubController {
  getConnectUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const user = req.user!;
      
      const url = await githubService.getConnectUrl(projectId, user.id);
      res.json({ url });
    } catch (error) {
      next(error);
    }
  };

  handleCallback = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      const { code, state } = req.query;
      
      if (typeof code !== 'string' || typeof state !== 'string') {
        throw new AppError('Invalid callback parameters', 400, 'BAD_REQUEST');
      }

      const { projectId } = await githubService.handleCallback(code, state);
      
      // In a real app, this would redirect to a frontend success page.
      // Since API might be decoupled, redirecting to frontend with status.
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      res.redirect(`${appUrl}/projects/${projectId}/settings/integrations?github=success`);
    } catch {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      res.redirect(`${appUrl}/settings/integrations?github=error`);
    }
  };

  listAvailableRepositories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const repos = await githubService.listAvailableRepositories(projectId);
      res.json(repos);
    } catch (error) {
      next(error);
    }
  };

  listConnectedRepositories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const repos = await githubService.listConnectedRepositories(projectId);
      res.json(repos);
    } catch (error) {
      next(error);
    }
  };

  connectRepository = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const { owner, repo } = connectRepoSchema.parse(req.body);
      const connected = await githubService.connectRepository(projectId, owner, repo);
      res.status(201).json(connected);
    } catch (error) {
      next(error);
    }
  };

  linkPullRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, issueId } = req.params;
      const { repoId, prNumber } = linkPrSchema.parse(req.body);
      
      const user = req.user!;
      const link = await githubService.linkPullRequest(projectId, issueId, repoId, prNumber, user.id);
      res.status(201).json(link);
    } catch (error) {
      next(error);
    }
  };

  listPullRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, repoId } = req.params;
      const prs = await githubService.listPullRequests(projectId, repoId);
      res.json(prs);
    } catch (error) {
      next(error);
    }
  };
}

export const githubController = new GithubController();
