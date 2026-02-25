/**
 * Shared Playwright helpers for Glitch UI smoke tests.
 */

/**
 * Navigate to the app, wait for mock auto-connect (SSH + WS).
 * Waits for the WS "Live mode active" indicator in Chat panel.
 * (Chat is the default panel, so .chat-status-on is always in the DOM.)
 */
export async function waitForConnected(page) {
  await page.goto('/');
  // chat-status-on appears once the MockWebSocket hello-ok handshake completes
  await page.waitForSelector('.chat-status-on', { timeout: 10000 });
}

/**
 * Click a sidebar nav item by its text label.
 */
export async function navTo(page, label) {
  await page.click(`.sidebar-item:has-text("${label}")`);
  // Brief settle for panel transition
  await page.waitForTimeout(200);
}

/**
 * Wait for the typing indicator (WS streaming) to appear then disappear.
 */
export async function waitForReply(page, timeout = 10000) {
  // Typing dots appear while chatSending is true
  await page.waitForSelector('.typing-dots', { timeout });
  // Wait for them to go away (response complete)
  await page.waitForSelector('.typing-dots', { state: 'hidden', timeout });
}

/**
 * Send a chat message and wait for the reply bubble.
 * Returns the final text content of the last glitch bubble.
 */
export async function sendAndWait(page, text) {
  const input = page.locator('.chat-input');
  await input.fill(text);
  await page.click('[data-testid="send-btn"]');
  await waitForReply(page);
  const bubbles = page.locator('.bubble-glitch');
  const last = bubbles.last();
  return last.textContent();
}

/**
 * Collect console errors during a page interaction.
 */
export function collectConsoleErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}
