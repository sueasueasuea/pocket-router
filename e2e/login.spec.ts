import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the login page
    await page.goto('/login');
  });

  test('should load the login page and show correct elements', async ({ page }) => {
    // Verify the page title/header
    await expect(page.locator('h1')).toHaveText('Pocket Router');
    await expect(page.getByText('Manage your allocations beautifully')).toBeVisible();

    // Verify card title is "Welcome back" by default (isLogin = true)
    await expect(page.getByText('Welcome back', { exact: true })).toBeVisible();

    // Verify form elements exist
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Sign in button should be visible
    const signInButton = page.getByRole('button', { name: 'Sign In', exact: true });
    await expect(signInButton).toBeVisible();

    // Google OAuth button should be visible
    const googleButton = page.getByRole('button', { name: 'Google' });
    await expect(googleButton).toBeVisible();
  });

  test('should toggle to sign up mode and show display name field', async ({ page }) => {
    // Click on the 'Sign up' link/button
    const signUpToggle = page.getByRole('button', { name: 'Sign up' });
    await signUpToggle.click();

    // Verify card title changed to "Create an account"
    await expect(page.getByText('Create an account', { exact: true })).toBeVisible();

    // Display name input should now be visible
    const displayNameInput = page.locator('input[id="display-name"]');
    await expect(displayNameInput).toBeVisible();
    await expect(displayNameInput).toHaveAttribute('placeholder', 'How friends should see you');

    // Sign up button should be visible
    const signUpButton = page.getByRole('button', { name: 'Sign Up', exact: true });
    await expect(signUpButton).toBeVisible();

    // Click back to sign in
    const signInToggle = page.getByRole('button', { name: 'Sign in' });
    await signInToggle.click();

    // Verify card title goes back to "Welcome back"
    await expect(page.getByText('Welcome back', { exact: true })).toBeVisible();
    await expect(displayNameInput).not.toBeVisible();
  });
});
