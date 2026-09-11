import { Router } from 'express';
import { workspacesController } from './workspaces.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireWorkspaceRole } from '../../middleware/rbac.middleware';

const router = Router();

// Workspaces collection
router.post('/', requireAuth, workspacesController.create);
router.get('/', requireAuth, workspacesController.list);

// Workspace detail and settings
router.get('/:workspaceId', requireAuth, requireWorkspaceRole('VIEWER'), workspacesController.getById);
router.patch('/:workspaceId', requireAuth, requireWorkspaceRole('ADMIN'), workspacesController.update);
router.delete('/:workspaceId', requireAuth, requireWorkspaceRole('OWNER'), workspacesController.delete);

// Workspace membership management
router.post('/:workspaceId/invites', requireAuth, requireWorkspaceRole('ADMIN'), workspacesController.inviteMember);
router.patch('/:workspaceId/members/:memberId', requireAuth, requireWorkspaceRole('ADMIN'), workspacesController.updateRole);
router.delete('/:workspaceId/members/:memberId', requireAuth, requireWorkspaceRole('ADMIN'), workspacesController.removeMember);
router.post('/:workspaceId/leave', requireAuth, requireWorkspaceRole('VIEWER'), workspacesController.leave);

export default router;
