import { describe, it, expect } from 'vitest';
import { apiFetch, ApiError } from '../src/api.js';

// Response-like 팩토리 (Node 24 전역 Response 사용)
const jsonRes = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const emptyRes = (status = 200) => new Response('', { status });

describe('apiFetch', () => {
  it('200 JSON을 파싱해 반환한다', async () => {
    const fetchImpl = async () => jsonRes({ count: 42 });
    const data = await apiFetch('/x', { fetchImpl });
    expect(data).toEqual({ count: 42 });
  });

  it('빈 200 응답은 null을 반환한다', async () => {
    const fetchImpl = async () => emptyRes(200);
    const data = await apiFetch('/x', { fetchImpl });
    expect(data).toBeNull();
  });

  it('4xx는 ApiError(status, kind=http)로 던지고 재시도하지 않는다', async () => {
    let calls = 0;
    const fetchImpl = async () => { calls += 1; return jsonRes({ error: 'bad' }, 404); };
    await expect(apiFetch('/x', { fetchImpl, retries: 2 })).rejects.toMatchObject({
      name: 'ApiError', status: 404, kind: 'http',
    });
    expect(calls).toBe(1); // 클라이언트 오류 → 재시도 없음
  });

  it('5xx는 재시도 후 실패하면 ApiError(kind=http)로 던진다', async () => {
    let calls = 0;
    const fetchImpl = async () => { calls += 1; return jsonRes({ error: 'boom' }, 500); };
    await expect(apiFetch('/x', { fetchImpl, retries: 2, retryDelayMs: 0 })).rejects.toMatchObject({
      name: 'ApiError', status: 500, kind: 'http',
    });
    expect(calls).toBe(3); // 최초 1 + 재시도 2
  });

  it('네트워크 오류는 재시도 후 ApiError(kind=network)로 던진다', async () => {
    let calls = 0;
    const fetchImpl = async () => { calls += 1; throw new TypeError('Failed to fetch'); };
    await expect(apiFetch('/x', { fetchImpl, retries: 1, retryDelayMs: 0 })).rejects.toMatchObject({
      name: 'ApiError', kind: 'network',
    });
    expect(calls).toBe(2);
  });

  it('타임아웃은 ApiError(kind=timeout)로 던진다', async () => {
    const hangFetch = (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
    await expect(apiFetch('/x', { fetchImpl: hangFetch, timeoutMs: 20, retries: 0 }))
      .rejects.toMatchObject({ name: 'ApiError', kind: 'timeout' });
  });

  it('일시 실패 후 재시도가 성공하면 값을 반환한다', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('Failed to fetch');
      return jsonRes({ ok: true });
    };
    const data = await apiFetch('/x', { fetchImpl, retries: 2, retryDelayMs: 0 });
    expect(data).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it('ApiError는 Error의 인스턴스다', () => {
    expect(new ApiError('x', { kind: 'network' })).toBeInstanceOf(Error);
  });
});
