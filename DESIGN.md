# DESIGN.md — DevPath AI 홈페이지 디자인 시스템

> 이 문서는 홈페이지의 확정 디자인 시스템이다. `/design-review`는 이 기준으로 보정한다.
> 출처: plan-master Design Spec(CEO+Eng+Design 리뷰) + 라이브 감사(2026-07-14).

## 분류
**MARKETING / LANDING PAGE.** 단, 아래 프로젝트 규칙이 gstack 일반 랜딩 룰보다 우선한다.
특히 "그라디언트 배경을 써라", "hero full-bleed" 같은 일반 룰은 이 프로젝트에서 **적용하지 않는다**(AI-slop 회피가 우선).

## 컬러 토큰 (CSS 변수, `assets/styles.css`)
- 브랜드/강조 텍스트: **인디고-600** `#4f46e5` (`--indigo-600`, primaryText)
- CTA 면 전용: **인디고-500** `#6366f1` (`--indigo-500`) — **텍스트 색으로 쓰지 말 것**
- CTA hover: 인디고-700 `#4338ca`
- 페이지 배경: **slate-50** `#f8fafc` (솔리드)
- 본문: slate-900 `#0f172a` · 보조: slate-500 `#64748b` · 부제: slate-700 `#334155`
- 보더(hairline): slate-200 `#e2e8f0`
- 상태: success `#059669` · danger `#dc2626`

## 타이포
- 본문/UI: **Pretendard** (`--font-sans`), 코드/LCS 답변: **D2Coding** (`--font-mono`)
- 폰트는 CDN(jsdelivr)에서 **논블로킹 로드**(`media="print" onload`) + `<noscript>` 폴백. `system-ui`를 디자인 폰트로 쓰지 않는다.
- 한글 본문 행간 1.6 · 헤드라인 1.2 · `word-break: keep-all`
- 본문 ≥16px · h1 clamp(2.25rem,5.2vw,3.25rem)

## 간격/형태
- **8pt 그리드** (`--space-1`=4 … `--space-8`=96)
- 버튼/카드 라운드 8 (`--radius`) · 콘텐츠 최대폭 1080px
- **장식 그림자 금지** — 면 구분은 hairline slate-200 보더로만

## 레이아웃 규칙 (지켜야 함)
- Hero: 에디토리얼. 좌(브랜드/헤드라인/CTA) + 우(인라인 미니진단, 인디고 상단 액센트). **카드 금지, 그라디언트 배경 금지.**
- 기능: **LCS 나란히 데모 = 전폭 앵커.** 진단/로드맵/멘토는 비대칭 보조 블록. **3열 균등 카드 금지.**
- 섹션당 한 가지 일. 모바일은 의도적 스택(무성의 스택 금지).
- 요금: 무료(활성) + 유료 3단계(준비 중, 비활성).

## AI-slop 금지 (전부 부재 유지)
그라디언트 배경 · 3열 균등 아이콘카드 · 컬러 서클 아이콘 · 전체 중앙정렬 · 균일 버블 라운드 ·
장식 blob/웨이브 · 이모지 장식 · 좌측 컬러보더 카드 · "Welcome to/Unlock" 카피 · 쿠키커터 섹션 리듬 · system-ui 디자인 폰트.

## 접근성 베이스라인
- `lang="ko"` · 대비 ≥4.5:1(인디고-600 6.5:1, slate-500 4.76:1)
- 터치 타깃 ≥44px(독립 링크/버튼; 인라인 텍스트 링크는 예외)
- `:focus-visible` 인디고 링 · skip-link
- `prefers-reduced-motion` 존중(스크롤리텔링·transition 정적 폴백)
- traction 갱신 `aria-live="polite"` · 리드폼 필드별 에러 `aria-invalid`/`aria-describedby`

## 성능
- 폰트 논블로킹(domReady ~19ms) · 위젯 lazy-load(IntersectionObserver + dynamic import)
- 이미지/위젯 min-height 예약(CLS 방지) · 초기 페이로드에 위젯 JS 미포함
