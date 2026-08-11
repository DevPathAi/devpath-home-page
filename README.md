# devpath-home-page

DevPath AI 정식 마케팅 홈페이지. 제품 기능 소개 + 창업자/회사 소개를 한 사이트에서 전달하고, 주 CTA "내 실력 진단받기"로 전환한다.

- **스택:** 바닐라 HTML/CSS/ES모듈 · Vitest(유닛) · Playwright(E2E) · CI(GitHub Actions) · 배포 Cloudflare Pages
- **상태:** T1~T18 구현 완료(T8 i18n 보류) · 요금 4단계 · 유닛 32 + E2E 6 통과 · `develop` 반영
- **플랜:** `docs/plan/plan-master.md` (CEO+Eng+Design 리뷰 + 태스크 T1~T18)
- **배포 전 후속:** `APPS_SCRIPT_URL` 설정 + `Code.gs` 배포 · 창업자 StockPilot/LearnFlow 링크 연결

## 개발

```bash
npm install
npm run dev        # http://127.0.0.1:4321 정적 서버
npm test           # Vitest 유닛
npm run test:e2e   # Playwright E2E (자동으로 서버 기동)
npm run build      # dist/ 배포 산출물 생성
npm run gen:og     # assets/og-image.png 재생성 (템플릿/카피 변경 시)
```

## 배포 (Cloudflare Pages)

- **Build command:** `npm run build` · **Output directory:** `dist`
- **Functions:** 루트 `functions/`가 `/api/lead`(POST 프록시), `/api/stats`(GET 집계)를 제공
- **환경변수:** `APPS_SCRIPT_URL` = 기존 devpath-landing-page의 Apps Script Web App `/exec` URL
  (프록시가 서버측에서 이 URL로 포워딩 → 브라우저는 same-origin 호출, CORS 불필요)
- **Apps Script:** `apps-script/Code.gs`를 배포(단일 소스). `?action=stats`는 집계 카운트만 반환(PII 금지, F3)

### Apps Script 배포 (수동 — clasp 미설정)

`Code.gs`를 고쳐도 **자동으로 반영되지 않는다.** Apps Script 편집기에 붙여넣고 **새 배포**를 만들어야 한다(같은 배포를 "재배포"해도 새 코드가 올라가지 않는다). 배포 URL이 바뀌면 Pages 환경변수 `APPS_SCRIPT_URL`도 함께 갱신하고 **재배포**해야 적용된다.

| Script Property | 용도 | 없을 때 |
|---|---|---|
| `SHEET_ID` | leads 시트 스프레드시트 ID | 바인딩된 시트 사용 |
| `ADMIN_EMAIL` | 신규 신청 알림 수신 주소 | `info@leva.ai.kr` |

**메일 발송:** 신규 리드 접수 시에만 신청자 확인 메일 + 관리자 알림을 보낸다(재신청은 보내지 않는다). 발송 실패는 접수를 실패로 만들지 않고 응답의 `mail_sent: false`로 보고되며, **화면 문구가 이 값에 종속된다** — 보내지 않았으면 보냈다고 말하지 않는다. 발송 계정은 스크립트 실행 계정이고 회신 주소는 `ADMIN_EMAIL`이다.

### 구성 오버라이드
`window.LEVA_CONFIG = { formEndpoint, statsEndpoint, tractionMinSignups }` 로 런타임 조정 가능.

## 문서
- [`HANDOFF.md`](./HANDOFF.md) — 다음 세션 이관 항목 + 현재 상태
- [`docs/plan/plan-master.md`](./docs/plan/plan-master.md) — 마스터 플랜
- [`docs/plan/design-doc.md`](./docs/plan/design-doc.md) — 설계 문서
- [`docs/plan/test-plan.md`](./docs/plan/test-plan.md) — 테스트 플랜

## 브랜치 전략
`master` 보호(릴리스). `develop` 통합 브랜치. 작업은 `feat/*`·`fix/*` → `develop` PR, 릴리스 시 `develop` → `master` PR.
