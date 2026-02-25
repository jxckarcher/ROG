/**
 * Scheduler panel smoke tests.
 *
 * Covers:
 *  1. Panel loads and shows cron job list (mock returns 2 jobs as agenda cards)
 *  2. Expanding a job loads history (uses cron runs endpoint, not cron history)
 *  3. Switching to "New Job" → Agent Run tab + selecting "One-time…" shows date+time inputs
 *  4. Inline cron preview updates when date/time are filled
 */
import { test, expect } from '@playwright/test';
import { waitForConnected, navTo } from '../helpers/setup.js';

test.describe('Scheduler panel', () => {
  test.beforeEach(async ({ page }) => {
    await waitForConnected(page);
    await navTo(page, 'Scheduler');
  });

  test('panel loads and shows mock cron jobs (.sched-agenda-card)', async ({ page }) => {
    // Mock returns 2 jobs — agenda view shows them as sched-agenda-card
    await page.waitForSelector('.sched-agenda-card', { timeout: 8000 });
    const jobs = page.locator('.sched-agenda-card');
    await expect(jobs).toHaveCount(2);
  });

  test('expanding a job loads run history (cron runs endpoint)', async ({ page }) => {
    await page.waitForSelector('.sched-agenda-card', { timeout: 8000 });

    // Click the chevron expand button on the first job
    const expandBtn = page.locator('.sched-expand-btn').first();
    await expandBtn.click();

    // History section should appear (sched-job-history)
    await expect(page.locator('.sched-job-history').first()).toBeVisible({ timeout: 4000 });
    const historyText = await page.locator('.sched-job-history').first().textContent();
    expect(historyText).not.toMatch(/not found|invalid command|command not found/i);
  });

  test('Agent Run tab + One-time… shows date and time inputs', async ({ page }) => {
    // Switch to "New Job" view first (agenda is default)
    await page.click('.sched-view-tab:has-text("New Job")');

    // Click the "Agent Run" tab within the form card
    await page.click('.sched-tab:has-text("Agent Run")');

    // Select "One-time…" by value (__once__)
    const schedSelect = page.locator('select.input').first();
    await schedSelect.selectOption({ value: '__once__' });

    // Date and time inputs should appear
    await expect(page.locator('input[type="date"]')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('input[type="time"]')).toBeVisible({ timeout: 2000 });
  });

  test('one-shot: filling date+time shows cron preview', async ({ page }) => {
    await page.click('.sched-view-tab:has-text("New Job")');
    await page.click('.sched-tab:has-text("Agent Run")');
    const schedSelect = page.locator('select.input').first();
    await schedSelect.selectOption({ value: '__once__' });

    await page.locator('input[type="date"]').fill('2026-03-01');
    await page.locator('input[type="time"]').fill('09:30');

    // Preview hint shows "Runs once at 09:30 on 2026-03-01 → cron: ..."
    const hint = page.locator('.sched-form-hint').filter({ hasText: /Runs once|cron:/i });
    await expect(hint).toBeVisible({ timeout: 2000 });
    await expect(hint).toContainText('09:30');
  });
});
