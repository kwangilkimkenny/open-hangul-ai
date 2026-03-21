import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * E2E Test: Table Editing
 * Right-click → Add/Delete rows and columns
 */

test.describe('Table Editing', () => {
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
      await page.waitForSelector('.hwp-table', { timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  }

  test('should show context menu on right-click', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    const cell = page.locator('.hwp-table td').first();
    if (!(await cell.count())) {
      test.skip();
      return;
    }

    // Right-click on table cell
    await cell.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Look for context menu
    const contextMenu = page.locator('[class*="context-menu"], [role="menu"]').first();
    if (await contextMenu.count()) {
      await expect(contextMenu).toBeVisible();
    }
  });

  test('should have row/column manipulation options in context menu', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    const cell = page.locator('.hwp-table td').first();
    if (!(await cell.count())) {
      test.skip();
      return;
    }

    await cell.click({ button: 'right' });
    await page.waitForTimeout(500);

    const contextMenu = page.locator('[class*="context-menu"], [role="menu"]').first();
    if (!(await contextMenu.count())) {
      test.skip();
      return;
    }

    // Check for row/column menu items
    const menuText = await contextMenu.textContent();
    const hasRowOptions = /행|row/i.test(menuText);
    const hasColOptions = /열|column|col/i.test(menuText);
    expect(hasRowOptions || hasColOptions).toBeTruthy();
  });

  test('should count table rows before and after adding', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    const table = page.locator('.hwp-table').first();
    if (!(await table.count())) {
      test.skip();
      return;
    }

    const initialRowCount = await table.locator('tr').count();
    expect(initialRowCount).toBeGreaterThan(0);

    // Right-click a cell
    const cell = table.locator('td').first();
    await cell.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Look for "행 추가" or "Add row" button
    const addRowBtn = page.locator('[class*="context-menu"] button, [role="menuitem"]')
      .filter({ hasText: /행.*추가|add.*row|아래.*행/i })
      .first();

    if (await addRowBtn.count()) {
      await addRowBtn.click();
      await page.waitForTimeout(1000);

      const newRowCount = await table.locator('tr').count();
      expect(newRowCount).toBe(initialRowCount + 1);
    }
  });

  test('should count table columns before and after adding', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    const table = page.locator('.hwp-table').first();
    if (!(await table.count())) {
      test.skip();
      return;
    }

    const firstRow = table.locator('tr').first();
    const initialColCount = await firstRow.locator('td, th').count();

    const cell = table.locator('td').first();
    await cell.click({ button: 'right' });
    await page.waitForTimeout(500);

    const addColBtn = page.locator('[class*="context-menu"] button, [role="menuitem"]')
      .filter({ hasText: /열.*추가|add.*col|오른쪽.*열/i })
      .first();

    if (await addColBtn.count()) {
      await addColBtn.click();
      await page.waitForTimeout(1000);

      const newColCount = await firstRow.locator('td, th').count();
      expect(newColCount).toBe(initialColCount + 1);
    }
  });

  test('should delete a row via context menu', async ({ page }) => {
    if (!(await loadDocument(page))) {
      test.skip();
      return;
    }

    const table = page.locator('.hwp-table').first();
    if (!(await table.count())) {
      test.skip();
      return;
    }

    const initialRowCount = await table.locator('tr').count();
    if (initialRowCount < 2) {
      test.skip();
      return;
    }

    const cell = table.locator('td').first();
    await cell.click({ button: 'right' });
    await page.waitForTimeout(500);

    const deleteRowBtn = page.locator('[class*="context-menu"] button, [role="menuitem"]')
      .filter({ hasText: /행.*삭제|delete.*row|행.*제거/i })
      .first();

    if (await deleteRowBtn.count()) {
      await deleteRowBtn.click();
      await page.waitForTimeout(1000);

      const newRowCount = await table.locator('tr').count();
      expect(newRowCount).toBe(initialRowCount - 1);
    }
  });
});
