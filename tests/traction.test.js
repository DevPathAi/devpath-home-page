import { describe, it, expect } from 'vitest';
import { decideTraction } from '../src/widgets/traction.js';

// F1 핵심 회귀 방어선 — 심사-facing. 3분기(임계 미만 / 실패 / 정상)를 못박는다.
describe('decideTraction (F1)', () => {
  const min = 20;

  it('정상: 임계 이상이면 stats 모드', () => {
    const stats = { ok: true, signups: 42, diagnoses_completed: 30, satisfaction: 4.5 };
    expect(decideTraction(stats, { minSignups: min })).toEqual({ mode: 'stats', stats });
  });

  it('임계 미만: 가입 수가 하한 미만이면 fallback', () => {
    const stats = { ok: true, signups: 19, diagnoses_completed: 5, satisfaction: 4 };
    expect(decideTraction(stats, { minSignups: min })).toEqual({ mode: 'fallback' });
  });

  it('경계값: 정확히 임계값이면 stats 모드', () => {
    const stats = { ok: true, signups: 20, diagnoses_completed: 10, satisfaction: null };
    expect(decideTraction(stats, { minSignups: min }).mode).toBe('stats');
  });

  it('실패: null 이면 fallback', () => {
    expect(decideTraction(null, { minSignups: min })).toEqual({ mode: 'fallback' });
  });

  it('실패: ok=false 이면 fallback', () => {
    expect(decideTraction({ ok: false }, { minSignups: min })).toEqual({ mode: 'fallback' });
  });

  it('빈 응답/누락 필드: signups 없으면 0으로 보고 fallback', () => {
    expect(decideTraction({ ok: true }, { minSignups: min })).toEqual({ mode: 'fallback' });
  });

  it('기본 임계값은 20', () => {
    expect(decideTraction({ ok: true, signups: 19 }).mode).toBe('fallback');
    expect(decideTraction({ ok: true, signups: 20 }).mode).toBe('stats');
  });
});
