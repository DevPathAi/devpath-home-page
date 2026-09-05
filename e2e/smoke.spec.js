import { createServer } from 'node:http';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installHostBoundRunHeaders } from './release/support/staging-control.js';

const DIAGNOSTIC_URL = 'https://app.leva.ai.kr/diagnostic';

async function listenOnLoopback(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test.describe('확정 홈페이지 스모크', () => {
  test('승인된 히어로·Before/After·4단계와 CTA를 노출한다', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/레바/);
    await expect(page.locator('h1 .hero-line')).toHaveText([
      '막힐 때마다 AI에게',
      '내 상황을 처음부터',
      '다시 설명하고 있나요?',
    ]);
    await expect(page.getByText('레바는 학습 이력과 직전 오류를 질문에 자동으로 붙입니다.', { exact: true })).toBeVisible();

    const question = 'Q. Spring Boot에서 같은 이메일을 저장할 때 duplicate key 오류가 나는 이유는 무엇인가요?';
    await expect(page.getByText(question, { exact: true })).toHaveCount(1);
    await expect(page.locator('.answer.before')).toContainText('BEFORE · 맥락 없는 답변');
    await expect(page.locator('.answer.before .context')).toHaveCount(0);
    await expect(page.locator('.answer.after .context')).toContainText('자동 첨부된 맥락');
    await expect(page.locator('.answer.after .context')).toContainText('학습 주제');
    await expect(page.locator('.answer.after .context')).toContainText('로드맵 진도');
    await expect(page.locator('.answer.after .context')).toContainText('직전 오류');
    await expect(page.locator('.stage h3')).toHaveText(['진단', '로드맵', 'AI 멘토', '경로 보정']);

    const ctas = page.locator('[data-diagnostic-cta="primary"]');
    await expect(ctas).toHaveCount(4);
    await expect(ctas.first()).toHaveAttribute('href', DIAGNOSTIC_URL);
  });

  test('승인 팔레트와 실제 화면 출처 배지를 사용한다', async ({ page }) => {
    await page.goto('/');
    const colors = await page.evaluate(() => ({
      ink: getComputedStyle(document.body).color,
      cta: getComputedStyle(document.querySelector('.btn.primary')).backgroundColor,
      accent: getComputedStyle(document.querySelector('.signal'), '::before').backgroundColor,
    }));

    expect(colors).toEqual({
      ink: 'rgb(18, 35, 30)',
      cta: 'rgb(31, 169, 122)',
      accent: 'rgb(245, 165, 36)',
    });
    await expect(page.locator('.shot .badge')).toHaveCount(3);
    await expect(page.locator('.shot .badge').first()).toContainText('출처 · 레바 앱 화면');
    await expect(page.locator('.shot .badge').first()).toContainText('캡처일 · 2026.09.05');
  });

  test('CTA 클릭 직전에 canonical 진단 경로를 journeyId로 장식한다', async ({ page }) => {
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
    test(`${width}px에서 가로 overflow 없이 맞는 navigation을 쓴다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);

      if (width <= 900) {
        await expect(page.locator('.mobile-nav__toggle')).toBeVisible();
        await expect(page.locator('.nav-links')).toBeHidden();
        await expect(page.locator('.nav-actions')).toBeHidden();
      } else {
        await expect(page.locator('.mobile-nav')).toBeHidden();
        await expect(page.locator('.nav-links')).toBeVisible();
        await expect(page.locator('.nav-actions')).toBeVisible();
      }
    });
  }

  test('공개 정적 페이지가 320px에서 가로로 밀리지 않는다', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 760 });
    const paths = ['/', '/privacy.html', '/terms.html', '/beta.html', '/about.html', '/contact.html'];
    if (testInfo.project.name === 'production-dist') paths.push('/updates/');

    for (const path of paths) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} 가 가로로 넘친다`).toBe(0);
    }
  });

  test('320px text-only 200% 확대에서도 페이지가 가로로 밀리지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/');

    const reflow = await page.evaluate(() => {
      const textElements = [...document.querySelectorAll('*')]
        .filter((element) => [...element.childNodes].some(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
        ));
      for (const element of textElements) {
        const style = getComputedStyle(element);
        const fontSize = Number.parseFloat(style.fontSize);
        const lineHeight = style.lineHeight === 'normal' ? Number.NaN : Number.parseFloat(style.lineHeight);
        if (Number.isFinite(fontSize)) element.style.fontSize = `${fontSize * 2}px`;
        if (Number.isFinite(lineHeight)) element.style.lineHeight = `${lineHeight * 2}px`;
      }
      const viewport = document.documentElement.clientWidth;
      return {
        overflow: document.documentElement.scrollWidth - viewport,
        offenders: [...document.querySelectorAll('body *')]
          .filter((element) => element.getBoundingClientRect().right > viewport + 1)
          .slice(0, 8)
          .map((element) => `${element.tagName}.${element.className}:${element.textContent.trim().slice(0, 30)}`),
      };
    });

    expect(reflow.overflow, `가로 초과 요소: ${reflow.offenders.join(', ')}`).toBe(0);
  });

  test('모바일 메뉴가 keyboard, Escape, outside click과 focus 복귀를 지원한다', async ({ page }) => {
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
    await expect(page.getByRole('navigation', { name: '모바일 메뉴' }).getByText('개발 기록')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(details).toHaveJSProperty('open', false);
    await expect(toggle).toBeFocused();

    await toggle.click();
    await page.mouse.click(8, 180);
    await expect(details).toHaveJSProperty('open', false);
  });

  test('JavaScript 없이도 핵심 내용과 native 모바일 메뉴를 쓸 수 있다', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.setViewportSize({ width: 320, height: 760 });
    await page.goto('/');

    await expect(page.getByText('누구에게 맞는가', { exact: true })).toBeVisible();
    const details = page.locator('details.mobile-nav');
    await page.locator('.mobile-nav__toggle').click();
    await expect(details).toHaveJSProperty('open', true);
    await expect(page.getByRole('navigation', { name: '모바일 메뉴' }).getByText('개발 기록')).toBeVisible();
    await context.close();
  });

  test('reduced-motion에서 smooth scroll과 긴 transition을 제거한다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const motion = await page.evaluate(() => ({
      scroll: getComputedStyle(document.documentElement).scrollBehavior,
      transitionSeconds: Number.parseFloat(getComputedStyle(document.querySelector('.btn')).transitionDuration),
    }));

    expect(motion.scroll).toBe('auto');
    expect(motion.transitionSeconds).toBeLessThanOrEqual(0.001);
  });

  test('홈과 공개 지원 페이지에 자동 접근성 위반이 없다', async ({ page }) => {
    for (const path of ['/', '/contact.html']) {
      await page.goto(path);
      const result = await new AxeBuilder({ page }).analyze();
      expect(result.violations, `${path} 접근성 위반`).toEqual([]);
    }
  });

  test('FAQ와 푸터의 지원 경로가 확정 목적지로 연결된다', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#faq details')).toHaveCount(6);
    await expect(page.locator('footer').getByRole('link', { name: '제품 Q&A' }))
      .toHaveAttribute('href', 'https://app.leva.ai.kr/community');
    await expect(page.locator('footer').getByRole('link', { name: '공지·변경 기록' }))
      .toHaveAttribute('href', '/updates');
    await expect(page.locator('footer').getByRole('link', { name: '문의·오류 신고' }))
      .toHaveAttribute('href', '/contact');
  });

  test('약관 페이지가 열리고 사업자 정보를 담는다', async ({ page }) => {
    await page.goto('/terms.html');
    await expect(page).toHaveTitle(/서비스 이용약관/);
    await expect(page.locator('h1')).toContainText('서비스 이용약관');
    await expect(page.locator('body')).toContainText('796-76-00732');
  });
});

test('run binding이 허용 origin의 302를 다른 origin까지 따라가지 않는다', async ({ browser }) => {
  const disallowedRequests = [];
  const allowedRequests = [];
  const disallowedServer = createServer((request, response) => {
    disallowedRequests.push({
      url: request.url,
      candidate: request.headers['x-candidate-spec-sha256'] ?? null,
      runKey: request.headers['x-release-run-key'] ?? null,
    });
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('redirect target');
  });
  const disallowedOrigin = await listenOnLoopback(disallowedServer);
  const allowedServer = createServer((request, response) => {
    allowedRequests.push({
      candidate: request.headers['x-candidate-spec-sha256'] ?? null,
      runKey: request.headers['x-release-run-key'] ?? null,
    });
    response.writeHead(302, { location: `${disallowedOrigin}/target?mutation=forbidden` });
    response.end();
  });
  const allowedOrigin = await listenOnLoopback(allowedServer);
  const context = await browser.newContext();
  const page = await context.newPage();
  const candidateSpecSha256 = 'e'.repeat(64);
  const runKey = 'A'.repeat(22);

  try {
    await installHostBoundRunHeaders(page, {
      allowedOrigins: new Set([allowedOrigin]),
      candidateSpecSha256,
      runKey,
    });
    let navigationError;
    try {
      await page.goto(`${allowedOrigin}/start`, { waitUntil: 'domcontentloaded' });
    } catch (error) {
      navigationError = error;
    }

    expect(allowedRequests).toEqual([{ candidate: candidateSpecSha256, runKey }]);
    expect(disallowedRequests).toEqual([]);
    expect(String(navigationError)).toMatch(/ERR_BLOCKED_BY_CLIENT/);
  } finally {
    await context.close();
    await closeServer(allowedServer);
    await closeServer(disallowedServer);
  }
});
