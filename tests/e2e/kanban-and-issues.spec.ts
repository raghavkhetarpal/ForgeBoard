import { test, expect } from '@playwright/test';
import { generateTestUser, registerUser, createWorkspace, createProject } from './helpers';
import { randomUUID } from 'crypto';

test.describe('Kanban & Issues Management', () => {
  test('should create, view, update, move status, and delete an issue', async ({ page }) => {
    const user = generateTestUser();
    await registerUser(page, user);

    const ws = await createWorkspace(page, `WS-Kanban-${randomUUID().substring(0, 5)}`);
    const proj = await createProject(page, `Project-Kanban-${randomUUID().substring(0, 5)}`);

    // Ensure we are on the Board tab
    const boardTab = page.locator('button:has-text("Board")');
    if (await boardTab.isVisible()) {
      await boardTab.click();
    }

    // 1. Create a new issue
    const issueTitle = `Test Issue ${randomUUID().substring(0, 6)}`;
    await page.click('button:has-text("New Issue")');
    await page.fill('#issue-title', issueTitle);
    await page.fill('#issue-desc', 'Detailed bug description for E2E testing');
    await page.selectOption('#issue-priority', 'HIGH');
    await page.click('div[role="dialog"] button[type="submit"]:has-text("Create Issue")');

    // 2. Verify issue card appears in the TODO column
    const issueCard = page.locator(`div[role="button"]:has-text("${issueTitle}")`).last();
    await expect(issueCard).toBeVisible({ timeout: 10000 });

    // 3. Open issue detail modal
    await issueCard.click();
    const modalTitle = page.locator('#edit-title');
    await expect(modalTitle).toHaveValue(issueTitle);

    // 4. Update issue: change status to IN_PROGRESS and update description
    await page.selectOption('#edit-status', 'IN_PROGRESS');
    await page.fill('#edit-desc', 'Updated bug description with new insights');
    await page.click('button:has-text("Save Changes")');

    // Modal should close
    await expect(page.locator('#edit-title')).toHaveCount(0);

    // 5. Open issue again from In Progress column and delete it
    const updatedCard = page.locator(`div[role="button"]:has-text("${issueTitle}")`).last();
    await updatedCard.click();
    await page.click('button:has-text("Delete Issue")');
    await page.click('button:has-text("Yes, Delete")');

    // 6. Verify issue card is removed from board
    await expect(page.locator(`text="${issueTitle}"`)).toHaveCount(0, { timeout: 10000 });
  });
});
