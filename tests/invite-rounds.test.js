// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { fetchInviteRounds, formatInviteRound } from '../src/invite-rounds.js';
import { onRequestGet } from '../functions/api/invite-rounds.js';

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf-8');

// 운영 실측(2026-09-17): api.leva.ai.kr 이 Access-Control-Allow-Origin 을 두 번 보내
// 브라우저가 차단했고 /updates 에 "잠시 불러오지 못했습니다" 가 공개됐다.
// 브라우저는 동일 출처 Pages Function 만 부르고, 함수가 서버측에서 API 를 읽는다.
describe('초대 회차 — 동일 출처 프록시', () => {
  it('브라우저 fetch 는 /api/invite-rounds(동일 출처)만 부른다', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    await fetchInviteRounds(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('/api/invite-rounds');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'omit' });
  });

  it('클라이언트 소스에 api.leva.ai.kr 직접 호출이 남아 있지 않다', () => {
    expect(read('../src/invite-rounds.js')).not.toContain('https://api.leva.ai.kr');
  });

  it('formatInviteRound 는 회차·발송 수·날짜를 한 줄로 만든다', () => {
    expect(formatInviteRound({ roundNumber: 2, deliveredCount: 30, date: '2026-09-05' }))
      .toBe('2차 초대 30명 발송 · 2026.09.05');
  });
});

describe('Pages Function GET /api/invite-rounds', () => {
  const run = (upstream) => onRequestGet({ request: new Request('https://leva.ai.kr/api/invite-rounds'), env: {} , fetcher: upstream });

  it('상류 배열을 화이트리스트 필드만 남겨 재노출하고 60초 캐시한다', async () => {
    const upstream = vi.fn(async () => new Response(JSON.stringify([
      { roundNumber: 1, deliveredCount: 12, date: '2026-09-01', email: 'x@y.z', extra: true },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const res = await run(upstream);
    expect(upstream.mock.calls[0][0]).toBe('https://api.leva.ai.kr/mentor-access/invite-rounds');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(await res.json()).toEqual([{ roundNumber: 1, deliveredCount: 12, date: '2026-09-01' }]);
  });

  it('빈 배열은 그대로 200 [] 이다', async () => {
    const res = await run(async () => new Response('[]', { status: 200 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('상류 실패·비정상 형식은 503 으로 알리고 캐시하지 않는다', async () => {
    const bad = await run(async () => new Response('{"oops":1}', { status: 200 }));
    expect(bad.status).toBe(503);
    expect(bad.headers.get('Cache-Control')).toBe('no-store');
    const down = await run(async () => { throw new Error('net'); });
    expect(down.status).toBe(503);
  });
});

describe('/updates 빈 상태 문구', () => {
  it('회차가 없을 때 안내 문구가 템플릿 소스에 있다', () => {
    expect(read('../src/invite-rounds.js')).toContain('아직 완료된 초대 회차가 없습니다.');
  });
});
