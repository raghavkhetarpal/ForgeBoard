import { test, expect } from '@playwright/test';
import { generateTestUser, registerUser, createWorkspace, createProject } from './helpers';
import { randomUUID } from 'crypto';

test.describe('Collaboration, Mentions, Labels & Milestones', () => {
  test('should create comments, edit/delete comments, attach labels, and manage milestones', async ({ page }) => {
    const user = generateTestUser();
    await registerUser(page, user);

    const ws = await createWorkspace(page, `WS-Collab-${randomUUID().substring(0, 5)}`);
    const proj = await createProject(page, `Project-Collab-${randomUUID().substring(0, 5)}`);

    // 1. Create a Milestone first
    await page.click('button:has-text("Milestones")');
    const milestoneTitle = `Sprint 1 - ${randomUUID().substring(0, 5)}`;
    await page.click('button:has-text("New Milestone")');
    await page.fill('#create-milestone-name', milestoneTitle);
    await page.fill('#create-milestone-desc', 'E2E milestone deliverables');
    await page.locator('div[role="dialog"] button[type="submit"]:has-text("Create Milestone")').click();

    await expect(page.locator(`h3:has-text("${milestoneTitle}")`)).toBeVisible({ timeout: 10000 });

    // 2. Switch back to Board tab
    await page.click('button:has-text("Board")');

    // 3. Create a Label
    await page.click('button:has-text("Labels")');
    const labelName = `Feature-${randomUUID().substring(0, 4)}`;
    await page.fill('#label-name', labelName);
    await page.locator('div[role="dialog"] button[type="submit"]:has-text("Add Label")').click();
    await expect(page.locator(`div[role="dialog"] span:has-text("${labelName}")`)).toBeVisible({ timeout: 10000 });
    // Close labels modal
    await page.click('div[role="dialog"] button:has-text("Close")');

    // 4. Create an Issue associated with the Milestone
    const issueTitle = `Collab Issue ${randomUUID().substring(0, 6)}`;
    await page.click('button:has-text("New Issue")');
    await page.fill('#issue-title', issueTitle);
    await page.fill('#issue-desc', 'Testing comments, labels, and mentions');
    // Select milestone
    await page.selectOption('#issue-milestone', { label: milestoneTitle });
    await page.locator('div[role="dialog"] button[type="submit"]:has-text("Create Issue")').click();

    // 5. Open the Issue Detail Modal
    const issueCard = page.locator(`div[role="button"]:has-text("${issueTitle}")`).last();
    await expect(issueCard).toBeVisible({ timeout: 10000 });
    await issueCard.click();

    // 6. Attach the created label to the issue
    await page.click('button:has-text("Add Label")');
    await page.click(`button:has-text("${labelName}")`);
    await expect(page.locator(`span:has-text("${labelName}")`).first()).toBeVisible({ timeout: 10000 });

    // 7. Add a comment with @mention
    const commentText = `Initial comment for discussion @${user.email}`;
    await page.fill('textarea[placeholder*="Leave a comment"]', commentText);
    await page.click('button:has-text("Comment")');

    // Verify comment appears
    await expect(page.locator(`text="${commentText}"`)).toBeVisible({ timeout: 10000 });

    // 8. Edit the comment
    await page.click('button[title="Edit comment"]');
    const updatedCommentText = `Updated comment after review @${user.email}`;
    const commentEditTextarea = page.locator('[data-testid="comment-edit-textarea"]');
    await commentEditTextarea.fill(updatedCommentText);
    await page.locator('[data-testid="comment-save-btn"]').click();
    await expect(page.locator(`text="${updatedCommentText}"`)).toBeVisible({ timeout: 10000 });

    // 9. Delete the comment
    await page.click('button[title="Delete comment"]');
    await page.click('button:has-text("Confirm")');
    await expect(page.locator(`text="${updatedCommentText}"`)).toHaveCount(0, { timeout: 10000 });

    // Close issue modal
    await page.click('button:has-text("Cancel")');

    // 10. Filter board by the created Label
    const labelFilter = page.locator('select').nth(1); // priorityFilter is 0th, labelFilter is 1st
    await labelFilter.selectOption({ label: labelName });
    await expect(page.locator(`div[role="button"]:has-text("${issueTitle}")`).last()).toBeVisible();

    // 11. Reset filter and switch to Milestones tab to check progress calculation
    await labelFilter.selectOption('ALL');
    await page.click('button:has-text("Milestones")');
    await expect(page.locator(`h3:has-text("${milestoneTitle}")`)).toBeVisible();
    // Milestone should show 1 open issue
    await expect(page.locator('text="0 of 1 issues closed"')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text="1 open"')).toBeVisible({ timeout: 10000 });
  });
});
