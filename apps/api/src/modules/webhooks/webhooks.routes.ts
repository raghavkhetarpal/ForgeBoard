import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../../infrastructure/prisma';
import { AppError } from '../../infrastructure/errors';
import { getSocketServer } from '../../infrastructure/socket';
import { activityService } from '../activity/activity.service';

const router = Router();

function verifyGithubSignature(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    // If we don't have a secret configured, we can't verify. Fail closed.
    return next(new AppError('Webhook secret not configured', 500, 'SERVER_ERROR'));
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature || typeof signature !== 'string') {
    return res.status(401).send('Missing signature'); // Deliberately generic string response
  }

  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody; // Populated by express.json({ verify: ... })
  if (!rawBody) {
    return res.status(401).send('Missing body');
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  try {
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return res.status(401).send('Invalid signature');
    }
  } catch (_err) {
    return res.status(401).send('Invalid signature');
  }

  next();
}

router.post('/github', verifyGithubSignature, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deliveryId = req.headers['x-github-delivery'];
    const eventType = req.headers['x-github-event'];

    if (typeof deliveryId !== 'string' || typeof eventType !== 'string') {
      res.status(400).send('Missing required headers');
      return;
    }

    // Idempotency check using the database table
    try {
      await prisma.webhookDelivery.create({
        data: {
          githubDeliveryId: deliveryId,
          eventType,
        }
      });
    } catch (err) {
      const pErr = err as { code?: string };
      // If P2002 (Unique constraint failed), this delivery was already processed
      if (pErr.code === 'P2002') {
        res.status(200).send('Already processed');
        return;
      }
      throw err;

      // If P2002 (Unique constraint failed), this delivery was already processed
      if (err.code === 'P2002') {
        res.status(200).send('Already processed');
        return;
      }
      throw err;
    }

    // We only care about pull_request merged events for now
    if (eventType !== 'pull_request') {
      res.status(200).send('Ignored event type');
      return;
    }

    const payload = req.body;
    
    // Narrow scope: ONLY pull_request 'closed' where 'merged' === true
    if (payload.action !== 'closed' || payload.pull_request?.merged !== true) {
      res.status(200).send('Ignored action');
      return;
    }

    const prNumber = payload.pull_request.number;
    const repoId = payload.repository?.id;

    if (!prNumber || !repoId) {
      res.status(200).send('Missing PR or Repo data');
      return;
    }

    // Look up the linked issue
    const issueLink = await prisma.issuePullRequest.findFirst({
      where: {
        repository: {
          githubRepoId: repoId
        },
        prNumber: prNumber
      },
      include: {
        issue: true
      }
    });

    if (!issueLink) {
      // Not linked to any ForgeBoard issue
      res.status(200).send('No linked issue found');
      return;
    }

    // Update PR status in our DB
    await prisma.issuePullRequest.update({
      where: { id: issueLink.id },
      data: { prStatus: 'merged' }
    });

    // Update issue status to DONE
    const updatedIssue = await prisma.issue.update({
      where: { id: issueLink.issue.id },
      data: { status: 'DONE' }
    });

    // Log activity for webhook auto-close
    void activityService.logActivity({
      projectId: updatedIssue.projectId,
      workspaceId: updatedIssue.workspaceId,
      actorId: null,
      action: 'PR_MERGED_AUTO_CLOSED',
      targetType: 'ISSUE',
      targetId: updatedIssue.id,
      metadata: { 
        message: `PR #${prNumber} merged, issue auto-closed`,
        prNumber,
        repoId
      }
    });

    // Emit real-time socket event
    const io = getSocketServer();
    io.to(`project:${updatedIssue.projectId}`).emit('issue:updated', { issue: updatedIssue });

    res.status(200).send('Processed');
  } catch (error) {
    next(error);
  }
});

export default router;
