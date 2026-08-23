import { projectsRepository } from './projects.repository';
import { ProjectStatus, ProjectRole, ProjectDto, ProjectMemberDto } from '@forgeboard/types';
import { AppError } from '../../infrastructure/errors';

export class ProjectsService {
  async createProject(
    workspaceId: string,
    data: { name: string; description?: string | null; status?: ProjectStatus; deadline?: string | null },
    creatorUserId: string
  ): Promise<ProjectDto> {
    // Note: Authorization (requiring workspace ADMIN) is handled by the route middleware.
    const project = await projectsRepository.create({
      workspaceId,
      name: data.name,
      description: data.description,
      status: data.status,
      deadline: data.deadline ? new Date(data.deadline) : null,
    });

    // Make the creator an explicit project ADMIN
    await projectsRepository.addMember({
      projectId: project.id,
      workspaceId,
      userId: creatorUserId,
      role: 'ADMIN',
    });

    return project;
  }

  async getProject(projectId: string): Promise<ProjectDto> {
    const project = await projectsRepository.findById(projectId);
    if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');
    return project;
  }

  async listWorkspaceProjects(workspaceId: string): Promise<ProjectDto[]> {
    return projectsRepository.findByWorkspaceId(workspaceId);
  }

  async updateProject(
    projectId: string,
    data: { name?: string; description?: string | null; status?: ProjectStatus; deadline?: string | null }
  ): Promise<ProjectDto> {
    const existing = await projectsRepository.findById(projectId);
    if (!existing) throw new AppError('Project not found', 404, 'NOT_FOUND');

    if (existing.status === 'ARCHIVED' && data.status !== 'ACTIVE' && data.status !== 'PLANNING' && data.status !== 'ON_HOLD' && data.status !== 'COMPLETED') {
        throw new AppError('Cannot modify an archived project unless you are unarchiving it.', 400, 'BAD_REQUEST');
    }

    const updated = await projectsRepository.update(projectId, {
      name: data.name,
      description: data.description !== undefined ? data.description : undefined,
      status: data.status,
      deadline: data.deadline !== undefined ? (data.deadline ? new Date(data.deadline) : null) : undefined,
    });

    return updated;
  }

  async archiveProject(projectId: string): Promise<ProjectDto> {
    const existing = await projectsRepository.findById(projectId);
    if (!existing) throw new AppError('Project not found', 404, 'NOT_FOUND');
    
    return projectsRepository.update(projectId, { status: 'ARCHIVED' });
  }

  async addProjectMember(
    projectId: string,
    targetUserId: string,
    role: ProjectRole,
    workspaceId: string
  ): Promise<ProjectMemberDto> {
    const existing = await projectsRepository.findMember(projectId, targetUserId);
    if (existing) {
      throw new AppError('User is already a member of this project', 409, 'CONFLICT');
    }

    return projectsRepository.addMember({
      projectId,
      workspaceId,
      userId: targetUserId,
      role,
    });
  }

  async removeProjectMember(projectId: string, targetUserId: string, isImplicitAdmin: boolean): Promise<void> {
    const existing = await projectsRepository.findMember(projectId, targetUserId);
    if (!existing) {
      throw new AppError('User is not a member of this project', 404, 'NOT_FOUND');
    }

    // Sole-owner protection equivalent: a project must have at least one explicit ADMIN if there's no workspace OWNER/ADMIN implicit logic handling it,
    // but actually, since workspace OWNERs/ADMINs are always implicit project ADMINs, we only need to protect the last explicit project ADMIN if no implicit admins exist.
    // However, to keep it simple and robust, let's just ensure we don't remove the last explicit project ADMIN if they are an ADMIN.
    if (existing.role === 'ADMIN') {
      const adminCount = await projectsRepository.countAdmins(projectId);
      if (adminCount <= 1 && !isImplicitAdmin) {
        throw new AppError('Cannot remove the last explicit project administrator without transferring role.', 409, 'CONFLICT');
      }
    }

    await projectsRepository.removeMember(projectId, targetUserId);
  }
}

export const projectsService = new ProjectsService();
