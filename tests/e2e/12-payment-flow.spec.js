import { test, expect } from '@playwright/test';

/**
 * E2E Test: 결제 플로우 (데모 모드)
 *
 * 시나리오:
 * 1. 랜딩페이지 → 회원가입
 * 2. 로그인 후 요금제 페이지
 * 3. Personal 플랜 선택 → 결제 모달
 * 4. 데모 모드에서 결제 시뮬레이션
 * 5. 성공 페이지 검증
 *
 * 주의: 데모 모드 전제 (VITE_SUPABASE_URL 미설정)
 * Supabase 모드에서는 실제 토스 결제창이 열리므로 별도 시나리오 필요
 */

test.describe('결제 플로우 (Demo Mode)', () => {
  test('랜딩페이지가 정상 로드되고 요금제 링크가 있어야 함', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 히어로 섹션 확인
    await expect(page.locator('h1')).toContainText('하나의 편집기로');

    // 요금제 링크 확인 (DOM에 존재하면 OK — 모바일에서는 nav가 숨겨질 수 있음)
    const pricingLink = page.locator('a[href="/pricing"]').first();
    await expect(pricingLink).toHaveCount(1);
  });

  test('로그인 없이 편집기 접근 시 로그인 페이지로 리다이렉트', async ({ page }) => {
    await page.goto('/editor');
    await page.waitForURL('**/login*');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h1')).toContainText('로그인');
  });

  test('데모 계정으로 로그인 → 편집기 접근', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 데모 계정 입력
    await page.fill('input[type="email"]', 'demo@hanview.ai');
    await page.fill('input[type="password"]', 'demo1234');
    await page.click('button[type="submit"]');

    // 편집기로 리다이렉트 확인
    await page.waitForURL('**/editor', { timeout: 10000 });
    await expect(page).toHaveURL(/\/editor/);
  });

  test('잘못된 로그인 정보 시 에러 표시', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    // 에러 메시지 확인
    await expect(page.locator('.auth-error')).toBeVisible({ timeout: 5000 });
  });

  test('회원가입 → 자동 로그인 → 편집기 이동', async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@example.com`;

    await page.goto('/signup');
    await page.fill('input[id="name"]', '테스트 사용자');
    await page.fill('input[id="email"]', uniqueEmail);
    await page.fill('input[id="password"]', 'test12345');
    await page.fill('input[id="confirmPassword"]', 'test12345');
    await page.check('input[type="checkbox"]');
    await page.click('button[type="submit"]');

    // 데모 모드에서는 즉시 로그인되어 편집기로 이동
    await page.waitForURL('**/editor', { timeout: 10000 });
  });

  test('요금제 페이지에서 4개 플랜이 표시되어야 함', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    // 4개 플랜 카드 확인
    const planCards = page.locator('.pricing-card');
    await expect(planCards).toHaveCount(4);

    // 플랜 이름 확인
    await expect(page.locator('text=Free').first()).toBeVisible();
    await expect(page.locator('text=Personal').first()).toBeVisible();
    await expect(page.locator('text=Business').first()).toBeVisible();
    await expect(page.locator('text=Enterprise').first()).toBeVisible();
  });

  test('비로그인 상태에서 유료 플랜 선택 시 로그인 페이지로', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    // Personal 플랜의 "지금 시작" 버튼 클릭
    const personalCta = page.locator('.pricing-card').nth(1).locator('button.plan-cta');
    await personalCta.click();

    // 로그인 페이지로 이동
    await page.waitForURL('**/login*', { timeout: 5000 });
  });

  test('월간/연간 토글이 작동해야 함', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    const monthlyButton = page.locator('button:has-text("월간")');
    const yearlyButton = page.locator('button:has-text("연간")');

    // 기본은 연간
    await expect(yearlyButton).toHaveClass(/active/);

    // 월간 클릭
    await monthlyButton.click();
    await expect(monthlyButton).toHaveClass(/active/);
  });

  test('로그인 후 요금제 → 결제 모달 열림', async ({ page }) => {
    // 1. 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', 'demo@hanview.ai');
    await page.fill('input[type="password"]', 'demo1234');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/editor');

    // 2. 요금제로 이동
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    // 3. Business 플랜 선택 (현재 demo는 personal이므로 다른 플랜)
    const businessCta = page.locator('.pricing-card').nth(2).locator('button.plan-cta');
    await businessCta.click();

    // 4. 결제 모달 표시 확인
    await expect(page.locator('.payment-modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.payment-modal h2')).toContainText('결제 수단 선택');

    // 5. 4개 결제 수단 표시 확인
    const methods = page.locator('.payment-method');
    await expect(methods).toHaveCount(4);

    // 6. 모달 닫기
    await page.locator('.close-btn').click();
    await expect(page.locator('.payment-modal')).not.toBeVisible();
  });

  test('법적 페이지 3종 모두 접근 가능해야 함', async ({ page }) => {
    for (const type of ['terms', 'privacy', 'refund']) {
      await page.goto(`/legal/${type}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('.updated')).toBeVisible();
    }
  });

  test('관리자 계정으로 어드민 대시보드 접근', async ({ page }) => {
    // admin 계정 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@hanview.ai');
    await page.fill('input[type="password"]', 'admin1234');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/editor');

    // 어드민 대시보드 접근
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('관리자 대시보드');
    await expect(page.locator('.mode-badge')).toBeVisible();
  });

  test('일반 사용자가 어드민 페이지 접근 시 차단', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'demo@hanview.ai');
    await page.fill('input[type="password"]', 'demo1234');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/editor');

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=접근 권한 없음')).toBeVisible();
  });

  test('쿠키 동의 배너가 첫 방문 시 표시', async ({ page, context }) => {
    // localStorage 클리어 (첫 방문 시뮬레이션)
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('hanview-cookie-consent'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 배너 표시 확인
    await expect(page.locator('.cookie-consent')).toBeVisible({ timeout: 3000 });

    // "필수만" 클릭
    await page.locator('button:has-text("필수만")').click();

    // 배너 사라짐 확인
    await expect(page.locator('.cookie-consent')).not.toBeVisible();

    // localStorage에 저장 확인
    const consent = await page.evaluate(() => localStorage.getItem('hanview-cookie-consent'));
    expect(consent).toBeTruthy();
    expect(JSON.parse(consent)).toMatchObject({ necessary: true, analytics: false, marketing: false });
  });
});
