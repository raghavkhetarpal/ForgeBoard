const fs = require('fs');

// Fix issues.service.ts
let issues = fs.readFileSync('apps/api/src/modules/issues/issues.service.ts', 'utf8');

const issuesTarget = `return issuesRepository.create({
      workspaceId,
      projectId,
      creatorId,
      ...data
    });`;

const issuesReplacement = `const created = await issuesRepository.create({
      workspaceId,
      projectId,
      creatorId,
      ...data
    });
    void activityService.logActivity({
      projectId,
      workspaceId,
      actorId: creatorId,
      action: 'ISSUE_CREATED',
      targetType: 'ISSUE',
      targetId: created.id
    });
    return created;`;

issues = issues.replace(issuesTarget, issuesReplacement);
fs.writeFileSync('apps/api/src/modules/issues/issues.service.ts', issues);


// Fix comments.service.ts
let comments = fs.readFileSync('apps/api/src/modules/comments/comments.service.ts', 'utf8');

const commentsTarget = `    // Broadcast the new comment to the project room`;

const commentsReplacement = `    void activityService.logActivity({
      projectId,
      workspaceId: issue.workspaceId,
      actorId: authorId,
      action: 'COMMENT_CREATED',
      targetType: 'COMMENT',
      targetId: comment.id
    });
    
    // Broadcast the new comment to the project room`;

comments = comments.replace(commentsTarget, commentsReplacement);
fs.writeFileSync('apps/api/src/modules/comments/comments.service.ts', comments);
