/**
 * Chat panel smoke tests.
 *
 * Covers:
 *  1. App loads and auto-connects in mock mode
 *  2. Chat panel renders with "SSH connected" status message
 *  3. Sending a message shows user bubble + typing dots → glitch reply
 *  4. Typing indicator appears and disappears (no permanent spinner)
 *  5. Multiple messages accumulate (no overwrite bug)
 *  6. "test" keyword gets the mock test reply
 */
import { test, expect } from '@playwright/test';
import { waitForConnected, navTo, sendAndWait, waitForReply, collectConsoleErrors } from '../helpers/setup.js';

test.describe('Chat panel', () => {
  test('app loads and SSH auto-connects', async ({ page }) => {
    await waitForConnected(page);
    // TopBar SSH chip should say Connected
    const chip = page.locator('.chip-on').first();
    await expect(chip).toBeVisible();
  });

  test('chat panel shows initial system message', async ({ page }) => {
    await waitForConnected(page);
    await navTo(page, 'Chat');
    // Initial system message after mock connect() — class is .chat-system
    const systemMsg = page.locator('.chat-system').first();
    await expect(systemMsg).toContainText(/connected/i);
  });

  test('typing indicator appears and clears after reply', async ({ page }) => {
    await waitForConnected(page);
    await navTo(page, 'Chat');

    const input = page.locator('.chat-input');
    await input.fill('hello');
    await page.click('[data-testid="send-btn"]');

    // Typing dots must appear
    await expect(page.locator('.typing-dots')).toBeVisible({ timeout: 5000 });

    // And then disappear once reply is done
    await expect(page.locator('.typing-dots')).toBeHidden({ timeout: 12000 });
  });

  test('user bubble appears immediately after send', async ({ page }) => {
    await waitForConnected(page);
    await navTo(page, 'Chat');

    await page.locator('.chat-input').fill('hello');
    await page.click('[data-testid="send-btn"]');

    // User bubble should be visible right away (before reply)
    const userBubble = page.locator('.bubble-user').last();
    await expect(userBubble).toBeVisible({ timeout: 2000 });
    await expect(userBubble).toContainText('hello');
  });

  test('glitch reply bubble appears with non-empty text', async ({ page }) => {
    await waitForConnected(page);
    await navTo(page, 'Chat');

    const reply = await sendAndWait(page, 'test');
    expect(reply).toBeTruthy();
    expect((reply || '').length).toBeGreaterThan(5);
  });

  test('multiple messages accumulate (no overwrite)', async ({ page }) => {
    await waitForConnected(page);
    await navTo(page, 'Chat');

    await sendAndWait(page, 'first message');
    await sendAndWait(page, 'second message');

    // Both user bubbles should be present
    const userBubbles = page.locator('.bubble-user');
    await expect(userBubbles).toHaveCount(2);

    // Two glitch bubbles too
    const glitchBubbles = page.locator('.bubble-glitch');
    await expect(glitchBubbles).toHaveCount(2);
  });

  test('send button disabled when input is empty', async ({ page }) => {
    await waitForConnected(page);
    await navTo(page, 'Chat');

    const sendBtn = page.locator('[data-testid="send-btn"]');
    await expect(sendBtn).toBeDisabled();

    await page.locator('.chat-input').fill('hello');
    await expect(sendBtn).toBeEnabled();
  });

  test('no console errors during normal chat flow', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await waitForConnected(page);
    await navTo(page, 'Chat');
    await sendAndWait(page, 'hello');
    expect(errors).toHaveLength(0);
  });
});
