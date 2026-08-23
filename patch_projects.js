const fs = require('fs');
const file = 'apps/api/src/modules/projects/projects.integration.test.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/await prisma\.workspaceMember\.deleteMany\(\);\s*await prisma\.project\.deleteMany\(\);\s*await prisma\.workspace\.deleteMany\(\);\s*await prisma\.user\.deleteMany\(\);/g, '');
content = content.replace(/await prisma\.projectMember\.deleteMany\(\);\s*await prisma\.project\.deleteMany\(\);\s*await prisma\.workspaceMember\.deleteMany\(\);\s*await prisma\.workspace\.deleteMany\(\);\s*await prisma\.user\.deleteMany\(\);/g, `
    if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, memberId, nonMemberId].filter(Boolean) } } });
`);

content = content.replace(/email: 'owner@example.com'/g, "email: `owner-${randomUUID()}@example.com`");
content = content.replace(/email: 'member@example.com'/g, "email: `member-${randomUUID()}@example.com`");
content = content.replace(/email: 'non@example.com'/g, "email: `non-${randomUUID()}@example.com`");

content = content.replace(/let ownerToken: string;/g, "let ownerToken: string;\n  let ownerId: string;");
content = content.replace(/let nonMemberToken: string;/g, "let nonMemberToken: string;\n  let nonMemberId: string;");

content = content.replace(/ownerToken = \(await createSession\(owner\.id, owner\.email\)\)\.sessionId;/g, "ownerId = owner.id;\n    ownerToken = (await createSession(owner.id, owner.email)).sessionId;");
content = content.replace(/nonMemberToken = \(await createSession\(nonMember\.id, nonMember\.email\)\)\.sessionId;/g, "nonMemberId = nonMember.id;\n    nonMemberToken = (await createSession(nonMember.id, nonMember.email)).sessionId;");

fs.writeFileSync(file, content);
