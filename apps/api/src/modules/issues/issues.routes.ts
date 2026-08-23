import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireProjectRole } from '../../middleware/rbac.middleware';
import { issuesController } from './issues.controller';
import { labelsController } from '../labels/labels.controller';
import { commentsController } from '../comments/comments.controller';

const router = Router({ mergeParams: true });

router.use(requireAuth);

// VIEWER can read
router.get('/', requireProjectRole('VIEWER'), issuesController.listIssues);
router.get('/:issueId', requireProjectRole('VIEWER'), issuesController.getIssue);

// MEMBER can mutate (create, update, delete)
router.post('/', requireProjectRole('MEMBER'), issuesController.createIssue);
router.patch('/:issueId/move', requireProjectRole('MEMBER'), issuesController.moveIssue);
router.patch('/:issueId', requireProjectRole('MEMBER'), issuesController.updateIssue);
router.delete('/:issueId', requireProjectRole('MEMBER'), issuesController.deleteIssue);

router.post('/:issueId/labels', requireProjectRole('MEMBER'), labelsController.attachLabel);
router.delete('/:issueId/labels/:labelId', requireProjectRole('MEMBER'), labelsController.removeLabel);

// Comments
router.post('/:issueId/comments', requireProjectRole('MEMBER'), commentsController.createComment);
router.get('/:issueId/comments', requireProjectRole('VIEWER'), commentsController.listComments);
router.patch('/:issueId/comments/:commentId', requireProjectRole('MEMBER'), commentsController.updateComment);
router.delete('/:issueId/comments/:commentId', requireProjectRole('MEMBER'), commentsController.deleteComment);

export default router;
