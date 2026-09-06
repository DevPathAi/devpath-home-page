import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  collectUpdates,
  parseUpdate,
  renderUpdatesFeed,
  renderUpdatesPage,
} from '../scripts/updates.mjs';
import { fetchInviteRounds, formatInviteRound } from '../src/invite-rounds.js';

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const updatesTemplate = readFileSync(root('templates/updates.html'), 'utf8');
const publicCss = readFileSync(root('assets/public.css'), 'utf8');

const valid = `---
title: AI 멘토 순차 초대 안내
summary: 매일 한 번 초대 메일을 보냅니다.
date: 2026-09-05
type: notice
bannerEnabled: true
startsAt: 2026-09-05T00:00:00+09:00
endsAt: 2026-09-30T23:59:59+09:00
ctaLabel: 베타 안내
ctaHref: /beta
---
본문입니다.
`;

describe('공지·변경 기록 source 계약', () => {
  it('canonical 토큰·폰트와 초대 회차 공간 예약을 사용한다', () => {
    expect(updatesTemplate).toContain('href="/assets/tokens.css"');
    expect(updatesTemplate).toContain('pretendard@v1.3.9');
    expect(updatesTemplate).toContain('d2coding@1.3.2');
    expect(publicCss).toMatch(/\.invite-rounds\s*\{[^}]*min-block-size:/s);
  });

  it('메일 인프라가 없는 상태에서 발송 시점이나 미구현 멘토 경로를 약속하지 않는다', () => {
    const source = readFileSync(root('content/updates/2026-09-05-mentor-invitations.md'), 'utf8');
    expect(source).not.toContain('1일 안에');
    expect(source).not.toContain('https://app.leva.ai.kr/mentor');
    expect(source).toContain('https://app.leva.ai.kr/login');
  });

  it('실제 발송 성공 집계만 N차 로그 문구로 표시한다', () => {
    expect(formatInviteRound({
      roundNumber: 3,
      date: '2026-09-05',
      deliveredCount: 7,
      lastSentAt: '2026-09-05T02:01:00Z',
    })).toBe('3차 초대 7명 발송 · 2026.09.05');
    expect(() => formatInviteRound({ roundNumber: 1, deliveredCount: -1 })).toThrow();
  });

  it('허용된 type과 안전한 CTA만 받는다', () => {
    expect(parseUpdate(valid, 'invite').type).toBe('notice');
    expect(() => parseUpdate(valid.replace('type: notice', 'type: post'), 'bad')).toThrow(/type/);
    expect(() => parseUpdate(valid.replace('/beta', 'javascript:alert(1)'), 'bad')).toThrow(/ctaHref/);
    expect(() => parseUpdate(valid.replace('/beta', '//evil.example/x'), 'bad')).toThrow(/ctaHref/);
  });

  it('배너 종료가 시작보다 이르면 거부한다', () => {
    const reversed = valid
      .replace('2026-09-05T00:00:00+09:00', '2026-10-01T00:00:00+09:00');
    expect(() => parseUpdate(reversed, 'bad-window')).toThrow(/startsAt|endsAt/);
  });

  it.each([
    ['frontmatter 누락', '본문만 있습니다.', /frontmatter/],
    ['frontmatter 행 형식', valid.replace('summary: 매일 한 번 초대 메일을 보냅니다.', 'summary 누락된 콜론'), /형식 오류/],
    ['필수 요약', valid.replace('summary: 매일 한 번 초대 메일을 보냅니다.\n', ''), /summary/],
    ['날짜 형식', valid.replace('date: 2026-09-05', 'date: 2026/09/05'), /YYYY-MM-DD/],
    ['본문 h1', valid.replace('본문입니다.', '# 제목'), /h1/],
    ['boolean 형식', valid.replace('bannerEnabled: true', 'bannerEnabled: yes'), /true 또는 false/],
  ])('%s 오류를 거부한다', (_, source, message) => {
    expect(() => parseUpdate(source, 'bad-schema')).toThrow(message);
  });

  it.each([
    ['필수 CTA', valid.replace('ctaLabel: 베타 안내\n', ''), /배너에는 ctaLabel/],
    ['파싱 불가 시간', valid.replace('startsAt: 2026-09-05T00:00:00+09:00', 'startsAt: tomorrow'), /시간 범위/],
  ])('배너 %s 오류를 거부한다', (_, source, message) => {
    expect(() => parseUpdate(source, 'bad-banner')).toThrow(message);
  });

  it('한 번 수집한 컬렉션으로 HTML과 feed를 만들고 최신순 정렬한다', () => {
    const updates = collectUpdates(root('content/updates'));
    const html = renderUpdatesPage(updates, updatesTemplate);
    const feed = JSON.parse(renderUpdatesFeed(updates));

    expect(updates.map((item) => item.date)).toEqual([...updates.map((item) => item.date)].sort().reverse());
    expect(feed.items).toHaveLength(updates.length);
    for (const item of updates) {
      expect(html).toContain(item.title);
      expect(feed.items.find((entry) => entry.slug === item.slug)?.title).toBe(item.title);
    }
    expect(Buffer.byteLength(JSON.stringify(feed))).toBeLessThanOrEqual(32 * 1024);
  });
});

describe('초대 회차 API', () => {
  it('최대 12개의 정상 응답을 출력 라벨로 매핑한다', async () => {
    const rounds = Array.from({ length: 12 }, (_, index) => ({
      roundNumber: index + 1,
      deliveredCount: index,
      date: '2026-09-05',
    }));
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => rounds,
    });

    const result = await fetchInviteRounds(fetcher);

    expect(result).toHaveLength(12);
    expect(result[0]).toEqual({ round: rounds[0], label: '1차 초대 0명 발송 · 2026.09.05' });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.leva.ai.kr/mentor-access/invite-rounds',
      { method: 'GET', headers: { Accept: 'application/json' }, credentials: 'omit' },
    );
  });

  it('비정상 HTTP와 잘못된 컬렉션 크기를 거부한다', async () => {
    await expect(fetchInviteRounds(vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }))).rejects.toThrow(/503/);

    for (const payload of [{ items: [] }, Array.from({ length: 13 }, () => ({}))]) {
      await expect(fetchInviteRounds(vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
      }))).rejects.toThrow(/응답 형식/);
    }
  });
});
