import { test, expect } from '@playwright/test';

const TEST_SITEKEY = '1x00000000000000000000AA';

async function prepareContact(page, { turnstile = 'success', sitekey = TEST_SITEKEY, api } = {}) {
  await page.route('**/contact.html', async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({
      response,
      body: source.replace(/data-turnstile-sitekey="[^"]*"/, `data-turnstile-sitekey="${sitekey}"`),
    });
  });
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js**', (route) => {
    if (turnstile === 'missing') {
      return route.fulfill({ contentType: 'application/javascript', body: '' });
    }
    const callback = {
      success: 'options.callback("test-token")',
      failure: 'options["error-callback"]()',
      timeout: 'options["timeout-callback"]()',
      expired: '(options.callback("test-token"),options["expired-callback"]())',
    }[turnstile];
    return route.fulfill({
      contentType: 'application/javascript',
      body: `window.__turnstileResetCount=0;window.turnstile={render:(selector,options)=>{window.__turnstileRenderOptions=options;queueMicrotask(()=>${callback});return "widget-1"},reset:()=>{window.__turnstileResetCount+=1}};`,
    });
  });
  if (api) await page.route('https://api.leva.ai.kr/support/public-requests', api);
  await page.goto('/contact.html');
}

async function fillValidForm(page) {
  await page.getByLabel('종류').selectOption('INQUIRY');
  await page.getByLabel('답변받을 이메일').fill('person@example.com');
  await page.getByLabel('제목').fill('로드맵 문의');
  await page.getByLabel('내용').fill('첫 주차 미션을 어디에서 시작하는지 알고 싶습니다.');
  await page.getByRole('checkbox').check();
}

test.describe('/contact 공개 접수', () => {
  test('300px보다 좁은 폼에서는 compact Turnstile을 렌더링한다', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 760 });
    await prepareContact(page);

    await expect.poll(() => page.evaluate(() => window.__turnstileRenderOptions?.size)).toBe('compact');
  });

  test('300px 이상 폼에서는 normal Turnstile을 렌더링한다', async ({ page }) => {
    await prepareContact(page);

    await expect.poll(() => page.evaluate(() => window.__turnstileRenderOptions?.size)).toBe('normal');
  });

  for (const scenario of [
    { label: '위젯 API', turnstile: 'missing', sitekey: TEST_SITEKEY },
    { label: 'sitekey', turnstile: 'success', sitekey: '' },
  ]) {
    test(`Turnstile ${scenario.label}가 없으면 제출을 막고 새로고침을 안내한다`, async ({ page }) => {
      await prepareContact(page, scenario);

      await expect(page.locator('#contact-turnstile-error')).toContainText('보안 확인을 불러오지 못했습니다');
      await expect(page.getByRole('button', { name: '문의 보내기' })).toBeDisabled();
    });
  }

  test('Turnstile timeout과 expired 토큰을 재확인 상태로 돌린다', async ({ page }) => {
    await prepareContact(page, { turnstile: 'timeout' });
    await expect(page.locator('#contact-turnstile-error')).toContainText('보안 확인 시간이 지났습니다');

    await page.unrouteAll({ behavior: 'wait' });
    await prepareContact(page, { turnstile: 'expired' });
    await fillValidForm(page);
    await page.getByRole('button', { name: '문의 보내기' }).click();
    await expect(page.locator('#contact-turnstile-error')).toContainText('자동 제출 방지 확인을 완료해 주세요');
    await expect(page.locator('#contact-turnstile')).toBeFocused();
  });

  test('필수 필드를 각각 표시하고 첫 오류로 초점을 옮긴다', async ({ page }) => {
    await prepareContact(page);
    await page.getByRole('button', { name: '문의 보내기' }).click();

    await expect(page.locator('#contact-type-error')).toContainText('선택');
    await expect(page.locator('#contact-email-error')).toContainText('이메일');
    await expect(page.locator('#contact-title-error')).toContainText('제목');
    await expect(page.locator('#contact-body-error')).toContainText('내용');
    await expect(page.locator('#contact-consent-error')).toContainText('동의');
    await expect(page.getByLabel('종류')).toBeFocused();
  });

  test('성공 요청은 공개 DTO만 보내고 완료 상태에서 폼을 초기화한다', async ({ page }) => {
    let received;
    await prepareContact(page, {
      api: async (route) => {
        received = route.request().postDataJSON();
        await route.fulfill({ status: 201, json: { id: 71 } });
      },
    });
    await fillValidForm(page);

    await page.getByRole('button', { name: '문의 보내기' }).click();

    await expect(page.locator('#contact-status')).toHaveAttribute('data-kind', 'success');
    await expect(page.locator('#contact-status')).toContainText('접수되었습니다');
    expect(received).toEqual({
      type: 'INQUIRY',
      email: 'person@example.com',
      title: '로드맵 문의',
      body: '첫 주차 미션을 어디에서 시작하는지 알고 싶습니다.',
      privacyConsent: true,
      turnstileToken: 'test-token',
    });
    await expect(page.getByLabel('답변받을 이메일')).toHaveValue('');
    await expect(page.getByRole('checkbox')).not.toBeChecked();
    await expect.poll(() => page.evaluate(() => window.__turnstileResetCount)).toBe(1);
  });

  for (const scenario of [
    { status: 422, code: 'TURNSTILE_FAILED', message: '자동 제출 방지 확인에 실패했습니다' },
    { status: 503, code: 'TURNSTILE_UNAVAILABLE', message: '보안 확인 서비스에 연결할 수 없습니다' },
    { status: 429, code: 'RATE_LIMITED', message: '짧은 시간에 여러 번 요청했습니다' },
    { status: 500, code: 'INTERNAL', message: '지금은 문의를 접수할 수 없습니다' },
  ]) {
    test(`API ${scenario.status} 상태를 구분해 안내한다`, async ({ page }) => {
      await prepareContact(page, {
        api: (route) => route.fulfill({ status: scenario.status, json: { code: scenario.code } }),
      });
      await fillValidForm(page);
      await page.getByRole('button', { name: '문의 보내기' }).click();

      await expect(page.locator('#contact-status')).toHaveAttribute('data-kind', 'error');
      await expect(page.locator('#contact-status')).toContainText(scenario.message);
      await expect(page.getByRole('button', { name: '문의 보내기' })).toBeEnabled();
      await expect.poll(() => page.evaluate(() => window.__turnstileResetCount)).toBe(1);
    });
  }

  test('Turnstile 위젯 실패는 API를 호출하지 않고 재시도를 안내한다', async ({ page }) => {
    let apiCalls = 0;
    await prepareContact(page, {
      turnstile: 'failure',
      api: (route) => { apiCalls += 1; return route.abort(); },
    });

    await expect(page.locator('#contact-turnstile-error')).toContainText('보안 확인에 실패했습니다');
    await fillValidForm(page);
    await page.getByRole('button', { name: '문의 보내기' }).click();
    await expect(page.locator('#contact-turnstile-error')).toContainText('자동 제출 방지 확인을 완료해 주세요');
    expect(apiCalls).toBe(0);
  });

  test('네트워크 실패를 서버 오류와 구분한다', async ({ page }) => {
    await prepareContact(page, { api: (route) => route.abort('connectionfailed') });
    await fillValidForm(page);
    await page.getByRole('button', { name: '문의 보내기' }).click();

    await expect(page.locator('#contact-status')).toContainText('네트워크에 연결할 수 없습니다');
  });

  test('빠른 재제출을 하나로 제한하고 실패한 토큰을 재사용하지 않는다', async ({ page }) => {
    let apiCalls = 0;
    await prepareContact(page, {
      api: async (route) => {
        apiCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 150));
        await route.fulfill({ status: 500, json: { code: 'INTERNAL' } });
      },
    });
    await fillValidForm(page);

    await page.getByRole('button', { name: '문의 보내기' }).dblclick();
    await expect(page.locator('#contact-status')).toContainText('지금은 문의를 접수할 수 없습니다');
    expect(apiCalls).toBe(1);

    await page.getByRole('button', { name: '문의 보내기' }).click();
    await expect(page.locator('#contact-turnstile-error')).toContainText('자동 제출 방지 확인을 완료해 주세요');
    expect(apiCalls).toBe(1);
  });
});
