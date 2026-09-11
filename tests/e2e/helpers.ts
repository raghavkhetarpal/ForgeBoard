import { Page, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

export function generateTestUser(): TestUser {
  const id = randomUUID().substring(0, 8);
  return {
    name: `Test User ${id}`,
    email: `test-${id}@example.com`,
    password: `Password123!-${id}`,
  };
}

export async function registerUser(page: Page, user: TestUser) {
  await page.goto('/register');
  await page.fill('#name', user.name);
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);
  await page.click('button[type="submit"]');
  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

export async function loginUser(page: Page, user: TestUser) {
  await page.goto('/login');
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

export async function createWorkspace(page: Page, name?: string): Promise<{ name: string; url: string }> {
  const wsName = name || `WS-${randomUUID().substring(0, 6)}`;
  await page.goto('/dashboard');
  
  // Click "Create Workspace" or "New Workspace" in header/banner
  await page.locator('header button:has-text("New Workspace"), button:has-text("New Workspace"), button:has-text("Create Workspace")').first().click();
  await page.fill('#ws-name', wsName);
  await page.locator('div[role="dialog"] button[type="submit"]:has-text("Create Workspace")').click();
  
  // Wait for navigation to workspace page
  await expect(page).toHaveURL(/\/workspaces\/[^/]+$/, { timeout: 15000 });
  return { name: wsName, url: page.url() };
}

export async function createProject(page: Page, name?: string): Promise<{ name: string; url: string }> {
  const projName = name || `Project-${randomUUID().substring(0, 6)}`;
  
  // Click "New Project"
  await page.locator('button:has-text("New Project")').first().click();
  await page.fill('#proj-name', projName);
  await page.locator('div[role="dialog"] button[type="submit"]:has-text("Create Project")').click();
  
  // Click on the project card to navigate to it if not redirected
  const projectLink = page.locator(`h3:has-text("${projName}")`);
  await expect(projectLink).toBeVisible({ timeout: 10000 });
  await projectLink.click();
  
  await expect(page).toHaveURL(/\/projects\/[^/]+$/, { timeout: 15000 });
  return { name: projName, url: page.url() };
}
