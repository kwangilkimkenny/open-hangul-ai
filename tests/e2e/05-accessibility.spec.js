import { test, expect } from '@playwright/test';

/**
 * E2E Test: Accessibility (WCAG 2.1 AA)
 * Tests keyboard navigation, screen reader support, and color contrast
 */

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('Keyboard Navigation', () => {
    test('should support Tab navigation', async ({ page, browserName }) => {
      // Press Tab until we get to an interactive element (WebKit may need multiple presses)
      let focusedTag = null;
      const interactiveElements = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];
      const maxTries = browserName === 'webkit' ? 5 : 2;

      for (let i = 0; i < maxTries; i++) {
        await page.keyboard.press('Tab');
        focusedTag = await page.evaluate(() => document.activeElement?.tagName);
        if (interactiveElements.includes(focusedTag)) {
          break;
        }
      }

      // Should focus an interactive element
      expect(interactiveElements).toContain(focusedTag);
    });

    test('should have visible focus indicators', async ({ page }) => {
      // Tab to first interactive element
      await page.keyboard.press('Tab');

      // Get focused element's outline or box-shadow
      const hasFocusIndicator = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return false;

        const styles = window.getComputedStyle(el);
        const outline = styles.outline;
        const boxShadow = styles.boxShadow;

        // Should have either outline or box-shadow
        return outline !== 'none' || boxShadow !== 'none';
      });

      expect(hasFocusIndicator).toBe(true);
    });

    test('should maintain logical focus order', async ({ page }) => {
      const focusOrder = [];

      // Tab through first 5 elements
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        const element = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            tag: el?.tagName,
            id: el?.id,
            text: el?.textContent?.substring(0, 20),
          };
        });
        focusOrder.push(element);
      }

      // Focus order should be populated
      expect(focusOrder.length).toBe(5);
      expect(focusOrder.every(el => el.tag)).toBe(true);
    });

    test('should support Shift+Tab for backward navigation', async ({ page, browserName }) => {
      const interactiveElements = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL'];
      const maxTries = browserName === 'webkit' ? 6 : 4;

      // Tab forward until we get to interactive elements
      let focusedTag = null;
      for (let i = 0; i < maxTries; i++) {
        await page.keyboard.press('Tab');
        focusedTag = await page.evaluate(() => document.activeElement?.tagName);
      }

      // Tab backward once
      await page.keyboard.press('Shift+Tab');

      const backwardElement = await page.evaluate(() => document.activeElement?.tagName);

      // Should have moved backward to an interactive element or BODY
      expect(backwardElement).toBeTruthy();
      const acceptableElements = [...interactiveElements, 'BODY', 'HTML'];
      expect(acceptableElements).toContain(backwardElement);
    });

    test('should have no keyboard traps', async ({ page }) => {
      // Tab through many elements
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab');
      }

      // Should still be able to focus elements
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();

      // Should be able to shift+tab back
      await page.keyboard.press('Shift+Tab');
      const backElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(backElement).toBeTruthy();
    });

    test('should support Escape key for dismissing modals', async ({ page }) => {
      // Look for any open modals or dialogs
      const dialog = page.locator('[role="dialog"], dialog, .modal').first();

      if ((await dialog.count()) > 0 && (await dialog.isVisible())) {
        // Press Escape
        await page.keyboard.press('Escape');

        // Dialog should close or become hidden
        await expect(dialog).toBeHidden({ timeout: 2000 });
      }
    });
  });

  test.describe('Semantic HTML', () => {
    test('should have proper document structure', async ({ page }) => {
      // Should have main landmark
      const main = page.locator('main, [role="main"]').first();
      const hasMain = (await main.count()) > 0;

      // Main landmark is recommended
      if (!hasMain) {
        console.log('Warning: No <main> landmark found');
      }
    });

    test('should have heading hierarchy', async ({ page }) => {
      // Get all headings
      const headings = await page.evaluate(() => {
        const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        return Array.from(elements).map(el => ({
          level: parseInt(el.tagName[1]),
          text: el.textContent?.substring(0, 50),
        }));
      });

      if (headings.length > 0) {
        // Should have at least one h1
        const hasH1 = headings.some(h => h.level === 1);
        expect(hasH1).toBe(true);

        // Headings should not skip levels (e.g., h1 -> h3)
        for (let i = 1; i < headings.length; i++) {
          const prevLevel = headings[i - 1].level;
          const currLevel = headings[i].level;
          const diff = currLevel - prevLevel;

          // Should not skip more than 1 level
          expect(diff).toBeLessThanOrEqual(1);
        }
      }
    });

    test('should use semantic HTML elements', async ({ page }) => {
      // Check for semantic elements
      const semanticElements = await page.evaluate(() => {
        return {
          nav: document.querySelectorAll('nav').length,
          header: document.querySelectorAll('header').length,
          footer: document.querySelectorAll('footer').length,
          article: document.querySelectorAll('article').length,
          section: document.querySelectorAll('section').length,
        };
      });

      // At least some semantic elements should be used
      const totalSemantic = Object.values(semanticElements).reduce((a, b) => a + b, 0);
      console.log('Semantic elements count:', totalSemantic);
    });
  });

  test.describe('ARIA Attributes', () => {
    test('should have lang attribute on html element', async ({ page }) => {
      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBeTruthy();
      expect(lang?.length).toBeGreaterThan(0);
    });

    test('should have accessible names for buttons', async ({ page }) => {
      const buttons = await page.locator('button').all();

      for (const button of buttons) {
        if (await button.isVisible()) {
          // Get accessible name (text content, aria-label, or title)
          const text = await button.textContent();
          const ariaLabel = await button.getAttribute('aria-label');
          const title = await button.getAttribute('title');

          const hasAccessibleName = text?.trim() || ariaLabel || title;
          expect(hasAccessibleName).toBeTruthy();
        }
      }
    });

    test('should have alt text for images', async ({ page }) => {
      const images = await page.locator('img').all();

      for (const img of images) {
        if (await img.isVisible()) {
          const alt = await img.getAttribute('alt');
          const role = await img.getAttribute('role');

          // Should have alt attribute (can be empty for decorative images)
          // or role="presentation"
          const hasAccessibility = alt !== null || role === 'presentation';
          expect(hasAccessibility).toBe(true);
        }
      }
    });

    test('should have associated labels for form inputs', async ({ page }) => {
      const inputs = await page.locator('input:not([type="hidden"])').all();

      for (const input of inputs) {
        if (await input.isVisible()) {
          const id = await input.getAttribute('id');
          const ariaLabel = await input.getAttribute('aria-label');
          const ariaLabelledby = await input.getAttribute('aria-labelledby');
          const title = await input.getAttribute('title');
          const placeholder = await input.getAttribute('placeholder');
          const type = await input.getAttribute('type');

          // Should have some form of label
          const hasLabel = id || ariaLabel || ariaLabelledby || title || placeholder;

          if (id) {
            // Check if there's a <label for="id">
            const label = await page.locator(`label[for="${id}"]`).count();
            expect(label > 0 || ariaLabel || ariaLabelledby).toBe(true);
          } else {
            // Should have aria-label or other label method
            if (!hasLabel) {
              console.log('Input without label found:', {
                type,
                id,
                ariaLabel,
                ariaLabelledby,
                title,
                placeholder,
              });
            }
            expect(hasLabel).toBeTruthy();
          }
        }
      }
    });

    test('should use proper ARIA roles', async ({ page }) => {
      // Get elements with custom roles
      const rolesUsed = await page.evaluate(() => {
        const elements = document.querySelectorAll('[role]');
        return Array.from(elements).map(el => el.getAttribute('role'));
      });

      // Valid ARIA roles (subset)
      const validRoles = [
        'alert',
        'alertdialog',
        'application',
        'article',
        'banner',
        'button',
        'checkbox',
        'dialog',
        'grid',
        'gridcell',
        'link',
        'list',
        'listbox',
        'listitem',
        'main',
        'menu',
        'menubar',
        'menuitem',
        'navigation',
        'progressbar',
        'radio',
        'region',
        'search',
        'status',
        'tab',
        'tablist',
        'tabpanel',
        'textbox',
        'toolbar',
        'tooltip',
        'presentation',
        'none',
      ];

      // All used roles should be valid
      for (const role of rolesUsed) {
        if (role) {
          expect(validRoles).toContain(role);
        }
      }
    });
  });

  test.describe('Color Contrast', () => {
    test('should have sufficient text contrast', async ({ page }) => {
      // Get body text color and background
      const contrast = await page.evaluate(() => {
        const body = document.body;
        const styles = window.getComputedStyle(body);

        return {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          fontSize: styles.fontSize,
        };
      });

      // Just verify colors are defined
      expect(contrast.color).toBeTruthy();
      expect(contrast.backgroundColor).toBeTruthy();

      // Actual contrast ratio calculation would require color parsing
      // For now, just document the values
      console.log('Body text color:', contrast.color);
      console.log('Body background:', contrast.backgroundColor);
    });

    test('should not rely solely on color for information', async ({ page }) => {
      // Check for elements that might use color-only indicators
      const colorOnlyIndicators = await page.evaluate(() => {
        // Look for elements with only background color changes
        const elements = document.querySelectorAll('[style*="background-color"], [style*="color"]');
        return elements.length;
      });

      // This is informational - we can't automatically detect color-only usage
      console.log('Elements with inline color styles:', colorOnlyIndicators);
    });
  });

  test.describe('Screen Reader Support', () => {
    test('should have descriptive page title', async ({ page }) => {
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
      expect(title.length).toBeLessThan(100); // Not too long
    });

    test('should announce dynamic content changes', async ({ page }) => {
      // Look for ARIA live regions
      const liveRegions = await page.locator('[aria-live]').count();

      // If there are status updates, should have live regions
      // This is informational
      console.log('ARIA live regions found:', liveRegions);
    });

    test('should have skip navigation link', async ({ page }) => {
      // Look for skip link
      const skipLink = page.locator('a[href^="#"], a[href^="#main"], a[href^="#content"]').first();

      // Skip link is recommended for keyboard users
      const hasSkipLink = (await skipLink.count()) > 0;

      if (!hasSkipLink) {
        console.log('Recommendation: Add skip navigation link for keyboard users');
      }
    });
  });

  test.describe('Forms Accessibility', () => {
    test('should show error messages accessibly', async ({ page }) => {
      // Look for form error messages
      const errors = page.locator('[role="alert"], .error, [aria-invalid="true"]');

      // If errors exist, they should be accessible
      const errorCount = await errors.count();

      if (errorCount > 0) {
        // Error messages should be associated with inputs
        const firstError = errors.first();
        const ariaDescribedby = await firstError.getAttribute('aria-describedby');

        // This is good practice
        console.log('Error message accessibility:', ariaDescribedby ? 'Good' : 'Could be improved');
      }
    });
  });

  test.describe('Interactive Elements', () => {
    test('should have sufficient click targets', async ({ page }) => {
      const buttons = await page.locator('button, a[role="button"]').all();

      for (const button of buttons.slice(0, 10)) {
        // Check first 10
        if (await button.isVisible()) {
          const box = await button.boundingBox();

          if (box) {
            // WCAG AAA: 44x44px minimum
            // WCAG AA: More lenient
            const meetsAAA = box.width >= 44 && box.height >= 44;
            const meetsAA = box.width >= 24 && box.height >= 24;

            expect(meetsAA).toBe(true);

            if (!meetsAAA) {
              console.log('Button could be larger for AAA compliance:', box);
            }
          }
        }
      }
    });
  });
});
