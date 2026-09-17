// Cloudflare Pages Function — GET /api/invite-rounds
// 운영 실측(2026-09-17): api.leva.ai.kr 이 Access-Control-Allow-Origin 을 두 번 보내
// (게이트웨이 CORS + platform-svc CORS) 브라우저가 차단했다. 브라우저는 동일 출처인
// 이 함수만 부르고, 함수가 서버측(Origin 헤더 없음)에서 API 를 읽어 화이트리스트
// 필드만 재노출한다. 근본 원인(이중 CORS)은 platform-svc 에서 별도로 고친다.

const UPSTREAM = 'https://api.leva.ai.kr/mentor-access/invite-rounds';

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

const unavailable = (error) =>
  json({ ok: false, error }, 503, { 'Cache-Control': 'no-store' });

export async function onRequestGet(context) {
  const fetcher = context.fetcher ?? fetch;
  try {
    const res = await fetcher(UPSTREAM, { headers: { Accept: 'application/json' } });
    if (!res.ok) return unavailable(`upstream_${res.status}`);
    const rounds = await res.json().catch(() => null);
    if (!Array.isArray(rounds) || rounds.length > 12) return unavailable('upstream_shape');
    const safe = [];
    for (const round of rounds) {
      const roundNumber = Number(round?.roundNumber);
      const deliveredCount = Number(round?.deliveredCount);
      const date = String(round?.date ?? '');
      if (!Number.isSafeInteger(roundNumber) || roundNumber < 1 ||
          !Number.isSafeInteger(deliveredCount) || deliveredCount < 0 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return unavailable('upstream_shape');
      }
      safe.push({ roundNumber, deliveredCount, date });
    }
    return json(safe, 200, { 'Cache-Control': 'public, max-age=60' });
  } catch {
    return unavailable('upstream_unreachable');
  }
}
