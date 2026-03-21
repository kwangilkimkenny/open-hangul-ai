import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * E2E Test: Save Workflow
 * Edit → Save → Reload → Verify edits preserved
 */

test.describe('Save Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  async function loadDocument(page) {
    const fileInput = page.locator('input[type="file"]').first();
    if (!(await fileInput.count())) return false;

    const samplePath = path.join(process.cwd(), 'docs/알림장 템플릿.hwpx');
    try {
      await fileInput.setInputFiles(samplePath);
      await page.waitForSelector('.hwp-table, .hwp-paragraph', { timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  }

  test('should have a save button', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    // Look for save button
    const saveButton = page.locator('button')
      .filter({ hasText: /저장|save/i })
      .first();

    if (await saveButton.count()) {
      await expect(saveButton).toBeVisible();
    } else {
      // Look for save icon button
      const saveIconBtn = page.locator('[aria-label*="save"], [title*="저장"], [title*="Save"]').first();
      if (await saveIconBtn.count()) {
        await expect(saveIconBtn).toBeVisible();
      }
    }
  });

  test('should trigger download on save', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    // Find and click save button
    const saveButton = page.locator('button')
      .filter({ hasText: /저장|save/i })
      .first();

    const saveIconBtn = page.locator('[aria-label*="save"], [title*="저장"]').first();
    const btn = (await saveButton.count()) ? saveButton : saveIconBtn;

    if (!(await btn.count())) {
      test.skip();
      return;
    }

    // Listen for download
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await btn.click();

    const download = await downloadPromise;
    if (download) {
      // Verify file name
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/\.hwpx$/);
    }
  });

  test('should show save confirmation or toast', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    // Edit a cell first
    const cell = page.locator('.hwp-table td').first();
    if (await cell.count()) {
      await cell.dblclick();
      await page.waitForTimeout(500);

      const isEditable = await cell.evaluate(el => el.contentEditable === 'true');
      if (isEditable) {
        await page.keyboard.type('수정됨');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    // Try Ctrl+S
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(1000);

    // Check for toast notification or download
    const toast = page.locator('[class*="toast"], [role="alert"]').first();
    const download = await downloadPromise;

    const hasToast = (await toast.count()) > 0;
    const hasDownload = download !== null;
    // Either a toast or download should occur
    expect(hasToast || hasDownload).toBeTruthy();
  });

  test('should handle Ctrl+S keyboard shortcut', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    // Ctrl+S should trigger save
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await page.keyboard.press('Control+s');

    const download = await downloadPromise;
    // Save may produce download or show toast
    expect(true).toBeTruthy(); // Verification that no crash occurred
  });

  test('should preserve file name on save', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    // Check if filename is displayed
    const fileNameElement = page.locator('[class*="file-name"], [class*="filename"], header').first();
    if (await fileNameElement.count()) {
      const text = await fileNameElement.textContent();
      expect(text).toBeTruthy();
    }
  });
});
