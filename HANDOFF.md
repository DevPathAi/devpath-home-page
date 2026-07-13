# DevPath AI 홈페이지 — 다음 세션 핸드오프

> 작성: 2026-07-13 · 상태: **설계·리뷰 완료, 구현 미착수**
> 이 세션은 `/office-hours → /plan-ceo-review → /plan-eng-review → /plan-design-review` 파이프라인을 돌려 홈페이지 설계·리뷰만 수행했다. 코드는 작성하지 않았다.

## 지금까지 (요약)
- **제품:** DevPath AI (AI 개발자 학습 플랫폼). 이 레포는 정식 마케팅 홈페이지.
- **확정 방향:** 주 CTA "내 실력 진단받기" / A→C 단계적(정적 우선 → 라이브 데모·지표) / 기존 `devpath-landing-page` 리드 파이프라인(Apps Script→Sheets) 통합.
- **스코프(EXPANSION):** 인터랙티브 위젯 4종 — 무가입 미니진단, LCS 나란히 데모, traction 티커, 창업자 스크롤리텔링. ("한국 최초" 등 최상급 표현 전면 제외.)
- **스택:** 바닐라 ES모듈 + Vitest(유닛) + Playwright(E2E 1). 프레임워크·번들러·애니메이션 라이브러리 없음. 배포 = Cloudflare Pages.
- **디자인:** 에디토리얼 Hero + 인라인 미니진단 / LCS 전폭 앵커(3열 그리드 금지) / DESIGN.md 토큰 상속(인디고-600 텍스트, 인디고-500 면, slate, Pretendard, LCS 코드=D2Coding) / 인디고 그라디언트 배경 금지.
- **리뷰 상태:** CEO + Eng + Design 모두 CLEARED, critical gap 0.

## 문서 위치
- `docs/plan/plan-master.md` — **마스터 플랜** (CEO+Eng+Design 리뷰 전부 + 태스크 T1~T18 + 리뷰 리포트)
- `docs/plan/design-doc.md` — office-hours 설계 문서
- `docs/plan/test-plan.md` — 테스트 플랜
- 원본(gstack): `~/.gstack/projects/devpath-home-page/`

## 다음 세션 이관 항목 (열린 결정/액션)

1. **구현 시작.** `docs/plan/plan-master.md`의 T1~T18로 착수. 순서: T1(레포 부트스트랩+Cloudflare Pages) → T2 정적 IA / T14 토큰 → 위젯(T5·T6·T7) → 상태·테스트(T11·T16) → 나머지. 병렬 레인은 plan-master 참조. **구현은 명시 지시 시에만 착수.**
2. **목업 먼저 (선택).** `~/.gstack/openai.json`에 OpenAI 키(`{"api_key":"sk-..."}`)를 넣고 `/plan-design-review` 재실행 → Hero 3변형 비주얼 생성. (이번 세션은 키 없어 텍스트 리뷰만 진행.)
3. **한/영 이중언어 토글 — 미결정.** 유일하게 남은 열린 결정. 현재 TODOS 후보. 투자자/글로벌 대상이면 채택, 아니면 스킵.

## 주의 (리뷰 내내 반복된 긴장)
홈페이지가 **알파 데모와 시간을 다투면 안 된다.** 본선을 이기는 건 홈페이지가 아니라 동작하는 알파(진단→로드맵→AI멘토). T1~T18 총 인간공수 ~2주. 알파 스프린트 대비 우선순위·타임박스는 창업자 판단.

## 인프라 미결 (푸쉬 관련)
- 이 레포는 **git remote 미설정**. 푸쉬하려면 remote 필요.
- 로컬 `gh`는 `VelkaressiaBlutkrone` 계정 로그인(세션 git user `Qahnaarin`과 상이). 조직 `DevPathAi` 사용 여부·계정 정합성 확인 후 remote 연결.
- git-branch-flow 규칙: `main` 보호. 최초 커밋 후 `develop` 생성, 작업은 `feat/*`→`develop` PR.
