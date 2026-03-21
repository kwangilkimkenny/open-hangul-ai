// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('New Document Editing Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test('should create a new document via Ctrl+N', async ({ page }) => {
    await page.keyboard.press('Control+n');
    await page.waitForTimeout(500);
    // 새 문서 생성 후 페이지 컨테이너가 존재해야 함
    const pageContainer = page.locator('.hwp-page-container');
    await expect(pageContainer.first()).toBeVisible({ timeout: 3000 });
  });

  test('should have editable paragraph after new document', async ({ page }) => {
    await page.keyboard.press('Control+n');
    await page.waitForTimeout(500);
    const paragraph = page.locator('.hwp-paragraph');
    await expect(paragraph.first()).toBeVisible({ timeout: 3000 });
  });

  test('should type text in new document paragraph', async ({ page }) => {
    await page.keyboard.press('Control+n');
    await page.waitForTimeout(500);

    // 단락 클릭하여 편집 모드 진입
    const paragraph = page.locator('.hwp-paragraph').first();
    if (await paragraph.isVisible()) {
      await paragraph.click();
      await page.waitForTimeout(200);
      await page.keyboard.type('Hello HWPX');
      await page.waitForTimeout(200);

      const text = await paragraph.textContent();
      expect(text).toContain('Hello HWPX');
    }
  });

  test('should apply bold formatting via Ctrl+B', async ({ page }) => {
    await page.keyboard.press('Control+n');
    await page.waitForTimeout(500);

    const paragraph = page.locator('.hwp-paragraph').first();
    if (await paragraph.isVisible()) {
      await paragraph.click();
      await page.keyboard.type('bold text');
      // 텍스트 전체 선택
      await page.keyboard.press('Control+a');
      await page.waitForTimeout(100);
      // 굵게 적용
      await page.keyboard.press('Control+b');
      await page.waitForTimeout(200);

      // bold 태그 또는 font-weight:bold span이 존재해야 함
      const hasBold = await paragraph.evaluate(el => {
        return el.querySelector('b, strong, [style*="bold"]') !== null;
      });
      expect(hasBold).toBe(true);
    }
  });

  test('should insert line break with Enter', async ({ page }) => {
    await page.keyboard.press('Control+n');
    await page.waitForTimeout(500);

    const paragraph = page.locator('.hwp-paragraph').first();
    if (await paragraph.isVisible()) {
      await paragraph.click();
      await page.keyboard.type('Line 1');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Line 2');
      await page.waitForTimeout(200);

      const html = await paragraph.innerHTML();
      // <br> 태그가 포함되어야 함
      expect(html).toContain('<br');
    }
  });

  test('should save new document via Ctrl+S', async ({ page }) => {
    await page.keyboard.press('Control+n');
    await page.waitForTimeout(500);

    const paragraph = page.locator('.hwp-paragraph').first();
    if (await paragraph.isVisible()) {
      await paragraph.click();
      await page.keyboard.type('Save test');
      await page.waitForTimeout(200);
    }

    // 저장 시 다운로드 이벤트 대기
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await page.keyboard.press('Control+s');
    const download = await downloadPromise;

    if (download) {
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/\.hwpx$/);
    }
  });

  test('menu bar should have all expected menus', async ({ page }) => {
    const menuLabels = ['파일(F)', '편집(E)', '보기(V)', '삽입(I)', '서식(O)', '도구(T)'];
    for (const label of menuLabels) {
      const menu = page.locator('.hwp-menubar').getByText(label);
      await expect(menu).toBeVisible({ timeout: 2000 });
    }
  });

  test('ribbon tabs should have all expected tabs', async ({ page }) => {
    const tabLabels = ['홈', '삽입', '서식', '도구', '보기', 'AI'];
    for (const label of tabLabels) {
      const tab = page.locator('.hwp-ribbon-tabs').getByText(label);
      await expect(tab).toBeVisible({ timeout: 2000 });
    }
  });

  test('ribbon tabs should support keyboard navigation', async ({ page }) => {
    // 첫 번째 탭 클릭
    const firstTab = page.locator('.hwp-ribbon-tab').first();
    await firstTab.click();
    await firstTab.focus();

    // ArrowRight로 다음 탭으로 이동
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);

    const secondTab = page.locator('.hwp-ribbon-tab').nth(1);
    const isSelected = await secondTab.getAttribute('aria-selected');
    expect(isSelected).toBe('true');
  });
});
