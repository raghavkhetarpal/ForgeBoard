import { test, expect } from '@playwright/test';
import { generateTestUser, registerUser, loginUser } from './helpers';

test.describe('Authentication & Session Management', () => {
  test('should register a new user, restore session on reload, and log out', async ({ page }) => {
    const user = generateTestUser();

    // 1. Register
    await registerUser(page, user);

    // Verify dashboard displays user greeting or workspaces page
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText('Workspaces');

    // 2. Session restoration on page reload
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText('Workspaces');

    // 3. Logout
    const logoutBtn = page.locator('button:has-text("Log out"), button:has-text("Logout"), button:has-text("Sign out")');
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
    } else {
      const userMenuBtn = page.locator('header button').last();
      await userMenuBtn.click();
      await page.click('button:has-text("Log out"), button:has-text("Sign out")');
    }

    // Verify redirected to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('should login an existing registered user', async ({ page }) => {
    const user = generateTestUser();
    await registerUser(page, user);

    // Logout first
    const logoutBtn = page.locator('button:has-text("Log out"), button:has-text("Logout"), button:has-text("Sign out")');
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
    } else {
      const userMenuBtn = page.locator('header button').last();
      await userMenuBtn.click();
      await page.click('button:has-text("Log out"), button:has-text("Sign out")');
    }
    await expect(page).toHaveURL(/\/login/);

    // Login with valid credentials
    await loginUser(page, user);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText('Workspaces');
  });

  test('should redirect unauthenticated users from /dashboard to /login', async ({ page }) => {
    // Navigate directly to protected route without authentication
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });

  test('should reject invalid credentials with an error message', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'nonexistent@example.com');
    await page.fill('#password', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // FormError should be visible
    const errorMessage = page.locator('.text-red-600, .text-red-700, [role="alert"]');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
});
