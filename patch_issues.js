const fs = require('fs');
const file = 'apps/api/src/modules/issues/issues.integration.test.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/await prisma\.issue\.deleteMany\(\);\s*await prisma\.projectMember\.deleteMany\(\);\s*await prisma\.project\.deleteMany\(\);\s*await prisma\.workspaceMember\.deleteMany\(\);\s*await prisma\.workspace\.deleteMany\(\);\s*await prisma\.user\.deleteMany\(\);/g, '');

content = content.replace(/afterAll\(async \(\) => \{\s*\}\);/g, `afterAll(async () => {
    if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, memberId, viewerId, nonMemberId].filter(Boolean) } } });
  });`);

content = content.replace(/email: 'owner@i.com'/g, "email: `owner-${randomUUID()}@i.com`");
content = content.replace(/email: 'member@i.com'/g, "email: `member-${randomUUID()}@i.com`");
content = content.replace(/email: 'viewer@i.com'/g, "email: `viewer-${randomUUID()}@i.com`");
content = content.replace(/email: 'non@i.com'/g, "email: `non-${randomUUID()}@i.com`");

content = content.replace(/let ownerToken: string;/g, "let ownerToken: string;\n  let ownerId: string;");
content = content.replace(/ownerToken = \(await createSession\(owner\.id, owner\.email\)\)\.sessionId;/g, "ownerId = owner.id;\n    ownerToken = (await createSession(owner.id, owner.email)).sessionId;");

fs.writeFileSync(file, content);
