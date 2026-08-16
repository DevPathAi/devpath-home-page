import { describe, it, expect, afterEach } from 'vitest';
import { onRequestPost } from '../functions/api/lead.js';

// Pages Function을 직접 호출한다. 업스트림(Apps Script)만 경계에서 스텁한다.
const ENV = { APPS_SCRIPT_URL: 'https://script.example.test/exec' };

const post = (body = JSON.stringify({ action: 'lead', lead_id: 'L1' })) =>
  new Request('https://leva.ai.kr/api/lead', { method: 'POST', body });

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function stubUpstream(body, init = {}) {
  globalThis.fetch = async () => new Response(body, { status: 200, ...init });
}

describe('POST /api/lead — 업스트림 응답 신뢰 경계', () => {
  // Apps Script는 실패를 HTTP 200 + HTML 오류 페이지로 돌려준다.
  // (실측: "다음 스크립트 함수(doGet)를 찾을 수 없습니다." — 상태코드 200)
  // res.ok만 보고 통과시키면 HTML에 application/json 라벨이 붙어 나간다.
  it('업스트림이 JSON이 아니면 502로 드러낸다', async () => {
    stubUpstream('<!DOCTYPE html><title>오류</title>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

    const res = await onRequestPost({ request: post(), env: ENV });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, error: 'upstream_invalid' });
  });

  // 빈 본문에 '{"ok":true}'를 채워 넣으면 기록되지 않은 리드가 성공으로 보고된다.
  it('업스트림이 빈 본문이면 성공을 날조하지 않는다', async () => {
    stubUpstream('');

    const res = await onRequestPost({ request: post(), env: ENV });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, error: 'upstream_invalid' });
  });
});
