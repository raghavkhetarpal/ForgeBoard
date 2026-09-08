import { Router } from 'express';
import { projectsController } from './projects.controller';
import { githubController } from '../github/github.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireWorkspaceRole, requireProjectRole } from '../../middleware/rbac.middleware';

const router = Router({ mergeParams: true });

// All routes require authentication
router.use(requireAuth);

// Routes nested under /api/workspaces/:workspaceId/projects
// e.g. POST /api/workspaces/:workspaceId/projects
router.post(
  '/',
  requireWorkspaceRole('ADMIN'), // must be at least workspace ADMIN to create a project
  projectsController.create.bind(projectsController)
);

router.get(
  '/',
  requireWorkspaceRole('VIEWER'), // any workspace member can view the list of projects
  projectsController.listForWorkspace.bind(projectsController)
);

// Routes directly under /api/projects/:projectId
const projectRouter = Router({ mergeParams: true });
projectRouter.use(requireAuth);

projectRouter.get(
  '/:projectId',
  requireProjectRole('VIEWER'),
  projectsController.get.bind(projectsController)
);

projectRouter.patch(
  '/:projectId',
  requireProjectRole('ADMIN'), // usually only ADMINs can edit project details
  projectsController.update.bind(projectsController)
);

projectRouter.delete(
  '/:projectId',
  requireProjectRole('ADMIN'),
  projectsController.archive.bind(projectsController)
);

projectRouter.post(
  '/:projectId/members',
  requireProjectRole('ADMIN'), // only project admins can add members
  projectsController.addMember.bind(projectsController)
);

projectRouter.delete(
  '/:projectId/members/:userId',
  requireProjectRole('ADMIN'), // only project admins can remove members
  projectsController.removeMember.bind(projectsController)
);


// GitHub Integration
projectRouter.get(
  '/:projectId/github/connect',
  requireProjectRole('ADMIN'),
  githubController.getConnectUrl
);

projectRouter.get(
  '/:projectId/github/repos',
  requireProjectRole('VIEWER'),
  githubController.listConnectedRepositories
);

projectRouter.get(
  '/:projectId/github/repos/available',
  requireProjectRole('ADMIN'),
  githubController.listAvailableRepositories
);

projectRouter.post(
  '/:projectId/github/repos',
  requireProjectRole('ADMIN'),
  githubController.connectRepository
);

projectRouter.get(
  '/:projectId/github/repos/:repoId/pulls',
  requireProjectRole('VIEWER'),
  githubController.listPullRequests
);

export { router as workspaceProjectsRouter, projectRouter };
