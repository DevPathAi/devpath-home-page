# devpath-home-page

DevPath AI 정식 마케팅 홈페이지. 제품 기능 소개 + 창업자/회사 소개를 한 사이트에서 전달하고, 주 CTA "내 실력 진단받기"로 전환한다.

- **스택:** 바닐라 HTML/CSS/ES모듈 · Vitest(유닛) · Playwright(E2E) · 배포 Cloudflare Pages
- **상태:** 설계·리뷰 완료, 구현 미착수 (`HANDOFF.md` 참조)
- **플랜:** `docs/plan/plan-master.md` (CEO+Eng+Design 리뷰 + 태스크 T1~T18)

## 문서
- [`HANDOFF.md`](./HANDOFF.md) — 다음 세션 이관 항목 + 현재 상태
- [`docs/plan/plan-master.md`](./docs/plan/plan-master.md) — 마스터 플랜
- [`docs/plan/design-doc.md`](./docs/plan/design-doc.md) — 설계 문서
- [`docs/plan/test-plan.md`](./docs/plan/test-plan.md) — 테스트 플랜

## 브랜치 전략
`main` 보호. `develop` 통합 브랜치. 작업은 `feat/*`·`fix/*` → `develop` PR, 릴리스 시 `develop` → `main` PR.
