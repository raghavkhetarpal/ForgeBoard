import { test, expect } from '@playwright/test';
import { generateTestUser, registerUser } from './helpers';
import { randomUUID } from 'crypto';

test.describe('Workspaces & Projects Lifecycle', () => {
  test('should create workspace, update settings, create project, and delete workspace', async ({ page }) => {
    const user = generateTestUser();
    await registerUser(page, user);

    const wsUnique = randomUUID().substring(0, 6);
    const wsName = `Alpha Workspace ${wsUnique}`;

    // 1. Create Workspace
    await page.locator('header button:has-text("New Workspace"), button:has-text("New Workspace"), button:has-text("Create Workspace")').first().click();
    await page.fill('#ws-name', wsName);
    await page.locator('div[role="dialog"] button[type="submit"]:has-text("Create Workspace")').click();

    // Wait for navigation to workspace page
    await expect(page).toHaveURL(/\/workspaces\/[^/]+$/, { timeout: 15000 });
    await expect(page.locator('h1')).toContainText(wsName);

    // 2. Create Project within Workspace
    const projUnique = randomUUID().substring(0, 6);
    const projName = `Core Platform ${projUnique}`;

    await page.locator('button:has-text("New Project")').first().click();
    await page.fill('#proj-name', projName);
    await page.fill('#proj-desc', 'Automated E2E platform project');
    await page.locator('div[role="dialog"] button[type="submit"]:has-text("Create Project")').click();

    // Verify project appears in list and navigate to it
    const projectCard = page.locator(`h3:has-text("${projName}")`);
    await expect(projectCard).toBeVisible({ timeout: 10000 });
    await projectCard.click();

    // Verify navigated to project board/overview
    await expect(page).toHaveURL(/\/projects\/[^/]+/, { timeout: 15000 });
    await expect(page.locator('h1')).toContainText(projName);

    // 3. Navigate back to workspace via breadcrumb or header link
    const wsBreadcrumb = page.locator(`header a:has-text("${wsName}"), nav a:has-text("${wsName}")`).first();
    if (await wsBreadcrumb.isVisible()) {
      await wsBreadcrumb.click();
    } else {
      await page.click('a:has-text("Back to Workspace")');
    }

    await expect(page).toHaveURL(/\/workspaces\/[^/]+$/, { timeout: 15000 });

    // 4. Workspace Settings tab: rename workspace
    await page.click('button:has-text("Settings")');
    const updatedWsName = `Renamed Workspace ${wsUnique}`;
    
    // Find workspace name input in settings form
    const nameInput = page.locator('form input[type="text"]').first();
    await nameInput.fill(updatedWsName);
    await page.click('button:has-text("Save Changes")');

    // Verify success banner
    await expect(page.locator('text=Workspace settings updated successfully')).toBeVisible({ timeout: 10000 });

    // 5. Delete workspace
    await page.click('button:has-text("Delete Workspace")');
    const confirmInput = page.locator('input[placeholder="Enter workspace name"]');
    await confirmInput.fill(updatedWsName);
    await page.click('div[role="dialog"] button:has-text("Delete Workspace")');

    // Verify redirected back to dashboard and workspace is gone
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.locator(`text="${updatedWsName}"`)).toHaveCount(0);
  });
});
