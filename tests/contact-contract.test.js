import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  submitPublicSupport,
  validatePublicSupport,
} from '../src/contact-form.js';

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const html = readFileSync(root('contact.html'), 'utf8');
const publicCss = readFileSync(root('assets/public.css'), 'utf8');
const valid = {
  type: 'INQUIRY',
  email: 'user@example.com',
  title: '로드맵 문의',
  body: '로드맵 저장 방법을 알고 싶습니다.',
  privacyConsent: true,
  turnstileToken: 'verified-token',
};

describe('/contact 문서 계약', () => {
  it('공개 지원 DTO와 개인정보 동의 필드를 제공한다', () => {
    for (const name of ['type', 'email', 'title', 'body', 'privacyConsent']) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain('maxlength="200"');
    expect(html).toContain('maxlength="5000"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="https://app.leva.ai.kr/community"');
    expect(html).toContain('href="/#faq"');
    expect(html).not.toMatch(/mailto:/i);
  });

  it('운영 Turnstile 위젯과 public_support action을 사용한다', () => {
    expect(html).toContain('data-turnstile-sitekey="0x4AAAAAAEpnnKHgknCSpxYZ"');
    expect(html).toContain('data-turnstile-action="public_support"');
    expect(html).not.toContain('data-turnstile-sitekey=""');
  });

  it('스크립트가 실패해도 개인정보를 URL query로 제출하지 않는다', () => {
    expect(html).toMatch(/<form[^>]+method="post"[^>]+action="\/contact"/);
    expect(html).toMatch(/<button[^>]+type="submit"[^>]+disabled/);
    expect(html).toContain(
      'id="contact-turnstile" class="contact-turnstile" tabindex="-1" role="group" aria-label="자동 제출 방지 확인" aria-describedby="contact-turnstile-error"',
    );
  });

  it('canonical 토큰·폰트와 안정적인 focus·Turnstile 공간을 사용한다', () => {
    expect(html).toContain('href="/assets/tokens.css"');
    expect(html).toContain('pretendard@v1.3.9');
    expect(html).toContain('d2coding@1.3.2');
    expect(publicCss).toContain('outline: var(--dp-state-focus-ring-width) solid var(--dp-state-focus-ring)');
    expect(publicCss).toMatch(/\.contact-turnstile\s*\{[^}]*min-block-size:\s*65px/s);
    expect(publicCss).not.toContain('outline: 3px solid var(--amber)');
    expect(publicCss).not.toContain('--green: #');
  });
});

describe('공개 지원 폼 상태', () => {
  it('필수값·email·동의·Turnstile을 각각 검증한다', () => {
    expect(validatePublicSupport({ ...valid, type: '' }).type).toBeTruthy();
    expect(validatePublicSupport({ ...valid, email: 'invalid' }).email).toBeTruthy();
    expect(validatePublicSupport({ ...valid, title: '' }).title).toBeTruthy();
    expect(validatePublicSupport({ ...valid, body: '' }).body).toBeTruthy();
    expect(validatePublicSupport({ ...valid, privacyConsent: false }).privacyConsent).toBeTruthy();
    expect(validatePublicSupport({ ...valid, turnstileToken: '' }).turnstileToken).toBeTruthy();
  });

  it('제목과 내용의 최대 길이 경계를 허용하고 한 글자 초과를 거부한다', () => {
    expect(validatePublicSupport({ ...valid, title: '가'.repeat(200) }).title).toBeUndefined();
    expect(validatePublicSupport({ ...valid, title: '가'.repeat(201) }).title).toContain('200자');
    expect(validatePublicSupport({ ...valid, body: '가'.repeat(5000) }).body).toBeUndefined();
    expect(validatePublicSupport({ ...valid, body: '가'.repeat(5001) }).body).toContain('5,000자');
  });

  it('성공 응답을 분류한다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 17 }) });
    await expect(submitPublicSupport(valid, { fetchImpl, endpoint: '/support/public-requests' }))
      .resolves.toEqual({ kind: 'success', id: 17 });
  });

  it.each([
    [400, {}, 'invalid'],
    [422, { code: 'TURNSTILE_FAILED' }, 'turnstile'],
    [503, { code: 'TURNSTILE_UNAVAILABLE' }, 'turnstile-unavailable'],
    [429, { code: 'RATE_LIMITED' }, 'rate-limit'],
    [502, {}, 'server'],
  ])('HTTP %s를 %s 상태로 분류한다', async (status, payload, kind) => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status, json: async () => payload });
    await expect(submitPublicSupport(valid, { fetchImpl, endpoint: '/support/public-requests' }))
      .resolves.toMatchObject({ kind });
  });

  it('network 오류와 timeout을 구분한다', async () => {
    const network = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(submitPublicSupport(valid, { fetchImpl: network, endpoint: '/x' }))
      .resolves.toMatchObject({ kind: 'network' });

    const timeout = vi.fn((_, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    await expect(submitPublicSupport(valid, { fetchImpl: timeout, endpoint: '/x', timeoutMs: 1 }))
      .resolves.toMatchObject({ kind: 'timeout' });
  });
});
