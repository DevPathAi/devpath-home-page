# DevPath AI 홈페이지 — 다음 세션 핸드오프

> 갱신: 2026-07-14 · 상태: **T1~T18 구현 완료, `develop` 반영. 배포 전 후속 작업 남음.**

## 지금까지 (요약)
- **제품:** DevPath AI (AI 개발자 학습 플랫폼). 이 레포는 정식 마케팅 홈페이지.
- **구현 완료:** plan-master의 **T1~T18 전부** + 요금 4단계. `feat/home-t1-t14` → PR #1/#2로 `develop` 머지됨.
- **스택:** 바닐라 ES모듈 + Vitest + Playwright + CI(GitHub Actions). 배포 = Cloudflare Pages.
- **검증:** 유닛 32 + E2E 6 통과. CI(Linux/Node 24) 녹색.

## 구현된 것 (develop 기준)
- **정적 IA 8섹션**(index.html) + SEO/OG + 점진적 향상(F2)
- **위젯 4종:** 미니진단(캐닝)·LCS 나란히 데모(캐닝, 탭 키보드 네비)·창업자 스크롤리텔링(reduced-motion)·traction 티커(F1 fallback·캐시·aria-live)
- **리드 파이프라인:** 리드폼(프라이버시 가드) + `/api/lead`·`/api/stats` CF Pages Function 프록시 + `apps-script/Code.gs`(stats 집계, PII 금지 F3)
- **디자인:** 라이트/인디고 토큰(Pretendard·D2Coding), 상태표(로딩·에러·성공), 반응형/a11y
- **요금:** 무료(활성) / 라이트 4,900·스탠다드 9,900·프로 14,900(준비 중, 비활성)
- **OG 이미지:** `assets/og-image.png`(1200×630) — `npm run gen:og`로 재생성
- **CI:** `.github/workflows/ci.yml` (vitest + playwright + build)

## 배포 전 후속 (창업자 액션 필요)
1. **Cloudflare Pages 연결:** build `npm run build`, output `dist`. 환경변수 `APPS_SCRIPT_URL` = 기존 devpath-landing-page Apps Script `/exec` URL.
2. **Apps Script 배포:** `apps-script/Code.gs`를 Web App으로 배포(SHEET_ID Script Property 설정).
3. **창업자 링크:** index.html의 StockPilot/LearnFlow 링크 placeholder → 실제 URL.
4. **도메인:** `devpath.ai` 연결 확인.

## 열린 결정 / 잔여 태스크
- **T8 한/영 이중언어 토글** — 보류 중(투자자/글로벌 대상이면 채택).
- **폰트 셀프호스팅** — 현재 Pretendard/D2Coding은 jsdelivr CDN. 안정성 위해 셀프호스팅 검토.
- **릴리스:** 준비되면 `develop` → `master` PR(2단계 PR 흐름). 이후 실배포.
- **라이브 QA:** 실배포 후 `/design-review`로 라이브 디자인 QA.

## 문서 위치
- `docs/plan/plan-master.md` — 마스터 플랜 (T1~T18 + CEO/Eng/Design 리뷰)
- `docs/plan/design-doc.md` — 설계 문서 · `docs/plan/test-plan.md` — 테스트 플랜

## 브랜치/CI 메모
- `master` 보호(릴리스). `develop` 통합. 작업은 `feat/*`→`develop` PR.
- **CI 게이팅:** ci.yml이 `develop`에 안착 → 이후 `develop` 대상 PR은 자동 CI 검증. (최초 도입 시엔 base에 워크플로가 없어 push 이벤트 CI로 검증했음.)
- remote: `github.com/DevPathAi/devpath-home-page` (정상 동작 확인, PR·머지 성공).
