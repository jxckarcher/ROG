/**
 * GitHub panel smoke tests.
 *
 * Covers:
 *  1. Panel loads (three-pane layout visible)
 *  2. "Ask Glitch" button opens inline drawer (does NOT navigate to Chat tab)
 *  3. Drawer has its own message thread, independent of main chat
 *  4. Sending a message in drawer shows reply (WS streaming)
 *  5. Closing drawer removes it without side effects
 */
import { test, expect } from '@playwright/test';
import { waitForConnected, navTo, waitForReply } from '../helpers/setup.js';

/**
 * Load the first available repo and wait for directory items to appear.
 * - Waits for auth → repos → click first repo → fetchDir populates items
 * - After this returns, the pane-2 "⚡ Ask" button is enabled.
 */
async function loadFirstRepo(page) {
  // Wait for repo list to populate (auth check + gh repo list complete)
  const repoItem = page.locator('.gh-repo-item').first();
  await expect(repoItem).toBeVisible({ timeout: 10000 });
  await repoItem.click();
  // Wait for directory items (fetchDir → gh api /contents returns array)
  await expect(page.locator('.gh-entry').first()).toBeVisible({ timeout: 8000 });
}

test.describe('GitHub panel', () => {
  test.beforeEach(async ({ page }) => {
    await waitForConnected(page);
    await navTo(page, 'GitHub');
  });

  test('three-pane layout is visible', async ({ page }) => {
    await expect(page.locator('.github-panel')).toBeVisible({ timeout: 5000 });
  });

  test('Ask Glitch button opens inline drawer without switching tabs', async ({ page }) => {
    await loadFirstRepo(page);

    // Pane-2 "⚡ Ask" button is now enabled (items loaded)
    const askBtn = page.locator('button[title="Ask Glitch about this directory"]');
    await expect(askBtn).toBeEnabled({ timeout: 3000 });
    await askBtn.click();

    // Drawer should open
    const drawer = page.locator('.gh-ask-drawer');
    await expect(drawer).toBeVisible({ timeout: 3000 });

    // Still on GitHub panel — NOT redirected to Chat
    const chatPanel = page.locator('.chat-panel');
    await expect(chatPanel).toHaveCount(0);
  });

  test('drawer has independent message thread', async ({ page }) => {
    await loadFirstRepo(page);

    const askBtn = page.locator('button[title="Ask Glitch about this directory"]');
    await expect(askBtn).toBeEnabled({ timeout: 3000 });
    await askBtn.click();

    const drawer = page.locator('.gh-ask-drawer');
    await expect(drawer).toBeVisible({ timeout: 3000 });

    // Send a message in the drawer
    const drawerInput = drawer.locator('textarea').first();
    await drawerInput.fill('what files are here?');
    await drawerInput.press('Enter');

    // A reply bubble should appear inside the drawer (not in main chat)
    await page.waitForTimeout(200);
    const drawerBubbles = drawer.locator('.ws-chat-msg, .ws-msg-glitch, [class*="bubble"]');
    await expect(drawerBubbles.first()).toBeVisible({ timeout: 10000 });
  });

  test('closing drawer hides it cleanly', async ({ page }) => {
    await loadFirstRepo(page);

    const askBtn = page.locator('button[title="Ask Glitch about this directory"]');
    await expect(askBtn).toBeEnabled({ timeout: 3000 });
    await askBtn.click();

    const drawer = page.locator('.gh-ask-drawer');
    await expect(drawer).toBeVisible({ timeout: 3000 });

    // Close button has aria-label="Close"
    await drawer.locator('button[aria-label="Close"]').click();
    await expect(drawer).toBeHidden({ timeout: 2000 });
  });

  test('toolbar stays visible and interactable when Ask drawer is open', async ({ page }) => {
    await loadFirstRepo(page);

    // Open the Ask drawer
    const askBtn = page.locator('button[title="Ask Glitch about this directory"]');
    await expect(askBtn).toBeEnabled({ timeout: 3000 });
    await askBtn.click();
    await expect(page.locator('.gh-ask-drawer')).toBeVisible({ timeout: 3000 });

    // .gh-toolbar must still be visible above the drawer
    const toolbar = page.locator('.gh-toolbar');
    await expect(toolbar).toBeVisible();

    // Back/Forward icon-btn buttons in toolbar must not be covered
    const backBtn = page.locator('.gh-toolbar button[aria-label="Back"]');
    await expect(backBtn).toBeVisible();

    // Refresh button must be visible and not occluded
    const refreshBtn = page.locator('.gh-toolbar button[aria-label="Refresh"]');
    await expect(refreshBtn).toBeVisible();
    const box = await refreshBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
  });

  test('icon-btn SVGs render with non-zero size', async ({ page }) => {
    // Check that Back, Forward, Refresh buttons have visible SVGs
    const ariaLabels = ['Back', 'Forward', 'Refresh'];
    for (const label of ariaLabels) {
      const btn = page.locator(`.gh-toolbar button[aria-label="${label}"]`);
      await expect(btn).toBeVisible({ timeout: 5000 });
      const svg = btn.locator('svg');
      await expect(svg).toBeVisible();
      const box = await svg.boundingBox();
      expect(box, `SVG inside ${label} button has zero size`).not.toBeNull();
      expect(box.width, `${label} SVG width`).toBeGreaterThan(0);
      expect(box.height, `${label} SVG height`).toBeGreaterThan(0);
    }
  });

  test('GitHub panel state survives tab switch (repo persists in store)', async ({ page }) => {
    await loadFirstRepo(page);

    // Note which repo is active (first() handles recent + all-repos duplicate entries)
    const activeRepo = page.locator('.gh-repo-item.active').first();
    await expect(activeRepo).toBeVisible({ timeout: 3000 });
    const repoName = await activeRepo.locator('.gh-repo-name').textContent();

    // Directory items visible
    await expect(page.locator('.gh-entry').first()).toBeVisible();

    // Switch away to Chat and back
    await navTo(page, 'Chat');
    await page.waitForTimeout(200);
    await navTo(page, 'GitHub');

    // Same repo should still be active — no re-fetch flicker, state in store
    await expect(page.locator('.gh-entry').first()).toBeVisible({ timeout: 5000 });
    const stillActive = page.locator('.gh-repo-item.active .gh-repo-name').first();
    await expect(stillActive).toHaveText(repoName, { timeout: 3000 });
  });
});
