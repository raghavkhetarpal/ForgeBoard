import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireProjectRole } from '../../middleware/rbac.middleware';
import { issuesController } from './issues.controller';

const router = Router({ mergeParams: true });

router.use(requireAuth);

// VIEWER can read
router.get('/', requireProjectRole('VIEWER'), issuesController.listIssues);
router.get('/:issueId', requireProjectRole('VIEWER'), issuesController.getIssue);

// MEMBER can mutate (create, update, delete)
router.post('/', requireProjectRole('MEMBER'), issuesController.createIssue);
router.patch('/:issueId', requireProjectRole('MEMBER'), issuesController.updateIssue);
router.delete('/:issueId', requireProjectRole('MEMBER'), issuesController.deleteIssue);

export default router;
