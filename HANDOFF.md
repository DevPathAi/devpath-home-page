# DevPath AI 홈페이지 — 다음 세션 핸드오프

> 갱신: 2026-07-14 · 상태: **T1~T18 구현 + 요금 4단계 + OG + CI + 라이브 디자인 리뷰 완료. `develop` 반영. 배포 미연결.**

## 지금까지 (요약)
- **제품:** DevPath AI (AI 개발자 학습 플랫폼). 이 레포는 정식 마케팅 홈페이지.
- **구현:** plan-master **T1~T18** 전부(T8 i18n 보류) + 요금 4단계 + OG 이미지 + CI + 디자인 리뷰 수정.
- **스택:** 바닐라 ES모듈 + Vitest + Playwright + CI(GitHub Actions). 배포 = Cloudflare Pages(미연결).
- **검증:** 유닛 32 + E2E 6 통과. CI 녹색. 라이브 디자인 감사 Design A− / AI Slop A.

## 브랜치 상태 (중요)
- **`master`** = 릴리스 v0.1 (`81acfd9`) — T1~T18까지. **아래 6커밋이 아직 없음.**
- **`develop`** = 최신. master보다 **6커밋 앞섬**:
  - `.dev.vars.example` + gitignore (PR #5)
  - 디자인 리뷰 수정 FINDING-001/002 + `DESIGN.md` (PR #6)
- → **다음 세션 첫 작업: `develop` → `master` 릴리스 PR** (디자인 성능 수정을 master로).

## 라이브 디자인 리뷰 결과 (2026-07-14, `/design-review`)
- **FINDING-001 (성능):** CDN 폰트가 렌더블로킹(`media=all`) → **domReady 4224ms**. `media="print" onload` 논블로킹 + noscript 폴백으로 전환 → **domReady 19ms**. 커밋 `535a82f`.
- **FINDING-002 (a11y):** nav 40px·푸터 24px 터치타깃 → `min-height:44px`. 커밋 `375e0af`.
- **DESIGN.md 추가** — 확정 디자인 시스템(토큰·레이아웃 규칙·AI-slop 금지·a11y·성능). 이후 `/design-review` 보정 기준.
- **학습:** 폰트 셀프호스팅(2MB)은 불필요. 문제는 호스팅이 아니라 **로딩 방식**이었음(논블로킹으로 해결).

## 구현된 것 (develop 기준)
- 정적 IA 8섹션(index.html) + SEO/OG + 점진적 향상(F2)
- 위젯 4종: 미니진단(캐닝)·LCS 나란히 데모(캐닝, 탭 키보드 네비)·창업자 스크롤리텔링(reduced-motion)·traction 티커(F1 fallback·캐시·aria-live)
- 리드 파이프라인: 리드폼(프라이버시 가드, 필드별 에러) + `/api/lead`·`/api/stats` CF Pages Function 프록시 + `apps-script/Code.gs`(stats 집계, PII 금지 F3)
- 디자인: 라이트/인디고 토큰(Pretendard 논블로킹·D2Coding), 상태표, 반응형/a11y
- 요금 4단계: 무료(활성) / 라이트 4,900·스탠다드 9,900·프로 14,900(준비 중, 비활성)
- OG 이미지 `assets/og-image.png`(1200×630) — `npm run gen:og`
- CI `.github/workflows/ci.yml` (vitest + playwright + build)

## 다음 세션 이관 항목 (순서)
1. **릴리스:** `develop` → `master` PR 머지 (디자인 수정·DESIGN.md·.dev.vars를 master로).
2. **배포 연결 (창업자 값 필요):**
   - `APPS_SCRIPT_URL` = 기존 devpath-landing-page Apps Script `/exec` URL → CF Pages 환경변수
   - 창업자 링크 StockPilot/LearnFlow 실제 URL (index.html 현재 `#`)
   - 도메인 `devpath.ai` 확정 (canonical/OG 절대경로 기준)
3. **창업자 대시보드 작업:**
   - Cloudflare Pages 프로젝트 생성 → 레포 연결 (build `npm run build`, output `dist`, env `APPS_SCRIPT_URL`)
   - Apps Script `Code.gs` Web App 배포 (`SHEET_ID` Script Property)
   - 도메인 DNS + SSL
4. **실배포 후:** `/design-review`로 라이브 도메인 재감사 + CORS 실검증(라이브 도메인에서 /api/* 호출).
5. **보류:** T8 한/영 i18n 토글. 폰트 셀프호스팅은 불필요(논블로킹으로 해결됨).

## 문서 위치
- `DESIGN.md` — 확정 디자인 시스템 (신규)
- `docs/plan/plan-master.md` — 마스터 플랜 (T1~T18 + 리뷰) · `design-doc.md` · `test-plan.md`
- 디자인 감사 리포트: `~/.gstack/projects/devpath-home-page/designs/design-audit-20260714/`

## 브랜치/CI/인프라 메모
- `master` 보호(릴리스). `develop` 통합. 작업은 `feat/*`·`fix/*`·`docs/*` → `develop` PR.
- **CI 게이팅 활성:** ci.yml이 `develop`·`master`에 있어 대상 PR 자동 검증.
- remote: `github.com/DevPathAi/devpath-home-page` (PR·머지 정상).
- 로컬 dev: `npm run dev` → http://127.0.0.1:4321
