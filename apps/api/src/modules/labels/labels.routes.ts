import { Router } from 'express';
import { labelsController } from './labels.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireProjectRole } from '../../middleware/rbac.middleware';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.post('/', requireProjectRole('MEMBER'), labelsController.createLabel);
router.get('/', requireProjectRole('VIEWER'), labelsController.listLabels);
router.patch('/:labelId', requireProjectRole('MEMBER'), labelsController.updateLabel);
router.delete('/:labelId', requireProjectRole('MEMBER'), labelsController.deleteLabel);

export default router;
