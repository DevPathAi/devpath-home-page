# DESIGN.md — Leva 홈페이지 디자인 계약

> 이 문서는 홈페이지에 적용되는 마케팅 사용 규칙을 설명한다. semantic token 값의
> 기준은 앱 코드의 `DpSemanticTokenManifest 1.0.0`, layout 폭의 기준은
> `AppTokens.standard`, breakpoint의 기준은 `src/layout/dp_window_class.dart`다.
> 홈페이지는 이를 `assets/tokens.css`에 그대로 mirror한다.

## 역할과 source of truth

- `devpath-frontend/packages/dp_design/lib/src/theme/`와 `src/layout/dp_window_class.dart`는 각각 token/layout 값과 breakpoint 값의 canonical source다.
- frontend `DESIGN.md`는 공통 의도와 허용 사용 규칙의 source of truth이며, 이 문서는 그 계약을 홈페이지 구성에 적용한다.
- `assets/tokens.css`는 홈페이지 전용 mirror이자 홈페이지에서 semantic 값을 선언할 수 있는 유일한 파일이다.
- `assets/styles.css`와 기능별 CSS는 custom property를 소비하며 색상·간격·반경 값을 다시 선언하지 않는다.
- 이 문서는 값 목록을 복제하지 않고 의미, 허용 용도, 접근성, 반응형 사용 규칙을 고정한다.
- 가격, beta 상태, 기능 가용성은 현재 운영·제품 source of truth를 따른다. 디자인 문서에 플랜 수를 고정하지 않는다.

## 분류와 미감

**MARKETING / LANDING PAGE.** 앱과 같은 warm neutral ground, ink hierarchy, amber accent를 쓰되 마케팅 화면은 더 에디토리얼하게 구성할 수 있다.

- 장식 그림자보다 surface와 1px border로 위계를 만든다.
- amber는 primary action, 현재 진행, 획득한 완료에만 쓴다.
- warning은 실제 경고에만 쓴다. 강조가 필요하다는 이유로 warning을 대신 쓰지 않는다.
- 장식용 gradient, 균등 아이콘 카드, blob, glass effect, 과도한 pill, AI orb를 쓰지 않는다.

## 컬러 의미

- Ground: `--dp-color-bg` → `--dp-color-surface` → `--dp-color-surface-muted`의 세 단계만 사용한다.
- Ink: 제목·본문은 `--dp-color-text-primary`, 보조 설명은 `--dp-color-text-secondary`를 쓴다.
- Faint: `--dp-color-text-faint`는 메타데이터나 비활성 설명에만 사용하며 본문에는 쓰지 않는다.
- Primary: `--dp-color-primary`는 면 채움 전용이다. 텍스트와 focus ring은 `--dp-color-primary-text`를 쓴다.
- Selection: 선택 면과 선은 `--dp-color-accent-soft`, `--dp-color-accent-line`을 함께 쓴다.
- State: success, warning, danger는 실제 상태를 전달할 때만 사용하고 텍스트나 아이콘을 함께 제공한다.
- Chart와 code surface 토큰은 브랜드 accent와 분리한다.
- light/dark 값은 모두 contract에 있지만, 홈페이지의 theme activation 정책은 별도 기능 변경으로 다룬다.

## 타이포그래피

- UI와 본문은 Pretendard, 코드와 고정폭 데이터는 D2Coding을 쓴다.
- 폰트는 CDN에서 non-blocking으로 로드하고 `<noscript>` fallback을 유지한다.
- 한글 본문 행간은 1.6, 제목은 manifest의 TextTheme 비율을 따른다.
- 마케팅 본문은 최소 16px, 장문 읽기 surface는 16–18px를 사용한다.
- 제목과 본문은 `word-break: keep-all`을 기본으로 하되 긴 식별자에는 안전한 wrap을 허용한다.

## 간격과 형태

- 간격은 4/8/12/16/24/32/48px scale만 사용한다. 더 큰 section 간격은 이 값의 `calc()` 조합으로 만든다.
- button/input radius는 8px, panel/card는 10px, compact tag는 12px를 기준으로 한다.
- pill은 tag/status처럼 작은 상태 표현에만 허용한다.
- 콘텐츠 최대폭은 1440px, 읽기 최대폭은 880px다.
- 독립된 링크와 control의 hit target은 최소 44×44px다.

## 반응형 계약

- Compact: 320–599px
- Medium: 600–839px
- Expanded: 840–1239px
- Large: 1240px 이상

경계는 viewport의 논리적 width 하나로 판단하며 orientation 전용 breakpoint를 만들지 않는다. 320px에서도 가로 overflow가 없어야 한다. 모바일 navigation은 단순히 숨기지 않고 접근 가능한 대체 진입점을 제공해야 한다.

## 레이아웃 규칙

- Hero는 가치 제안, primary action, 실제 결과 preview의 순서를 유지한다. 시각 장식이 결과 증거보다 앞서지 않는다.
- 결과 preview와 Evidence Block은 앱의 realistic fixture schema를 사용한다. Flutter widget을 HTML로 복제하지 않는다.
- 기능 설명은 대표 journey의 순서로 읽혀야 하며 같은 무게의 반복 카드 묶음으로 만들지 않는다.
- section마다 primary action은 최대 하나다. 보조 행동은 outline 또는 text action으로 낮춘다.
- 콘텐츠와 legal page는 readable width를 우선하고 코드·표만 의미상 필요한 내부 가로 스크롤을 허용한다.

## 상태와 상호작용

- default/hover/pressed/focus/selected/disabled/error 역할은 `assets/tokens.css`의 state mapping을 쓴다.
- focus ring은 2px `--dp-color-primary-text`이며 요소 바깥에 충분한 offset을 둔다.
- loading은 layout shift를 막고, partial/error에서도 마지막으로 유효한 콘텐츠를 유지한다.
- 오류는 원인, 보존된 것, 가능한 다음 행동 순으로 설명한다.
- `prefers-reduced-motion: reduce`에서는 위치 이동, shimmer, 불필요한 transition을 제거한다.
- 동적 상태는 적절한 `aria-live`, form 오류는 `aria-invalid`와 `aria-describedby`를 사용한다.

## 접근성과 검증

- 본문·버튼은 WCAG AA 대비를 통과해야 한다. 색만으로 상태를 구분하지 않는다.
- keyboard-only flow, 200% text, reduced motion, long Korean copy를 검증한다.
- Compact 320/599, Medium 600/839, Expanded 840/1239, Large 1240 이상 경계에서 overflow와 focus order를 확인한다.
- 토큰 parity test는 이름 존재뿐 아니라 light/dark 값, state mapping, contract version을 비교한다.

## 성능

- 초기 화면에 필요하지 않은 위젯 JS는 lazy hydrate한다.
- 이미지와 비동기 widget은 크기를 예약해 CLS를 막는다.
- production `dist`에서 모든 stylesheet와 asset reference가 유효한지 검증한다.
