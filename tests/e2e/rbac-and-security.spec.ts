import { test, expect } from '@playwright/test';
import { generateTestUser, registerUser, loginUser, createWorkspace, createProject } from './helpers';
import { randomUUID } from 'crypto';

test.describe('RBAC, Security & Tenant Isolation', () => {
  test('should enforce workspace invitation, role management, and VIEWER read-only enforcement', async ({ browser }) => {
    // Context A: Owner user
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const owner = generateTestUser();
    await registerUser(ownerPage, owner);

    const ws = await createWorkspace(ownerPage, `WS-RBAC-${randomUUID().substring(0, 5)}`);
    const proj = await createProject(ownerPage, `Project-RBAC-${randomUUID().substring(0, 5)}`);

    // Context B: Colleague user
    const colleagueContext = await browser.newContext();
    const colleaguePage = await colleagueContext.newPage();
    const colleague = generateTestUser();
    await registerUser(colleaguePage, colleague);

    // 1. Owner invites Colleague as VIEWER
    await ownerPage.goto(ws.url);
    await ownerPage.click('button:has-text("Members")');
    await ownerPage.click('button:has-text("Invite Member")');
    await ownerPage.fill('input[type="email"]', colleague.email);
    await ownerPage.selectOption('div[role="dialog"] select', 'VIEWER');
    await ownerPage.click('div[role="dialog"] button[type="submit"]');

    // Verify invitation success and member appears in members table
    await expect(ownerPage.locator(`td:has-text("${colleague.email}")`)).toBeVisible({ timeout: 10000 });

    // 2. Verify Colleague now sees workspace and project
    await colleaguePage.goto('/dashboard');
    await expect(colleaguePage.locator(`h3:has-text("${ws.name}")`)).toBeVisible({ timeout: 10000 });
    await colleaguePage.click(`h3:has-text("${ws.name}")`);

    // Verify Colleague role badge is VIEWER
    await expect(colleaguePage.locator('span:has-text("VIEWER")')).toBeVisible({ timeout: 10000 });

    // Verify VIEWER cannot see "New Project" button
    await expect(colleaguePage.locator('button:has-text("New Project")')).toHaveCount(0);

    // 3. Colleague enters the project board
    await colleaguePage.click(`h3:has-text("${proj.name}")`);
    await expect(colleaguePage).toHaveURL(/\/projects\/[^/]+/, { timeout: 10000 });

    // Verify VIEWER cannot see "New Issue" button on the board
    await expect(colleaguePage.locator('button:has-text("New Issue")')).toHaveCount(0);

    // 4. Owner promotes Colleague from VIEWER to ADMIN
    await ownerPage.goto(ws.url);
    await ownerPage.click('button:has-text("Members")');
    const colleagueRow = ownerPage.locator(`tr:has-text("${colleague.email}")`);
    await colleagueRow.locator('select').selectOption('ADMIN');

    // Verify change persisted in Owner's view
    await expect(colleagueRow.locator('select')).toHaveValue('ADMIN', { timeout: 10000 });

    // Colleague logs back in because session was invalidated upon role promotion (server-side security contract)
    await loginUser(colleaguePage, colleague);
    await colleaguePage.goto(ws.url);

    // Verify Colleague role badge is now ADMIN
    await expect(colleaguePage.locator('span:has-text("ADMIN")')).toBeVisible({ timeout: 10000 });

    // Verify ADMIN now has "New Project" button available in header
    await expect(colleaguePage.locator('button:has-text("New Project")').first()).toBeVisible({ timeout: 10000 });

    await ownerContext.close();
    await colleagueContext.close();
  });

  test('should enforce cross-workspace tenant isolation', async ({ browser }) => {
    // User A creates Workspace A
    const userAContext = await browser.newContext();
    const pageA = await userAContext.newPage();
    const userA = generateTestUser();
    await registerUser(pageA, userA);
    const wsA = await createWorkspace(pageA, `Isolated-WS-A-${randomUUID().substring(0, 5)}`);

    // User B creates Workspace B
    const userBContext = await browser.newContext();
    const pageB = await userBContext.newPage();
    const userB = generateTestUser();
    await registerUser(pageB, userB);

    // User B attempts to access Workspace A directly by URL
    await pageB.goto(wsA.url);

    // Verify access denied error is displayed
    await expect(pageB.locator('text=You do not have access to view this workspace')).toBeVisible({ timeout: 10000 });

    await userAContext.close();
    await userBContext.close();
  });
});
