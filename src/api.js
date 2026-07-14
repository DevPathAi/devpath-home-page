// 단일 fetch 클라이언트 (T9).
// timeout, 에러 정규화(4xx/5xx/네트워크/파싱), 빈 응답, 재시도를 한 곳에서 처리한다.
// 위젯(traction 등)·리드폼이 모두 이걸 통해 호출한다 — 5벌 중복 방지(DRY).

export class ApiError extends Error {
  constructor(message, { status = null, kind = 'network', cause } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;   // HTTP 상태코드 또는 null(네트워크/타임아웃)
    this.kind = kind;       // 'timeout' | 'network' | 'http' | 'parse'
    if (cause !== undefined) this.cause = cause;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 재시도해도 되는 실패인가? (타임아웃/네트워크/5xx만 재시도, 4xx는 즉시 실패)
function isRetryable(err) {
  if (err.kind === 'timeout' || err.kind === 'network') return true;
  if (err.kind === 'http' && err.status >= 500) return true;
  return false;
}

async function parseBody(res) {
  const text = await res.text();
  if (!text) return null; // 빈 응답 → null
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch (cause) {
      throw new ApiError('응답 JSON 파싱 실패', { status: res.status, kind: 'parse', cause });
    }
  }
  return text;
}

async function attempt(url, opts) {
  const {
    method = 'GET', body, headers, timeoutMs = 8000,
    fetchImpl = globalThis.fetch, signal: externalSignal,
  } = opts;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const res = await fetchImpl(url, {
      method,
      headers: { Accept: 'application/json', ...headers },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ApiError(`HTTP ${res.status}`, { status: res.status, kind: 'http' });
    }
    return await parseBody(res);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err && err.name === 'AbortError') {
      if (timedOut) throw new ApiError(`요청 시간 초과 (${timeoutMs}ms)`, { kind: 'timeout', cause: err });
      throw new ApiError('요청이 취소됨', { kind: 'network', cause: err });
    }
    throw new ApiError(err?.message || '네트워크 오류', { kind: 'network', cause: err });
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * @param {string} url
 * @param {object} [options]
 * @param {'GET'|'POST'} [options.method]
 * @param {any} [options.body]
 * @param {object} [options.headers]
 * @param {number} [options.timeoutMs=8000]
 * @param {number} [options.retries=1]  재시도 횟수(최초 1회 + retries)
 * @param {number} [options.retryDelayMs=300]
 * @param {typeof fetch} [options.fetchImpl]  테스트 주입용
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<any>} 파싱된 본문(빈 응답이면 null)
 */
export async function apiFetch(url, options = {}) {
  const { retries = 1, retryDelayMs = 300 } = options;
  let lastErr;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await attempt(url, options);
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || i === retries) throw err;
      if (retryDelayMs > 0) await sleep(retryDelayMs);
    }
  }
  throw lastErr;
}

// JSON POST 편의 헬퍼
export function postJson(url, payload, options = {}) {
  return apiFetch(url, {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(payload),
  });
}
