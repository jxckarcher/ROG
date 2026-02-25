/**
 * Workspaces panel smoke tests.
 *
 * Covers:
 *  1. File list loads (mock ls -la returns fixture files)
 *  2. Click a file → editor pane shows file path
 *  3. Commit + Push button opens confirmation modal (two-step, not immediate push)
 *  4. Cancelling commit modal does NOT push
 *  5. +File button (title="New file") opens file creation modal
 *  6. Delete file hover button shows confirmation modal with danger button
 */
import { test, expect } from '@playwright/test';
import { waitForConnected, navTo } from '../helpers/setup.js';

test.describe('Workspaces panel', () => {
  test.beforeEach(async ({ page }) => {
    await waitForConnected(page);
    await navTo(page, 'Workspaces');
    // Wait for file list to populate (mock ls -la returns README.md etc)
    await page.waitForSelector('.ws-file-item', { timeout: 8000 });
  });

  test('file list renders mock fixture files', async ({ page }) => {
    const items = page.locator('.ws-file-item');
    await expect(items.first()).toBeVisible();
    // Mock ls -la output includes README.md
    await expect(items.filter({ hasText: 'README.md' })).toBeVisible();
  });

  test('clicking a file shows its path in editor toolbar', async ({ page }) => {
    // Click the README.md file item main button
    const readmeBtn = page.locator('.ws-file-item').filter({ hasText: 'README.md' }).locator('.ws-file-item-main');
    await readmeBtn.click();
    // ws-file-path shows the full VPS path (includes README.md)
    await expect(page.locator('.ws-file-path')).toContainText('README.md', { timeout: 5000 });
  });

  test('Commit + Push opens diff modal (two-step)', async ({ page }) => {
    // Must open a file first so refreshGitStatus runs and enables the button
    const readmeBtn = page.locator('.ws-file-item').filter({ hasText: 'README.md' }).locator('.ws-file-item-main');
    await readmeBtn.click();
    // Wait for git status to populate (button becomes enabled)
    const commitBtn = page.locator('button:has-text("Commit + Push")');
    await expect(commitBtn).toBeEnabled({ timeout: 5000 });

    await commitBtn.click();

    // Modal should open with diff stat
    const modal = page.locator('.ws-modal-overlay');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await expect(modal).toContainText(/file.*changed|insertions|deletions/i);
  });

  test('cancelling commit modal closes without committing', async ({ page }) => {
    const readmeBtn = page.locator('.ws-file-item').filter({ hasText: 'README.md' }).locator('.ws-file-item-main');
    await readmeBtn.click();
    const commitBtn = page.locator('button:has-text("Commit + Push")');
    await expect(commitBtn).toBeEnabled({ timeout: 5000 });

    await commitBtn.click();
    const modal = page.locator('.ws-modal-overlay');
    await expect(modal).toBeVisible({ timeout: 3000 });

    await page.click('.ws-modal-footer button:has-text("Cancel")');
    await expect(modal).toBeHidden({ timeout: 2000 });
  });

  test('+File button opens new file creation modal', async ({ page }) => {
    // button[title="New file"] in the explorer toolbar
    await page.click('button[title="New file"]');

    const modal = page.locator('.ws-modal-overlay');
    await expect(modal).toBeVisible({ timeout: 3000 });
    // Modal body has an input for the filename (no type attr, just .input class)
    await expect(modal.locator('input.input')).toBeVisible();
  });

  test('hover delete button shows confirmation modal with danger button', async ({ page }) => {
    // Hover to reveal actions, then click the Trash/delete button
    const fileItem = page.locator('.ws-file-item').filter({ hasText: 'README.md' });
    await fileItem.hover();

    // ws-file-action-btn last = delete (trash icon)
    const deleteBtn = fileItem.locator('button[title="Delete"]');
    await deleteBtn.click();

    const modal = page.locator('.ws-modal-overlay');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await expect(modal.locator('.btn-danger')).toBeVisible();
  });
});
