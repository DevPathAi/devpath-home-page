# 홈페이지 콘텐츠 확장 구현 계획 (`/beta` · `/about` · 홈 FAQ)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 베타 안내(`/beta`)와 회사 소개(`/about`) 페이지를 만들고 홈에 FAQ를 더해, 심사가 읽을 공개 콘텐츠를 늘리면서 신청 직전의 불확실성을 없앤다.

**Architecture:** `privacy.html` 패턴을 따르는 정적 HTML 두 장을 추가한다. 배포 화이트리스트(`build.mjs`)와 sitemap 고정 경로(`scripts/notes.mjs`)가 수동 목록이라, 셋의 일치를 테스트로 강제하는 가드를 **먼저** 만들고 그 위에 페이지를 얹는다.

**Tech Stack:** 바닐라 HTML/CSS/ES모듈 · vitest 2.1.9 · 번들러 없음

**Spec:** `docs/superpowers/specs/2026-08-11-content-expansion-beta-about-faq-design.md`

## Global Constraints

- 대상 레포는 `devpath-home-page` 하나다. 앱(`devpath-frontend`)은 건드리지 않는다.
- 작업 브랜치는 `develop`에서 분기한다. `develop`·`main`에 직접 커밋하지 않는다.
- **URL은 확장자 없는 clean URL이고 트레일링 슬래시를 붙이지 않는다** — `/beta`, `/about`. 파일 기반 경로라 `/privacy`와 같다. (디렉터리 인덱스인 `/notes/`만 슬래시가 붙는다)
- 퍼블리셔 ID는 `ca-pub-2785578834914321`. 신규 페이지에 스크립트만 동일하게 넣고 **광고 슬롯(`<ins class="adsbygoogle">`)은 넣지 않는다.**
- 브랜드는 `Leva`다. `DevPath`를 새로 쓰지 않는다.
- **공개 금지:** CF Account/Zone ID·API 토큰, Apps Script `/exec` URL, 스프레드시트 ID, 내부 호스트명, 사업장 주소.
- **게시 허용(이미 게시 중):** 상호 `레바`, 사업자등록번호 `796-76-00732`, 성명 `김민구`(처리방침의 개인정보 보호책임자).
- **확정된 사실만 쓴다.** 초대 소요 기간처럼 정해지지 않은 것은 약속하지 않는다.
- 기존 테스트 **141건**을 깨지 않는다. 확인 명령은 `npx vitest run`.
- 원고는 **사람이 직접 쓴다.** 서브에이전트에 위임하지 않는다 — 조사 맥락이 없으면 일반론이 되고, 그건 심사가 정확히 거르는 것이다.

## 확정 사실 (원고에 쓸 수 있는 것)

- 베타 초대 방식: **신청 순서대로 순차 승인**
- 베타에서 쓸 수 있는 것: **적응형 진단 + 맞춤 로드맵**, **AI 멘토(LCS)**, **커뮤니티 Q&A**
- 비용: **베타 기간 전체 무료**
- 유료 플랜: **준비 중**(홈 요금 섹션에 이미 명시)
- 연락처: `info@leva.ai.kr`

## File Structure

| 파일 | 책임 |
|---|---|
| `tests/static-pages.test.js` (신규) | 루트 html · `DEPLOY_ENTRIES` · sitemap 고정 경로의 3자 일치 가드 |
| `beta.html` (신규) | 베타 안내 |
| `about.html` (신규) | 만드는 사람과 회사 |
| `build.mjs` (수정) | `DEPLOY_ENTRIES`에 두 페이지 추가 |
| `scripts/notes.mjs` (수정) | `STATIC_PAGES`에 두 경로 추가 |
| `index.html` (수정) | FAQ 섹션 신설 · 헤더/푸터 내비 |
| `privacy.html` (수정) | 푸터 내비 통일 |
| `templates/note.html` (수정) | 푸터 내비 통일 |
| `templates/notes-index.html` (수정) | 푸터 내비 통일 |
| `robots.txt` (수정) | `Mediapartners-Google` 그룹 명시 |
| `assets/styles.css` (수정) | FAQ 섹션 스타일 |
| `tests/nav-consistency.test.js` (신규) | 모든 페이지 푸터가 공통 링크를 담는지 |
| `tests/beta-about-pages.test.js` (신규) | 신규 페이지의 head·애드센스·폼·금지 정보 |

---

### Task 1: 정적 페이지 3자 일치 가드

가드를 먼저 만든다. 지금 상태(`index`·`privacy`)로 green이어야 하고, 이후 페이지를 추가할 때 세 곳 중 하나라도 빠뜨리면 red가 된다.

**Files:**
- Create: `tests/static-pages.test.js`

**Interfaces:**
- Consumes: `build.mjs`의 `DEPLOY_ENTRIES`, `scripts/notes.mjs`의 `renderSitemap`
- Produces: 없음 (가드 전용)

- [ ] **Step 1: 가드 테스트를 쓴다**

`tests/static-pages.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectNotes, renderSitemap } from '../scripts/notes.mjs';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

// 404는 noindex라 sitemap에 실리면 안 된다. 유일한 예외로 못박는다.
const NOINDEX_PAGES = ['404.html'];

function deployEntries() {
  const m = readFileSync(root('build.mjs'), 'utf-8').match(/const DEPLOY_ENTRIES = \[([^\]]*)\]/);
  if (!m) throw new Error('DEPLOY_ENTRIES를 찾지 못했다');
  return m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

// 정적 페이지는 파일·배포목록·sitemap 세 곳을 손으로 맞춰야 한다.
// 하나라도 빠지면 조용히 배포에서 빠지거나 색인에서 빠진다.
describe('정적 페이지 3자 일치', () => {
  const files = readdirSync(root('.'))
    .filter((f) => f.endsWith('.html'))
    .filter((f) => !NOINDEX_PAGES.includes(f))
    .sort();

  it('루트의 모든 html이 배포 화이트리스트에 있다', () => {
    const entries = deployEntries();

    expect(files.filter((f) => !entries.includes(f))).toEqual([]);
  });

  it('noindex 페이지도 배포는 된다', () => {
    const entries = deployEntries();

    expect(NOINDEX_PAGES.filter((f) => !entries.includes(f))).toEqual([]);
  });

  it('루트의 모든 html이 sitemap 고정 경로에 있다', () => {
    const xml = renderSitemap(collectNotes(root('content/notes')));
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    // index.html → https://leva.ai.kr/ , privacy.html → https://leva.ai.kr/privacy
    const expected = files.map((f) =>
      f === 'index.html' ? 'https://leva.ai.kr/' : `https://leva.ai.kr/${f.replace(/\.html$/, '')}`,
    );

    expect(expected.filter((u) => !locs.includes(u))).toEqual([]);
  });

  it('noindex 페이지는 sitemap에 없다', () => {
    const xml = renderSitemap(collectNotes(root('content/notes')));

    expect(xml).not.toContain('/404');
  });
});
```

- [ ] **Step 2: 지금 상태로 통과하는지 확인한다**

Run: `npx vitest run tests/static-pages.test.js`
Expected: PASS (4건). 현재 루트 html은 `index.html`·`privacy.html`·`404.html` 셋이고, 앞의 둘은 `DEPLOY_ENTRIES`와 `STATIC_PAGES`에 모두 있다.

만약 실패하면 **가드가 맞고 현재 상태가 틀린 것**이다. 그 경우 무엇이 어긋났는지 확인하고 보고한 뒤 멈춘다.

- [ ] **Step 3: 가드가 실제로 잡는지 확인한다(일시적 red 확인)**

`build.mjs`의 `DEPLOY_ENTRIES`에서 `'privacy.html'`을 잠깐 지운다.

Run: `npx vitest run tests/static-pages.test.js`
Expected: FAIL — "루트의 모든 html이 배포 화이트리스트에 있다"

확인 후 **반드시 되돌린다**. 되돌린 뒤 다시 Run 해서 PASS를 확인한다.

이 단계를 건너뛰지 않는다. 가드가 통과하는 것만 보고 넘어가면, 실제로는 아무것도 검사하지 않는 테스트를 통과로 착각할 수 있다.

- [ ] **Step 4: 전체 스위트**

Run: `npx vitest run`
Expected: 141 + 4 = 145건 통과

- [ ] **Step 5: 커밋**

```bash
git add tests/static-pages.test.js
git commit -m "test(pages): 정적 페이지의 파일·배포목록·sitemap 일치를 강제한다"
```

---

### Task 2: `/beta` 베타 안내 페이지

**Files:**
- Create: `beta.html`
- Modify: `build.mjs` (`DEPLOY_ENTRIES`)
- Modify: `scripts/notes.mjs` (`STATIC_PAGES`)
- Create: `tests/beta-about-pages.test.js`

**Interfaces:**
- Consumes: Task 1의 3자 일치 가드
- Produces: `/beta` 페이지. Task 4(홈 FAQ)가 여기로 링크한다.

- [ ] **Step 1: 「아직 없는 것」에 쓸 항목을 사용자에게 확인한다**

원고 §5에 들어갈 내용이다. 코드에서 알 수 없는 운영 사실이므로 추측하지 않는다.

확인할 것: 베타에서 **아직 안 되는 것**이 무엇인지(예: 특정 스택만 지원, 모바일 앱 없음, 커뮤니티 기능 일부 미구현 등).

확정된 것은 이것 하나다 — **유료 플랜은 준비 중이고 베타 기간에는 과금이 없다.** 사용자가 추가 항목을 주지 않으면 이 항목만 쓰고 넘어간다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`tests/beta-about-pages.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf-8');

// 정적 페이지는 원고와 금지 목록이 다르다. 사업자등록번호와 성명은
// 처리방침·푸터에 이미 의도적으로 게시돼 있다.
const FORBIDDEN = [
  { name: 'CF Account/Zone ID', re: /\b[0-9a-f]{32}\b/ },
  { name: 'Apps Script 배포 URL', re: /script\.google\.com\/macros/ },
];

describe('/beta 페이지', () => {
  const html = read('beta.html');

  it('canonical이 확장자·슬래시 없는 자기 URL이다', () => {
    expect(html).toContain('<link rel="canonical" href="https://leva.ai.kr/beta" />');
    expect(html).toContain('<meta property="og:url" content="https://leva.ai.kr/beta" />');
  });

  it('색인을 허용한다', () => {
    expect(html).toMatch(/<meta name="robots" content="index, follow"/);
  });

  it('애드센스 스크립트는 넣되 광고 슬롯은 넣지 않는다', () => {
    expect(html).toContain('ca-pub-2785578834914321');
    expect(html).not.toContain('adsbygoogle"');
  });

  // 위젯은 [data-widget] 셀렉터로 마운트되므로 main.js가 있어야 동작한다.
  it('신청 폼 위젯과 그 위젯을 마운트할 스크립트가 함께 있다', () => {
    expect(html).toContain('data-widget="lead-form"');
    expect(html).toMatch(/<script[^>]+src="\/src\/main\.js"/);
  });

  it('확정되지 않은 초대 기간을 약속하지 않는다', () => {
    expect(html).not.toMatch(/며칠|영업일|\d+일 (안에|이내)/);
  });

  it.each(FORBIDDEN)('$name을(를) 담지 않는다', ({ re }) => {
    expect(re.test(html)).toBe(false);
  });
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npx vitest run tests/beta-about-pages.test.js`
Expected: FAIL — `beta.html` 없음(ENOENT)

- [ ] **Step 4: 페이지 골격을 만든다**

`beta.html`. `privacy.html`의 구조를 따르되 애드센스 스크립트와 내비를 넣는다.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>베타 안내 — Leva</title>
  <meta name="description" content="Leva 베타에서 무엇을 쓸 수 있는지, 초대는 어떻게 되는지, 비용은 어떻게 되는지 안내합니다." />
  <link rel="canonical" href="https://leva.ai.kr/beta" />
  <meta name="robots" content="index, follow" />

  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2785578834914321"
          crossorigin="anonymous"></script>

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Leva" />
  <meta property="og:title" content="베타 안내 — Leva" />
  <meta property="og:description" content="Leva 베타에서 무엇을 쓸 수 있는지, 초대는 어떻게 되는지, 비용은 어떻게 되는지 안내합니다." />
  <meta property="og:url" content="https://leva.ai.kr/beta" />
  <meta property="og:image" content="https://leva.ai.kr/assets/og-image.png" />
  <meta property="og:locale" content="ko_KR" />

  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
  <link rel="stylesheet" href="/assets/styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="container site-header__inner">
      <a class="wordmark" href="/">Leva</a>
      <nav class="site-nav" aria-label="주요">
        <a href="/">홈</a>
        <a href="/notes/">개발 기록</a>
        <a href="/about">소개</a>
      </nav>
    </div>
  </header>

  <main id="main" class="container legal note">
    <h1>베타 안내</h1>
    <p class="legal__meta">2026년 8월 11일 기준</p>

    <!-- 본문은 Step 5에서 사람이 쓴다 -->

    <h2>신청하기</h2>
    <div id="lead-form-root" data-widget="lead-form">
      <div class="widget-fallback lead-form__fallback surface">
        <p>이메일로 진단 초대와 로드맵 안내를 보내드립니다.</p>
        <a class="btn btn-primary" href="mailto:info@leva.ai.kr?subject=Leva%20베타%20초대%20신청">이메일로 초대 신청</a>
      </div>
    </div>
  </main>

  <footer class="site-footer">
    <div class="container site-footer__inner">
      <p class="site-footer__brand">Leva</p>
      <nav class="site-footer__links" aria-label="푸터">
        <a href="/">홈</a>
        <a href="/beta">베타 안내</a>
        <a href="/about">소개</a>
        <a href="/notes/">개발 기록</a>
        <a href="/privacy">개인정보 처리방침</a>
        <a href="mailto:info@leva.ai.kr">연락</a>
      </nav>
      <p class="site-footer__biz">레바 | 사업자등록번호 796-76-00732</p>
      <p class="site-footer__copy">© 2026 Leva</p>
    </div>
  </footer>

  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 5: 본문을 쓴다 (사람이 직접)**

`<h1>` 다음, `<h2>신청하기</h2>` 앞에 넣는다. 순서는 스펙 §4.1을 따른다.

1. `<h2>베타가 무엇인가</h2>` — 지금 어떤 상태이고 이 기간에 무엇을 확인하려는지
2. `<h2>무엇을 쓸 수 있나</h2>` — 진단+로드맵 / AI 멘토(LCS) / 커뮤니티 Q&A. 각각 한 문단씩. 기능 이름만 나열하지 않고 그 기능이 무엇을 대신해 주는지 쓴다
3. `<h2>비용</h2>` — 베타 기간 전체 무료. 유료 플랜은 준비 중
4. `<h2>초대는 어떻게 되나</h2>` — 신청 순서대로 순차 승인. **기간은 쓰지 않는다**
5. `<h2>아직 없는 것</h2>` — Step 1에서 확인한 항목
6. `<h2>바라는 것</h2>` — 피드백

분량은 공백 제외 1,000자 이상을 목표로 한다. 홈 카피의 반복이 아니라 **홈에 없는 정보**를 쓴다.

- [ ] **Step 6: 배포 목록과 sitemap에 등록한다**

`build.mjs`의 `DEPLOY_ENTRIES`에 `'beta.html'`을 넣는다. `'privacy.html'` 뒤가 자연스럽다:

```javascript
const DEPLOY_ENTRIES = ['index.html', 'privacy.html', 'beta.html', '404.html', 'src', 'assets', '_headers', '_redirects', '_routes.json', 'robots.txt', 'favicon.ico', 'ads.txt'];
```

`scripts/notes.mjs`의 `STATIC_PAGES`에 경로를 넣는다:

```javascript
const STATIC_PAGES = [
  { path: '/', lastmod: '2026-08-10' },
  { path: '/privacy', lastmod: '2026-08-10' },
  { path: '/beta', lastmod: '2026-08-11' },
];
```

- [ ] **Step 7: 통과를 확인한다**

Run: `npx vitest run tests/beta-about-pages.test.js tests/static-pages.test.js`
Expected: 모두 통과. 3자 일치 가드가 새 페이지를 함께 검사한다.

Step 6을 빠뜨렸다면 여기서 가드가 잡는다. 그게 이 가드의 목적이다.

- [ ] **Step 8: 전체 스위트와 빌드**

```bash
npx vitest run
npm run build
```

Expected: 전건 통과. `dist/beta.html` 존재. `dist/sitemap.xml`의 `<loc>` 10개(고정 4 + 글 6).

- [ ] **Step 9: 커밋**

```bash
git add beta.html build.mjs scripts/notes.mjs tests/beta-about-pages.test.js
git commit -m "feat(beta): 베타 안내 페이지를 추가한다"
```

---

### Task 3: `/about` 소개 페이지

**Files:**
- Create: `about.html`
- Modify: `build.mjs`, `scripts/notes.mjs`
- Modify: `tests/beta-about-pages.test.js`
- Modify: `index.html` (창업자 섹션 끝에 `/about` 링크)

**Interfaces:**
- Consumes: Task 1의 가드, Task 2의 테스트 파일
- Produces: `/about` 페이지

- [ ] **Step 1: 실명 표기 여부를 사용자에게 확인한다**

창업자 이야기에 실명(`김민구`)을 쓸지 확인한다. 처리방침에 개인정보 보호책임자로 이미 게시돼 있어 새로 노출하는 정보는 아니지만, 서사에 이름을 붙이는 것은 별개의 선택이다. **확인 전에는 쓰지 않는다.**

- [ ] **Step 2: 실패하는 테스트를 추가한다**

`tests/beta-about-pages.test.js` 끝에 추가한다:

```javascript
describe('/about 페이지', () => {
  const html = read('about.html');

  it('canonical이 확장자·슬래시 없는 자기 URL이다', () => {
    expect(html).toContain('<link rel="canonical" href="https://leva.ai.kr/about" />');
    expect(html).toContain('<meta property="og:url" content="https://leva.ai.kr/about" />');
  });

  it('색인을 허용한다', () => {
    expect(html).toMatch(/<meta name="robots" content="index, follow"/);
  });

  it('애드센스 스크립트는 넣되 광고 슬롯은 넣지 않는다', () => {
    expect(html).toContain('ca-pub-2785578834914321');
    expect(html).not.toContain('adsbygoogle"');
  });

  it('회사 정보와 연락처를 싣는다', () => {
    expect(html).toContain('레바');
    expect(html).toContain('796-76-00732');
    expect(html).toContain('mailto:info@leva.ai.kr');
  });

  // 결제 기능이 없어 표시의무가 없다. 실수로 넣지 않도록 막는다.
  it('사업장 주소를 싣지 않는다', () => {
    expect(html).not.toMatch(/[가-힣]+시\s+[가-힣]+구/);
  });

  it.each(FORBIDDEN)('$name을(를) 담지 않는다', ({ re }) => {
    expect(re.test(html)).toBe(false);
  });
});

describe('홈에서 소개로', () => {
  it('창업자 섹션이 /about으로 잇는다', () => {
    expect(read('index.html')).toContain('href="/about"');
  });
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npx vitest run tests/beta-about-pages.test.js`
Expected: FAIL — `about.html` 없음(ENOENT)

- [ ] **Step 4: 페이지 골격을 만든다**

`about.html`. `beta.html`과 같은 구조에 head 값만 바꾸고, 폼 대신 회사 정보를 넣는다.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>소개 — Leva</title>
  <meta name="description" content="Leva를 왜, 어떻게 만들고 있는지와 회사 정보를 안내합니다." />
  <link rel="canonical" href="https://leva.ai.kr/about" />
  <meta name="robots" content="index, follow" />

  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2785578834914321"
          crossorigin="anonymous"></script>

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Leva" />
  <meta property="og:title" content="소개 — Leva" />
  <meta property="og:description" content="Leva를 왜, 어떻게 만들고 있는지와 회사 정보를 안내합니다." />
  <meta property="og:url" content="https://leva.ai.kr/about" />
  <meta property="og:image" content="https://leva.ai.kr/assets/og-image.png" />
  <meta property="og:locale" content="ko_KR" />

  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
  <link rel="stylesheet" href="/assets/styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="container site-header__inner">
      <a class="wordmark" href="/">Leva</a>
      <nav class="site-nav" aria-label="주요">
        <a href="/">홈</a>
        <a href="/beta">베타 안내</a>
        <a href="/notes/">개발 기록</a>
      </nav>
    </div>
  </header>

  <main id="main" class="container legal note">
    <h1>소개</h1>

    <!-- 본문은 Step 5에서 사람이 쓴다 -->

    <h2>회사 정보</h2>
    <ul>
      <li>상호: 레바</li>
      <li>사업자등록번호: 796-76-00732</li>
      <li>문의: <a href="mailto:info@leva.ai.kr">info@leva.ai.kr</a></li>
    </ul>
  </main>

  <footer class="site-footer">
    <div class="container site-footer__inner">
      <p class="site-footer__brand">Leva</p>
      <nav class="site-footer__links" aria-label="푸터">
        <a href="/">홈</a>
        <a href="/beta">베타 안내</a>
        <a href="/about">소개</a>
        <a href="/notes/">개발 기록</a>
        <a href="/privacy">개인정보 처리방침</a>
        <a href="mailto:info@leva.ai.kr">연락</a>
      </nav>
      <p class="site-footer__biz">레바 | 사업자등록번호 796-76-00732</p>
      <p class="site-footer__copy">© 2026 Leva</p>
    </div>
  </footer>
</body>
</html>
```

`main.js`는 넣지 않는다 — 이 페이지에는 위젯이 없다.

- [ ] **Step 5: 본문을 쓴다 (사람이 직접)**

`<h1>소개</h1>` 다음, `<h2>회사 정보</h2>` 앞에 넣는다.

1. `<h2>왜 만드는가</h2>` — 홈 창업자 섹션(3문단)을 바탕으로 확장한다. 홈에는 요약이 남으므로 **같은 문장을 복사하지 말고** 더 구체적으로 쓴다
2. `<h2>어떻게 만드는가</h2>` — AI와 협업해 만든다는 사실을 숨기지 않는다. 실제로 겪은 문제와 해결 과정을 `/notes/`에 공개하고 있다는 점을 링크와 함께 쓴다
3. `<h2>지금 어디까지 왔나</h2>` — 베타 진행 중. 확정 사실만

분량은 공백 제외 1,000자 이상.

- [ ] **Step 6: 홈 창업자 섹션에서 잇는다**

`index.html`의 `<p class="founder__prev">` 줄을 다음으로 바꾼다. 기존 문구에서 링크 대상이 없는 프로젝트 이름을 그대로 두되, 소개 페이지로 가는 길을 만든다:

```html
        <p class="founder__prev">
          이전에 만든 것들: StockPilot · LearnFlow
        </p>
        <p class="founder__more"><a href="/about">만드는 사람과 회사에 대해 더 읽기 →</a></p>
```

- [ ] **Step 7: 배포 목록과 sitemap에 등록한다**

```javascript
const DEPLOY_ENTRIES = ['index.html', 'privacy.html', 'beta.html', 'about.html', '404.html', 'src', 'assets', '_headers', '_redirects', '_routes.json', 'robots.txt', 'favicon.ico', 'ads.txt'];
```

```javascript
const STATIC_PAGES = [
  { path: '/', lastmod: '2026-08-10' },
  { path: '/privacy', lastmod: '2026-08-10' },
  { path: '/beta', lastmod: '2026-08-11' },
  { path: '/about', lastmod: '2026-08-11' },
];
```

- [ ] **Step 8: 통과와 빌드를 확인한다**

```bash
npx vitest run
npm run build
```

Expected: 전건 통과. `dist/about.html` 존재. `dist/sitemap.xml`의 `<loc>` **11개**(고정 5 + 글 6).

- [ ] **Step 9: 커밋**

```bash
git add about.html build.mjs scripts/notes.mjs index.html tests/beta-about-pages.test.js
git commit -m "feat(about): 소개 페이지를 추가하고 홈에서 연결한다"
```

---

### Task 4: 홈 FAQ 섹션

**Files:**
- Modify: `index.html` (`#pricing`과 `#lead` 사이)
- Modify: `assets/styles.css`
- Modify: `tests/crawler-surface.test.js`

**Interfaces:**
- Consumes: Task 2의 `/beta`
- Produces: 없음

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`tests/crawler-surface.test.js` 끝에 추가한다:

```javascript
// 요금을 본 직후이자 폼에 닿기 직전이 질문이 가장 많이 생기는 자리다.
describe('홈 FAQ', () => {
  const html = read('index.html');

  it('FAQ 섹션이 있다', () => {
    expect(html).toContain('id="faq"');
  });

  it('요금과 리드 폼 사이에 놓인다', () => {
    expect(html.indexOf('id="pricing"')).toBeLessThan(html.indexOf('id="faq"'));
    expect(html.indexOf('id="faq"')).toBeLessThan(html.indexOf('id="lead"'));
  });

  it('상세는 /beta로 보낸다', () => {
    expect(html).toContain('href="/beta"');
  });

  it('확정되지 않은 초대 기간을 약속하지 않는다', () => {
    expect(html).not.toMatch(/며칠|영업일|\d+일 (안에|이내)/);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/crawler-surface.test.js`
Expected: FAIL — `id="faq"` 없음

- [ ] **Step 3: FAQ 섹션을 넣는다**

`index.html`에서 `</section>`(요금 섹션의 끝, `<!-- ── 8. 리드 캡처` 주석 바로 앞)과 리드 섹션 사이에 넣는다. 주석 번호는 그대로 두고 FAQ를 7.5로 표시한다:

```html
    <!-- ── 7.5 자주 묻는 것 ─────────────────────────────────────────────── -->
    <section class="section faq" id="faq">
      <div class="container">
        <h2>자주 묻는 것</h2>
        <dl class="faq__list">
          <dt>베타는 무료인가요?</dt>
          <dd>베타 기간에는 전부 무료입니다. 카드 등록도 없습니다. 유료 플랜은 준비 중이며, 시작하기 전에 미리 안내드립니다.</dd>

          <dt>초대는 어떻게 되나요?</dt>
          <dd>신청하신 순서대로 순차 승인합니다. 승인되면 이메일로 알려드립니다.</dd>

          <dt>무엇을 쓸 수 있나요?</dt>
          <dd>적응형 진단과 맞춤 로드맵, 학습 맥락을 붙여 묻는 AI 멘토, 커뮤니티 Q&amp;A를 쓸 수 있습니다. <a href="/beta">베타 안내에서 자세히 보기</a></dd>

          <dt>진단은 얼마나 걸리나요?</dt>
          <dd>가입 없이 해보는 미니 진단은 20초입니다. 적응형 진단은 문항이 적응하며 좁혀 들어가 몇 분이면 끝납니다.</dd>

          <dt>개인정보는 어떻게 다루나요?</dt>
          <dd>수집 항목과 보유 기간, 정보주체의 권리를 <a href="/privacy">개인정보 처리방침</a>에 공개하고 있습니다.</dd>

          <dt>지금 서비스는 어떤 상태인가요?</dt>
          <dd>베타를 진행 중이고, 먼저 써본 분들의 피드백으로 매주 다듬고 있습니다. 만들면서 겪은 문제는 <a href="/notes/">개발 기록</a>에 그대로 적고 있습니다.</dd>
        </dl>
      </div>
    </section>
```

- [ ] **Step 4: 스타일을 추가한다**

`assets/styles.css` 끝에 추가한다. `.legal`·`.note` 계열과 달리 홈 섹션이므로 `.faq` 아래에 둔다:

```css
/* ── 자주 묻는 것 ─────────────────────────────────────────────────────── */
.faq__list { margin: 1.5rem 0 0; }
.faq__list dt {
  font-weight: 600;
  margin: 1.25rem 0 0.35rem;
  color: var(--slate-900);
}
.faq__list dt:first-child { margin-top: 0; }
.faq__list dd {
  margin: 0;
  color: var(--slate-700);
  line-height: 1.7;
}
```

`--slate-900`·`--slate-700`이 정의돼 있는지 확인한다(둘 다 `assets/styles.css` 상단에 있다).

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run`
Expected: 전건 통과. 기존 `content-compliance` 20건도 함께 통과해야 한다(푸터 제휴 링크 정확 일치 단언이 있다).

- [ ] **Step 6: 커밋**

```bash
git add index.html assets/styles.css tests/crawler-surface.test.js
git commit -m "feat(home): 요금과 신청 사이에 FAQ를 넣는다"
```

---

### Task 5: 내비 일관성과 광고 크롤러 명시

**Files:**
- Modify: `index.html`, `privacy.html`, `templates/note.html`, `templates/notes-index.html`
- Modify: `robots.txt`
- Create: `tests/nav-consistency.test.js`
- Modify: `tests/deploy-entries.test.js` (주석 정정)

**Interfaces:**
- Consumes: Task 2·3의 페이지
- Produces: 없음

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/nav-consistency.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf-8');

// 페이지마다 푸터 링크가 제각각이면, 어떤 페이지에 도착한 사람은
// 나머지 페이지로 갈 길이 없다. 실제로 privacy에는 /notes 링크가 없었다.
const PAGES = ['index.html', 'privacy.html', 'beta.html', 'about.html'];
const TEMPLATES = ['templates/note.html', 'templates/notes-index.html'];
const REQUIRED_LINKS = ['/beta', '/about', '/notes/', '/privacy'];

describe('푸터 내비 일관성', () => {
  it.each([...PAGES, ...TEMPLATES])('%s 푸터가 공통 링크를 담는다', (page) => {
    const html = read(page);
    const footer = html.slice(html.indexOf('site-footer__links'));

    expect(REQUIRED_LINKS.filter((l) => !footer.includes(`href="${l}"`))).toEqual([]);
  });
});

describe('광고 크롤러 허용', () => {
  const txt = read('robots.txt');

  // Mediapartners-Google은 User-agent: * 그룹을 무시하고
  // 자기 이름으로 쓴 규칙만 따른다(Google 문서).
  it('Mediapartners-Google 그룹을 명시한다', () => {
    expect(txt).toMatch(/User-agent:\s*Mediapartners-Google/);
  });

  it('명시 그룹이 전체를 허용한다', () => {
    const group = txt.slice(txt.search(/User-agent:\s*Mediapartners-Google/));
    expect(group).toMatch(/Allow:\s*\//);
  });

  it('기존 전체 크롤러 허용을 유지한다', () => {
    expect(txt).toContain('User-agent: *');
    expect(txt).toContain('Sitemap: https://leva.ai.kr/sitemap.xml');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/nav-consistency.test.js`
Expected: FAIL — `privacy.html` 푸터에 `/notes/`·`/beta`·`/about` 없음, `robots.txt`에 Mediapartners 그룹 없음

- [ ] **Step 3: 각 페이지 푸터를 통일한다**

`index.html`의 푸터 `<nav>`를 다음으로 바꾼다. **`제휴` 링크의 정확한 문자열은 `tests/content-compliance.test.js:34`가 단언하므로 그대로 보존한다**:

```html
      <nav class="site-footer__links" aria-label="푸터">
        <a href="/beta">베타 안내</a>
        <a href="/about">소개</a>
        <a href="/notes/">개발 기록</a>
        <a href="mailto:info@leva.ai.kr">연락</a>
        <a href="mailto:info@leva.ai.kr">제휴</a>
        <a href="/privacy">개인정보 처리방침</a>
      </nav>
```

`privacy.html`의 푸터 `<nav>`:

```html
      <nav class="site-footer__links" aria-label="푸터">
        <a href="/">홈</a>
        <a href="/beta">베타 안내</a>
        <a href="/about">소개</a>
        <a href="/notes/">개발 기록</a>
        <a href="/privacy">개인정보 처리방침</a>
        <a href="mailto:info@leva.ai.kr">연락</a>
      </nav>
```

`templates/note.html`과 `templates/notes-index.html`의 푸터 `<nav>`도 위 `privacy.html`과 동일한 6줄로 맞춘다.

- [ ] **Step 4: 홈 헤더 내비에 두 페이지를 넣는다**

`index.html`의 헤더 `<nav class="site-nav">`를 다음으로 바꾼다:

```html
      <nav class="site-nav" aria-label="주요">
        <a href="#features">기능</a>
        <a href="/beta">베타 안내</a>
        <a href="/notes/">개발 기록</a>
        <a href="/about">소개</a>
        <a href="#pricing">요금</a>
      </nav>
```

`#how`(작동 흐름)와 `#founder`(만든 사람)를 뺀다 — 링크가 다섯 개를 넘으면 모바일에서 줄바꿈이 생기고, 두 항목은 각각 `/beta`와 `/about`이 더 자세히 다룬다.

- [ ] **Step 5: robots.txt에 광고 크롤러를 명시한다**

`robots.txt`를 다음으로 바꾼다:

```text
User-agent: *
Allow: /

# Mediapartners-Google은 위의 * 그룹을 무시하고 자기 그룹만 따른다(Google 문서).
User-agent: Mediapartners-Google
Allow: /

Sitemap: https://leva.ai.kr/sitemap.xml
```

- [ ] **Step 6: 낡은 주석을 고친다**

`tests/deploy-entries.test.js:24`의 주석이 "`_redirects`·`favicon.ico`는 지금도 목록에만 있고 파일이 없다"라고 하는데, `_redirects`는 이제 존재한다. 해당 줄을 다음으로 바꾼다:

```javascript
  // 실제로 favicon.ico는 지금도 목록에만 있고 파일이 없다 — 이는
```

- [ ] **Step 7: 통과를 확인한다**

Run: `npx vitest run`
Expected: 전건 통과. `head-meta`·`content-compliance`가 헤더/푸터 변경에 걸리지 않는지 함께 확인한다. 만약 걸린다면 그 테스트가 무엇을 지키려는지 읽고, **테스트를 고치지 말고** 마크업을 맞춘다.

- [ ] **Step 8: 커밋**

```bash
git add index.html privacy.html templates robots.txt tests/nav-consistency.test.js tests/deploy-entries.test.js
git commit -m "feat(nav): 모든 페이지의 푸터를 통일하고 광고 크롤러를 명시한다"
```

---

### Task 6: 육안 확인 · PR · 배포 · 라이브 검증

**Files:** 없음 (릴리스 작업)

- [ ] **Step 1: 전체 검증**

```bash
npx vitest run
npm run build
```

Expected: 전건 통과. `dist/`에 `beta.html`·`about.html`. `dist/sitemap.xml`의 `<loc>` 11개.

- [ ] **Step 2: 눈으로 확인한다**

```bash
npm run preview
```

`http://localhost:4321/beta.html`, `/about.html`, `/`(FAQ 섹션)를 연다. 확인할 것:

- `/beta`의 신청 폼이 **실제로 마운트되는지**(정적 폴백이 아니라 입력 필드가 보이는지). 안 보이면 `main.js` 로드나 `data-widget` 속성을 확인한다
- FAQ의 `dt`/`dd` 간격이 읽히는지
- 푸터 링크가 모든 페이지에서 같은지

테스트가 green이어도 레이아웃 결함은 눈으로만 잡힌 전례가 여러 번 있다. 이 단계를 건너뛰지 않는다.

- [ ] **Step 3: PR을 만든다**

```bash
git push -u origin <브랜치명>
gh pr create --base develop --title "feat(content): 베타 안내·소개 페이지와 홈 FAQ" --body "<스펙 링크와 변경 요약>"
```

- [ ] **Step 4: CI 확인 후 머지**

```bash
gh pr checks <번호>
gh pr merge <번호> --merge --delete-branch
```

red면 머지하지 않는다.

- [ ] **Step 5: 배포**

★이 레포의 Cloudflare Pages 프로젝트는 **직접 업로드**다. `develop` 머지만으로는 배포되지 않는다.★

```bash
git switch develop && git pull --ff-only
npm run build
export CLOUDFLARE_API_TOKEN='<Pages:Edit 권한 토큰>'
export CLOUDFLARE_ACCOUNT_ID='<계정 ID>'
npx wrangler pages deploy dist --project-name devpath-home-page --branch develop
```

`wrangler whoami`는 Pages:Edit 토큰만으로 실패한다. `CLOUDFLARE_ACCOUNT_ID`를 함께 준다.

- [ ] **Step 6: 라이브 반복 실측**

★배포 직후 단발 측정은 믿지 않는다. 엣지가 경로별로 옛/새를 섞어 응답한다 — 오늘만 세 번 겪었다.★

`curl.exe -4`를 쓴다(이 환경의 `Invoke-WebRequest`는 DNS 오류를 낸다).

```bash
curl -sS -4 -o /dev/null -w "%{http_code} %{content_type}\n" https://leva.ai.kr/beta
curl -sS -4 -o /dev/null -w "%{http_code} %{content_type}\n" https://leva.ai.kr/about
curl -sS -4 -o /dev/null -w "%{http_code}\n" https://leva.ai.kr/
curl -sS -4 https://leva.ai.kr/sitemap.xml | grep -c "<loc>"
curl -sS -4 https://leva.ai.kr/robots.txt
```

Expected:
- `/beta`, `/about` → `200 text/html` (**308이 아니다**. 308이면 파일이 아니라 디렉터리로 처리된 것)
- `/` → 200
- sitemap `<loc>` → **11**
- robots.txt에 `Mediapartners-Google` 그룹

**연속 두 라운드가 같은 값을 낼 때까지** 반복한다. 20초 간격으로 4회면 충분하다.

- [ ] **Step 7: 색인 요청(선택)**

Search Console의 URL 검사에서 `/beta`와 `/about`을 각각 **색인 요청**한다. sitemap 재제출은 불필요하다(URL이 같고 내용만 갱신된다).

---

## Self-Review

**스펙 커버리지**

| 스펙 항목 | 태스크 |
|---|---|
| §4.1 `/beta` 페이지 | Task 2 |
| §4.2 `/about` 페이지 | Task 3 |
| §4.3 홈 FAQ | Task 4 |
| §4.4 내비게이션 | Task 3 Step 6(창업자→about), Task 5 Step 3·4 |
| §4.5 `robots.txt` 광고 크롤러 | Task 5 Step 5 |
| §5 콘텐츠 원칙 | Task 2 Step 1·5, Task 3 Step 1·5, 기간 미약속 테스트(Task 2·4) |
| §5.1 공개 범위 | Task 2·3의 `FORBIDDEN` 단언, 주소 부재 단언 |
| §6.1 정적 HTML | Task 2·3 |
| §6.2 URL·슬래시 없음 | Task 2·3 canonical 단언, Task 6 Step 6 실측 |
| §6.3 폼 재사용 | Task 2 Step 4·Step 2 단언, Task 6 Step 2 육안 |
| §6.4 애드센스 | Task 2·3 단언 |
| §6.5 3자 일치 가드 | Task 1 |
| §7 테스트 | 각 태스크 |
| §8 검증 | Task 6 |

**빠진 것을 하나 찾아 고쳤다.** 스펙 §6.5는 가드가 "루트 html == 배포목록 == sitemap"을 본다고만 했고 `404.html` 예외를 어떻게 다룰지 정하지 않았다. Task 1에서 `NOINDEX_PAGES` 상수로 명시하고, "404도 배포는 된다"와 "404는 sitemap에 없다"를 각각 단언하도록 했다.

**가드가 실제로 잡는지 확인하는 단계를 넣었다.** Task 1 Step 3에서 목록을 일부러 깨뜨려 red를 보고 되돌린다. 통과만 보고 넘어가면 아무것도 검사하지 않는 테스트를 통과로 착각한다 — 이 레포에서 실제로 있었던 실패 방식이다.

**타입·이름 일관성** — `DEPLOY_ENTRIES`, `STATIC_PAGES`, `collectNotes`, `renderSitemap`, `data-widget="lead-form"`은 기존 코드의 이름을 그대로 썼다. Task 2에서 만든 `tests/beta-about-pages.test.js`의 `read`·`FORBIDDEN`을 Task 3이 이어 쓴다(같은 파일).

**자리표시자** — Task 2 Step 5와 Task 3 Step 5의 본문은 의도적으로 비워 두고 쓸 항목만 지정했다. 원고는 사실 관계를 아는 사람이 쓰는 산문이라 계획이 문장까지 지정할 수 없다. 대신 분량·금지 정보·미약속 규칙은 기계가 강제한다.

**사용자 확인이 필요한 두 지점** — Task 2 Step 1(「아직 없는 것」 항목), Task 3 Step 1(실명 표기). 둘 다 코드에서 알 수 없는 사실이고, 확인 없이 추측으로 채우면 해당 페이지의 목적이 무너진다.
