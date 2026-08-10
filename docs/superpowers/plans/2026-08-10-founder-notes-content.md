# 개발 기록(`/notes`) 콘텐츠 보강 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `leva.ai.kr`에 창업자 개발기 6편을 정적 HTML로 배포하고, sitemap·인덱스를 원고 파일 집합에서 생성해 수동 갱신 누락을 구조적으로 없앤다.

**Architecture:** `content/notes/*.md` 원고를 `scripts/notes.mjs`가 수집·검증·렌더하고, `build.mjs`가 기존 화이트리스트 복사 후 이를 호출해 `dist/notes/`와 `dist/sitemap.xml`을 쓴다. 렌더 함수는 문자열만 반환해 파일시스템 없이 테스트한다. 실패 경로는 `tests/fixtures/`의 잘못된 픽스처 디렉터리로 검증한다.

**Tech Stack:** Node.js ESM · `marked` 18.0.9 (빌드타임 devDependency) · vitest 2.1.8 · 번들러 없음

**Spec:** `docs/superpowers/specs/2026-08-10-founder-notes-content-design.md`

## Global Constraints

- 대상 레포는 `devpath-home-page` 하나다. 다른 레포를 건드리지 않는다.
- 작업 브랜치는 `develop`에서 분기한다. `develop`·`main`에 직접 커밋하지 않는다.
- **모든 URL은 확장자 없는 clean URL이다.** Cloudflare Pages가 `.html`을 떼고 308 리다이렉트하므로, canonical·sitemap·내부 링크에 `.html`을 쓰지 않는다.
- 퍼블리셔 ID는 `ca-pub-2785578834914321`. **`ads.txt`와 `index.html`의 기존 애드센스 스크립트는 수정하지 않는다.** 신규 페이지에 동일한 형태로 넣기만 한다.
- 광고 슬롯(`<ins class="adsbygoogle">`)은 어디에도 넣지 않는다.
- 공개 금지: Cloudflare Account ID·Zone ID·API 토큰, 사업자등록번호, 대표자명, 내부 호스트명, Apps Script `/exec` URL, 스프레드시트 ID.
- 브랜드는 `Leva`다. `DevPath`를 새로 쓰지 않는다.
- 기존 테스트 9파일 85건을 깨지 않는다. 확인 명령은 `npx vitest run`.

## 스펙에서 한 가지를 정정하고 시작한다

스펙 §4.5는 「두 원고가 같은 slug를 가지면 빌드 실패」를 요구한다. **이 조건은 발생할 수 없다** — slug는 `content/notes/` 한 디렉터리의 `.md` 파일명에서 나오고, 한 디렉터리에 같은 이름의 파일은 존재할 수 없다. 이 검증과 그 테스트는 만들지 않는다. Task 1 마지막 단계에서 스펙 본문도 함께 고친다.

대신 **본문에 `#`(h1)이 있으면 실패**하는 검증을 넣는다. 템플릿이 이미 제목을 `<h1>`으로 내보내므로, 본문에 h1이 또 있으면 한 페이지에 h1이 둘이 된다.

## File Structure

| 파일 | 책임 |
|---|---|
| `scripts/notes.mjs` (신규) | 원고 수집·검증·렌더. 파일 쓰기 없음. 문자열만 반환 |
| `templates/note.html` (신규) | 개별 글 레이아웃 |
| `templates/notes-index.html` (신규) | 인덱스 레이아웃 |
| `content/notes/*.md` (신규 6개) | 원고 |
| `build.mjs` (수정) | 복사 빌드 후 `scripts/notes.mjs` 호출해 `dist/notes/`·`dist/sitemap.xml` 쓰기 |
| `sitemap.xml` (삭제) | 생성물로 전환 |
| `assets/styles.css` (수정) | `.note` 조판 규칙 추가 |
| `index.html` (수정) | 헤더 내비에 `/notes` 링크 |
| `package.json` (수정) | `marked` 추가, `description` 브랜드 교정 |
| `tests/notes-collect.test.js` (신규) | 수집·검증 |
| `tests/notes-render.test.js` (신규) | 글·인덱스·sitemap 렌더 |
| `tests/notes-content.test.js` (신규) | 원고 공개 금지 정보 가드 |
| `tests/crawler-surface.test.js` (수정) | sitemap 단언을 집합 일치로 교체 |
| `tests/build-output.test.js` (신규) | 빌드 산출물 존재 |

---

### Task 1: 원고 수집과 검증

**Files:**
- Create: `scripts/notes.mjs`
- Create: `tests/notes-collect.test.js`
- Create: `tests/fixtures/notes-ok/first-post.md`, `tests/fixtures/notes-ok/second-post.md`
- Create: `tests/fixtures/notes-missing-title/bad.md`
- Create: `tests/fixtures/notes-bad-date/bad.md`
- Create: `tests/fixtures/notes-h1-in-body/bad.md`
- Create: `tests/fixtures/notes-empty/.gitkeep`
- Modify: `docs/superpowers/specs/2026-08-10-founder-notes-content-design.md`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `parseFrontmatter(raw: string, slug: string) => { title, description, date, body }` — 위반 시 `Error` throw
  - `collectNotes(dir: string) => Note[]` where `Note = { slug, title, description, date, body }`, `date` 내림차순·동률 시 `slug` 오름차순 정렬

- [ ] **Step 1: 픽스처 원고를 만든다**

`tests/fixtures/notes-ok/first-post.md`:

```markdown
---
title: 첫 번째 글
description: 첫 번째 글의 설명이다.
date: 2026-08-09
---

## 소제목

본문 문단이다.
```

`tests/fixtures/notes-ok/second-post.md`:

```markdown
---
title: 두 번째 글
description: 두 번째 글의 설명이다.
date: 2026-08-10
---

## 소제목

본문 문단이다.
```

`tests/fixtures/notes-missing-title/bad.md`:

```markdown
---
description: 제목이 없는 원고다.
date: 2026-08-10
---

## 소제목

본문.
```

`tests/fixtures/notes-bad-date/bad.md`:

```markdown
---
title: 날짜 형식이 틀린 글
description: date가 YYYY-MM-DD가 아니다.
date: 2026/08/10
---

## 소제목

본문.
```

`tests/fixtures/notes-h1-in-body/bad.md`:

```markdown
---
title: 본문에 h1이 있는 글
description: 템플릿이 이미 h1을 내보내므로 본문의 h1은 중복이다.
date: 2026-08-10
---

# 본문 안의 h1

본문.
```

`tests/fixtures/notes-empty/.gitkeep`은 빈 파일이다. git이 빈 디렉터리를 추적하지 않으므로 필요하다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`tests/notes-collect.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, collectNotes } from '../scripts/notes.mjs';

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

describe('parseFrontmatter', () => {
  it('세 필수 값과 본문을 분리한다', () => {
    const raw = '---\ntitle: 제목\ndescription: 설명\ndate: 2026-08-10\n---\n\n## 소제목\n';

    const note = parseFrontmatter(raw, 'slug');

    expect(note.title).toBe('제목');
    expect(note.description).toBe('설명');
    expect(note.date).toBe('2026-08-10');
    expect(note.body.trim()).toBe('## 소제목');
  });

  it('frontmatter 블록이 없으면 실패한다', () => {
    expect(() => parseFrontmatter('본문만 있다', 'slug')).toThrow(/frontmatter/);
  });

  it('콜론이 여러 개인 값도 온전히 읽는다', () => {
    const raw = '---\ntitle: 제목\ndescription: 비율은 1:2:3이다\ndate: 2026-08-10\n---\n\n## 소제목\n';

    expect(parseFrontmatter(raw, 'slug').description).toBe('비율은 1:2:3이다');
  });
});

describe('collectNotes', () => {
  it('최신순으로 수집한다', () => {
    const notes = collectNotes(fixture('notes-ok'));

    expect(notes.map((n) => n.slug)).toEqual(['second-post', 'first-post']);
  });

  it('필수 키가 없으면 어느 원고인지 밝히며 실패한다', () => {
    expect(() => collectNotes(fixture('notes-missing-title'))).toThrow(/bad.*title/s);
  });

  it('date가 YYYY-MM-DD가 아니면 실패한다', () => {
    expect(() => collectNotes(fixture('notes-bad-date'))).toThrow(/date/);
  });

  it('본문에 h1이 있으면 실패한다', () => {
    expect(() => collectNotes(fixture('notes-h1-in-body'))).toThrow(/h1/);
  });

  it('원고가 하나도 없으면 실패한다', () => {
    expect(() => collectNotes(fixture('notes-empty'))).toThrow(/원고/);
  });
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npx vitest run tests/notes-collect.test.js`
Expected: FAIL — `Failed to resolve import "../scripts/notes.mjs"`

- [ ] **Step 4: 최소 구현**

`scripts/notes.mjs`:

```javascript
// 원고 수집·검증·렌더. 파일 쓰기는 하지 않고 문자열만 반환한다 —
// 테스트가 파일시스템 없이 단언할 수 있게 하기 위해서다.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REQUIRED = ['title', 'description', 'date'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFrontmatter(raw, slug) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error(`${slug}: frontmatter 블록이 없다`);

  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const i = line.indexOf(':');
    if (i < 0) throw new Error(`${slug}: frontmatter 형식 오류 — ${line}`);
    // 값에 콜론이 더 있어도 첫 콜론만 구분자로 쓴다.
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }

  for (const key of REQUIRED) {
    if (!meta[key]) throw new Error(`${slug}: frontmatter에 ${key}가 없다`);
  }
  if (!DATE_RE.test(meta.date)) {
    throw new Error(`${slug}: date는 YYYY-MM-DD여야 한다 — ${meta.date}`);
  }

  const body = m[2];
  // 템플릿이 제목을 h1으로 내보낸다. 본문의 h1은 한 페이지에 h1을 둘로 만든다.
  if (/^#\s/m.test(body)) throw new Error(`${slug}: 본문에 h1(#)을 쓰지 않는다. ##부터 시작할 것`);

  return { title: meta.title, description: meta.description, date: meta.date, body };
}

export function collectNotes(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  if (files.length === 0) throw new Error(`${dir}: 원고가 하나도 없다`);

  const notes = files.map((file) => {
    const slug = file.replace(/\.md$/, '');
    return { slug, ...parseFrontmatter(readFileSync(join(dir, file), 'utf-8'), slug) };
  });

  // 날짜 내림차순. 동률이면 slug 오름차순으로 안정 정렬한다 —
  // 순서가 빌드마다 흔들리면 sitemap과 인덱스에 무의미한 diff가 생긴다.
  notes.sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date)));
  return notes;
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run tests/notes-collect.test.js`
Expected: PASS (8건)

- [ ] **Step 6: 스펙의 slug 중복 요구를 정정한다**

`docs/superpowers/specs/2026-08-10-founder-notes-content-design.md`에서 §4.5의 다음 줄을 삭제한다:

```
- 두 원고가 같은 slug를 갖는다
```

같은 자리에 다음을 넣는다:

```
- 본문에 `#`(h1)이 있다 — 템플릿이 이미 제목을 h1으로 내보낸다
```

§6 테스트 표의 `slug 중복 | 같은 slug 두 개면 throw` 행도 `본문 h1 | 본문에 #이 있으면 throw`로 바꾼다.

이유를 §4.5 끝에 한 줄로 남긴다:

```
slug는 한 디렉터리의 파일명에서 오므로 중복이 발생할 수 없다. 이 검증은 두지 않는다.
```

- [ ] **Step 7: 전체 스위트를 돌린다**

Run: `npx vitest run`
Expected: 기존 85건 + 신규 8건 = 93건 통과

- [ ] **Step 8: 커밋**

```bash
git add scripts/notes.mjs tests/notes-collect.test.js tests/fixtures docs/superpowers/specs/2026-08-10-founder-notes-content-design.md
git commit -m "feat(notes): 원고 수집과 frontmatter 검증을 추가한다"
```

---

### Task 2: 글 렌더와 조판

**Files:**
- Modify: `package.json` (marked 추가, description 교정)
- Create: `templates/note.html`
- Modify: `scripts/notes.mjs` (escapeHtml, renderNote 추가)
- Modify: `assets/styles.css` (`.note` 규칙 추가)
- Create: `tests/notes-render.test.js`

**Interfaces:**
- Consumes: Task 1의 `Note = { slug, title, description, date, body }`
- Produces:
  - `escapeHtml(s: string) => string`
  - `renderNote(note: Note, template: string) => string` — 완성된 HTML 문서

- [ ] **Step 1: marked를 설치하고 브랜드 잔재를 고친다**

```bash
npm install --save-dev marked@18.0.9
```

`package.json:6`의 `description`을 바꾼다:

```json
  "description": "Leva 정식 마케팅 홈페이지 (바닐라 ES모듈)",
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`tests/notes-render.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { escapeHtml, renderNote } from '../scripts/notes.mjs';

const template = readFileSync(
  fileURLToPath(new URL('../templates/note.html', import.meta.url)),
  'utf-8',
);

const NOTE = {
  slug: 'empty-response-reported-success',
  title: '빈 응답을 성공으로 보고하던 함수',
  description: '기록되지 않은 신청이 "성공"으로 보였다.',
  date: '2026-08-10',
  body: '## 증상\n\n한 줄이었다.\n\n```js\nconst a = 1;\n```\n',
};

describe('escapeHtml', () => {
  it('HTML 특수문자를 이스케이프한다', () => {
    expect(escapeHtml('a & b < c > d "e"')).toBe('a &amp; b &lt; c &gt; d &quot;e&quot;');
  });
});

describe('renderNote', () => {
  const html = renderNote(NOTE, template);

  it('제목과 날짜를 싣는다', () => {
    expect(html).toContain('<h1>빈 응답을 성공으로 보고하던 함수</h1>');
    expect(html).toContain('2026-08-10');
  });

  it('마크다운 본문을 HTML로 변환한다', () => {
    expect(html).toContain('<h2>증상</h2>');
    expect(html).toContain('<code');
  });

  // Pages가 .html을 떼는 clean URL로 308 리다이렉트한다.
  it('canonical이 확장자 없는 자기 URL을 가리킨다', () => {
    expect(html).toContain('<link rel="canonical" href="https://leva.ai.kr/notes/empty-response-reported-success" />');
    expect(html).not.toContain('.html"');
  });

  it('description의 따옴표가 속성을 깨뜨리지 않는다', () => {
    expect(html).toContain('content="기록되지 않은 신청이 &quot;성공&quot;으로 보였다."');
  });

  it('애드센스 스크립트는 넣되 광고 슬롯은 넣지 않는다', () => {
    expect(html).toContain('ca-pub-2785578834914321');
    expect(html).not.toContain('adsbygoogle"');
  });

  it('목록으로 돌아가는 링크가 있다', () => {
    expect(html).toContain('href="/notes"');
  });

  it('치환하지 못한 자리표시자가 남지 않는다', () => {
    expect(html).not.toMatch(/\{\{\w+\}\}/);
  });
});

describe('아티클 조판', () => {
  const css = readFileSync(
    fileURLToPath(new URL('../assets/styles.css', import.meta.url)),
    'utf-8',
  );

  // 코드블록의 긴 줄이 가로로 넘치면 모바일에서 페이지 전체가 밀린다.
  it('코드블록이 자기 안에서 가로 스크롤된다', () => {
    expect(css).toMatch(/\.note pre\s*\{[^}]*overflow-x:\s*auto/);
  });
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npx vitest run tests/notes-render.test.js`
Expected: FAIL — `templates/note.html` 없음(ENOENT)

- [ ] **Step 4: 템플릿을 만든다**

`templates/note.html`:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{title}} — Leva</title>
  <meta name="description" content="{{description}}" />
  <link rel="canonical" href="https://leva.ai.kr/notes/{{slug}}" />
  <meta name="robots" content="index, follow" />

  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2785578834914321"
          crossorigin="anonymous"></script>

  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Leva" />
  <meta property="og:title" content="{{title}}" />
  <meta property="og:description" content="{{description}}" />
  <meta property="og:url" content="https://leva.ai.kr/notes/{{slug}}" />
  <meta property="og:image" content="https://leva.ai.kr/assets/og-image.png" />
  <meta property="og:locale" content="ko_KR" />

  <script type="application/ld+json">{{jsonld}}</script>

  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
  <link rel="stylesheet" href="/assets/styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="container site-header__inner">
      <a class="wordmark" href="/">Leva</a>
      <nav class="site-nav" aria-label="주요">
        <a href="/notes">개발 기록</a>
      </nav>
    </div>
  </header>

  <main id="main" class="container legal note">
    <h1>{{title}}</h1>
    <p class="legal__meta">{{date}}</p>
{{body}}
    <p class="note__back"><a href="/notes">← 개발 기록 목록으로</a></p>
  </main>

  <footer class="site-footer">
    <div class="container site-footer__inner">
      <p class="site-footer__brand">Leva</p>
      <nav class="site-footer__links" aria-label="푸터">
        <a href="/">홈</a>
        <a href="/notes">개발 기록</a>
        <a href="/privacy">개인정보 처리방침</a>
        <a href="mailto:info@leva.ai.kr">연락</a>
      </nav>
      <p class="site-footer__copy">© 2026 Leva</p>
    </div>
  </footer>
</body>
</html>
```

- [ ] **Step 5: 렌더 함수를 구현한다**

`scripts/notes.mjs` 상단 import에 `marked`를 추가한다:

```javascript
import { marked } from 'marked';
```

파일 끝에 다음을 추가한다:

```javascript
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

// String.replace의 두 번째 인자를 문자열로 주면 $&·$1 같은 패턴이 치환된다.
// 원고 본문에 그런 문자열이 있으면 조용히 깨지므로 함수 형태로 넘긴다.
function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`템플릿 자리표시자 ${key}에 줄 값이 없다`);
    return values[key];
  });
}

export function renderNote(note, template) {
  const url = `https://leva.ai.kr/notes/${note.slug}`;
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: note.title,
    description: note.description,
    datePublished: note.date,
    url,
    author: { '@type': 'Organization', name: 'Leva' },
  });

  return fill(template, {
    title: escapeHtml(note.title),
    description: escapeHtml(note.description),
    slug: note.slug,
    date: note.date,
    jsonld,
    body: marked.parse(note.body),
  });
}
```

- [ ] **Step 6: 조판 CSS를 추가한다**

`assets/styles.css` 끝에 다음을 추가한다:

```css
/* ── 개발 기록 아티클 ─────────────────────────────────────────────────── */
.note pre {
  overflow-x: auto;
  background: var(--slate-50);
  border: 1px solid var(--slate-200);
  border-radius: 0.5rem;
  padding: 0.875rem 1rem;
  margin: 1rem 0;
  font-size: 0.8125rem;
  line-height: 1.6;
}
.note :not(pre) > code {
  background: var(--slate-100);
  border-radius: 0.25rem;
  padding: 0.1em 0.35em;
  font-size: 0.875em;
}
.note blockquote {
  margin: 1rem 0;
  padding: 0.25rem 0 0.25rem 1rem;
  border-left: 3px solid var(--slate-300);
  color: var(--slate-600);
}
.note table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: 0.875rem;
}
.note th, .note td {
  border: 1px solid var(--slate-200);
  padding: 0.5rem 0.625rem;
  text-align: left;
}
.note th { background: var(--slate-50); font-weight: 600; }
.note__back { margin-top: 2.5rem; }
```

`--slate-100`·`--slate-200`·`--slate-300`·`--slate-600`이 `assets/styles.css`에 정의돼 있는지 확인한다. 없는 변수가 있으면 그 자리에 정의된 가장 가까운 값(예: `--slate-50`, `--slate-500`, `--slate-700`)으로 바꾼다. 확인 명령:

```bash
grep -n -- "--slate-100:\|--slate-200:\|--slate-300:\|--slate-600:" assets/styles.css
```

- [ ] **Step 7: 통과를 확인한다**

Run: `npx vitest run tests/notes-render.test.js`
Expected: PASS (9건)

- [ ] **Step 8: 전체 스위트**

Run: `npx vitest run`
Expected: 102건 통과

- [ ] **Step 9: 커밋**

```bash
git add package.json package-lock.json templates/note.html scripts/notes.mjs assets/styles.css tests/notes-render.test.js
git commit -m "feat(notes): 글 렌더와 아티클 조판을 추가한다"
```

---

### Task 3: 인덱스 렌더

**Files:**
- Create: `templates/notes-index.html`
- Modify: `scripts/notes.mjs` (renderIndex 추가)
- Modify: `tests/notes-render.test.js`

**Interfaces:**
- Consumes: Task 1의 `Note[]`, Task 2의 `escapeHtml`·`fill`
- Produces: `renderIndex(notes: Note[], template: string) => string`

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`tests/notes-render.test.js` 끝에 다음을 추가하고, 상단 import에 `renderIndex`를 더한다:

```javascript
describe('renderIndex', () => {
  const indexTemplate = readFileSync(
    fileURLToPath(new URL('../templates/notes-index.html', import.meta.url)),
    'utf-8',
  );
  const NOTES = [
    { ...NOTE, slug: 'newer', title: '나중 글', date: '2026-08-10' },
    { ...NOTE, slug: 'older', title: '먼저 글', date: '2026-08-01' },
  ];
  const html = renderIndex(NOTES, indexTemplate);

  it('모든 글로 가는 링크가 있다', () => {
    expect(html).toContain('href="/notes/newer"');
    expect(html).toContain('href="/notes/older"');
  });

  it('받은 순서를 그대로 유지한다', () => {
    expect(html.indexOf('/notes/newer')).toBeLessThan(html.indexOf('/notes/older'));
  });

  it('canonical이 /notes다', () => {
    expect(html).toContain('<link rel="canonical" href="https://leva.ai.kr/notes" />');
  });

  it('애드센스 스크립트는 넣되 광고 슬롯은 넣지 않는다', () => {
    expect(html).toContain('ca-pub-2785578834914321');
    expect(html).not.toContain('adsbygoogle"');
  });

  it('치환하지 못한 자리표시자가 남지 않는다', () => {
    expect(html).not.toMatch(/\{\{\w+\}\}/);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/notes-render.test.js`
Expected: FAIL — `templates/notes-index.html` 없음, `renderIndex` 미정의

- [ ] **Step 3: 템플릿을 만든다**

`templates/notes-index.html`:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>개발 기록 — Leva</title>
  <meta name="description" content="Leva를 만들며 실제로 부딪힌 문제와 그 해결 과정을 기록합니다." />
  <link rel="canonical" href="https://leva.ai.kr/notes" />
  <meta name="robots" content="index, follow" />

  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2785578834914321"
          crossorigin="anonymous"></script>

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Leva" />
  <meta property="og:title" content="개발 기록 — Leva" />
  <meta property="og:description" content="Leva를 만들며 실제로 부딪힌 문제와 그 해결 과정을 기록합니다." />
  <meta property="og:url" content="https://leva.ai.kr/notes" />
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
      </nav>
    </div>
  </header>

  <main id="main" class="container legal note">
    <h1>개발 기록</h1>
    <p>Leva를 만들며 실제로 부딪힌 문제와 그 해결 과정을 기록합니다. 전부 겪은 일이고, 숫자는 실측값입니다.</p>
    <ul class="note-list">
{{items}}
    </ul>
  </main>

  <footer class="site-footer">
    <div class="container site-footer__inner">
      <p class="site-footer__brand">Leva</p>
      <nav class="site-footer__links" aria-label="푸터">
        <a href="/">홈</a>
        <a href="/privacy">개인정보 처리방침</a>
        <a href="mailto:info@leva.ai.kr">연락</a>
      </nav>
      <p class="site-footer__copy">© 2026 Leva</p>
    </div>
  </footer>
</body>
</html>
```

- [ ] **Step 4: renderIndex를 구현한다**

`scripts/notes.mjs` 끝에 추가한다:

```javascript
export function renderIndex(notes, template) {
  const items = notes
    .map((note) => [
      '      <li class="note-list__item">',
      `        <a href="/notes/${note.slug}">${escapeHtml(note.title)}</a>`,
      `        <p class="legal__meta">${note.date}</p>`,
      `        <p>${escapeHtml(note.description)}</p>`,
      '      </li>',
    ].join('\n'))
    .join('\n');

  return fill(template, { items });
}
```

- [ ] **Step 5: 목록 스타일을 추가한다**

`assets/styles.css`의 `.note__back` 규칙 앞에 추가한다:

```css
.note-list { list-style: none; padding-left: 0; margin: 1.5rem 0 0; }
.note-list__item { margin: 0 0 1.5rem; }
.note-list__item a { font-size: 1.0625rem; font-weight: 600; }
.note-list__item p { margin: 0.25rem 0 0; }
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npx vitest run tests/notes-render.test.js`
Expected: PASS (14건)

- [ ] **Step 7: 커밋**

```bash
git add templates/notes-index.html scripts/notes.mjs assets/styles.css tests/notes-render.test.js
git commit -m "feat(notes): 인덱스 페이지 렌더를 추가한다"
```

---

### Task 4: sitemap 생성으로 전환

**Files:**
- Modify: `scripts/notes.mjs` (renderSitemap 추가)
- Modify: `tests/notes-render.test.js`
- Delete: `sitemap.xml`
- Modify: `build.mjs` (DEPLOY_ENTRIES에서 sitemap.xml 제거)
- Modify: `tests/crawler-surface.test.js`

**Interfaces:**
- Consumes: Task 1의 `Note[]`
- Produces: `renderSitemap(notes: Note[]) => string`

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`tests/notes-render.test.js` 끝에 추가하고 상단 import에 `renderSitemap`을 더한다:

```javascript
describe('renderSitemap', () => {
  const NOTES = [
    { ...NOTE, slug: 'newer', date: '2026-08-10' },
    { ...NOTE, slug: 'older', date: '2026-08-01' },
  ];
  const xml = renderSitemap(NOTES);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  it('고정 경로 셋과 모든 글을 담는다', () => {
    expect(locs).toEqual([
      'https://leva.ai.kr/',
      'https://leva.ai.kr/notes',
      'https://leva.ai.kr/notes/newer',
      'https://leva.ai.kr/notes/older',
      'https://leva.ai.kr/privacy',
    ]);
  });

  it('리다이렉트되는 .html 경로를 담지 않는다', () => {
    expect(xml).not.toContain('.html');
  });

  it('/notes의 lastmod가 가장 최근 글 날짜다', () => {
    expect(xml).toMatch(/<loc>https:\/\/leva\.ai\.kr\/notes<\/loc>\s*<lastmod>2026-08-10<\/lastmod>/);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/notes-render.test.js`
Expected: FAIL — `renderSitemap is not a function`

- [ ] **Step 3: renderSitemap을 구현한다**

`scripts/notes.mjs` 끝에 추가한다:

```javascript
const SITE = 'https://leva.ai.kr';
// 원고와 무관하게 항상 존재하는 페이지. 날짜를 고정값으로 둬 빌드마다
// sitemap이 흔들리지 않게 한다(Date.now를 쓰지 않는 이유).
const STATIC_PAGES = [
  { path: '/', lastmod: '2026-08-10' },
  { path: '/privacy', lastmod: '2026-08-10' },
];

export function renderSitemap(notes) {
  const latest = notes.length > 0 ? notes[0].date : '2026-08-10';
  const entries = [
    ...STATIC_PAGES.map((p) => ({ loc: `${SITE}${p.path}`, lastmod: p.lastmod })),
    { loc: `${SITE}/notes`, lastmod: latest },
    ...notes.map((n) => ({ loc: `${SITE}/notes/${n.slug}`, lastmod: n.date })),
  ].sort((a, b) => a.loc.localeCompare(b.loc));

  const urls = entries
    .map((e) => `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
```

`notes`는 Task 1에서 최신순으로 정렬돼 들어오므로 `notes[0].date`가 가장 최근 날짜다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run tests/notes-render.test.js`
Expected: PASS (17건)

- [ ] **Step 5: 정적 sitemap을 걷어낸다**

```bash
git rm sitemap.xml
```

`build.mjs`의 `DEPLOY_ENTRIES`에서 `'sitemap.xml'`을 제거한다. 수정 후:

```javascript
const DEPLOY_ENTRIES = ['index.html', 'privacy.html', '404.html', 'src', 'assets', '_headers', '_redirects', '_routes.json', 'robots.txt', 'favicon.ico', 'ads.txt'];
```

- [ ] **Step 6: crawler-surface 테스트의 sitemap 단언을 교체한다**

`tests/crawler-surface.test.js`의 `describe('sitemap.xml', ...)` 블록 전체를 다음으로 바꾼다. 파일 상단 import에 `readdirSync`를 더한다.

```javascript
// sitemap은 이제 생성물이다. 레포에 정적 파일로 두지 않으므로
// 화이트리스트가 아니라 "원고 집합과 일치하는가"를 단언한다.
describe('sitemap', () => {
  it('robots.txt가 선언한 URL과 실제 배포 경로가 일치한다', () => {
    const declared = read('robots.txt').match(/^Sitemap:\s*(\S+)$/m)?.[1];
    expect(declared).toBe('https://leva.ai.kr/sitemap.xml');
  });

  it('정적 파일로 남아 있지 않다', () => {
    expect(existsSync(root('sitemap.xml'))).toBe(false);
    expect(deployEntries()).not.toContain('sitemap.xml');
  });

  it('원고 파일 집합과 sitemap의 글 URL 집합이 일치한다', () => {
    const slugs = readdirSync(root('content/notes'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
      .sort();
    const notes = collectNotes(root('content/notes'));
    const locs = [...renderSitemap(notes).matchAll(/<loc>https:\/\/leva\.ai\.kr\/notes\/([^<]+)<\/loc>/g)]
      .map((m) => m[1])
      .sort();

    expect(locs).toEqual(slugs);
  });
});
```

상단 import에 다음을 더한다:

```javascript
import { readdirSync } from 'node:fs';
import { collectNotes, renderSitemap } from '../scripts/notes.mjs';
```

이 테스트는 `content/notes/`에 원고가 있어야 통과한다. 원고는 Task 7에서 들어온다. **그때까지 이 테스트는 실패한다.** Task 5에서 임시 원고 하나를 넣어 파이프라인을 종단으로 세운다.

- [ ] **Step 7: 커밋**

```bash
git add scripts/notes.mjs build.mjs tests/notes-render.test.js tests/crawler-surface.test.js
git rm --cached sitemap.xml 2>/dev/null || true
git commit -m "feat(notes): sitemap을 원고 집합에서 생성하도록 전환한다"
```

---

### Task 5: build.mjs 통합과 첫 원고

**Files:**
- Create: `content/notes/empty-response-reported-success.md`
- Modify: `build.mjs`
- Create: `tests/build-output.test.js`

**Interfaces:**
- Consumes: Task 1~4의 `collectNotes`·`renderNote`·`renderIndex`·`renderSitemap`
- Produces: `dist/notes/<slug>.html`, `dist/notes/index.html`, `dist/sitemap.xml`

- [ ] **Step 1: 첫 원고를 쓴다**

`content/notes/empty-response-reported-success.md`. 본문은 1,200자 이상이어야 한다. 아래 뼈대를 채워 쓴다 — **측정값과 실제 코드를 넣고, 일반론을 쓰지 않는다.**

```markdown
---
title: 빈 응답을 성공으로 보고하던 함수
description: 기록되지 않은 신청이 사용자에게는 성공 화면으로 보였다. 한 줄짜리 폴백이 만든 조용한 유실.
date: 2026-08-10
---

## 증상

베타 신청 폼이 제출에 실패하고 있었다. 서버 응답은 503이었다.

...(실제 조사 과정: /api/lead가 503을 내던 이유, Apps Script가 실패도 200 + HTML로 돌려준다는 실측, 그 위에서 `text || '{"ok":true}'`가 무엇을 만들었는지, 어떻게 고쳤는지)

## 왜 이게 위험한가

...

## 고친 방법

```js
const text = await res.text();
let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  return json({ ok: false, error: 'upstream_invalid' }, 502);
}
return json(parsed, res.ok ? 200 : 502);
```

## 같은 뿌리에서 나온 것

...(soft-404: 존재하지 않는 경로가 200 + index.html을 돌려주던 문제)
```

Apps Script `/exec` URL과 스프레드시트 ID는 **쓰지 않는다**(Global Constraints).

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`tests/build-output.test.js`:

```javascript
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

describe('빌드 산출물', () => {
  beforeAll(() => {
    execFileSync('node', ['build.mjs'], { cwd: root('.'), stdio: 'pipe' });
  }, 60_000);

  it('원고 수만큼 글 페이지를 낸다', () => {
    const sources = readdirSync(root('content/notes')).filter((f) => f.endsWith('.md'));
    const built = readdirSync(root('dist/notes')).filter((f) => f !== 'index.html');

    expect(built).toHaveLength(sources.length);
  });

  it('인덱스와 sitemap을 낸다', () => {
    expect(existsSync(root('dist/notes/index.html'))).toBe(true);
    expect(existsSync(root('dist/sitemap.xml'))).toBe(true);
  });

  it('sitemap이 글 URL을 담는다', () => {
    expect(readFileSync(root('dist/sitemap.xml'), 'utf-8')).toContain('/notes/');
  });
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npx vitest run tests/build-output.test.js`
Expected: FAIL — `dist/notes` 없음(ENOENT)

- [ ] **Step 4: build.mjs를 통합한다**

`build.mjs`의 import 줄을 다음으로 바꾼다:

```javascript
import { cp, rm, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { collectNotes, renderNote, renderIndex, renderSitemap } from './scripts/notes.mjs';
```

`console.log(\`built dist/ ...\`)` 줄 **앞**에 다음을 넣는다:

```javascript
// 개발 기록 렌더. 원고 검증에 실패하면 여기서 예외가 나 빌드가 중단된다 —
// 조용히 누락되는 것보다 시끄럽게 실패하는 쪽을 택한다.
const notes = collectNotes(root + 'content/notes');
const noteTemplate = readFileSync(root + 'templates/note.html', 'utf-8');
const indexTemplate = readFileSync(root + 'templates/notes-index.html', 'utf-8');

await mkdir(dist + '/notes', { recursive: true });
for (const note of notes) {
  await writeFile(dist + `/notes/${note.slug}.html`, renderNote(note, noteTemplate));
}
await writeFile(dist + '/notes/index.html', renderIndex(notes, indexTemplate));
await writeFile(dist + '/sitemap.xml', renderSitemap(notes));
console.log(`rendered ${notes.length} notes`);
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run tests/build-output.test.js`
Expected: PASS (3건)

- [ ] **Step 6: 전체 스위트**

Run: `npx vitest run`
Expected: 전부 통과. Task 4에서 예고한 `crawler-surface`의 집합 일치 테스트도 이제 원고가 있으므로 통과한다.

- [ ] **Step 7: 눈으로 확인한다**

```bash
npm run preview
```

`http://localhost:4321/notes/`와 `http://localhost:4321/notes/empty-response-reported-success.html`을 브라우저로 연다. 확인할 것:

- 코드블록이 가로로 넘치지 않고 자기 안에서 스크롤된다
- 제목이 h1으로 한 번만 나온다
- 「목록으로」 링크가 동작한다

- [ ] **Step 8: 커밋**

```bash
git add build.mjs content/notes tests/build-output.test.js
git commit -m "feat(notes): 빌드에 개발 기록 렌더를 통합하고 첫 글을 싣는다"
```

---

### Task 6: 발견 가능성

**Files:**
- Modify: `index.html:68-73`
- Modify: `tests/crawler-surface.test.js`

**Interfaces:**
- Consumes: Task 5의 `/notes` 인덱스
- Produces: 없음

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`tests/crawler-surface.test.js` 끝에 추가한다:

```javascript
// sitemap만으로는 부족하다. 고아 페이지는 색인이 잘 안 된다.
describe('개발 기록 발견 가능성', () => {
  it('홈에서 /notes로 가는 링크가 있다', () => {
    expect(read('index.html')).toContain('href="/notes"');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/crawler-surface.test.js`
Expected: FAIL — `index.html`에 `/notes` 링크 없음

- [ ] **Step 3: 내비게이션에 링크를 넣는다**

`index.html:68-73`의 `<nav class="site-nav" aria-label="주요">` 블록을 다음으로 바꾼다:

```html
      <nav class="site-nav" aria-label="주요">
        <a href="#features">기능</a>
        <a href="#how">작동 흐름</a>
        <a href="/notes">개발 기록</a>
        <a href="#founder">만든 사람</a>
        <a href="#pricing">요금</a>
      </nav>
```

`index.html:298-302`의 푸터 `<nav class="site-footer__links">`에도 개발 기록을 넣는다:

```html
      <nav class="site-footer__links" aria-label="푸터">
        <a href="/notes">개발 기록</a>
        <a href="mailto:info@leva.ai.kr">연락</a>
        <a href="mailto:info@leva.ai.kr">제휴</a>
        <a href="/privacy">개인정보 처리방침</a>
      </nav>
```

`tests/content-compliance.test.js:34`가 `<a href="mailto:info@leva.ai.kr">제휴</a>`를 정확 일치로 단언한다. 위 형태는 그 문자열을 그대로 보존한다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run`
Expected: 전부 통과 (기존 `content-compliance` 20건 포함)

- [ ] **Step 5: 커밋**

```bash
git add index.html tests/crawler-surface.test.js
git commit -m "feat(notes): 홈 내비게이션에서 개발 기록으로 연결한다"
```

---

### Task 7: 공개 금지 정보 가드와 원고 2편

**Files:**
- Create: `tests/notes-content.test.js`
- Create: `content/notes/cloudflare-zone-api-no-dns-import.md`
- Create: `content/notes/surrogate-pair-broke-562-docs.md`

**Interfaces:**
- Consumes: Task 1의 `collectNotes`
- Produces: 원고 3편(Task 5의 1편 포함)

- [ ] **Step 1: 실패하는 가드 테스트를 쓴다**

`tests/notes-content.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { collectNotes } from '../scripts/notes.mjs';

const notes = collectNotes(fileURLToPath(new URL('../content/notes', import.meta.url)));

// 사람이 매번 눈으로 확인하는 방식은 실패한다. 기계로 강제한다.
const FORBIDDEN = [
  { name: 'Cloudflare Account/Zone ID', re: /\b[0-9a-f]{32}\b/ },
  { name: '사업자등록번호', re: /\b\d{3}-\d{2}-\d{5}\b/ },
  { name: 'Apps Script 배포 URL', re: /script\.google\.com\/macros/ },
  { name: '대표자명', re: /김민구/ },
];

describe('원고 공개 금지 정보', () => {
  it('원고가 있다', () => {
    expect(notes.length).toBeGreaterThan(0);
  });

  it.each(FORBIDDEN)('$name을(를) 담지 않는다', ({ re }) => {
    const hits = notes.filter((n) => re.test(n.body) || re.test(n.title) || re.test(n.description));

    expect(hits.map((n) => n.slug)).toEqual([]);
  });

  it('본문이 1,000자 이상이다', () => {
    const thin = notes.filter((n) => n.body.replace(/\s/g, '').length < 1000);

    expect(thin.map((n) => n.slug)).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/notes-content.test.js`
Expected: 「본문이 1,000자 이상이다」가 Task 5의 원고 분량에 따라 통과하거나 실패한다. 실패하면 그 원고를 먼저 채운다. 나머지 금지 정보 단언은 통과해야 한다 — 하나라도 실패하면 해당 원고에서 그 값을 지운다.

- [ ] **Step 3: 원고 2편을 쓴다**

`content/notes/cloudflare-zone-api-no-dns-import.md`:

```markdown
---
title: Cloudflare에 API로 존을 만들면 DNS 레코드를 하나도 안 가져온다
description: 대시보드 온보딩과 달리 자동 스캔이 없다. 모르고 네임서버를 바꿨다면 메일이 즉시 죽었다.
date: 2026-08-09
---

## 하려던 일

...(루트 도메인을 Cloudflare Pages에 붙이려 했다. 등록기관에 ALIAS/ANAME이 없어 apex CNAME이 불가능했고, 네임서버 이전이 유일한 길이었다)

## 놓칠 뻔한 것

...(API로 존을 만들면 기존 레코드를 하나도 가져오지 않는다. 대시보드 온보딩은 자동 스캔을 하지만 API는 하지 않는다. 그대로 NS를 바꿨다면 메일과 하위 도메인 세 개가 즉시 죽었다)

## 막아준 것

...(NS 변경 직전에 기존 존과 새 존을 1:1로 대조하는 단계를 계획에 넣어 뒀다. 그게 실제로 걸러냈다)

## 전파 확인은 공개 리졸버로 하지 말 것

...(이 존은 기본 TTL이 86400이라 공개 리졸버는 한참 옛값을 준다. 레지스트리에 직접 물어야 한다)
```

`content/notes/surrogate-pair-broke-562-docs.md`:

```markdown
---
title: 이모지 하나가 문서 562개를 깨뜨렸다
description: UTF-16 서로게이트 쌍을 코드유닛 인덱스로 자르면, 예외는 읽기가 아니라 쓰기에서 터진다.
date: 2026-08-07
---

## 증상

...(문서를 청크로 쪼개 임베딩하는 파이프라인이 MalformedInputException으로 죽었다)

## 어디서 터졌나

...(읽기가 아니라 쓰기/인코딩 단계였다는 것이 단서였다)

## 원인

...(청커가 UTF-16 코드유닛 인덱스로 잘랐다. 이모지는 서로게이트 쌍 두 코드유닛이라 그 한가운데가 경계가 되면 짝 잃은 서로게이트가 남는다)

## 실측

...(743개 문서 중 562개, 5,246자가 영향)

## 고치는 방향을 잘못 잡을 뻔했다

...(인코더를 관대하게 만들면 예외는 사라지지만 본문이 조용히 손상된다. 경계 계산을 고쳐야 한다)
```

각 원고는 공백 제외 1,000자 이상이어야 한다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run`
Expected: 전부 통과

- [ ] **Step 5: 빌드하고 눈으로 확인한다**

```bash
npm run preview
```

`http://localhost:4321/notes/`에 3편이 최신순으로 보이는지 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add content/notes tests/notes-content.test.js
git commit -m "feat(notes): 공개 금지 정보 가드와 개발기 2편을 추가한다"
```

---

### Task 8: 나머지 원고 3편

**Files:**
- Create: `content/notes/green-tests-empty-screen.md`
- Create: `content/notes/post-deploy-measurement-lies.md`
- Create: `content/notes/canvaskit-cannot-be-reviewed.md`

**Interfaces:**
- Consumes: Task 7의 가드 테스트
- Produces: 원고 6편 완성

- [ ] **Step 1: 원고 3편을 쓴다**

각 원고의 frontmatter와 다룰 내용:

`content/notes/green-tests-empty-screen.md` — `date: 2026-08-05`
제목: 테스트가 green인데 화면은 비어 있었다
description: 신규 사용자에겐 값이 전부 0이라 막대 높이가 0이었다. 테스트는 그 0을 정확히 검증하고 통과했다.
내용: 주차별 진행률 차트가 신규 사용자에게 빈 상자로 보인 사건. 테스트가 `toY: 0`을 정확히 단언해 green이었던 구조. 같은 계열이 네 번 재발했다는 사실. 「나란히 선 단언」이 화면 퇴행을 못 잡는 이유(양쪽이 같은 리터럴로 퇴행하면 둘 다 통과). 육안 확인을 테스트가 대체하지 못하는 지점.

`content/notes/post-deploy-measurement-lies.md` — `date: 2026-08-03`
제목: 배포 직후의 측정은 믿을 수 없다
description: 엣지가 경로별로 옛 버전과 새 버전을 섞어 응답했다. 한 번 재고 판단했다면 두 번 오판할 뻔했다.
내용: 배포 직후 한 경로는 새 버전, 다른 경로는 옛 버전을 돌려주던 실측. 그래서 「교체가 안 됐다」고 오판할 뻔한 과정. 상태코드만 보면 SPA 폴백에 속는다는 것(`/ads.txt`가 200이지만 실제로는 HTML이었던 사례) — content-type까지 봐야 한다. 안정될 때까지 반복 측정.

`content/notes/canvaskit-cannot-be-reviewed.md` — `date: 2026-08-01`
제목: Flutter Web 앱은 광고 심사를 받을 수 없었다
description: CanvasKit은 캔버스에 그린다. 크롤러에게는 빈 화면이다.
내용: 앱을 심사에 낼 수 없었던 이유(CanvasKit 렌더링은 DOM 텍스트를 남기지 않는다, 게다가 로그인 뒤에 있다). 그래서 심사 대상이 홈페이지가 됐고, 그 홈페이지가 한 번도 배포된 적 없었다는 발견. 렌더링 방식이 SEO와 크롤러 접근성에 갖는 함의.

각 원고는 공백 제외 1,000자 이상이며, Global Constraints의 공개 금지 목록을 지킨다.

- [ ] **Step 2: 전체 스위트**

Run: `npx vitest run`
Expected: 전부 통과. `notes-content` 가드가 6편 모두를 검사한다.

- [ ] **Step 3: 빌드 산출물을 확인한다**

```bash
npm run build
ls dist/notes/
```

Expected: 글 6개 + `index.html` = 7개 파일

- [ ] **Step 4: sitemap을 확인한다**

```bash
grep -c "<loc>" dist/sitemap.xml
```

Expected: `9` (고정 3개 + 글 6개)

- [ ] **Step 5: 눈으로 확인한다**

```bash
npm run preview
```

`/notes/`에서 6편이 최신순으로 보이고, 각 글이 열리는지 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add content/notes
git commit -m "feat(notes): 개발기 3편을 추가해 여섯 편을 완성한다"
```

---

### Task 9: PR과 배포

**Files:** 없음 (릴리스 작업)

- [ ] **Step 1: 전체 검증**

```bash
npx vitest run
npm run build
```

Expected: 전부 통과, `dist/notes/`에 7파일

- [ ] **Step 2: PR을 만든다**

```bash
git push -u origin <브랜치명>
gh pr create --base develop --title "feat(notes): 개발 기록 6편과 마크다운 빌드 파이프라인" --body "<스펙 링크와 변경 요약>"
```

- [ ] **Step 3: CI 확인**

```bash
gh pr checks <번호>
```

Expected: green. red면 머지하지 않는다.

- [ ] **Step 4: 머지**

```bash
gh pr merge <번호> --merge --delete-branch
```

- [ ] **Step 5: 배포**

★이 레포의 Cloudflare Pages 프로젝트는 **직접 업로드**다. `develop` 머지만으로는 배포되지 않는다.★

```bash
git switch develop && git pull --ff-only
npm run build
export CLOUDFLARE_API_TOKEN='<Pages:Edit 권한 토큰>'
npx wrangler pages deploy dist --project-name devpath-home-page --branch develop
```

- [ ] **Step 6: 라이브 실측**

★배포 직후 단발 측정은 믿지 않는다. 엣지가 경로별로 옛/새를 섞어 응답한다. 안정될 때까지 반복 측정한다.★

```bash
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" https://leva.ai.kr/notes
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" https://leva.ai.kr/sitemap.xml
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" https://leva.ai.kr/notes/empty-response-reported-success
curl -sS -o /dev/null -w "%{http_code}\n" https://leva.ai.kr/zzz-no-page
```

Expected:
- `/notes` → `200 text/html`
- `/sitemap.xml` → `200` + XML content-type (`application/xml` 또는 `text/xml`). **`text/html`이면 파일이 안 올라간 것이다**
- 글 URL → `200 text/html`
- `/zzz-no-page` → `404` (PR #18의 `404.html`이 반영됐는지 함께 확인)

- [ ] **Step 7: Search Console에 sitemap을 제출한다**

`leva.ai.kr` 속성에서 `https://leva.ai.kr/sitemap.xml`을 제출한다. 색인 속도를 앞당긴다.

---

## Self-Review

**스펙 커버리지**

| 스펙 항목 | 태스크 |
|---|---|
| §3.1 콘텐츠 성격(측정값 있는 실화) | Task 5·7·8 원고, Task 7 분량 가드 |
| §3.2 저자성 표기 | Task 7·8 원고 집필 시 톤 |
| §3.3 공개 금지 정보 | Task 7 `notes-content.test.js` |
| §3.4 글 6편 | Task 5(1편)·7(2편)·8(3편) |
| §4.1 파일 배치·모듈 분리 | Task 1~5 |
| §4.2 URL·clean URL | Task 2·4 canonical·sitemap 단언 |
| §4.3 원고 형식·frontmatter | Task 1 |
| §4.4 빌드 흐름·정렬 | Task 1 정렬, Task 5 통합 |
| §4.5 빌드 실패 정책 | Task 1 (slug 중복은 정정) |
| §4.6 페이지 구성·애드센스 | Task 2·3 |
| §4.7 발견 가능성 | Task 6 |
| §5 기존 자산 변화 | Task 2(package.json)·4(sitemap·build.mjs·crawler test)·6(index.html) |
| §6 테스트 | Task 1~8 각 테스트 |
| §7 위험 대응 | Task 9 배포 실측 |

**빠진 것을 하나 찾아 고쳤다.** 스펙 §6의 애드센스 단언이 글 페이지(Task 2 Step 2)에만 있고 인덱스 페이지에는 없었다. Task 3 Step 1의 테스트에 같은 단언을 넣었다.

**Task 3 Step 6의 기대 건수를 함께 조정했다** — 단언 하나가 늘어 13건이 아니라 14건이다.

**타입 일관성** — `Note`의 필드명(`slug`·`title`·`description`·`date`·`body`)이 Task 1의 `collectNotes` 반환값부터 Task 8까지 동일하다. `fill`은 Task 2에서 정의하고 Task 3·4에서 쓰는데, 모듈 스코프 함수라 export가 필요 없다(같은 파일 안). 확인됨.

**자리표시자** — Task 5·7·8의 원고 본문에 `...(내용)` 형태가 남아 있다. 이는 **의도된 것**이다. 원고는 사실 관계를 아는 사람이 쓰는 산문이므로 계획이 문장까지 지정할 수 없다. 대신 각 원고가 다룰 내용을 문장 수준으로 지정했고, 분량·금지 정보·필수 메타데이터는 기계 검증이 강제한다.
