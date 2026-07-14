// Cloudflare Pages Function — GET /api/stats (T10, F3)
// Apps Script ?action=stats(집계 전용)를 호출하고, 화이트리스트 필드만 재노출한다.
// 원시 리드/PII는 절대 통과시키지 않는다(이중 방어). 60초 edge 캐시.

const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

export async function onRequestGet({ env }) {
  const upstream = env.APPS_SCRIPT_URL;
  if (!upstream) return json({ ok: false, error: 'endpoint_not_configured' }, 503);

  try {
    const res = await fetch(`${upstream}?action=stats`);
    const data = await res.json().catch(() => null);
    if (!data || data.ok !== true) return json({ ok: false }, 200, { 'Cache-Control': 'no-store' });

    // 화이트리스트 — 집계 카운트만. 그 외 필드는 폐기.
    const safe = {
      ok: true,
      signups: Number(data.signups) || 0,
      diagnoses_completed: Number(data.diagnoses_completed) || 0,
      satisfaction: data.satisfaction == null ? null : Number(data.satisfaction),
      updated_at: typeof data.updated_at === 'string' ? data.updated_at : null,
    };
    return json(safe, 200, { 'Cache-Control': 'public, max-age=60' });
  } catch {
    return json({ ok: false, error: 'upstream_unreachable' }, 200, { 'Cache-Control': 'no-store' });
  }
}
