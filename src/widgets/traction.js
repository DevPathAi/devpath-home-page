// traction 티커 위젯 (T4 + T12 캐시).
// /api/stats 집계를 가져와 숫자를 표시하되, 하한 임계 미만/실패/빈값이면
// "베타 진행 중 — 초대받기" fallback을 노출한다(F1). 갱신은 aria-live=polite.
import { apiFetch } from '../api.js';
import { config } from '../config.js';

const CACHE_KEY = 'devpath:traction';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

// ── F1 판정 (순수 함수 — T11 유닛 테스트 대상) ────────────────────────────
// stats 가 null/실패/임계 미만이면 fallback. 정상이면 stats 모드.
export function decideTraction(stats, { minSignups = 20 } = {}) {
  if (!stats || stats.ok !== true) return { mode: 'fallback' };
  const signups = Number(stats.signups) || 0;
  if (signups < minSignups) return { mode: 'fallback' };
  return { mode: 'stats', stats };
}

// ── localStorage 5분 캐시 (T12) ───────────────────────────────────────────
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, stats } = JSON.parse(raw);
    if (!at || Date.now() - at > CACHE_TTL_MS) return null;
    return stats;
  } catch {
    return null;
  }
}
function writeCache(stats) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), stats }));
  } catch { /* 무시 */ }
}

// ── 렌더 ──────────────────────────────────────────────────────────────────
const FALLBACK_HTML = `
  <p class="traction__fallback">
    지금 베타를 진행 중입니다. 먼저 진단을 받아본 분들의 피드백으로 매주 다듬고 있어요.
    <a href="#lead">초대받기</a>
  </p>`;

function statHtml(num, label) {
  return `<div class="traction__stat"><div class="traction__num">${num}</div><div class="traction__label">${label}</div></div>`;
}

export function renderTraction(el, decision) {
  if (decision.mode === 'fallback') {
    el.innerHTML = FALLBACK_HTML;
    return;
  }
  const s = decision.stats;
  const parts = [
    statHtml(`${s.signups.toLocaleString('ko-KR')}명`, '진단 신청'),
    statHtml(`${(s.diagnoses_completed || 0).toLocaleString('ko-KR')}건`, '진단 완료'),
  ];
  if (s.satisfaction != null) parts.push(statHtml(`${s.satisfaction}/5`, '만족도'));
  el.innerHTML = `<div class="traction__grid">${parts.join('')}</div>`;
}

export async function mount(el) {
  const minSignups = config.tractionMinSignups;

  // 1) 캐시 우선 렌더(있으면 즉시)
  const cached = readCache();
  if (cached) renderTraction(el, decideTraction(cached, { minSignups }));

  // 2) 네트워크 갱신
  let stats = null;
  try {
    stats = await apiFetch(config.statsEndpoint, { timeoutMs: 6000, retries: 1 });
    if (stats && stats.ok === true) writeCache(stats);
  } catch {
    stats = null; // 실패 → fallback (F1)
  }

  // 캐시만 있고 새 요청이 실패하면 캐시 결과 유지, 아니면 새 결과로 렌더
  if (stats || !cached) renderTraction(el, decideTraction(stats, { minSignups }));
}
