# CLAUDE.md — devpath-home-page

> 레바의 공식 마케팅 홈페이지. 바닐라 HTML/CSS/ES 모듈을 빌드해 Cloudflare Pages에 배포한다. 이 파일과 `AGENTS.md`는 같은 규칙을 유지한다.

## 규칙 출처

- 워크스페이스 `CLAUDE.md`·`AGENTS.md`: AI 작업 소유권.
- 하위 저장소 공통 문서: 추측 금지, 테스트 우선, 원인 분석, 브랜치 격리, 검증 기반 완료와 조건부 Scope Lock.
- `devpath-frontend`: `develop` 중심 브랜치 전략과 디자인 시스템 source-of-truth 원칙.
- `devpath-gitops`: exact artifact, 적용 전 검증과 배포 증거 원칙.
- 이 저장소의 `package.json`, `README.md`, `DESIGN.md`와 Phase 0 승인 계획: Home 전용 명령과 제품·디자인 계약.

다른 저장소의 언어·프레임워크 명령과 과거 특정 호스트 장애 우회 규칙은 Home에 복사하지 않는다.

## 절대 조건 — 모든 작업에 예외 없이 적용

### 1. 추측·예상 금지

- 코드·설정·운영 상태·의존성을 추측하지 않는다. 관련 파일과 실제 명령 결과를 확인한 뒤 행동한다.
- 확인하지 못한 제품 기능, 수치, 가격, 고객 사례, 창업자 신원과 화면을 만들어 내지 않는다.
- 확인이 불가능하고 결과를 바꾸는 정보가 필요하면 정확한 차단 근거와 필요한 입력을 밝힌다.

### 2. 테스트 우선

- 기능·빌드 계약·콘텐츠 계약을 바꿀 때는 실패하는 테스트 또는 재현 가능한 검증을 먼저 추가한다.
- 구현 후 관련 단위·통합·브라우저·접근성 검사를 실제로 실행한다. 실행하지 않은 검사를 통과했다고 보고하지 않는다.
- 문서만 바꿀 때도 링크, 경로, 명령, Markdown과 `git diff --check`를 검증한다.

### 3. 문제 발생 시 원인 분석 우선

- 실패가 생기면 코드, 로그, 스택트레이스, 생성된 `dist`를 먼저 확인한다.
- 증상만 감추는 임시 예외나 테스트 완화를 금지한다. 원인을 설명할 수 있을 때 수정한다.

### 4. 신규 작업은 새 브랜치에서 수행

- `master`는 보호 릴리스 브랜치, `develop`은 통합 브랜치다.
- 작업 브랜치는 최신 `origin/develop`에서 `feat/*`, `fix/*`, `chore/*`, `docs/*`로 분기하고 `develop`으로 PR한다.
- `master`·`develop`에 직접 커밋하거나 push하지 않는다. 릴리스는 `develop` → `master` PR로 진행한다.
- 여러 세션의 변경을 섞지 않는다. 기존 dirty 파일과 사용자 소유 변경을 보존하고 관련 파일만 stage한다.

### 5. 완료는 검증 결과로만 판단

- “완료”, “문제없음”, “배포 가능”은 실행한 명령과 관찰한 결과가 있을 때만 말한다.
- source HTML이 아니라 실제 배포 후보인 생성된 `dist`를 최종 계약으로 검증한다.
- 실패·미실행·외부 승인 대기는 성공 결과와 분리해 보고한다.

## AI 작업 소유권

- 명령 실행, 파일 수정, API 호출, 검증, 문서화처럼 도구로 가능한 작업은 AI가 직접 수행한다.
- 인간에게 넘길 수 있는 것은 실제 호출이 거부된 작업과 다른 계정 로그인·법적 승인·결제·물리적 행동처럼 구조적으로 인간 전용인 작업뿐이다.
- 실행 가능 여부는 실제 시도 또는 구체적인 파일·API 검토 후 판정한다. 추측으로 작업을 사용자에게 돌리지 않는다.
- 인간 전용 단계가 필요하면 복사 실행 가능한 명령과 결과를 이어받는 절차를 함께 제공한다.
- 상세 공통 규칙: `C:\Users\deepe\.claude\rules\ai-task-ownership.md`.

## 저장소 구조와 기준 문서

- `index.html`, `about.html`, `beta.html`, `privacy.html`, `terms.html`: 정적 페이지 source.
- `assets/`: CSS, JavaScript, 폰트와 공개 이미지.
- `content/`, `scripts/notes.mjs`: 개발 기록 원문과 생성 규칙.
- `templates/`: 빌드 시 사용하는 정적 템플릿.
- `functions/`: 롤백 기간에 유지되는 Pages Functions. 새 Home waitlist backend를 만들지 않는다.
- `build.mjs`: source를 `dist/`로 만드는 유일한 배포 빌드 진입점.
- `tests/`: Vitest 계약·단위 테스트.
- `e2e/`: Playwright 기능·접근성·시각 검증.
- `DESIGN.md`: Home 디자인 시스템과 토큰 사용 계약.
- `D:\workspace\dpa\docs\plan\2026-09-04-homepage-phase0-engineering-plan.md`: Phase 0 실행 순서와 승인 결정 UX1–UX15의 기준.
- 승인 목업과 `approved.json`은 계획서의 `Approved Mockups` 절에 기록된 `~/.gstack/projects/.../designs/` 경로를 사용한다.

README나 과거 목업이 위 기준과 충돌하면 최신 승인 계획, `approved.json`, 실제 제품 source 순으로 판정한다. 충돌을 임의로 합성하지 않는다.

## 빌드·테스트

저장소 루트에서 실행한다.

```bash
npm ci
npm run build
npm test
npm run test:e2e
npm run test:visual
npm run visual:contracts
npm run visual:fonts:verify
npm run visual:evidence:validate
npm run test:all
```

- 로컬 개발: `npm run dev` → `http://127.0.0.1:4321`.
- 배포 후보 확인: `npm run preview` → 생성된 `dist`를 같은 포트에서 제공한다.
- 릴리스 검증: `npm run test:release`.
- OG 이미지 생성: 승인 카피·템플릿 변경 시 `npm run gen:og` 후 산출물과 참조를 검증한다.
- 의존성 변경이 없으면 lockfile을 다시 만들지 않는다. 의존성 변경 시 `package.json`과 `package-lock.json`을 함께 검토한다.
- 알려진 npm 취약점을 숨기거나 테스트를 약화하지 않는다. 범위 밖이면 개수와 영향, 후속 작업을 명시한다.

## 빌드와 배포 계약

- `dist/`를 직접 손으로 수정하지 않는다. source·template·config를 수정하고 `npm run build`로 재생성한다.
- 필수 배포 entry가 없으면 build가 실패해야 한다. 선택 entry는 명시적으로 분리한다.
- HTML, metadata, JSON-LD, sitemap, CTA URL은 한 source of truth에서 생성하고 `dist` 계약 테스트로 대조한다.
- Cloudflare Pages build command는 `npm run build`, output directory는 `dist`다.
- production 변경은 exact source SHA, dist hash, deployment ID와 canary 증거를 남긴다. 현재 배포를 추측으로 덮어쓰지 않는다.
- www·Pages 기본 도메인 redirect는 path와 query를 보존하는 단일 301이어야 한다.

## Phase 0 홈페이지 계약

- 본문 브랜드 표기는 `레바`다. 과거 `DevPath AI`, 구 가격, 구 기능 약속을 현재 제품처럼 노출하지 않는다.
- 대상은 사수 없이 일하는 0~3년차 현직 개발자다. 입문자·취준생·즉시 취업 보장 프레임을 만들지 않는다.
- Header 순서는 `작동 방식 · LCS · 요금 · 개발 기록 · 소개 | 로그인 · 가입 없이 진단 시작`이다.
- 공개 4단계는 `진단 → 로드맵 → AI 멘토 → 경로 보정`이다. 경로 보정은 `진행을 확인하고 다음 미션을 제안합니다. 받아들이면 경로가 바뀝니다.`로만 설명하며 사용자 수락 전 자동 변경을 주장하지 않는다.
- Before/After 질문은 한 번만 표시하고 After에만 `학습 주제 · 진도 · 직전 오류` 맥락 블록을 둔다.
- 전송 전 패널은 `학습 주제 · 로드맵 진도 · 직전 오류 · 마스킹 표시`만 보여 주는 비조작 `figure`다.
- 가격은 `현재 무료 베타 / AI 멘토 순차 초대 중 / 정식 전환 시 월 9,900원 예정` 3행만 사용하고 기능 비교표를 만들지 않는다.
- 게스트 진단 CTA는 앱 `/diagnostic`, AI 멘토 초대 CTA는 앱 `/login`으로 보낸다. 계정 전체 상태와 분리된 `mentor_access=WAITLISTED|ACTIVE`가 멘토만 통제하며, 대기 중에도 일반 앱과 첫 주차 미션은 연다.
- 실제 12주 경로, FAQ 6문항, 최신 개발 기록 3편은 기존 source에서 build-time으로 가져온다. 목업 placeholder를 배포하지 않는다.
- Founder 사진·이름은 승인 자료 전까지 `실제 자료로 교체 예정` placeholder다. 생성 사진·가짜 이름을 금지한다.
- Footer는 제품/회사/법적 3열을 유지한다. 제품 Q&A는 앱 `/community`, FAQ는 Home `#faq`, 공지·변경 기록은 `/updates`, 문의·오류 신고는 `/contact`로 분리한다.
- 회사 정보에는 검증되어 공개 가능한 값만 넣는다. 대표자명·소재지를 추측하거나 `확인 후 입력` 같은 내부 placeholder를 배포하지 않는다.
- AI 멘토는 신청 순서대로 순차 승인하고, 승인되면 이메일로 안내한다. Home은 신청 정보를 직접 수집하지 않는다.
- `/updates`는 정적 원고 하나에서 HTML과 32 KiB 이하 JSON feed를 함께 생성한다. `/contact`는 Turnstile과 개인정보 동의를 거쳐 플랫폼의 기존 지원 큐로 보낸다.

## 디자인·반응형·접근성

- Home palette anchor는 ink `#12231E`, primary CTA `#1FA97A`, emphasis `#F5A524`다. 기능 CSS에 raw color를 흩뜨리지 않고 canonical token projection을 사용한다.
- Header blur/glass와 Hero 장식 shadow, gradient, blob, AI orb, 과도한 pill을 사용하지 않는다.
- 한글 제목과 본문은 `word-break: keep-all`을 기본으로 하며 H1 승인 줄바꿈을 보존한다.
- viewport 계약은 Compact `320–599`, Medium `600–839`, Expanded `840–1239`, Large `1240+`다.
- Compact·Medium 메뉴는 Header 안에서 펼쳐져 Hero를 아래로 미는 인라인 nav다. overlay·drawer·focus trap을 사용하지 않는다.
- semantic landmark, skip link, heading 순서, 44×44px hit target, keyboard focus, 200% text, reduced motion, WCAG AA 대비와 가로 overflow 0을 검증한다.
- 모든 이미지·iframe은 크기를 예약한다. 사용자가 상호작용하기 전 YouTube iframe을 만들지 않는다.

## 실제 화면과 미디어 증거

- 최초 Home은 `stills` mode이며 새로 캡처한 `진단 결과 · AI 멘토 · 경로 보정` 3장을 표시한다.
- GovTech 제출용 PNG 3종은 Home asset이 아니다. 기존 v1.3 TTS 검수 영상도 공개하지 않는다.
- 실제 화면은 배포 후보 앱에서 캡처하고 role, route, viewport, capture time, app source/deployment SHA, original/derived hash를 manifest에 기록한다.
- 허용 파생은 개인정보 검토 후 crop, resize, WebP encoding뿐이다. 화면의 값·문구·상태를 합성하거나 지우지 않는다.
- `video` mode는 창업자 육성 11/11, 승인 문구·브랜드·자막·길이·hash와 immutable provider ID가 모두 검증된 뒤 별도 릴리스로 전환한다.

## 보안·개인정보

- API key, OAuth secret, 결제 키, 계정 토큰, 실제 개인정보를 저장소·로그·스크린샷에 커밋하지 않는다.
- `.dev.vars`는 로컬 전용이고 `.dev.vars.example`에는 예시 키만 둔다.
- 실제 화면 fixture는 비식별 중립 계정을 사용한다. 캡처 전에 이름·이메일·토큰·URL query를 검사한다.
- 구 랜딩 데이터·runtime·credential 종료는 export 검증 → redirect → 관찰 → runtime 중단 → provider 폐기 순서를 지킨다. 원본 삭제나 credential 폐기를 앞당기지 않는다.

## 공통 작업 규칙

- Conventional Commits를 사용한다. 관련 파일만 명시적으로 stage하고 `git add -A`를 기본값으로 사용하지 않는다.
- 사용자 소유 변경을 reset, checkout, 삭제하거나 덮어쓰지 않는다.
- 도구 호출은 현재 실행 환경이 제공하는 안전한 방식으로 직접 수행한다. 다른 저장소의 호스트 장애 우회 규칙을 이 저장소에 복사하지 않는다.
- 서브에이전트 사용은 상위 실행 환경이 허용하거나 사용자가 명시한 경우에만 한다. 위임 시 단일 작업 경계, 금지 범위, 완료 조건을 적고 결과를 주 에이전트가 직접 검증한다.
- 저장소 밖 산출물과 운영 상태를 참조할 때 절대 경로, hash, source SHA 또는 URL을 기록해 다음 세션이 재현할 수 있게 한다.

## Skill routing

요청이 사용 가능한 skill과 일치하면 해당 skill의 `SKILL.md`를 먼저 읽고 따른다.

- 제품 아이디어·수요 검증 → `/office-hours`
- 전략·범위 → `/plan-ceo-review`
- 아키텍처·실행 계획 → `/plan-eng-review`
- 디자인 계획·시각 검토 → `/plan-design-review`, `/design-review`
- 승인 목업 HTML화 → `/design-html`
- 버그·실패 원인 분석 → `/investigate`
- 브라우저 QA → `/qa`, 보고 전용은 `/qa-only`
- 코드·diff 검토 → `/review`
- 배포·PR → `/ship`, `/land-and-deploy`
- 문맥 저장·복원 → `/context-save`, `/context-restore`
- 실행 가능한 명세 → `/spec`
