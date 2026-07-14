// Cloudflare Pages Function — POST /api/lead (T10)
// 동일 출처 프록시: 클라이언트 리드 제출을 서버측에서 Apps Script로 포워딩한다.
// 이렇게 하면 브라우저는 same-origin 호출로 JSON 응답을 읽을 수 있고(CORS 불필요),
// Apps Script Web App URL은 환경변수(APPS_SCRIPT_URL)로만 노출된다.

const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

export async function onRequestPost({ request, env }) {
  const upstream = env.APPS_SCRIPT_URL;
  if (!upstream) return json({ ok: false, error: 'endpoint_not_configured' }, 503);

  let body;
  try {
    body = await request.text();
    if (!body || body.length > 20_000) return json({ ok: false, error: 'bad_request' }, 400);
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  try {
    // Apps Script에는 text/plain(단순 요청)으로 전달 — 서버측이라 CORS 무관.
    const res = await fetch(`${upstream}?action=lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    });
    const text = await res.text();
    return new Response(text || '{"ok":true}', {
      status: res.ok ? 200 : 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch {
    return json({ ok: false, error: 'upstream_unreachable' }, 502);
  }
}
// POST 외 메서드는 CF Pages가 자동으로 405 응답.
