import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../privacy.html', import.meta.url)), 'utf-8');

// <h2>제목</h2> 부터 다음 <h2> 직전까지를 한 장으로 자른다.
function section(titleFragment) {
  const heads = [...html.matchAll(/<h2>([\s\S]*?)<\/h2>/g)];
  const idx = heads.findIndex((h) => h[1].includes(titleFragment));
  if (idx === -1) return null;
  const start = heads[idx].index;
  const end = idx + 1 < heads.length ? heads[idx + 1].index : html.length;
  return html.slice(start, end);
}

const text = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// 국내에 두는 수탁자. 여기 없는 수탁자는 국외이전 장에 반드시 나타나야 한다
// (아래 「위탁과 국외이전은 함께 움직인다」 참조).
const DOMESTIC = ['Amazon Web Services'];

describe('처리방침이 앱까지 덮는다', () => {
  // 방침이 사전 신청 폼만 다루던 때에는 로그인·학습·멘토가 통째로 빠져 있었다.
  // 앱은 이미 운영 중이므로 실제로 저장하는 것을 적어야 한다.
  it('앱에서 수집하는 항목이 적혀 있다', () => {
    const s = section('처리하는 개인정보 항목');

    expect(s).not.toBeNull();
    for (const item of ['소셜 계정', '학습', 'AI 멘토', '커뮤니티']) {
      expect(text(s)).toContain(item);
    }
  });

  it('처리 목적에 서비스 제공이 포함된다', () => {
    expect(text(section('처리 목적'))).toMatch(/회원 가입|서비스 제공|학습/);
  });
});

describe('국외이전을 고지한다', () => {
  // 개인정보 보호법 제28조의8 — 이전받는 자·이전 국가·이전 항목·이전 목적을
  // 알려야 한다. 위탁·보관에 따른 이전은 처리방침 공개로 갈음할 수 있다.
  const s = () => section('국외 이전');

  it('국외 이전 장이 있다', () => {
    expect(s()).not.toBeNull();
  });

  it('법정 고지 항목이 표의 머리글에 있다', () => {
    const heads = [...(s() ?? '').matchAll(/<th>([\s\S]*?)<\/th>/g)].map((m) => m[1]);

    for (const required of ['이전받는 자', '이전 국가', '이전 항목', '이전 목적']) {
      expect(heads.some((h) => h.includes(required))).toBe(true);
    }
  });

  // AI 멘토는 질문 본문과 최근 코드 실행 기록을 미국의 Anthropic에 보낸다.
  // 이용자가 자기 코드가 어디로 가는지 알 수 있어야 한다.
  it('AI 멘토가 보내는 곳과 보내는 것이 적혀 있다', () => {
    const t = text(s());

    expect(t).toContain('Anthropic');
    expect(t).toContain('미국');
    expect(t).toMatch(/코드/);
  });

  it('국외 이전을 거부할 수 있는 방법을 안내한다', () => {
    expect(text(s())).toMatch(/거부|철회|탈퇴/);
  });
});

// 수탁자를 새로 적으면서 국외이전 장을 잊는 것이 실제로 일어난 누락이다
// (리드 이메일이 Google 미국 서버에 저장되는데 위탁으로만 적혀 있었다).
// 국내에 두는 수탁자가 아니라면 두 장에 모두 나타나야 한다.
describe('위탁과 국외이전은 함께 움직인다', () => {
  it('국내 수탁자가 아닌 곳은 국외이전 장에도 있다', () => {
    const rows = [...section('처리위탁').matchAll(/<tr><td>([\s\S]*?)<\/td>/g)];
    const cross = text(section('국외 이전'));

    expect(rows.length).toBeGreaterThan(0);
    for (const [, name] of rows) {
      const vendor = name.split('(')[0].trim();
      if (DOMESTIC.some((d) => vendor.includes(d))) continue;
      expect(cross, `수탁자 「${vendor}」가 국외이전 장에 없다`).toContain(vendor);
    }
  });
});

// 약관은 "가입 시 출생 연도를 확인해 만 14세 미만을 제한한다"고 규정한다.
// 처리방침이 같은 항목을 「선택」으로 적으면 두 법적 문서가 서로를 반박한다.
describe('수집 항목의 필수·선택이 실제와 맞는다', () => {
  it('출생연도가 필수 항목으로 기재된다', () => {
    const s = text(section('처리하는 개인정보 항목'));

    expect(s).toMatch(/연령 확인\(필수\)/);
    expect(s).toContain('출생연도');
  });

  it('출생연도가 선택 항목에 남아 있지 않다', () => {
    const s = section('처리하는 개인정보 항목');
    const optional = s.slice(s.indexOf('프로필(선택)'));
    const nextItem = optional.slice(0, optional.indexOf('</li>'));

    expect(nextItem).not.toContain('출생연도');
  });
});
