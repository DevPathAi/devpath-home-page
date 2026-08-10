# 설계 — 개발 기록(`/notes`) 콘텐츠 보강

- 작성일: 2026-08-10
- 대상 레포: `devpath-home-page`
- 배경 문서: `docs/superpowers/handoff-2026-08-10-adsense-live-content-next.md`(documents 레포)

## 1. 배경과 목표

애드센스 심사가 진행 중이다(콘솔 상태 `Getting ready`, 2026-08-10 확인). 거절의 최유력 사유는 **「가치 있는 콘텐츠 부족」**이며, 현재 `leva.ai.kr`의 배포 대상은 `index.html`(308줄, 전부 제품 소개)과 `privacy.html`(158줄) **두 페이지뿐**이다. 실질 콘텐츠 페이지는 0개다.

재신청에 횟수 제한은 없으나 심사 대기(수일~4주) 중에 미리 만들어 두는 것이 시간을 버는 유일한 방법이다.

**목표**: `leva.ai.kr`에 고유한 가치를 갖는 정적 콘텐츠 페이지를 신설하고, 크롤러가 이를 발견·색인할 수 있게 한다.

**성공 기준**
1. `/notes` 인덱스와 개별 글 페이지가 정적 HTML로 배포된다.
2. `sitemap.xml`이 원고 집합과 항상 일치한다(수동 갱신 불필요).
3. `index.html`에서 `/notes`로 가는 내부 링크가 존재한다.
4. 원고 누락·메타데이터 누락이 **빌드 실패로 드러난다**(조용한 누락 금지).

## 2. 비목표 (YAGNI)

- 태그·카테고리·검색·페이지네이션 — 글 6편에 불필요하다.
- RSS·댓글·공유 버튼.
- 광고 슬롯(`<ins class="adsbygoogle">`) 배치 — 승인 후 별도 결정.
- 다국어.
- 기존 `index.html`의 마케팅 카피 개편.

## 3. 콘텐츠 방침

### 3.1 성격

**창업자 1인칭 개발기**다. Leva를 만들며 실제로 부딪힌 문제와 그 해결 과정을 다룬다. 모든 글은 **측정값이 붙은 실화**여야 하며, 일반론·요약·튜토리얼 재탕은 싣지 않는다.

이는 구글의 「스케일된 콘텐츠 남용」 정책을 피하는 방법이기도 하다. 분량이 아니라 **다른 데서 구할 수 없는 고유성**이 심사 기준이다.

### 3.2 저자성 표기

개발은 AI 협업으로 진행됐다. 글을 「사람이 혼자 겪은 일」로 포장하지 않는다. AI를 사용해 개발했다는 사실을 숨기지 않는 톤으로 쓴다 — 사실에 부합하며, 「AI로 실제 서비스를 만들며 부딪힌 것들」이 오히려 더 희소한 콘텐츠다.

### 3.3 공개 금지 정보

다음은 어떤 글에도 싣지 않는다. 현상과 원인만 다루고 식별자는 마스킹한다.

- Cloudflare Account ID · Zone ID · API 토큰
- 사업자등록번호 · 대표자명 · 주소
- 내부 호스트명 · 실제 DB 이름 · 자격증명
- Apps Script `/exec` URL · 스프레드시트 ID

### 3.4 글 목록 (6편)

| # | slug | 제목(가제) | 핵심 |
|---|---|---|---|
| 1 | `cloudflare-zone-api-no-dns-import` | Cloudflare에 API로 존을 만들면 DNS 레코드를 하나도 안 가져온다 | 대시보드 온보딩과 달리 자동 스캔이 없다. 모르고 NS를 바꿨다면 메일과 하위 도메인이 즉시 죽었다. NS 변경 직전 1:1 대조가 막았다 |
| 2 | `surrogate-pair-broke-562-docs` | 이모지 하나가 문서 562개를 깨뜨렸다 | 청커가 UTF-16 코드유닛으로 잘라 서로게이트 쌍 한가운데를 절단 → 예외가 읽기가 아니라 **쓰기/인코딩**에서 발생. 실측 743중 562문서·5,246자 |
| 3 | `green-tests-empty-screen` | 테스트가 green인데 화면은 비어 있었다 | 신규 사용자에겐 값이 전부 0이라 막대 높이가 0인데, 테스트가 `toY:0`을 정확히 검증해 통과. 같은 계열 재발 4회 |
| 4 | `post-deploy-measurement-lies` | 배포 직후의 측정은 믿을 수 없다 | 엣지가 경로별로 옛/새 버전을 섞어 응답. 상태코드만 보면 SPA 폴백에 속는다 — content-type까지 확인해야 한다 |
| 5 | `empty-response-reported-success` | 빈 응답을 성공으로 보고하던 함수 | `text \|\| '{"ok":true}'` 한 줄로, 기록되지 않은 신청이 성공 화면으로 보였다. 같은 뿌리에서 soft-404가 나왔다 |
| 6 | `canvaskit-cannot-be-reviewed` | Flutter Web 앱은 애드센스 심사를 받을 수 없었다 | CanvasKit은 캔버스에 그린다 → 크롤러에게 빈 화면. 심사 대상이 앱이 아니라 홈페이지가 된 이유 |

분량은 편당 1,200~2,000자. **slug는 위 표의 값으로 확정**한다(URL이 되므로 이후 바꾸면 링크가 깨진다). 제목은 가제이며 원고 집필 시점에 확정한다 — 제목은 URL에 영향을 주지 않는다.

## 4. 아키텍처

### 4.1 파일 배치

```
content/notes/<slug>.md      원고 (frontmatter + 마크다운 본문)
templates/note.html          개별 글 레이아웃
templates/notes-index.html   인덱스 레이아웃
scripts/notes.mjs            원고 수집·검증·렌더·sitemap 생성 (순수 모듈)
build.mjs                    복사 빌드 후 scripts/notes.mjs 호출
```

렌더 로직을 `build.mjs`에 인라인하지 않고 `scripts/notes.mjs`로 분리한다. **테스트 가능성 때문이다** — 「원고가 0개면 빌드가 실패한다」·「slug가 중복이면 실패한다」 같은 단언은 실제 `content/notes/`를 비우거나 오염시키지 않고는 검증할 수 없다. 모듈이 **입력 디렉터리를 인자로 받으면** 테스트가 픽스처 디렉터리를 넘겨 검증할 수 있다.

노출 함수(입력 디렉터리를 인자로 받는다):

- `collectNotes(dir)` → 검증을 마친 원고 목록. 위반 시 throw
- `renderNote(note, template)` → 글 HTML 문자열
- `renderIndex(notes, template)` → 인덱스 HTML 문자열
- `renderSitemap(notes)` → sitemap XML 문자열

파일 쓰기는 `build.mjs`가 담당한다. 렌더 함수는 문자열만 반환해 테스트가 파일시스템 없이 단언할 수 있게 한다.

### 4.2 출력과 URL

| 원고 | dist 산출물 | 라이브 URL |
|---|---|---|
| `content/notes/<slug>.md` | `dist/notes/<slug>.html` | `https://leva.ai.kr/notes/<slug>` |
| (생성) | `dist/notes/index.html` | `https://leva.ai.kr/notes` |
| (생성) | `dist/sitemap.xml` | `https://leva.ai.kr/sitemap.xml` |

Cloudflare Pages가 `.html` 확장자를 떼는 clean URL로 308 리다이렉트하므로, 내부 링크·canonical·sitemap은 **모두 확장자 없는 형태**를 쓴다.

### 4.3 원고 형식

```markdown
---
title: 이모지 하나가 문서 562개를 깨뜨렸다
description: UTF-16 서로게이트 쌍을 코드유닛 인덱스로 자르면 무슨 일이 벌어지는가.
date: 2026-08-10
---

본문 마크다운…
```

`title`·`description`·`date` 세 키는 **필수**다. slug는 파일명에서 온다.

frontmatter 파싱은 자체 구현한다(의존성 추가 없음). 마크다운 → HTML 변환만 `marked`를 쓴다. 입력이 우리가 작성한 원고이므로 sanitize는 하지 않는다.

### 4.4 빌드 흐름

`build.mjs`는 기존 `DEPLOY_ENTRIES` 화이트리스트 복사를 마친 뒤 이어서 수행한다:

1. `content/notes/*.md`를 읽어 frontmatter를 파싱한다.
2. 각 원고를 `templates/note.html`에 끼워 `dist/notes/<slug>.html`로 쓴다.
3. `date` 내림차순으로 정렬해 `dist/notes/index.html`을 생성한다. **같은 날짜면 slug 사전순**으로 안정 정렬한다(정렬이 빌드마다 흔들리면 sitemap과 인덱스에 무의미한 diff가 생긴다).
4. 고정 경로(`/`, `/privacy`, `/notes`)와 모든 글 URL로 `dist/sitemap.xml`을 생성한다.

`sitemap.xml`은 더 이상 레포에 정적 파일로 두지 않고 **생성물**이 된다. 현재 레포 루트의 `sitemap.xml`은 삭제하고 `DEPLOY_ENTRIES`에서도 뺀다.

### 4.5 빌드 실패 정책

현재 `build.mjs`는 없는 엔트리를 `ENOENT`로 조용히 건너뛴다. 그 관용이 「파일만 만들고 배포에서 누락」 함정의 근원이다. 신규 파이프라인은 반대 방향을 택한다 — **조용한 성공보다 시끄러운 실패**.

다음 경우 빌드를 중단하고 0이 아닌 종료 코드를 낸다:

- frontmatter에 `title`·`description`·`date` 중 하나라도 없다
- `date`가 `YYYY-MM-DD` 형식이 아니다
- 두 원고가 같은 slug를 갖는다
- `content/notes/`에 원고가 하나도 없다

기존 화이트리스트 복사의 `ENOENT` 관용은 그대로 둔다(`_redirects`·`favicon.ico`가 목록에만 있고 파일이 없는 상태가 의도된 허용이다).

### 4.6 페이지 구성

**개별 글** — `privacy.html`과 동일한 헤더/푸터를 쓴다.

- `<title>` = `{title} — Leva`
- `<meta name="description">` = frontmatter `description`
- `<link rel="canonical">` = `https://leva.ai.kr/notes/{slug}` (확장자 없음)
- `<meta name="robots" content="index, follow">`
- Open Graph: `og:type=article`, `og:title`, `og:description`, `og:url`, 기존 `og-image.png` 재사용
- `Article` JSON-LD: `headline`·`datePublished`·`author`(조직명 `Leva`)
- `<head>`에 애드센스 스크립트 — `index.html`과 **동일한 형태**로 넣는다. 퍼블리셔 ID와 `ads.txt`는 건드리지 않는다. 광고 슬롯(`<ins>`)은 넣지 않는다
- 본문 상단에 제목·작성일, 하단에 「목록으로」 링크

**인덱스 `/notes`** — 제목·작성일·`description`을 최신순 목록으로. canonical은 `https://leva.ai.kr/notes`. 애드센스 스크립트를 동일하게 포함한다.

### 4.7 발견 가능성

sitemap만으로는 부족하다. `index.html` 헤더 내비게이션에 `/notes` 링크를 추가해 크롤러가 실제 링크를 타고 들어오게 한다.

## 5. 기존 자산에 생기는 변화

| 자산 | 변화 | 이유 |
|---|---|---|
| `sitemap.xml` (루트) | **삭제** — 생성물로 전환 | 글 추가 시 수동 갱신 누락 방지 |
| `tests/crawler-surface.test.js` | sitemap 관련 단언 3건 교체 — ①「`DEPLOY_ENTRIES`에 `sitemap.xml`이 있다」 **삭제**(생성물이라 화이트리스트 대상이 아니다) ②「정확히 2개 URL」 → 원고 집합과의 일치 ③「`.html` 미포함」은 유지 | 하드코딩 대조 → **집합 일치 검증**으로 승격 |
| `build.mjs` | `DEPLOY_ENTRIES`에서 `sitemap.xml` 제거, 렌더 단계 추가 | 위와 같음 |
| `index.html` | 헤더 내비에 `/notes` 추가 | 발견 가능성 |
| `package.json` | `marked`를 `devDependencies`에 추가, `description`의 「DevPath AI」를 「Leva」로 교정 | 렌더 / 브랜드 잔재 |

`package.json:6`의 `description`은 아직 구 브랜드가 남아 있다. 이 작업에서 함께 정리한다.

## 6. 테스트

`vitest`로 검증한다. 기존 스위트(9파일 85건)를 깨지 않는다.

검증 대상은 `scripts/notes.mjs`의 노출 함수다(§4.1). 실패 경로(필수 키 누락·형식 오류·slug 중복·원고 0개)는 `tests/fixtures/` 아래 **의도적으로 잘못된 픽스처 디렉터리**를 만들어 `collectNotes(dir)`에 넘겨 검증한다. 실제 `content/notes/`를 훼손하지 않는다.

| 대상 | 단언 |
|---|---|
| frontmatter 파서 | 필수 키 누락 시 throw · 정상 입력에서 세 값과 본문 분리 |
| `date` 검증 | `YYYY-MM-DD`가 아니면 throw |
| slug 중복 | 같은 slug 두 개면 throw |
| 원고 0개 | 빌드가 실패한다 |
| 렌더 | 마크다운 본문이 HTML로 변환돼 레이아웃에 들어간다 |
| canonical | 각 글이 자기 URL을 가리키고 `.html`을 포함하지 않는다 |
| **sitemap 일치** | `content/notes/*.md` 집합 == sitemap `<loc>`의 글 URL 집합 |
| sitemap 고정 경로 | `/`, `/privacy`, `/notes`가 포함된다 |
| 인덱스 | 모든 글로 가는 링크가 존재하고 최신순이다 |
| 발견 가능성 | `index.html`에 `/notes` 링크가 존재한다 |
| 애드센스 | 글 페이지 `<head>`에 스크립트가 있고, `<ins class="adsbygoogle">`는 없다 |
| 공개 금지 정보 | 원고 전체에 금지 패턴(Account/Zone ID 형태의 32자리 hex, 사업자등록번호, `script.google.com/macros`)이 없다 |
| 빌드 산출물 | `npm run build` 후 `dist/notes/`에 글 수만큼 파일과 `index.html`이 존재한다 |

마지막 「공개 금지 정보」 테스트는 §3.3을 기계적으로 강제한다 — 사람이 매번 눈으로 확인하는 방식은 실패한다.

## 7. 위험과 대응

| 위험 | 대응 |
|---|---|
| 심사 중 `<head>` 변경이 심사에 영향 | 퍼블리셔 ID·`ads.txt`·기존 `index.html`의 스크립트는 건드리지 않는다. 신규 페이지에 동일 스크립트를 넣는 것은 기존 설정 변경이 아니다 |
| 글이 「AI 대량 생성」으로 보임 | 6편, 각각 고유한 측정값과 실패 서사. 일반론 금지(§3.1) |
| 배포 누락 | sitemap·인덱스가 생성물이고 테스트가 집합 일치를 단언한다 |
| 내부 정보 유출 | §3.3 금지 목록 + 기계 검증 테스트(§6) |
| 배포는 수동이다 | 이 레포의 Pages 프로젝트는 **직접 업로드**다. `develop` 머지만으로 배포되지 않으며 `npm run build` 후 `wrangler pages deploy dist`가 필요하다 |

## 8. 이 설계가 다루지 않는 것

- 리드 수집 복구(`APPS_SCRIPT_URL` 주입 + Apps Script 재배포) — 별건이며 사용자 콘솔 작업에 걸려 있다.
- `devpath-landing-page`의 인터뷰 기능 이식 — 핸드오프의 우선순위 ②.
- 앱(`devpath-frontend`) 릴리스.
