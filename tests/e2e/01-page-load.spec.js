import { test, expect } from '@playwright/test';

/**
 * E2E Test: Initial Page Load
 * Tests basic page functionality and initial render
 */

test.describe('Initial Page Load', () => {
  test('should load the application without errors', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Check that the page title is correct
    await expect(page).toHaveTitle(/HAN-View/);

    // Verify no console errors (except warnings)
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait a bit to catch any delayed errors
    await page.waitForTimeout(1000);

    // Should have no console errors
    expect(errors.length).toBe(0);
  });

  test('should display the main UI components', async ({ page }) => {
    await page.goto('/');

    // Wait for main content to load (networkidle for WebKit)
    await page.waitForLoadState('networkidle');

    // Check for main heading (adjust selector based on your actual HTML)
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 15000 });

    // Verify the app container exists
    const appContainer = page.locator('#root, .app, main').first();
    await expect(appContainer).toBeVisible({ timeout: 15000 });
  });

  test('should have correct viewport settings', async ({ page }) => {
    await page.goto('/');

    // Check viewport meta tag
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewportMeta).toContain('width=device-width');
    expect(viewportMeta).toContain('initial-scale=1');
  });

  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('load');

    const loadTime = Date.now() - startTime;

    // Should load within 5 seconds (generous for first load)
    expect(loadTime).toBeLessThan(5000);
  });

  test('should have security meta tags', async ({ page }) => {
    await page.goto('/');

    // Check for Content-Security-Policy meta tag
    const cspMeta = page.locator('meta[http-equiv="Content-Security-Policy"]');
    await expect(cspMeta).toHaveCount(1);

    // Check for X-Frame-Options meta tag
    const xfoMeta = page.locator('meta[http-equiv="X-Frame-Options"]');
    await expect(xfoMeta).toHaveCount(1);

    // Check for X-Content-Type-Options meta tag
    const xctoMeta = page.locator('meta[http-equiv="X-Content-Type-Options"]');
    await expect(xctoMeta).toHaveCount(1);
  });

  test('should not have any broken images', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get all images
    const images = await page.locator('img').all();

    for (const img of images) {
      const src = await img.getAttribute('src');

      // Skip data URLs and blob URLs (they're generated)
      if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
        const naturalWidth = await img.evaluate(el => el.naturalWidth);
        expect(naturalWidth).toBeGreaterThan(0);
      }
    }
  });

  test('should have no accessibility violations on load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for basic accessibility attributes
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang');

    // All images should have alt attributes (or be decorative)
    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');

      // Either has alt text or is marked as decorative
      const hasAccessibility = alt !== null || role === 'presentation';
      expect(hasAccessibility).toBe(true);
    }
  });

  test('should support keyboard navigation', async ({ page, browserName }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Press Tab until we get to an interactive element (WebKit may need multiple presses)
    let focusedElement = null;
    const interactiveElements = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];
    const maxTries = browserName === 'webkit' ? 5 : 2;

    for (let i = 0; i < maxTries; i++) {
      await page.keyboard.press('Tab');
      focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      if (interactiveElements.includes(focusedElement)) {
        break;
      }
    }

    // Should have focused an interactive element
    expect(interactiveElements).toContain(focusedElement);
  });
});
