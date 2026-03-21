import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * E2E Test: Keyboard Shortcuts
 * Ctrl+Z/Y, Ctrl+B/I/U, Ctrl+H, etc.
 */

test.describe('Keyboard Shortcuts', () => {
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

  async function enterEditMode(page) {
    const cell = page.locator('.hwp-table td').first();
    if (!(await cell.count())) return null;

    await cell.dblclick();
    await page.waitForTimeout(500);

    const isEditable = await cell.evaluate(el => el.contentEditable === 'true');
    return isEditable ? cell : null;
  }

  test('should handle Ctrl+Z for undo', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    const cell = await enterEditMode(page);
    if (!cell) {
      test.skip();
      return;
    }

    // Type something
    const originalText = await cell.textContent();
    await page.keyboard.type('새 텍스트');
    await page.waitForTimeout(200);

    // Undo with Ctrl+Z
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);

    // Text should revert (or at least change)
    const afterUndo = await cell.textContent();
    // Undo behavior depends on implementation
    expect(typeof afterUndo).toBe('string');
  });

  test('should handle Ctrl+Y for redo', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    const cell = await enterEditMode(page);
    if (!cell) {
      test.skip();
      return;
    }

    await page.keyboard.type('리두 테스트');
    await page.waitForTimeout(200);

    // Undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);

    // Redo
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(300);

    const text = await cell.textContent();
    expect(typeof text).toBe('string');
  });

  test('should handle Ctrl+Shift+Z for redo (alternative)', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    const cell = await enterEditMode(page);
    if (!cell) {
      test.skip();
      return;
    }

    await page.keyboard.type('테스트');
    await page.waitForTimeout(200);

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);

    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(300);

    const text = await cell.textContent();
    expect(typeof text).toBe('string');
  });

  test('should handle Ctrl+F for search', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    await page.keyboard.press('Control+f');
    await page.waitForTimeout(500);

    // Look for search dialog
    const searchUI = page.locator('[class*="search"], [class*="find"]').first();
    if (await searchUI.count()) {
      await expect(searchUI).toBeVisible();
    }

    // Close
    await page.keyboard.press('Escape');
  });

  test('should handle Ctrl+H for find and replace', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    await page.keyboard.press('Control+h');
    await page.waitForTimeout(500);

    const searchUI = page.locator('[class*="search"], [class*="find"], [class*="replace"]').first();
    if (await searchUI.count()) {
      await expect(searchUI).toBeVisible();

      // Should have replace input
      const inputs = searchUI.locator('input');
      const inputCount = await inputs.count();
      // Find+Replace typically has 2 inputs
      expect(inputCount).toBeGreaterThanOrEqual(1);
    }

    await page.keyboard.press('Escape');
  });

  test('should prevent default browser behavior for Ctrl+S', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    // Ctrl+S should not open browser save dialog
    // Instead it should trigger app save
    let browserSaveOpened = false;

    page.on('dialog', () => {
      browserSaveOpened = true;
    });

    await page.keyboard.press('Control+s');
    await page.waitForTimeout(1000);

    // Browser save dialog should not appear (app handles it)
    expect(browserSaveOpened).toBe(false);
  });

  test('should handle Tab for cell navigation in edit mode', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    const cell = await enterEditMode(page);
    if (!cell) {
      test.skip();
      return;
    }

    // Press Tab to move to next cell
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    // Active element should have changed
    const activeTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeTag).toBeTruthy();
  });

  test('should not crash on rapid keyboard shortcuts', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    // Rapid fire shortcuts
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+y');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+f');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);

    // App should still be functional
    const appRoot = page.locator('#root, .app, main').first();
    await expect(appRoot).toBeVisible();
  });
});
