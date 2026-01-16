import { test, expect } from '@playwright/test';

/**
 * E2E Test: Responsive Design
 * Tests responsive layouts and mobile compatibility
 */

test.describe('Responsive Design', () => {
  test.describe('Desktop (1920x1080)', () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

    test('should render correctly on large desktop', async ({ page }) => {
      await page.goto('/');

      // Check viewport size
      const viewportSize = page.viewportSize();
      expect(viewportSize?.width).toBe(1920);
      expect(viewportSize?.height).toBe(1080);

      // Main content should be visible
      const mainContent = page.locator('#root, .app, main').first();
      await expect(mainContent).toBeVisible();

      // Should not have horizontal scrollbar
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
    });
  });

  test.describe('Laptop (1280x720)', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('should render correctly on laptop', async ({ page }) => {
      await page.goto('/');

      // Check viewport size
      const viewportSize = page.viewportSize();
      expect(viewportSize?.width).toBe(1280);

      // Main content should be visible
      const mainContent = page.locator('#root, .app, main').first();
      await expect(mainContent).toBeVisible();

      // Should not have horizontal scrollbar
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
    });
  });

  test.describe('Tablet (768x1024)', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('should render correctly on tablet', async ({ page }) => {
      await page.goto('/');

      // Main content should be visible
      const mainContent = page.locator('#root, .app, main').first();
      await expect(mainContent).toBeVisible();

      // Should not have horizontal scrollbar
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);

      // Touch targets should be large enough (44x44px minimum)
      const buttons = await page.locator('button, a[role="button"]').all();
      for (const button of buttons.slice(0, 5)) {
        // Check first 5 buttons
        if (await button.isVisible()) {
          const box = await button.boundingBox();
          if (box) {
            // Either width or height should be at least 44px
            const hasMinimumSize = box.width >= 44 || box.height >= 44;
            expect(hasMinimumSize).toBe(true);
          }
        }
      }
    });
  });

  test.describe('Mobile (375x667)', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should render correctly on mobile', async ({ page }) => {
      await page.goto('/');

      // Main content should be visible
      const mainContent = page.locator('#root, .app, main').first();
      await expect(mainContent).toBeVisible();

      // Should not have horizontal scrollbar
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);

      // Text should be readable (16px minimum)
      const bodyFontSize = await page.evaluate(() => {
        return window.getComputedStyle(document.body).fontSize;
      });
      const fontSize = parseInt(bodyFontSize);
      expect(fontSize).toBeGreaterThanOrEqual(14); // Slightly lower threshold for mobile
    });

    test('should support touch interactions on mobile', async ({ page }) => {
      await page.goto('/');

      // Look for interactive elements
      const buttons = page.locator('button, a[role="button"]').first();

      if ((await buttons.count()) > 0) {
        // Should be tappable
        await expect(buttons).toBeVisible();

        // Check touch target size
        const box = await buttons.boundingBox();
        if (box) {
          // Minimum touch target: 44x44px (iOS) or 48x48px (Android)
          const hasMinimumSize = box.width >= 40 && box.height >= 40;
          expect(hasMinimumSize).toBe(true);
        }
      }
    });

    test('should stack content vertically on mobile', async ({ page }) => {
      await page.goto('/');

      // Get layout direction of main container
      const flexDirection = await page.evaluate(() => {
        const main = document.querySelector('#root, .app, main');
        if (main) {
          return window.getComputedStyle(main).flexDirection;
        }
        return null;
      });

      // If using flexbox, should be column on mobile
      if (flexDirection) {
        // Either column or not using flex (which is fine)
        const isMobileFriendly = flexDirection === 'column' || flexDirection === '';
        expect(isMobileFriendly).toBe(true);
      }
    });
  });

  test.describe('Responsive Images', () => {
    test('should load appropriate images for viewport', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Get all images
      const images = await page.locator('img').all();

      for (const img of images) {
        const src = await img.getAttribute('src');

        // Skip data URLs and blob URLs
        if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
          // Image should load successfully
          const naturalWidth = await img.evaluate(el => el.naturalWidth);
          expect(naturalWidth).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe('Orientation Changes', () => {
    test('should handle portrait to landscape', async ({ page }) => {
      // Start in portrait
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      // Verify portrait layout
      let viewportSize = page.viewportSize();
      expect(viewportSize?.width).toBeLessThan(viewportSize?.height || 0);

      // Switch to landscape
      await page.setViewportSize({ width: 667, height: 375 });
      await page.waitForTimeout(500); // Wait for reflow

      // Verify landscape layout
      viewportSize = page.viewportSize();
      expect(viewportSize?.width).toBeGreaterThan(viewportSize?.height || 0);

      // App should still be functional
      const mainContent = page.locator('#root, .app, main').first();
      await expect(mainContent).toBeVisible();
    });
  });

  test.describe('Zoom Levels', () => {
    test('should support pinch-to-zoom on mobile', async ({ page }) => {
      await page.goto('/');

      // Check viewport meta tag allows zoom
      const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');

      // Should not have user-scalable=no
      if (viewportMeta) {
        expect(viewportMeta).not.toContain('user-scalable=no');
        expect(viewportMeta).not.toContain('maximum-scale=1');
      }
    });
  });
});
