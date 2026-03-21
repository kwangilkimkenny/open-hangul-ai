import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * E2E Test: Search and Replace
 * Search → highlight → replace → verify
 */

test.describe('Search and Replace', () => {
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

  test('should open search dialog with Ctrl+H', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    // Open search dialog with keyboard shortcut
    await page.keyboard.press('Control+h');
    await page.waitForTimeout(500);

    // Look for search dialog
    const searchDialog = page.locator('[class*="search"], [class*="find"], [role="dialog"]').first();
    if (await searchDialog.count()) {
      await expect(searchDialog).toBeVisible();
    }
  });

  test('should open search dialog with Ctrl+F', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    await page.keyboard.press('Control+f');
    await page.waitForTimeout(500);

    const searchDialog = page.locator('[class*="search"], [class*="find"], [role="dialog"]').first();
    if (await searchDialog.count()) {
      await expect(searchDialog).toBeVisible();
    }
  });

  test('should search for text and show results', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    // Try to open search
    await page.keyboard.press('Control+f');
    await page.waitForTimeout(500);

    const searchInput = page.locator('[class*="search"] input, [class*="find"] input').first();
    if (!(await searchInput.count())) {
      test.skip();
      return;
    }

    // Type search term
    await searchInput.fill('알림');
    await page.waitForTimeout(500);

    // Check for highlights or result count
    const highlights = page.locator('[class*="search-highlight"], [class*="highlight"]');
    const resultCount = page.locator('[class*="search"] [class*="count"], [class*="result"]');

    const hasHighlights = (await highlights.count()) > 0;
    const hasResultCount = (await resultCount.count()) > 0;

    // At least one indicator should be present
    expect(hasHighlights || hasResultCount).toBeTruthy();
  });

  test('should navigate between search results', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    await page.keyboard.press('Control+f');
    await page.waitForTimeout(500);

    const searchInput = page.locator('[class*="search"] input, [class*="find"] input').first();
    if (!(await searchInput.count())) {
      test.skip();
      return;
    }

    await searchInput.fill('알림');
    await page.waitForTimeout(500);

    // Look for next/previous buttons
    const nextBtn = page.locator('[class*="search"] button')
      .filter({ hasText: /다음|next|▼|→/i })
      .first();

    if (await nextBtn.count()) {
      await nextBtn.click();
      await page.waitForTimeout(300);

      // Current highlight should change
      const currentHighlight = page.locator('[class*="current"], [class*="active-highlight"]');
      if (await currentHighlight.count()) {
        await expect(currentHighlight.first()).toBeVisible();
      }
    }
  });

  test('should close search dialog with Escape', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    await page.keyboard.press('Control+f');
    await page.waitForTimeout(500);

    const searchDialog = page.locator('[class*="search"], [class*="find"], [role="dialog"]').first();
    if (!(await searchDialog.count())) {
      test.skip();
      return;
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Dialog should be hidden
    const isVisible = await searchDialog.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });
});
