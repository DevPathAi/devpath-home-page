import { test, expect } from '@playwright/test';

// E2E 1: 홈 로드 → 주 CTA → 리드폼 제출(Apps Script 프록시 모킹) 스모크.
test.describe('홈페이지 스모크', () => {
  test.beforeEach(async ({ page }) => {
    // /api/stats: 임계 이상 정상 응답 모킹
    await page.route('**/api/stats', (route) =>
      route.fulfill({ json: { ok: true, signups: 42, diagnoses_completed: 30, satisfaction: 4.6 } }),
    );
    // /api/lead: 성공 응답 모킹
    await page.route('**/api/lead', (route) =>
      route.fulfill({ json: { ok: true, lead_id: 'test-1', updated: false } }),
    );
  });

  test('페이지 로드 + 핵심 콘텐츠 노출', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Leva/);
    await expect(page.locator('h1')).toContainText('다음 단계');
    await expect(page.getByRole('link', { name: '가입 없이 진단 시작' })).toBeVisible();
  });

  // 게스트 진단은 앱에서 가입 없이 시작된다. 예전에는 이 CTA가 #lead(이메일
  // 폼)로 갔는데, 그건 지금 써볼 수 있는 제품을 대기열 뒤에 숨기는 것이었다.
  // 외부 링크라 클릭해 이동시키는 대신 목적지를 단언한다.
  test('주 CTA가 앱 게스트 진단으로 향한다', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('link', { name: '가입 없이 진단 시작' }),
    ).toHaveAttribute('href', 'https://app.leva.ai.kr/');
    await expect(
      page.getByRole('link', { name: '무료로 진단 시작' }).first(),
    ).toHaveAttribute('href', 'https://app.leva.ai.kr/');
  });

  test('리드폼 제출 → 성공 상태', async ({ page }) => {
    await page.goto('/');
    // 리드폼 마운트가 lazy-load 되도록 섹션으로 스크롤
    await page.locator('#lead').scrollIntoViewIfNeeded();
    const email = page.locator('#lf-email');
    await expect(email).toBeVisible({ timeout: 5000 }); // 위젯 하이드레이트 대기
    await email.fill('tester@example.com');
    await page.locator('#lf-stage').selectOption('learning');
    await page.locator('#lf-consent').check();
    await page.getByRole('button', { name: '진단 초대받기' }).click();
    await expect(page.locator('#lf-success')).toBeVisible();
  });

  test('traction: 임계 이상이면 숫자 노출', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-widget="traction"]').scrollIntoViewIfNeeded();
    await expect(page.locator('.traction__num').first()).toBeVisible({ timeout: 5000 });
  });

  test('리드폼: 빈 제출 시 필드별 에러(T16)', async ({ page }) => {
    await page.goto('/');
    await page.locator('#lead').scrollIntoViewIfNeeded();
    await expect(page.locator('#lf-email')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: '진단 초대받기' }).click();
    await expect(page.locator('#lf-email-err')).toContainText('이메일');
    await expect(page.locator('#lf-stage-err')).toContainText('단계');
    await expect(page.locator('#lf-consent-err')).toContainText('동의');
    await expect(page.locator('#lf-email')).toHaveAttribute('aria-invalid', 'true');
  });

  test('LCS 데모: 탭 전환으로 예시 변경(T6/T18)', async ({ page }) => {
    await page.goto('/');
    await page.locator('#lcs').scrollIntoViewIfNeeded();
    const tabs = page.locator('.lcs-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 5000 });
    // 두 번째 탭(useEffect) 클릭 → 해당 질문이 비교 영역에 노출
    await tabs.nth(1).click();
    await expect(page.locator('.lcs__compare')).toContainText('useEffect');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  });
});
