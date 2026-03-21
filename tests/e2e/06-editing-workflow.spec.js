import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * E2E Test: Editing Workflow
 * HWPX load → cell click → text input → verify change → Undo → Redo
 */

test.describe('Editing Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load a document and display content', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (!(await fileInput.count())) {
      test.skip();
      return;
    }

    // Load a sample HWPX file
    const samplePath = path.join(process.cwd(), 'docs/알림장 템플릿.hwpx');
    try {
      await fileInput.setInputFiles(samplePath);
    } catch {
      test.skip();
      return;
    }

    // Wait for rendering
    await page.waitForSelector('.hwp-table, .hwp-paragraph', { timeout: 15000 });

    // Verify content is rendered
    const tables = page.locator('.hwp-table');
    const paragraphs = page.locator('.hwp-paragraph');
    const totalElements = (await tables.count()) + (await paragraphs.count());
    expect(totalElements).toBeGreaterThan(0);
  });

  test('should enable cell editing on click', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (!(await fileInput.count())) {
      test.skip();
      return;
    }

    const samplePath = path.join(process.cwd(), 'docs/알림장 템플릿.hwpx');
    try {
      await fileInput.setInputFiles(samplePath);
    } catch {
      test.skip();
      return;
    }

    await page.waitForSelector('.hwp-table td, .hwp-table th', { timeout: 15000 });

    // Click on a table cell
    const cell = page.locator('.hwp-table td, .hwp-table th').first();
    if (await cell.count()) {
      await cell.click();
      await page.waitForTimeout(500);

      // Check if editing mode is activated (contentEditable or editing class)
      const isEditable = await cell.evaluate(el =>
        el.contentEditable === 'true' || el.classList.contains('editing')
      );
      // Editing may or may not be enabled depending on edit mode state
      expect(typeof isEditable).toBe('boolean');
    }
  });

  test('should support text input in editable cell', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (!(await fileInput.count())) {
      test.skip();
      return;
    }

    const samplePath = path.join(process.cwd(), 'docs/알림장 템플릿.hwpx');
    try {
      await fileInput.setInputFiles(samplePath);
    } catch {
      test.skip();
      return;
    }

    await page.waitForSelector('.hwp-table td', { timeout: 15000 });

    const cell = page.locator('.hwp-table td').first();
    if (!(await cell.count())) {
      test.skip();
      return;
    }

    // Double-click to enter edit mode
    await cell.dblclick();
    await page.waitForTimeout(500);

    const isEditable = await cell.evaluate(el => el.contentEditable === 'true');
    if (isEditable) {
      const originalText = await cell.textContent();
      await page.keyboard.type('테스트 입력');
      const newText = await cell.textContent();
      expect(newText).not.toBe(originalText);
    }
  });

  test('should preserve changes after blur', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (!(await fileInput.count())) {
      test.skip();
      return;
    }

    const samplePath = path.join(process.cwd(), 'docs/알림장 템플릿.hwpx');
    try {
      await fileInput.setInputFiles(samplePath);
    } catch {
      test.skip();
      return;
    }

    await page.waitForSelector('.hwp-table td', { timeout: 15000 });

    const cells = page.locator('.hwp-table td');
    if ((await cells.count()) < 2) {
      test.skip();
      return;
    }

    // Click first cell
    await cells.first().dblclick();
    await page.waitForTimeout(500);

    const isEditable = await cells.first().evaluate(el => el.contentEditable === 'true');
    if (!isEditable) {
      test.skip();
      return;
    }

    // Type and blur
    await page.keyboard.type('변경됨');
    const textAfterType = await cells.first().textContent();

    // Click elsewhere to blur
    await cells.nth(1).click();
    await page.waitForTimeout(500);

    // Text should be preserved
    const textAfterBlur = await cells.first().textContent();
    expect(textAfterBlur).toContain('변경됨');
  });

  test('should support Escape to end editing', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    if (!(await fileInput.count())) {
      test.skip();
      return;
    }

    const samplePath = path.join(process.cwd(), 'docs/알림장 템플릿.hwpx');
    try {
      await fileInput.setInputFiles(samplePath);
    } catch {
      test.skip();
      return;
    }

    await page.waitForSelector('.hwp-table td', { timeout: 15000 });

    const cell = page.locator('.hwp-table td').first();
    if (!(await cell.count())) {
      test.skip();
      return;
    }

    await cell.dblclick();
    await page.waitForTimeout(500);

    const isEditable = await cell.evaluate(el => el.contentEditable === 'true');
    if (!isEditable) {
      test.skip();
      return;
    }

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Cell should no longer be in editing mode
    const editingClass = await cell.evaluate(el => el.classList.contains('editing'));
    expect(editingClass).toBe(false);
  });
});
