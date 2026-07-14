# devpath-home-page

DevPath AI 정식 마케팅 홈페이지. 제품 기능 소개 + 창업자/회사 소개를 한 사이트에서 전달하고, 주 CTA "내 실력 진단받기"로 전환한다.

- **스택:** 바닐라 HTML/CSS/ES모듈 · Vitest(유닛) · Playwright(E2E) · 배포 Cloudflare Pages
- **상태:** T1~T14 구현 완료(T8 i18n 보류) · 유닛 32 + E2E 4 통과 · T15~T18(디자인 폴리시) 잔여
- **플랜:** `docs/plan/plan-master.md` (CEO+Eng+Design 리뷰 + 태스크 T1~T18)

## 개발

```bash
npm install
npm run dev        # http://127.0.0.1:4321 정적 서버
npm test           # Vitest 유닛
npm run test:e2e   # Playwright E2E (자동으로 서버 기동)
npm run build      # dist/ 배포 산출물 생성
```

## 배포 (Cloudflare Pages)

- **Build command:** `npm run build` · **Output directory:** `dist`
- **Functions:** 루트 `functions/`가 `/api/lead`(POST 프록시), `/api/stats`(GET 집계)를 제공
- **환경변수:** `APPS_SCRIPT_URL` = 기존 devpath-landing-page의 Apps Script Web App `/exec` URL
  (프록시가 서버측에서 이 URL로 포워딩 → 브라우저는 same-origin 호출, CORS 불필요)
- **Apps Script:** `apps-script/Code.gs`를 배포(단일 소스). `?action=stats`는 집계 카운트만 반환(PII 금지, F3)

### 구성 오버라이드
`window.DEVPATH_CONFIG = { formEndpoint, statsEndpoint, tractionMinSignups }` 로 런타임 조정 가능.

## 문서
- [`HANDOFF.md`](./HANDOFF.md) — 다음 세션 이관 항목 + 현재 상태
- [`docs/plan/plan-master.md`](./docs/plan/plan-master.md) — 마스터 플랜
- [`docs/plan/design-doc.md`](./docs/plan/design-doc.md) — 설계 문서
- [`docs/plan/test-plan.md`](./docs/plan/test-plan.md) — 테스트 플랜

## 브랜치 전략
`master` 보호(릴리스). `develop` 통합 브랜치. 작업은 `feat/*`·`fix/*` → `develop` PR, 릴리스 시 `develop` → `master` PR.
