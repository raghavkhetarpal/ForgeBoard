import prisma from '../apps/api/src/infrastructure/prisma';
import { createSession, signSessionCookie, SESSION_COOKIE_NAME } from '../apps/api/src/infrastructure/session';
import fs from 'fs';
import path from 'path';

export interface SeedMeta {
  workspaceId: string;
  projectId: string;
  ownerId: string;
  memberId: string;
  ownerCookie: string;
  memberCookie: string;
  targetIssueId: string;
}

const SEED_PREFIX = 'bench-seed-';

export async function seedBenchmarkData(tier: 'standard' | 'stress' = 'standard'): Promise<SeedMeta> {
  console.log(`[Seed] Starting benchmark seeding for tier: ${tier.toUpperCase()}`);

  // Determine scaling parameters based on tier
  const numUsers = 10;
  const numWorkspaces = 2;
  const projectsPerWs = 2;
  const issuesPerProj = tier === 'stress' ? 200 : 50;

  // Clean up any previous benchmark seed data
  console.log('[Seed] Cleaning up prior benchmark seed data...');
  const existingUsers = await prisma.user.findMany({
    where: { email: { startsWith: SEED_PREFIX } },
    select: { id: true },
  });
  const userIds = existingUsers.map((u) => u.id);

  if (userIds.length > 0) {
    await prisma.workspace.deleteMany({
      where: { name: { startsWith: SEED_PREFIX } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
  }

  // 1. Create Users
  console.log(`[Seed] Creating ${numUsers} benchmark users...`);
  const users = [];
  for (let i = 1; i <= numUsers; i++) {
    const user = await prisma.user.create({
      data: {
        email: `${SEED_PREFIX}user-${i}@example.com`,
        name: `Benchmark User ${i}`,
        passwordHash: '$2a$10$YourMockHashForBenchmarkSeedingPurposesOnly123456',
      },
    });
    users.push(user);
  }

  const owner = users[0];
  const member = users[1];

  // 2. Create Active Redis Sessions
  console.log('[Seed] Creating Redis sessions for benchmark authentication...');
  const ownerSession = await createSession(owner.id, owner.email, 86400);
  const memberSession = await createSession(member.id, member.email, 86400);

  const ownerCookie = `${SESSION_COOKIE_NAME}=${signSessionCookie(ownerSession.sessionId)}`;
  const memberCookie = `${SESSION_COOKIE_NAME}=${signSessionCookie(memberSession.sessionId)}`;

  // 3. Create Workspaces & Memberships
  let primaryWorkspaceId = '';
  let primaryProjectId = '';
  let primaryTargetIssueId = '';

  for (let w = 1; w <= numWorkspaces; w++) {
    const ws = await prisma.workspace.create({
      data: {
        name: `${SEED_PREFIX}Workspace-${w}`,
        slug: `${SEED_PREFIX}ws-${w}-${Date.now()}`,
        members: {
          create: [
            { userId: owner.id, role: 'OWNER' },
            { userId: member.id, role: 'MEMBER' },
          ],
        },
      },
    });

    if (w === 1) primaryWorkspaceId = ws.id;

    // 4. Create Projects
    for (let p = 1; p <= projectsPerWs; p++) {
      const proj = await prisma.project.create({
        data: {
          name: `${SEED_PREFIX}Project-${w}-${p}`,
          workspaceId: ws.id,
          members: {
            create: [
              { userId: owner.id, workspaceId: ws.id, role: 'ADMIN' },
              { userId: member.id, workspaceId: ws.id, role: 'MEMBER' },
            ],
          },
        },
      });

      if (w === 1 && p === 1) primaryProjectId = proj.id;

      // 5. Bulk Create Issues
      const issuesData = [];
      const statuses = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BACKLOG'] as const;
      const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

      for (let i = 1; i <= issuesPerProj; i++) {
        issuesData.push({
          projectId: proj.id,
          workspaceId: ws.id,
          creatorId: owner.id,
          assigneeId: i % 2 === 0 ? member.id : owner.id,
          title: `Benchmark Task ${i} - ${p}-${w} search target`,
          description: `Detailed task description for benchmark index search verification issue number ${i}.`,
          status: statuses[i % statuses.length],
          priority: priorities[i % priorities.length],
          position: i * 1000,
        });
      }

      await prisma.issue.createMany({
        data: issuesData,
      });

      // Fetch one issue ID for movement benchmarks
      if (w === 1 && p === 1) {
        const firstIssue = await prisma.issue.findFirst({
          where: { projectId: proj.id },
          select: { id: true },
        });
        if (firstIssue) primaryTargetIssueId = firstIssue.id;
      }

      // 6. Bulk Create Activity Log Entries
      const activityData = [];
      for (let a = 1; a <= Math.min(issuesPerProj, 50); a++) {
        activityData.push({
          workspaceId: ws.id,
          projectId: proj.id,
          actorId: owner.id,
          action: 'ISSUE_CREATED',
          targetType: 'ISSUE',
          targetId: primaryTargetIssueId || 'stub-target',
          metadata: { title: `Benchmark Task ${a}` },
        });
      }

      await prisma.activity.createMany({
        data: activityData,
      });
    }
  }

  const meta: SeedMeta = {
    workspaceId: primaryWorkspaceId,
    projectId: primaryProjectId,
    ownerId: owner.id,
    memberId: member.id,
    ownerCookie,
    memberCookie,
    targetIssueId: primaryTargetIssueId,
  };

  const artifactPath = path.resolve(__dirname, '../benchmark-meta.json');
  fs.writeFileSync(artifactPath, JSON.stringify(meta, null, 2));
  console.log(`[Seed] Seeding completed successfully. Metadata written to ${artifactPath}`);

  return meta;
}

// Allow direct CLI execution
if (require.main === module) {
  const tierArg = process.argv.find((arg) => arg.startsWith('--tier='))?.split('=')[1] as 'standard' | 'stress' | undefined;
  seedBenchmarkData(tierArg || 'standard')
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Seeding failed:', err);
      process.exit(1);
    });
}
