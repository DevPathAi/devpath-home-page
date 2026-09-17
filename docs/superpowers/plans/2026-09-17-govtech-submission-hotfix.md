# GovTech 제출 전 수정 계획 (2026-09-17 → 제출 9/18)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 외부 리뷰(P0 4건·P1 7건·P2 6건)를 실측으로 검증한 뒤, 내일 제출 전에 공개 표면(leva.ai.kr·영상)에서 사실과 다른 것을 없앤다. 앱(app.leva.ai.kr) 쪽은 develop PR 로 준비하되 운영 반영은 사람 게이트가 필요함을 명시한다.

**Architecture:** 홈페이지는 Cloudflare Pages `devpath-home-page`(Git 미연결, Production = `develop` 라벨의 직접 업로드)라 로컬 wrangler(OAuth 로그인 확인됨)로 `dist` 를 바로 올릴 수 있다 — 오늘 밤 반영 가능한 유일한 경로. 앱·게이트웨이·서비스는 exact-digest 승격 캠페인(ET13 baseline 승인·Cloudflare 토큰 = 사람 단계)을 거쳐야 운영에 닿는다. 영상은 로컬 v1.3 렌더가 이미 정상이라 재렌더 뒤 **YouTube 재업로드(사람)** 만 남는다.

**Tech Stack:** 홈페이지 바닐라 ES 모듈 + Vitest + Playwright + CF Pages Functions, wrangler 4.133, ffmpeg 8.1, Flutter 3.44.1, Spring Cloud Gateway / platform-svc.

**Spec:** 사용자 붙여넣은 외부 리뷰(2026-09-17). 아래 "검증" 표가 실측 결과다.

## 검증 결과 (전부 실측, 2026-09-17 15:00–16:00 KST)

| # | 리뷰 주장 | 실측 | 판정 |
|---|---|---|---|
| P0-1 | 영상 포스터가 자리표시자 | `assets/video-poster.jpg` = 게시본 48 s 프레임. **게시된 YouTube `MTSrOoTlZss` 본편 44–48 s 에도 "검수용 모델 응답 · 운영 캡처로 교체 / 운영 응답 확보 전 검수용 자리표시자" 가 그대로**. 로컬 `leva-90s-video/clips/leva-90s-v1.3-video-only.webm` 의 같은 구간은 운영 실응답(정상). 게시본이 v1.2 계열 | 사실. 영상 재렌더+재업로드 필요 |
| P0-2 | 히어로 "진단 신뢰도 0%" | `assets/live-diagnostic-result.png`(1440×1000, 대부분 여백) "현재 레벨 JUNIOR · 진단 신뢰도 0%". 신뢰도 = 응답(비스킵) 문항/15 (`AssessmentService:132`) → 9/5 캡처는 전 문항 스킵으로 만든 것 | 사실. 실제 응답으로 재캡처 |
| P0-3 | 홈 캡처(주황)와 앱(인디고) 테마 불일치 | `af1995c 2026-09-13 feat: redesign Leva UI for mobile-first use` 가 PR #199/#202/#204 로 9/16 main 반영(운영 배포 9/16 21:35 KST). **의도된 개편**이며 회귀 아님. 홈 캡처 3장·영상은 9/4–9/5 구 테마 | 사실. 캡처 갱신, 영상은 녹화일 명시 |
| P0-4 | /updates CORS 헤더 중복 | `GET https://api.leva.ai.kr/mentor-access/invite-rounds`(Origin: leva.ai.kr) → 200 `[]` 이지만 `Access-Control-Allow-Origin` 2회, `Vary` 3종×2. 원인 = 게이트웨이 `GatewaySecurityConfig` CORS(publicOrigins) **와** platform-svc `SecurityConfig.publicInviteRounds` CORS 가 둘 다 붙임 | 사실. 홈 쪽 동일 출처 프록시로 즉시 우회 + 서비스 쪽 CORS 제거 PR |
| P1-a | 멘토 캡처가 빈 화면·칩 "Riverpod이 뭔가요?" 고정 | `mentor_page.dart:16` `_kExamples` 상수 3개(트랙 무관) | 사실 |
| P1-b | 경로 캡처 1주차 0%, 제안 장면 없음 | `live-backend-path.png` 확인 | 사실 |
| P1-c | 12주 미리보기 문구 반복·검증 불가 완료 조건 | 생성 문구(learning-svc 경로 생성 결과). 이번 범위 밖(프롬프트/후처리) | 사실, P2 로 |
| P1-d | 번들 무압축·no cache-control | nginx 1.31.3 `main.dart.js` 5,969,649 B, `content-encoding` 없음(내 실측과 동일). `apps/web/nginx.conf` 에 gzip·캐시 없음 | 사실 |
| P1-e | 부팅 로딩 표시 없음 | `apps/web/web/index.html` body 에 스플래시 없음 | 사실 |
| P1-f | `window.LEVA_CONFIG` 미주입 → analytics development/dev | 운영 HTML 에 없음. `build.mjs` 는 주입하지 않고 `src/config.js` 기본값 사용 | 사실 |
| P1-g | AdSense 홈·앱 동시 탑재 | 홈 `<head>` 62행, `ads.txt`, 앱 `index.html` 주입 스크립트 확인 | 사실. 결정 사항 |
| P2-a | D2Coding CSS 404 | `cdn.jsdelivr.net/gh/wan2land/d2coding@1.3.2/d2coding.css` 404, jsDelivr 에 해당 gh 패키지 버전 없음 | 사실 |
| P2-b | 문구 엇갈림 | index "9,900원 예정"/about "정해지지 않았습니다"; about "혼자"/beta "저희"; beta "스택 범위가 아직 좁습니다"(앱 8트랙); FAQ "매주 다듬고 있습니다" | 사실 |
| P2-c | version.json `devpath_web` | `{"app_name":"devpath_web",…}` (pubspec name) | 사실 |
| P2-d | 제목 구분자 혼재 | index `·`, about/beta `—` | 사실 |

## Global Constraints

- 사실만 게시한다: "실녹화"·"캡처일"·"출처" 배지는 실제 파일의 출처·날짜와 일치해야 한다. 데모/목 데이터 화면을 쓰면 배지에 그렇게 적는다.
- 홈페이지 배포 = `npx wrangler@4 pages deploy dist --project-name devpath-home-page --branch develop`(Production). 배포 전 `npm test`·`npm run build`·`npm run test:e2e` 녹색. 직접 배포는 gitops landing-last 가 기대하는 "prior deployment" 를 바꾸므로 배포 id 를 기록해 gitops 핸드오프에 남긴다.
- 앱·게이트웨이·서비스 변경은 develop PR 까지만 이 세션이 한다. 운영 반영은 승격 캠페인(사람: ET13 15-fixture baseline 승인, Cloudflare durable token) 뒤에만 가능하다 — 제출일 전 반영은 사용자가 그 게이트를 열 때만.
- 비밀값 출력 금지. YouTube 업로드·계정 로그인은 사람 단계(도구로 불가: 계정 OAuth 없음).

---

## P0 — 제출 전 (홈페이지 핫픽스 브랜치 `fix/govtech-submission-hotfix-20260917`, 워크트리 `.worktrees/home-govtech-hotfix-20260917`)

### Task 1: 영상 재렌더와 포스터 교체

**Files:** `leva-90s-video/output/leva-90s-guide-review-v1.3.mp4`(생성), `devpath-home-page/assets/video-poster.jpg`, `evidence/video-release.v1.json`, `index.html` 485–493행.

- [ ] 1.1 `leva-90s-video` 에서 `.\build.ps1 -SkipCapture` 실행(기존 실녹화 클립 사용, TTS 자막) → `output/leva-90s-guide-review-v1.3.mp4` 생성, ffmpeg 로 44/48/52 s 프레임을 뽑아 자리표시자 문구가 없음을 눈으로 확인.
- [ ] 1.2 포스터: v1.3 렌더 48 s 프레임(운영 실응답 화면)을 1280×720 JPEG 로 저장 → `assets/video-poster.jpg`. `evidence/video-release.v1.json` 의 poster sha256·sourceTimestampSeconds 갱신.
- [ ] 1.3 **[사람]** 새 mp4 를 YouTube 에 업로드(기존 영상은 파일 교체 불가 → 새 videoId). 받은 videoId 로 `index.html data-video-id`·`evidence/video-release.v1.json provider.videoId/watchUrl/embedUrl/retrievedRenditionSha256`·`publishedOn` 갱신. 업로드 전에는 포스터만 교체하고 배지 문구를 "출처 · 레바 앱 실녹화(2026.09.04, 개편 전 디자인)" 로 바꿔 사실과 맞춘다.
- [ ] 1.4 `npm test`(evidence 계약 테스트 포함) 녹색 확인, 커밋 `fix(video): replace placeholder poster and pin the re-rendered rendition`.

### Task 2: 히어로·필름스트립 캡처를 현재 앱(9/16 개편 테마)으로 교체

**Files:** `assets/live-diagnostic-result.png`, `assets/live-mentor.png`, `assets/live-backend-path.png`, `index.html` 447·496–498행(캡처일 배지), `tools/capture-live.mjs`(신규, 홈 레포).

- [ ] 2.1 진단 결과(로그인 불필요): Playwright 로 `https://app.leva.ai.kr/diagnostic` 게스트 흐름을 자동 진행(트랙 백엔드 Spring 선택 → 15문항 모두 응답) → 결과 카드가 보이는 뷰포트(1440×900)에서 카드 영역 중심으로 캡처. 신뢰도가 0% 가 아님을 확인. 배지 "캡처일 · 2026.09.17".
- [ ] 2.2 멘토·경로(로그인 필요): **[사람]** 데모 계정으로 로그인한 Chrome 을 `--remote-debugging-port=9222` 로 띄운다(`leva-90s-video/capture-browser.cjs` 와 같은 방식). 이 세션이 CDP 로 붙어 `/mentor`(맥락 패널 + 질문 + 응답이 보이는 상태)와 `/path`(다음 미션 제안이 보이는 상태)를 캡처한다. 사람 단계가 제출 전 불가능하면 mock 빌드(`MOCK_PROFILE=onboarded`) 캡처로 대체하고 배지를 "출처 · 레바 앱 화면(데모 데이터) / 캡처일 · 2026.09.17" 로 적는다.
- [ ] 2.3 세 캡처를 표시 크기(695×483)에서 글자가 읽히도록 카드 중심으로 크롭(원본 2× DPR 유지). `npm run test:visual:list`/visual 계약이 캡처 sha 를 고정하면 갱신.
- [ ] 2.4 커밋 `fix(home): refresh product captures from the 2026-09-16 redesign`.

### Task 3: /updates 초대 회차 — 동일 출처 프록시 + 빈 상태 + 근본 원인 PR

**Files:** `functions/api/invite-rounds.js`(신규), `src/invite-rounds.js`, `tests/invite-rounds.test.js`, `templates/updates.html`; platform-svc `SecurityConfig.java`.

- [ ] 3.1 RED: `tests/invite-rounds.test.js` 에 "fetchInviteRounds 는 `/api/invite-rounds`(동일 출처)를 호출한다", "빈 배열이면 '아직 완료된 초대 회차가 없습니다.' 를 보이고 목록은 숨긴다" 를 추가해 실패 확인.
- [ ] 3.2 `functions/api/invite-rounds.js`: `onRequestGet` 이 `https://api.leva.ai.kr/mentor-access/invite-rounds` 를 서버측 fetch(Origin 헤더 없음) → 배열만 화이트리스트(`roundNumber, deliveredCount, date`)로 재노출, `Cache-Control: public, max-age=60`, 실패 시 `[]` 아닌 503 JSON. `src/invite-rounds.js` `ENDPOINT = '/api/invite-rounds'`.
- [ ] 3.3 GREEN → `npm test`. 라이브 확인은 배포 후 `curl https://leva.ai.kr/api/invite-rounds`.
- [ ] 3.4 근본 원인(별도 레포, develop PR): platform-svc `SecurityConfig` 의 `publicInviteRounds` CORS 등록 제거(엣지 CORS 는 게이트웨이 `PUBLIC_CORS_ALLOWED_ORIGINS` 가 담당). 테스트: 게이트웨이 계약 테스트가 있으면 single-ACAO 단언 추가. 운영 반영은 승격 캠페인.

### Task 4: 테마 불일치 답변과 홈 배포

- [ ] 4.1 리뷰 회신용 사실: 개편은 의도(`af1995c`, 9/13 mobile-first redesign, 9/16 운영). 홈 캡처는 Task 2 로 현재 테마, 영상은 개편 전 녹화임을 배지에 명시(Task 1.3).
- [ ] 4.2 `npm test` · `npm run build` · `npm run test:e2e` 녹색 → `npx wrangler@4 pages deploy dist --project-name devpath-home-page --branch develop` → 배포 id·URL 기록 → 라이브 `curl` 로 포스터·캡처·`/api/invite-rounds`·`/updates` 문구 확인. 브랜치 push + develop PR(이력·CI).
- [ ] 4.3 gitops 핸드오프에 "홈 직접 배포 <id>" 를 남겨 다음 landing-last 의 prior deployment 기대값 불일치를 예고.

## P1 — 홈페이지 (같은 배포에 태움)

### Task 5: 운영 설정 주입(analytics)과 정합성

- [ ] 5.1 RED: `tests/build.test.js`(또는 기존 build 테스트)에 "dist/*.html 은 `<script>window.LEVA_CONFIG={appVersion:<40자 sha>,analyticsEnvironment:'production'}</script>` 를 모듈 스크립트 앞에 가진다" 추가.
- [ ] 5.2 `build.mjs`: `APP_VERSION`(없으면 `git rev-parse HEAD`)·`ANALYTICS_ENVIRONMENT`(기본 production) 로 각 HTML 진입 파일에 주입. `config.test.js` 의 "함께 공급" 계약 유지.
- [ ] 5.3 D2Coding CSS `<link>` 2개 제거(jsDelivr 에 패키지 없음; 폰트 스택은 이미 `ui-monospace, monospace` 로 폴백). 시각 계약 테스트가 폰트 링크를 고정하면 갱신.
- [ ] 5.4 문구 통일: 유료 플랜 = "준비 중이며 가격은 미정"(index 306·565행 "9,900원 예정" 을 `2026-08-10-leva-rebrand-compliance-design.md` 와 대조해 결정) / 1인 운영 → "혼자"(beta 47·118행 "저희") / beta 104행 "스택 범위" → 8개 트랙 명시 / FAQ "매주 다듬고 있습니다" → "계속 다듬고 있습니다"(마지막 개발 기록 8/11) / `<title>` 구분자 `·` 로 통일(about·beta). `tests/content-compliance.test.js` 갱신.
- [ ] 5.5 AdSense: **결정 필요** — 유지 시 `privacy.html` 에 광고·행태정보 고지 존재를 확인(없으면 추가), 제거 시 홈 `<head>` 스크립트·`ads.txt`·앱 index.html 주입을 함께 뺀다. 이 계획은 "유지 + 고지 확인" 을 기본값으로 둔다.

## P1 — 앱 (frontend develop PR `fix/govtech-app-followups-20260917`; 운영 반영은 승격 캠페인 뒤)

### Task 6: 부팅 스플래시, 전송 압축·캐시, 멘토 칩, version.json

- [ ] 6.1 `apps/web/web/index.html`: body 에 CSS 전용 스플래시(브랜드 마크 + "불러오는 중") 를 두고 `flutter-first-frame` 이벤트에서 제거. 계약 테스트(`frontend_reproducibility_contract_test` 류)에 존재 단언.
- [ ] 6.2 `apps/web/Dockerfile` 런타임 스테이지에서 `gzip -9 -k` 로 `.js/.wasm/.json/.otf/.ttf/.css/.html` 사전 압축, `apps/web/nginx.conf` 에 `gzip_static on; gzip_vary on;` 과 `location ~* \.(js|wasm|otf|ttf|json)$ { add_header Cache-Control "no-cache"; }`(ETag 재검증), `index.html` `no-cache`. `web-image-release-contract` 갱신. 실측 예상: `main.dart.js` 5.97 → 1.69 MB(리뷰어 gzip 실측), 폰트 5.6 → 약 3.5 MB.
- [ ] 6.3 `mentor_page.dart` `_kExamples` → 현재 트랙별 제안(백엔드 Spring: "@Transactional 은 언제 붙이나요?" 등) — 트랙 소스는 진단/경로 상태에서. 위젯 테스트.
- [ ] 6.4 `version.json`: `flutter build web` 의 `app_name` 은 pubspec name 이므로 pubspec `name: leva_web` 로 바꾸면 import 전량 변경 → 대신 nginx 에서 `/version.json` 을 `{"app_name":"leva_web",...}` 로 재작성하지 않고(위조), pubspec rename 을 별도 PR 로 잡는다(P2).

## P2

- 12주 미리보기 문구(learning-svc 경로 생성 프롬프트/후처리: 반복 문장·검증 불가 완료 조건·7주차 묶음).
- journeyId 가 두 번 중 한 번만 붙는 원인 조사(`src/analytics`·앱 `journey_handoff.dart`).
- FAQ/개발 기록 갱신, pubspec rename.

## 사람 단계 요약 (제출 전)

1. YouTube 재업로드(Task 1.3) → videoId 를 알려주면 홈 evidence/embed 를 갱신해 재배포한다.
2. 멘토·경로 실캡처용 로그인 세션(Task 2.2) — 불가 시 데모 데이터 캡처로 대체(배지 명시).
3. AdSense 유지/제거 결정(Task 5.5).
4. 앱 쪽 수정을 제출 전에 운영 반영하려면 ET13 baseline 승인 + Cloudflare 토큰(N01) 이 필요하다.
