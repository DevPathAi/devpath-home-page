// 런타임 설정 (T3/T4). index.html 또는 배포 환경에서 window.DEVPATH_CONFIG 로 덮어쓴다.
// Apps Script Web App URL(?action=lead|stats)은 기존 devpath-landing-page 백엔드를 재사용한다.
// 미설정 시 폼은 검증까지 동작하고, 제출 단계에서 안내 메시지로 graceful degrade.

const overrides = (typeof window !== 'undefined' && window.DEVPATH_CONFIG) || {};

export const config = {
  // 동일 출처 CF Pages Function 프록시(권장) — 함수가 서버측에서 Apps Script로 포워딩.
  // window.DEVPATH_CONFIG.formEndpoint 로 Apps Script /exec URL 직접 지정도 가능.
  formEndpoint: overrides.formEndpoint || '/api/lead',
  statsEndpoint: overrides.statsEndpoint || '/api/stats',
  consentVersion: overrides.consentVersion || undefined,
  landingVariant: overrides.landingVariant || 'home-v1',
  // traction 하한 임계값(F1) — 가입 수가 이 미만이면 fallback 노출
  tractionMinSignups: overrides.tractionMinSignups ?? 20,
};

export function hasFormEndpoint() {
  return Boolean(config.formEndpoint);
}
