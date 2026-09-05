import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  collectUpdates,
  parseUpdate,
  renderUpdatesFeed,
  renderUpdatesPage,
} from '../scripts/updates.mjs';

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

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

  it('한 번 수집한 컬렉션으로 HTML과 feed를 만들고 최신순 정렬한다', () => {
    const updates = collectUpdates(root('content/updates'));
    const html = renderUpdatesPage(updates, readFileSync(root('templates/updates.html'), 'utf8'));
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
