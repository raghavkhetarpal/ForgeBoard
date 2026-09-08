import { Router } from 'express';
import { githubController } from './github.controller';

const router = Router();

// OAuth callback is global, not under a specific project, because GitHub redirects to a static callback URL
// We will mount this at /api/github/callback in index.ts
router.get('/callback', githubController.handleCallback);

export default router;
