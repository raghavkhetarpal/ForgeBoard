import { Router } from 'express';
import { milestonesController } from './milestones.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireProjectRole } from '../../middleware/rbac.middleware';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.post('/', requireProjectRole('MEMBER'), milestonesController.createMilestone);
router.get('/', requireProjectRole('VIEWER'), milestonesController.listMilestones);
router.get('/:milestoneId', requireProjectRole('VIEWER'), milestonesController.getMilestone);
router.patch('/:milestoneId', requireProjectRole('MEMBER'), milestonesController.updateMilestone);
router.delete('/:milestoneId', requireProjectRole('MEMBER'), milestonesController.deleteMilestone);

export default router;
