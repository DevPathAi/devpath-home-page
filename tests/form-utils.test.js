import { describe, it, expect } from 'vitest';
import {
  normalizeEmail, isValidEmail, detectSensitiveInput, validateLead,
  buildLeadPayload, parseAttribution, mergeRows,
} from '../src/form-utils.js';

describe('email 검증', () => {
  it('정규화는 트림+소문자', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });
  it('유효/무효 판별', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('프라이버시 가드 (detectSensitiveInput) — 회귀 방어', () => {
  it('GitHub URL 감지', () => {
    expect(detectSensitiveInput('https://github.com/me/repo')).toContain('GitHub URL');
  });
  it('일반 URL 감지', () => {
    expect(detectSensitiveInput('http://x.com')).toContain('URL');
  });
  it('토큰/시크릿 감지', () => {
    expect(detectSensitiveInput('api_key=abc123')).toContain('token');
  });
  it('private key 감지', () => {
    expect(detectSensitiveInput('-----BEGIN RSA PRIVATE KEY-----')).toContain('private key');
  });
  it('스택 트레이스 감지', () => {
    expect(detectSensitiveInput('Error\n    at Foo.bar (x.js:1)')).toContain('stack trace');
  });
  it('긴 멀티라인 로그 감지', () => {
    expect(detectSensitiveInput('a\nb\nc\nd\ne\nf')).toContain('long multiline log');
  });
  it('일반 문장은 통과', () => {
    expect(detectSensitiveInput('JPA N+1이 헷갈려요')).toEqual([]);
  });
});

describe('validateLead', () => {
  const ok = { email: 'a@b.co', current_stage: 'learning', consent_required: true, recent_stuck_moment: '' };
  it('정상 입력은 에러 0', () => {
    expect(validateLead(ok)).toEqual([]);
  });
  it('이메일 누락 시 에러', () => {
    expect(validateLead({ ...ok, email: 'x' }).some((e) => e.includes('이메일'))).toBe(true);
  });
  it('단계 누락 시 에러', () => {
    expect(validateLead({ ...ok, current_stage: '' }).some((e) => e.includes('단계'))).toBe(true);
  });
  it('동의 누락 시 에러', () => {
    expect(validateLead({ ...ok, consent_required: false }).some((e) => e.includes('동의'))).toBe(true);
  });
  it('민감 입력 시 에러', () => {
    expect(validateLead({ ...ok, recent_stuck_moment: 'token=abc' }).some((e) => e.includes('코드'))).toBe(true);
  });
});

describe('buildLeadPayload', () => {
  it('action=lead, 정규화 이메일, consent 포함', () => {
    const p = buildLeadPayload(
      { email: 'A@B.CO', current_stage: 'learning', consent_required: true },
      { now: '2026-07-14T00:00:00.000Z' },
    );
    expect(p.action).toBe('lead');
    expect(p.email_normalized).toBe('a@b.co');
    expect(p.consent_required).toBe(true);
    expect(p.step1_submitted_at).toBe('2026-07-14T00:00:00.000Z');
    expect(p.lead_id).toBeTruthy();
  });
});

describe('parseAttribution', () => {
  it('UTM 파라미터 추출', () => {
    const a = parseAttribution('https://devpath.ai/?utm_source=github&utm_medium=readme', 'https://ref');
    expect(a.utm_source).toBe('github');
    expect(a.utm_medium).toBe('readme');
    expect(a.referrer).toBe('https://ref');
  });
});

describe('mergeRows', () => {
  it('빈 값은 기존 값을 덮지 않는다', () => {
    expect(mergeRows({ a: '1', b: '2' }, { a: '', b: '9', c: '3' })).toEqual({ a: '1', b: '9', c: '3' });
  });
});
