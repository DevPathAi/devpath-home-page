// 리드폼 검증·페이로드·프라이버시 가드 (T3).
// devpath-landing-page/src/form-utils.js 에서 이식 — 동일 Sheet 파이프라인과
// 페이로드 호환을 유지한다. 소스코드·토큰·로그 등 민감 입력 차단 로직 보존.

export const CONSENT_VERSION = '2026-07-14-home-v1';

// 민감 입력 패턴 — 코드/URL/토큰/스택트레이스/로그 차단
const SENSITIVE_PATTERNS = [
  { name: 'GitHub URL', pattern: /github\.com\/[\w.-]+\/[\w.-]+/i },
  { name: 'URL', pattern: /https?:\/\//i },
  { name: 'password', pattern: /\bpassword\s*=/i },
  { name: 'token', pattern: /\b(token|api[_-]?key|secret)\s*[:=]/i },
  { name: 'private key', pattern: /BEGIN\s+(RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE KEY/i },
  { name: 'env file', pattern: /\.env\b/i },
  { name: 'JDBC URL', pattern: /jdbc:[a-z]+:\/\//i },
  { name: 'stack trace', pattern: /\n\s+at\s+[\w.$<>]+/i },
  { name: 'long multiline log', pattern: /(?:\n.*){5,}/ },
];

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function createLeadId(randomSource = globalThis.crypto) {
  if (randomSource && typeof randomSource.randomUUID === 'function') {
    return randomSource.randomUUID();
  }
  const random = Math.random().toString(36).slice(2, 10);
  return `lead_${Date.now().toString(36)}_${random}`;
}

export function parseAttribution(urlLike, referrer = '') {
  const url = new URL(urlLike, 'https://devpath.ai/');
  return {
    utm_source: url.searchParams.get('utm_source') || '',
    utm_medium: url.searchParams.get('utm_medium') || '',
    utm_campaign: url.searchParams.get('utm_campaign') || '',
    utm_content: url.searchParams.get('utm_content') || '',
    referrer: referrer || '',
  };
}

export function detectSensitiveInput(value) {
  const text = String(value || '');
  return SENSITIVE_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ name }) => name);
}

// 홈 리드폼 단일 스텝 검증: 이메일 + 단계 + 필수동의 + (선택)자유텍스트 민감검사
export function validateLead(data) {
  const errors = [];
  if (!isValidEmail(data.email)) errors.push('올바른 이메일을 입력해주세요.');
  if (!data.current_stage) errors.push('현재 단계를 선택해주세요.');
  if (!data.consent_required) errors.push('필수 개인정보 수집·이용에 동의해주세요.');
  const sensitive = detectSensitiveInput(data.recent_stuck_moment);
  if (sensitive.length > 0) {
    errors.push(`코드·로그·URL·비밀값은 넣지 말아주세요. 감지: ${sensitive.join(', ')}`);
  }
  return errors;
}

export function buildLeadPayload(data, context = {}) {
  const now = context.now || new Date().toISOString();
  return {
    action: 'lead',
    lead_id: data.lead_id || createLeadId(),
    email_raw: String(data.email || '').trim(),
    email_normalized: normalizeEmail(data.email),
    current_stage: data.current_stage || '',
    stack: String(data.stack || '').trim(),
    recent_stuck_moment: String(data.recent_stuck_moment || '').trim(),
    consent_required: Boolean(data.consent_required),
    consent_version: context.consentVersion || CONSENT_VERSION,
    consent_accepted_at: now,
    step1_submitted_at: now,
    last_updated_at: now,
    utm_source: context.utm_source || '',
    utm_medium: context.utm_medium || '',
    utm_campaign: context.utm_campaign || '',
    utm_content: context.utm_content || '',
    referrer: context.referrer || '',
    landing_variant: context.landingVariant || 'home-v1',
  };
}

export function mergeRows(existing, incoming) {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === '' || value === null || typeof value === 'undefined') continue;
    merged[key] = value;
  }
  return merged;
}
