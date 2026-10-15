import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 점검 H-3(2026-10-11): leva.ai.kr 응답에 X-Frame-Options 등은 있었지만
// Strict-Transport-Security 가 없었다. Cloudflare Pages 는 _headers 의 /* 블록을
// 모든 응답에 붙인다. CSP 는 Turnstile·애널리틱스·광고 출처 실측과 위반 보고
// 수집처가 먼저라 아직 두지 않는다.
const headers = readFileSync(new URL('../_headers', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function block(path) {
  const lines = headers.split('\n');
  const start = lines.indexOf(path);
  expect(start, `${path} 블록 없음`).toBeGreaterThanOrEqual(0);
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('  ')) break;
    body.push(line.trim());
  }
  return body;
}

describe('사이트 전체 보안 헤더', () => {
  it('모든 응답에 HSTS 를 붙인다', () => {
    expect(block('/*')).toContain('Strict-Transport-Security: max-age=31536000; includeSubDomains');
  });

  it('기존 보안 헤더를 그대로 유지한다', () => {
    expect(block('/*')).toEqual(expect.arrayContaining([
      'X-Content-Type-Options: nosniff',
      'Referrer-Policy: strict-origin-when-cross-origin',
      'X-Frame-Options: DENY',
      'Permissions-Policy: geolocation=(), microphone=(), camera=()',
    ]));
  });
});
