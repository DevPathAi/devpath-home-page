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

**⚠ 메일 권한 승인 (최초 1회 · 스코프 변경 시):** `MailApp`은 `script.send_mail` 스코프를 요구한다. 코드만 올리면 웹앱이 런타임에 거부당하고, 예외는 `mail_error`로만 보인다. 편집기에서 **`authorizeMailScope` 함수를 실행**해 동의 팝업을 승인한 뒤 **새 버전으로 배포**해야 적용된다. 다른 함수를 실행하면 팝업이 뜨지 않는다 — Apps Script는 실행한 코드가 실제로 요구하는 권한만 묻기 때문이다.

**메일 발송:** 신규 리드 접수 시에만 신청자 확인 메일 + 관리자 알림을 보낸다(재신청은 보내지 않는다). 발송 실패는 접수를 실패로 만들지 않고 응답의 `mail_sent: false`로 보고되며, **화면 문구가 이 값에 종속된다** — 보내지 않았으면 보냈다고 말하지 않는다. 발송 계정은 스크립트 실행 계정이고 회신 주소는 `ADMIN_EMAIL`이다.

### 구성 오버라이드
`window.LEVA_CONFIG = { formEndpoint, statsEndpoint, tractionMinSignups }` 로 런타임 조정 가능.

## 문서
- [`HANDOFF.md`](./HANDOFF.md) — 다음 세션 이관 항목 + 현재 상태
- [`docs/plan/plan-master.md`](./docs/plan/plan-master.md) — 마스터 플랜
- [`docs/plan/design-doc.md`](./docs/plan/design-doc.md) — 설계 문서
- [`docs/plan/test-plan.md`](./docs/plan/test-plan.md) — 테스트 플랜
- [`docs/visual-a11y-evidence.md`](./docs/visual-a11y-evidence.md) — production-dist 시각/접근성 증거 v2와 baseline 승인 절차

### 릴리스 candidate 결합

일반 CI와 로컬 진단은 저장소의 Home 전용 candidate fixture를 사용하며,
이 산출물은 전역 릴리스 seal 입력이 아니다. GitOps 릴리스 검증은 exact Home
SHA를 checkout한 뒤 외부 raw candidate의 절대 경로와 별도 채널에서 얻은
64자리 소문자 SHA-256을 함께 주입해 동일한 고정 Docker wrapper를 실행한다.

```bash
MISSION_CANDIDATE_SPEC_PATH='/absolute/path/to/candidate-spec.raw.json' \
MISSION_CANDIDATE_SPEC_SHA256='<out-of-band-sha256>' \
npm run visual:evidence:docker
```

wrapper는 둘 중 하나만 있거나 raw 바이트 해시가 다르면 렌더 전에 실패한다.
성공 시 GitOps가 수집할 sanitize된 manifest는
`test-results/visual-a11y/manifests/*.json`에 생성된다. 상세 mount·digest·검증
계약은 [`docs/visual-a11y-evidence.md`](./docs/visual-a11y-evidence.md)를 따른다.

## 브랜치 전략
`master` 보호(릴리스). `develop` 통합 브랜치. 작업은 `feat/*`·`fix/*` → `develop` PR, 릴리스 시 `develop` → `master` PR.
