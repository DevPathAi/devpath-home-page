import { test, expect } from '@playwright/test';

const DIAGNOSTIC_URL = 'https://app.leva.ai.kr/diagnostic';

test.describe('Mission Spine 랜딩 스모크', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/stats', (route) =>
      route.fulfill({ json: { ok: true, signups: 42, diagnoses_completed: 30, satisfaction: 4.6 } }),
    );
    await page.route('**/api/lead', (route) =>
      route.fulfill({ json: { ok: true, lead_id: 'test-1', updated: false } }),
    );
  });

  test('페이지가 실제 Outcome Preview와 canonical CTA를 노출한다', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Leva/);
    await expect(page.locator('h1')).toContainText('다음 미션');
    await expect(page.getByText('예시 결과', { exact: true })).toBeVisible();
    await expect(page.getByText('에러 처리 패턴 적용', { exact: true })).toBeVisible();
    const ctas = page.locator('[data-diagnostic-cta="primary"]');
    await expect(ctas).toHaveCount(4);
    await expect(ctas.first()).toHaveAttribute('href', DIAGNOSTIC_URL);
  });

  test('source와 dist가 각각 올바른 stylesheet를 제공한다', async ({ page }, testInfo) => {
    await page.goto('/');
    const hrefs = await page.locator('link[rel="stylesheet"]').evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')),
    );

    if (testInfo.project.name === 'production-dist') {
      expect(hrefs.some((href) => /^\/assets\/tokens\.[0-9a-f]{8}\.css$/.test(href))).toBe(true);
      expect(hrefs.some((href) => /^\/assets\/styles\.[0-9a-f]{8}\.css$/.test(href))).toBe(true);
    } else {
      expect(hrefs).toContain('/assets/tokens.css');
      expect(hrefs).toContain('/assets/styles.css');
    }
  });

  test('CTA 클릭 직전에 canonical 경로를 journeyId로 장식한다', async ({ page }) => {
    await page.goto('/');
    const cta = page.locator('.hero [data-diagnostic-cta="primary"]');
    await cta.evaluate((link) => link.addEventListener('click', (event) => event.preventDefault()));

    await cta.click();

    await expect(cta).toHaveAttribute(
      'href',
      /^https:\/\/app\.leva\.ai\.kr\/diagnostic\?journeyId=[A-Za-z0-9_-]{22}$/,
    );
  });

  for (const width of [320, 600, 840, 1240]) {
    test(`${width}px에서 overflow 없이 해당 window class navigation을 쓴다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);

      if (width < 840) {
        await expect(page.locator('.mobile-nav__toggle')).toBeVisible();
        await expect(page.locator('.site-nav')).toBeHidden();
      } else {
        await expect(page.locator('.mobile-nav')).toBeHidden();
        await expect(page.locator('.site-nav')).toBeVisible();
      }
      await expect(page.locator('.site-header__cta')).toBeVisible();
    });
  }

  test('기존 정적 페이지도 320px에서 가로로 밀리지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 760 });

    for (const path of ['/', '/privacy.html', '/terms.html', '/beta.html', '/about.html']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} 가 가로로 넘친다`).toBe(0);
    }
  });

  test('320px에서 text-only 200% 확대 후에도 header가 가로로 밀리지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/');

    const overflow = await page.evaluate(() => {
      const textElements = [...document.querySelectorAll('*')]
        .filter((element) => [...element.childNodes].some(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
        ));
      for (const element of textElements) {
        const style = getComputedStyle(element);
        const fontSize = Number.parseFloat(style.fontSize);
        const lineHeight = style.lineHeight === 'normal'
          ? Number.NaN
          : Number.parseFloat(style.lineHeight);
        if (Number.isFinite(fontSize)) element.style.fontSize = `${fontSize * 2}px`;
        if (Number.isFinite(lineHeight)) element.style.lineHeight = `${lineHeight * 2}px`;
      }
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });

    expect(overflow).toBe(0);
  });

  test('모바일 menu가 keyboard, Escape, outside click과 focus 복귀를 지원한다', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 760 });
    await page.goto('/');
    const details = page.locator('details.mobile-nav');
    const toggle = page.locator('.mobile-nav__toggle');
    const box = await toggle.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(details).toHaveJSProperty('open', true);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: '모바일 보조' }).getByText('실제 경로')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(details).toHaveJSProperty('open', false);
    await expect(toggle).toBeFocused();

    await toggle.click();
    // Panel은 우측 280px 안에 있으므로 좌측 여백을 눌러 실제 outside pointer를 보낸다.
    await page.mouse.click(8, 180);
    await expect(details).toHaveJSProperty('open', false);
  });

  test('JavaScript 없이도 결과와 모바일 보조 navigation을 쓸 수 있다', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.setViewportSize({ width: 320, height: 760 });
    await page.goto('/');

    await expect(page.getByText('진단 후 받는 것', { exact: true })).toBeVisible();
    const details = page.locator('details.mobile-nav');
    await page.locator('.mobile-nav__toggle').click();
    await expect(details).toHaveJSProperty('open', true);
    await expect(page.getByRole('navigation', { name: '모바일 보조' }).getByText('개발 기록')).toBeVisible();
    await context.close();
  });

  test('reduced-motion에서 scroll, transition, reveal motion을 제거한다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const motion = await page.evaluate(() => ({
      scroll: getComputedStyle(document.documentElement).scrollBehavior,
      transition: getComputedStyle(document.querySelector('.btn')).transitionDuration,
      founderOpacity: getComputedStyle(document.querySelector('.founder__beat')).opacity,
      founderTransform: getComputedStyle(document.querySelector('.founder__beat')).transform,
    }));

    expect(motion.scroll).toBe('auto');
    expect(motion.transition.split(',').every((value) => value.trim() === '0s')).toBe(true);
    expect(motion.founderOpacity).toBe('1');
    expect(motion.founderTransform).toBe('none');
  });

  test('리드폼 제출과 오류 상태를 보존한다', async ({ page }) => {
    await page.goto('/');
    await page.locator('#lead').scrollIntoViewIfNeeded();
    await expect(page.locator('#lf-email')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: '진단 초대받기' }).click();
    await expect(page.locator('#lf-email-err')).toContainText('이메일');
    await expect(page.locator('#lf-email')).toHaveAttribute('aria-invalid', 'true');

    await page.locator('#lf-email').fill('tester@example.com');
    await page.locator('#lf-stage').selectOption('learning');
    await page.locator('#lf-consent').check();
    await page.getByRole('button', { name: '진단 초대받기' }).click();
    await expect(page.locator('#lf-success')).toBeVisible();
  });

  test('검증된 traction 수치가 있을 때만 숫자 제목을 쓴다', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-widget="traction"]').scrollIntoViewIfNeeded();
    await expect(page.locator('.traction__num').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.traction__title')).toHaveText('숫자로 보는 지금');
  });

  test('학습 맥락 비교 탭이 keyboard roving focus를 유지한다', async ({ page }) => {
    await page.goto('/');
    await page.locator('#lcs').scrollIntoViewIfNeeded();
    const tabs = page.locator('.lcs-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 5000 });
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.lcs__compare')).toContainText('useEffect');
  });

  test('약관 페이지가 열리고 사업자 정보를 담는다', async ({ page }) => {
    await page.goto('/terms.html');
    await expect(page).toHaveTitle(/서비스 이용약관/);
    await expect(page.locator('h1')).toContainText('서비스 이용약관');
    await expect(page.locator('body')).toContainText('796-76-00732');
  });
});
