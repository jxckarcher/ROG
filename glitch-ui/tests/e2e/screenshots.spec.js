/**
 * Auto-screenshot tests — capture each panel at two viewports.
 * Output goes to tests/screenshots/ (gitignored).
 * Run with: npx playwright test screenshots.spec.js
 *
 * These tests always pass (screenshot capture never fails assertion-wise).
 * They exist to produce visual proof of each sprint's UI state.
 */
import { test } from '@playwright/test';
import { waitForConnected, navTo } from '../helpers/setup.js';
import fs from 'fs';

const PANELS = ['Chat', 'GitHub', 'Scheduler', 'Workspaces', 'Terminal', 'Budget'];
const VIEWPORTS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '900x600',  width: 900,  height: 600  },
];

// Ensure output directory exists
const SHOT_DIR = new URL('../../tests/screenshots', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

for (const vp of VIEWPORTS) {
  test.describe(`Screenshots @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await waitForConnected(page);
    });

    for (const panel of PANELS) {
      test(`${panel}`, async ({ page }) => {
        await navTo(page, panel);

        // Let the panel settle (animations, data loads)
        if (panel === 'GitHub') {
          // Wait for repo list to populate
          await page.waitForSelector('.gh-repo-item', { timeout: 8000 }).catch(() => {});
        } else if (panel === 'Scheduler') {
          await page.waitForSelector('.sched-agenda-card', { timeout: 6000 }).catch(() => {});
        } else if (panel === 'Workspaces') {
          await page.waitForSelector('.ws-file-item', { timeout: 6000 }).catch(() => {});
        }

        const outPath = `${SHOT_DIR}/${panel.toLowerCase()}-${vp.name}.png`;
        await page.screenshot({ path: outPath, fullPage: false });
      });
    }
  });
}
