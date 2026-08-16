# 서비스 이용약관 신설 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 필수 동의를 받고 있으면서 문서가 없는 「서비스 이용약관」을 신설해 라이브에 게시하고, 앱 동의 화면에서 전문을 열 수 있게 하며, 기존 이용자에게 재동의를 받는다.

**Architecture:** 약관 본문은 `privacy.html` 과 같은 정적 HTML로 `devpath-home-page` 에 둔다. 앱은 `_ConsentKind.terms` 에 `docUrl` 을 추가해 외부 링크로 연다(PRIVACY 와 동일 패턴). 재동의는 `ConsentType.TERMS` 를 `"v2"` 로 올리고 마이그레이션으로 `users.consent_status` 를 `PENDING` 으로 되돌려 발동시킨다 — 라우터 게이트는 이미 `consent_status` 만 보므로 프론트 로직은 바뀌지 않는다.

**Tech Stack:** 정적 HTML + vitest + playwright (home-page) · Flutter/Riverpod + flutter_test (frontend) · Flyway SQL (shared) · Spring Boot 4 + JUnit 5 (platform-svc)

**설계 문서:** `docs/superpowers/specs/2026-08-12-terms-of-service-design.md`

## Global Constraints

이 절의 값은 모든 Task 의 요구사항에 암묵적으로 포함된다.

- 브랜드는 `Leva` 단독이다. 산출물에 `DevPath` · `devpath.ai` 문자열이 **한 곳도** 남으면 안 된다.
- 사업자 표기: 상호 `레바` · 사업자등록번호 `796-76-00732` · 문의 `info@leva.ai.kr`
- 도메인: 사이트 `https://leva.ai.kr` · 앱 `https://app.leva.ai.kr` · 약관 `https://leva.ai.kr/terms`
- 약관 시행일: **2026년 8월 12일**
- **범위는 무료 베타의 현재 상태로 한정한다.** 요금·결제·환불·청약철회 조항을 넣지 않는다(결제 미구현).
- **사업장 주소를 게시하지 않는다.** 무상 서비스라 전자상거래법상 표시의무 대상이 아니며 `privacy.html` 과 같은 기준을 적용한다.
- 각 레포에서 작업은 `develop` 에서 새 브랜치를 분기해 진행하고 `develop` 으로 PR 한다. `main` 직접 push 금지.
- 커밋 메시지는 Conventional Commits, 본문은 한국어.

---

## File Structure

| 레포 | 파일 | 책임 |
|---|---|---|
| home-page | `terms.html` (신설) | 약관 본문. `privacy.html` 의 `.legal` 구조를 그대로 따른다 |
| home-page | `build.mjs:14` | `DEPLOY_ENTRIES` — 배포 화이트리스트 |
| home-page | `scripts/notes.mjs:106` | `STATIC_PAGES` — sitemap 고정 경로 |
| home-page | `tests/terms-page.test.js` (신설) | 약관 조항 내용 회귀 테스트 |
| home-page | `e2e/smoke.spec.js` | 약관 페이지 로드·오버플로 스모크 |
| home-page | `tests/nav-consistency.test.js:10,12` | `PAGES`·`REQUIRED_LINKS` — 푸터 공통 링크 |
| home-page | `index.html` · `privacy.html` · `beta.html` · `about.html` · `templates/note.html` · `templates/notes-index.html` | 푸터 링크 |
| frontend | `apps/web/lib/src/features/consent/presentation/consent_page.dart:16` | `terms` 에 `docUrl` |
| frontend | `apps/web/test/features/consent/consent_page_test.dart` | 전문 링크 열림 검증 |
| shared | `src/main/resources/db/migration/V202608121001__terms_v2_reconsent.sql` (신설) | 재동의 발동 |
| platform-svc | `src/main/java/ai/devpath/platform/consent/ConsentType.java:5` | `TERMS` 버전 `"v2"` |
| platform-svc | `src/test/java/ai/devpath/platform/consent/ConsentServiceTest.java` | v2 저장 검증 |

---

### Task 1: 약관 페이지 골격과 배포 등록 (home-page)

`terms.html` 을 만들고 배포·sitemap 에 등록한다. 본문 조항은 Task 2 에서 채운다 — 이 Task 는 **파일이 실제로 배포되고 색인되는 배선**만 책임진다.

**Files:**
- Create: `terms.html`
- Modify: `build.mjs:14` · `scripts/notes.mjs:106`
- Test: `tests/static-pages.test.js` (기존 — 수정 없이 red→green)

**Interfaces:**
- Consumes: 없음
- Produces: `https://leva.ai.kr/terms` 로 서빙되는 `terms.html`. Task 2 가 이 파일의 본문을 채우고, Task 3 이 이 경로로 링크한다.

- [ ] **Step 1: 브랜치를 만든다**

```bash
cd /d/workspace/dpa/devpath-home-page
git switch develop && git pull
git switch -c feat/terms-of-service
```

- [ ] **Step 2: 기존 테스트가 red 가 되는 것을 먼저 확인한다**

`tests/static-pages.test.js` 는 "루트의 모든 html 이 배포 화이트리스트와 sitemap 에 있다"를 이미 강제한다. `terms.html` 을 만들면 등록 전까지 이 테스트가 깨진다 — 새 테스트를 쓸 필요가 없다.

먼저 골격만 만든다. `privacy.html` 의 head·header·footer 구조를 그대로 쓰되 본문은 제목과 시행일만 둔다.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>서비스 이용약관 — Leva</title>
  <meta name="description" content="Leva 서비스 이용약관 — 서비스 내용, 회원의 의무, 콘텐츠의 권리, AI 생성물의 한계를 안내합니다." />
  <link rel="canonical" href="https://leva.ai.kr/terms" />
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
  <link rel="stylesheet" href="/assets/styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="container site-header__inner">
      <a class="wordmark" href="/">Leva</a>
    </div>
  </header>

  <main id="main" class="container legal">
    <h1>서비스 이용약관</h1>
    <p class="legal__meta">시행일: 2026년 8월 12일</p>
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
        <a href="/terms">서비스 이용약관</a>
        <a href="mailto:info@leva.ai.kr">연락</a>
      </nav>
      <p class="site-footer__biz">레바 | 사업자등록번호 796-76-00732</p>
      <p class="site-footer__copy">© 2026 Leva</p>
    </div>
  </footer>
</body>
</html>
```

- [ ] **Step 3: 테스트를 돌려 red 를 눈으로 확인한다**

Run: `npm test -- static-pages`
Expected: FAIL — "루트의 모든 html이 배포 화이트리스트에 있다" 와 "루트의 모든 html이 sitemap 고정 경로에 있다" 가 `['terms.html']` · `['https://leva.ai.kr/terms']` 를 남기며 실패한다.

> red 를 보지 않고 다음 단계로 가지 않는다. 실패 메시지에 `terms` 가 나오지 않으면 파일 위치가 틀린 것이다.

- [ ] **Step 4: DEPLOY_ENTRIES 에 등록한다**

`build.mjs:14` 을 다음으로 바꾼다.

```javascript
const DEPLOY_ENTRIES = ['index.html', 'privacy.html', 'terms.html', 'beta.html', 'about.html', '404.html', 'src', 'assets', '_headers', '_redirects', '_routes.json', 'robots.txt', 'favicon.ico', 'ads.txt'];
```

- [ ] **Step 5: STATIC_PAGES 에 등록한다**

`scripts/notes.mjs:106` 의 배열에 항목을 추가한다.

```javascript
const STATIC_PAGES = [
  { path: '/', lastmod: '2026-08-10' },
  { path: '/privacy', lastmod: '2026-08-10' },
  { path: '/terms', lastmod: '2026-08-12' },
  { path: '/beta', lastmod: '2026-08-11' },
  { path: '/about', lastmod: '2026-08-11' },
];
```

- [ ] **Step 6: 테스트가 green 이 되는 것을 확인한다**

Run: `npm test`
Expected: PASS (전체 스위트)

- [ ] **Step 7: 빌드 산출물에 실제로 들어가는지 직접 확인한다**

테스트는 배열 리터럴을 읽을 뿐 빌드를 돌리지 않는다. 실제 `dist/` 를 만들어 눈으로 본다.

```bash
npm run build && ls dist/terms.html && grep -c '/terms' dist/sitemap.xml
```

Expected: `dist/terms.html` 이 존재하고, sitemap 에 `/terms` 가 1건 있다.

- [ ] **Step 8: 커밋**

```bash
git add terms.html build.mjs scripts/notes.mjs
git commit -m "feat(terms): 이용약관 페이지를 신설하고 배포·색인에 등록한다"
```

---

### Task 2: 약관 본문 조항 작성 (home-page)

**Files:**
- Modify: `terms.html` · `e2e/smoke.spec.js`
- Test: `tests/terms-page.test.js` (신설)

**Interfaces:**
- Consumes: Task 1 이 만든 `terms.html` 골격
- Produces: 14개 조항이 담긴 약관 본문. Task 4 의 앱 링크가 이 문서를 연다.

- [ ] **Step 1: 내용 회귀 테스트를 먼저 쓴다**

`tests/terms-page.test.js` 를 만든다. `tests/privacy-policy.test.js` 의 `section()` 헬퍼 방식을 따르되 조 제목이 `<h2>제N조(제목)</h2>` 형태다.

```javascript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../terms.html', import.meta.url)), 'utf-8');

// <h2>제목</h2> 부터 다음 <h2> 직전까지를 한 조로 자른다.
function article(titleFragment) {
  const heads = [...html.matchAll(/<h2>([\s\S]*?)<\/h2>/g)];
  const idx = heads.findIndex((h) => h[1].includes(titleFragment));
  if (idx === -1) return null;
  const start = heads[idx].index;
  const end = idx + 1 < heads.length ? heads[idx + 1].index : html.length;
  return html.slice(start, end);
}

const text = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('약관이 실제 서비스를 규정한다', () => {
  it('제공하는 서비스가 모두 적혀 있다', () => {
    const t = text(article('서비스의 내용'));
    for (const item of ['진단', '학습 경로', 'AI 멘토', '커뮤니티', '코드']) {
      expect(t).toContain(item);
    }
  });

  it('베타이며 무상 제공임을 밝힌다', () => {
    expect(text(article('서비스의 내용'))).toMatch(/베타/);
    expect(text(article('서비스의 내용'))).toMatch(/무상|무료/);
  });

  it('만 14세 미만 제한이 서버 차단과 일치한다', () => {
    expect(text(article('이용계약의 성립'))).toContain('만 14세 미만');
  });
});

describe('나중에 바꾸기 어려운 조항', () => {
  // 저작권 귀속을 뒤집으면 이미 게시한 회원의 권리에 영향을 준다.
  it('콘텐츠 저작권이 회원에게 있다고 못박는다', () => {
    const t = text(article('콘텐츠의 권리'));
    expect(t).toMatch(/저작권은.*회원에게/);
    expect(t).toContain('비독점');
  });

  it('AI 생성물의 정확성을 보장하지 않는다고 밝힌다', () => {
    const t = text(article('AI 생성물'));
    expect(t).toMatch(/보장하지 않/);
    expect(t).toMatch(/참고/);
  });

  // 신고→판정→비공개는 이미 구현된 기능이다. 약관에 근거가 없으면
  // 제재를 할 수 없다.
  it('신고와 제재 절차의 근거가 있다', () => {
    const t = text(article('커뮤니티'));
    for (const item of ['신고', '비공개', '이용']) {
      expect(t).toContain(item);
    }
  });
});

describe('범위를 넘지 않는다', () => {
  // 결제는 구현돼 있지 않다. 없는 기능을 규정하면 약관이 사실과 어긋난다.
  it('결제·환불·청약철회 조항이 없다', () => {
    const t = text(html);
    for (const forbidden of ['청약철회', '환불', '결제대금']) {
      expect(t).not.toContain(forbidden);
    }
  });

  // 무상 서비스라 표시의무 대상이 아니다. privacy.html 과 같은 기준.
  it('사업장 주소를 게시하지 않는다', () => {
    expect(text(html)).not.toMatch(/주소\s*:/);
  });
});

describe('표기 일관성', () => {
  it('사업자 표기가 처리방침과 같다', () => {
    expect(html).toContain('796-76-00732');
    expect(html).toContain('info@leva.ai.kr');
  });

  it('옛 브랜드가 남아 있지 않다', () => {
    expect(html).not.toContain('DevPath');
    expect(html).not.toContain('devpath.ai');
  });

  it('시행일이 명시돼 있다', () => {
    expect(html).toContain('시행일: 2026년 8월 12일');
  });
});
```

- [ ] **Step 2: 테스트를 돌려 red 를 확인한다**

Run: `npm test -- terms-page`
Expected: FAIL — 조항이 아직 없으므로 `article()` 이 `null` 을 반환해 `text(null)` 에서 터진다. 「범위를 넘지 않는다」·「옛 브랜드」 항목만 통과한다.

- [ ] **Step 3: 조항 본문을 작성한다**

> **교정(2026-08-12)**: 제4조 마지막 문단은 처음 "요금과 결제·환불에 관한 사항을" 이었는데,
> 이는 Step 1 테스트의 `not.toContain('환불')` 및 Global Constraints 와 **정면으로 충돌**했다.
> verbatim 으로 넣으면 계획이 스스로 제시한 테스트가 red 로 남는다. "관련 사항을" 로 일반화해
> 해소했다 — 유료 전환 시 사전 공지·동의 의무는 유지하면서, 아직 없는 기능의 구체적 조건은
> 규정하지 않는다. 아래 본문은 교정된 것이다.

`terms.html` 의 `<main>` 안, `<p class="legal__meta">` 다음에 아래를 넣는다.

```html
    <p>
      이 약관은 레바(이하 “회사”)가 제공하는 Leva 서비스의 이용에 관한 조건과 절차,
      회사와 회원의 권리·의무를 정합니다. 서비스를 이용하기 전에 읽어주시기 바랍니다.
    </p>

    <h2>제1조(목적)</h2>
    <p>
      이 약관은 회사가 제공하는 서비스의 이용조건과 절차, 회사와 회원의 권리·의무 및
      책임사항을 정함을 목적으로 합니다.
    </p>

    <h2>제2조(용어의 정의)</h2>
    <ul>
      <li>“서비스”란 회사가 leva.ai.kr 및 app.leva.ai.kr에서 제공하는 학습 진단, AI 학습 경로,
        AI 멘토, 커뮤니티, 코드 실행 환경 등 일체의 서비스를 말합니다.</li>
      <li>“회원”이란 이 약관에 동의하고 서비스 이용계약을 체결한 사람을 말합니다.</li>
      <li>“콘텐츠”란 회원이 서비스에 게시하거나 전송한 글, 답변, 댓글, 코드, 질문 등
        일체의 자료를 말합니다.</li>
      <li>“베타 서비스”란 정식 출시 전 시험적으로 제공되는 현재 단계의 서비스를 말합니다.</li>
    </ul>

    <h2>제3조(약관의 게시와 개정)</h2>
    <p>
      회사는 이 약관을 서비스 화면에 게시합니다. 회사는 관련 법령을 위배하지 않는 범위에서
      약관을 개정할 수 있으며, 개정 시 적용일자와 개정 사유를 밝혀 적용일 7일 전부터
      공지합니다. 회원에게 불리한 개정은 30일 전부터 공지합니다.
    </p>
    <p>
      개정 내용이 회원의 권리·의무에 중대한 영향을 미치는 경우 회사는 회원의 재동의를 받을 수
      있습니다. 회원이 개정 약관에 동의하지 않는 경우 이용계약을 해지할 수 있습니다.
    </p>

    <h2>제4조(서비스의 내용)</h2>
    <p>회사가 제공하는 서비스는 다음과 같습니다.</p>
    <ul>
      <li>적응형 학습 진단</li>
      <li>진단 결과에 기반한 AI 학습 경로 제공</li>
      <li>학습 맥락을 첨부해 질문하는 AI 멘토</li>
      <li>커뮤니티 질문·답변</li>
      <li>코드 실행 환경(샌드박스)</li>
    </ul>
    <p>
      현재 서비스는 <strong>베타 단계이며 회원에게 무상으로 제공됩니다.</strong>
      회사는 앞으로 유료 서비스를 도입할 수 있으며, 이 경우 관련 사항을
      별도로 정해 사전에 공지하고 회원의 동의를 받습니다.
    </p>

    <h2>제5조(이용계약의 성립)</h2>
    <p>
      이용계약은 이용자가 이 약관에 동의하고 회사가 정한 가입 절차를 완료함으로써 성립합니다.
      회원 가입은 GitHub 또는 Google 계정을 통한 인증으로 이루어집니다.
    </p>
    <p>
      <strong>만 14세 미만은 서비스를 이용할 수 없습니다.</strong> 회사는 가입 시 출생 연도를
      확인해 만 14세 미만의 가입을 제한합니다. 베타 기간에는 회사가 정한 승인 절차를 거친
      이용자에게 서비스를 제공할 수 있습니다.
    </p>

    <h2>제6조(회원의 의무)</h2>
    <p>회원은 다음 행위를 해서는 안 됩니다.</p>
    <ul>
      <li>타인의 계정이나 개인정보를 도용하거나 부정하게 사용하는 행위</li>
      <li>회사의 사전 승낙 없이 자동화된 수단으로 서비스에 접근하거나 데이터를 수집하는 행위</li>
      <li>코드 실행 환경을 암호화폐 채굴, 외부 시스템 공격, 과도한 자원 점유 등
        학습 목적 외로 사용하는 행위</li>
      <li>타인의 저작권 등 권리를 침해하는 콘텐츠를 게시하는 행위</li>
      <li>서비스의 정상적인 운영을 방해하는 행위</li>
    </ul>
    <p>
      회원은 서비스에 자격증명·비밀키 등 비밀값이나 타인의 개인정보를 입력하거나 게시하지
      않아야 합니다. 코드와 오류 메시지에 그러한 정보가 포함되지 않도록 주의해 주시기 바랍니다.
    </p>

    <h2>제7조(콘텐츠의 권리와 이용허락)</h2>
    <p>
      회원이 게시한 <strong>콘텐츠의 저작권은 해당 회원에게 있습니다.</strong>
    </p>
    <p>
      회원은 회사에 대하여 콘텐츠를 서비스의 제공·운영·개선 및 품질 향상을 위하여 사용·복제·
      수정·저장·전시할 수 있는 무상의 <strong>비독점적</strong> 이용을 허락합니다.
      이 허락은 서비스 운영에 필요한 범위로 한정됩니다.
    </p>
    <p>
      회원이 콘텐츠를 삭제하거나 이용계약을 해지하면 회사는 해당 콘텐츠의 이용을 중단합니다.
      다만 다른 회원의 이용 맥락을 유지하기 위해 필요한 경우와 법령에 따라 보존해야 하는
      경우는 예외로 합니다. 회원은 자신이 게시한 콘텐츠에 대해 적법한 권리를 보유함을
      보증합니다.
    </p>

    <h2>제8조(AI 생성물의 성격과 한계)</h2>
    <p>
      진단 결과, 학습 경로, AI 멘토의 답변, 코드 리뷰 등 인공지능이 생성한 결과물은 학습을 돕기
      위한 <strong>참고 자료</strong>입니다.
    </p>
    <p>
      회사는 AI 생성물의 정확성·완전성·최신성을 <strong>보장하지 않습니다.</strong>
      인공지능은 사실과 다른 내용을 생성할 수 있습니다. 회원은 AI 생성물을 그대로 신뢰해
      발생한 결과에 대해 스스로 책임을 집니다. 특히 실제 개발 환경에 코드를 적용하기 전에는
      회원이 직접 검증해야 합니다.
    </p>
    <p>
      AI 멘토를 이용할 때 질문 내용과 학습 맥락이 국외의 인공지능 제공자에게 전송될 수
      있습니다. 자세한 내용은 <a href="/privacy">개인정보 처리방침</a>에서 확인할 수 있습니다.
    </p>

    <h2>제9조(커뮤니티 운영과 제재)</h2>
    <p>
      회원은 다른 회원의 콘텐츠가 이 약관이나 법령을 위반한다고 판단하는 경우
      <strong>신고</strong>할 수 있습니다.
    </p>
    <p>
      회사는 신고를 접수하면 해당 콘텐츠를 검토하고, 위반이 확인되면 게시물
      <strong>비공개</strong> 또는 삭제, 회원의 서비스 <strong>이용 제한</strong> 등의 조치를 할
      수 있습니다. 회사는 조치 전 또는 후에 해당 회원에게 사유를 알립니다. 다만 긴급한 경우
      조치 후에 알릴 수 있습니다. 회원은 조치에 대해 이의를 제기할 수 있습니다.
    </p>

    <h2>제10조(서비스의 변경·중단)</h2>
    <p>
      서비스는 베타 단계이므로 기능이 추가·변경·중단될 수 있습니다. 회사는 서비스의 내용을
      변경하거나 중단하는 경우 사전에 공지합니다. 다만 시스템 장애나 긴급한 보안 조치 등
      부득이한 사유가 있는 경우 사후에 공지할 수 있습니다.
    </p>

    <h2>제11조(광고의 게재)</h2>
    <p>
      회사는 서비스 화면에 광고를 게재할 수 있습니다. 광고에는 제3자 광고 사업자가 제공하는
      것이 포함될 수 있으며, 광고 사업자의 쿠키 사용에 관한 사항은
      <a href="/privacy">개인정보 처리방침</a>에서 안내합니다. 회원과 광고주 사이의 거래로
      발생한 문제에 대해 회사는 책임지지 않습니다.
    </p>

    <h2>제12조(이용계약의 해지와 이용 제한)</h2>
    <p>
      회원은 언제든지 서비스 내 기능을 통해 이용계약을 해지(회원 탈퇴)할 수 있습니다.
      회사는 회원이 제6조의 의무를 위반한 경우 사전 통지 후 서비스 이용을 제한하거나
      이용계약을 해지할 수 있습니다. 다만 서비스의 안정적 운영을 위해 긴급히 필요한 경우
      즉시 제한하고 사후에 알릴 수 있습니다.
    </p>
    <p>
      이용계약이 해지되면 회원의 개인정보는 <a href="/privacy">개인정보 처리방침</a>에 따라
      처리됩니다.
    </p>

    <h2>제13조(책임의 제한)</h2>
    <p>
      회사는 베타 기간 동안 서비스를 무상으로 제공하며, 서비스의 중단·오류·데이터 손실로
      회원에게 발생한 손해에 대하여 회사의 고의 또는 중대한 과실이 없는 한 책임지지 않습니다.
    </p>
    <p>
      회사는 서비스 이용을 통한 회원의 학습 성과나 취업·이직 등 특정 결과를 보장하지 않습니다.
      회원 사이 또는 회원과 제3자 사이에 발생한 분쟁에 개입할 의무가 없으며 그로 인한 손해를
      배상할 책임이 없습니다. 천재지변, 정전, 회선 장애 등 불가항력으로 서비스를 제공할 수 없는
      경우에도 책임지지 않습니다.
    </p>

    <h2>제14조(분쟁의 해결)</h2>
    <p>
      이 약관에 관하여는 대한민국 법을 적용합니다. 서비스 이용과 관련해 분쟁이 발생한 경우
      회사와 회원은 성실히 협의해 해결합니다. 협의로 해결되지 않는 경우 민사소송법에 따른
      관할 법원에 소를 제기할 수 있습니다.
    </p>

    <h2>부칙</h2>
    <p>이 약관은 2026년 8월 12일부터 시행합니다.</p>
    <ul>
      <li>상호: 레바</li>
      <li>사업자등록번호: 796-76-00732</li>
      <li>문의: <a href="mailto:info@leva.ai.kr">info@leva.ai.kr</a></li>
    </ul>
```

- [ ] **Step 4: 테스트가 green 이 되는 것을 확인한다**

Run: `npm test`
Expected: PASS (전체 스위트)

- [ ] **Step 5: 눈으로 확인한다**

```bash
npm run preview
```

브라우저에서 `http://localhost:4321/terms` 를 연다. 확인할 것: 조 제목이 계단식으로 보이는지, 목록의 들여쓰기가 깨지지 않는지, 푸터 링크가 동작하는지.

> `.legal ul` 이 다른 규칙을 이겨 `padding-left` 가 무효화된 사례가 있었다. 테스트는 이것을 잡지 못하므로 눈으로 본다.

- [ ] **Step 6: e2e 스모크에 약관 페이지를 넣는다**

`e2e/smoke.spec.js:42` 의 경로 배열에 `/terms.html` 을 추가한다. 약관은 목록이 많아 좁은 화면에서 밀릴 위험이 다른 페이지보다 크다.

```javascript
    for (const path of ['/', '/privacy.html', '/terms.html', '/beta.html', '/about.html', '/notes/']) {
```

같은 파일의 `test.describe('홈페이지 스모크', ...)` 블록 안에 페이지 로드 단언을 추가한다.

```javascript
  test('약관 페이지가 열리고 사업자 정보를 담는다', async ({ page }) => {
    await page.goto('/terms.html');

    await expect(page).toHaveTitle(/서비스 이용약관/);
    await expect(page.locator('h1')).toContainText('서비스 이용약관');
    await expect(page.locator('body')).toContainText('796-76-00732');
  });
```

Run: `npm run test:e2e`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add -- terms.html tests/terms-page.test.js e2e/smoke.spec.js
git commit -m "feat(terms): 약관 14개 조항 본문을 작성한다"
```

---

### Task 3: 푸터 상호 링크 (home-page)

**Files:**
- Modify: `tests/nav-consistency.test.js:10,12` · `index.html` · `privacy.html` · `beta.html` · `about.html` · `templates/note.html` · `templates/notes-index.html`

**Interfaces:**
- Consumes: Task 1 이 만든 `/terms` 경로
- Produces: 모든 페이지에서 약관에 도달 가능

- [ ] **Step 1: 테스트를 먼저 고쳐 red 를 만든다**

`tests/nav-consistency.test.js` 의 두 배열을 고친다. `PAGES` 에 `terms.html` 을 넣어 약관 페이지의 푸터도 같은 검사를 받게 한다(Task 1 골격에 이미 링크가 들어 있어 이 항목은 바로 통과한다).

```javascript
const PAGES = ['index.html', 'privacy.html', 'terms.html', 'beta.html', 'about.html'];
const TEMPLATES = ['templates/note.html', 'templates/notes-index.html'];
const REQUIRED_LINKS = ['/beta', '/about', '/notes/', '/privacy', '/terms'];
```

- [ ] **Step 2: red 를 확인한다**

Run: `npm test -- nav-consistency`
Expected: FAIL — **6곳**이 `['/terms']` 를 남기며 실패한다: `index.html` · `privacy.html` · `beta.html` · `about.html` · `templates/note.html` · `templates/notes-index.html`. `terms.html` 은 Task 1 골격의 푸터에 이미 모든 링크가 있으므로 통과한다.

> 실패가 6곳인지 센다. 적으면 어떤 파일의 푸터가 다른 구조인 것이므로 그 파일을 직접 열어 확인한다. `terms.html` 이 실패 목록에 있으면 Task 1 골격의 푸터가 잘못된 것이다.

- [ ] **Step 3: 여섯 파일 푸터에 링크를 넣는다**

각 파일에서 `<a href="/privacy">개인정보 처리방침</a>` 다음 줄에 아래를 넣는다.

```html
        <a href="/terms">서비스 이용약관</a>
```

- [ ] **Step 4: green 을 확인한다**

Run: `npm test`
Expected: PASS (전체 스위트)

- [ ] **Step 5: 커밋하고 PR 을 올린다**

```bash
git add -- tests/nav-consistency.test.js index.html privacy.html beta.html about.html templates/note.html templates/notes-index.html
git commit -m "feat(terms): 모든 페이지 푸터에서 약관에 닿게 한다"
git push -u origin feat/terms-of-service
gh pr create --base develop --title "feat: 서비스 이용약관 신설" --body "동의 화면이 필수로 받고 있는 약관 문서를 신설한다. 설계: docs/superpowers/specs/2026-08-12-terms-of-service-design.md"
```

> `git add -A` 를 쓰지 않는다. `.gstack/` 같은 도구 산출물이 커밋에 섞인 사례가 있다.

---

### Task 4: 앱 동의 화면에서 전문 열기 (frontend)

**Files:**
- Modify: `apps/web/lib/src/features/consent/presentation/consent_page.dart:16`
- Test: `apps/web/test/features/consent/consent_page_test.dart`

**Interfaces:**
- Consumes: Task 1~3 이 게시한 `https://leva.ai.kr/terms`
- Produces: 동의 화면 약관 항목의 「전문 보기」 버튼(`ValueKey('consent-terms-doc')`)

- [ ] **Step 1: 브랜치를 만든다**

```bash
cd /d/workspace/dpa/devpath-frontend
git switch develop && git pull
git switch -c feat/consent-terms-link
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`apps/web/test/features/consent/consent_page_test.dart` 에 추가한다. 기존 PRIVACY 테스트(174-178행)와 같은 `_RecordingOpener` fake 를 쓴다.

```dart
  testWidgets('약관 전문 링크가 약관 페이지를 연다', (tester) async {
    bigView(tester);
    final opener = _RecordingOpener();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [externalLinkOpenerProvider.overrideWithValue(opener)],
        child: _app(),
      ),
    );

    await tester.tap(find.byKey(const ValueKey('consent-terms-doc')));
    await tester.pump();

    expect(opener.opened, ['https://leva.ai.kr/terms']);
  });
```

- [ ] **Step 3: red 를 확인한다**

Run: `cd apps/web && flutter test test/features/consent/consent_page_test.dart --plain-name "약관 전문 링크가 약관 페이지를 연다"`
Expected: FAIL — `consent-terms-doc` 키를 가진 위젯이 없다. `docUrl` 이 `null` 이면 `secondary` 가 `null` 이라 버튼 자체가 렌더되지 않는다.

> `flutter test` 에는 `-n` 이 없다. `--plain-name` 이다.

- [ ] **Step 4: docUrl 을 추가한다**

`consent_page.dart:16` 을 다음으로 바꾼다.

```dart
  terms(
    'TERMS',
    true,
    '서비스 이용약관 동의',
    '서비스 이용에 필요한 기본 약관입니다.',
    docUrl: 'https://leva.ai.kr/terms',
  ),
```

- [ ] **Step 5: green 을 확인한다**

Run: `cd apps/web && flutter test test/features/consent/consent_page_test.dart`
Expected: PASS (파일 전체)

- [ ] **Step 6: 전체 스위트와 포맷 게이트를 통과시킨다**

```bash
cd /d/workspace/dpa/devpath-frontend
melos run analyze
melos run test
melos run format
```

Expected: `melos run format` 이 `0 changed` 를 출력한다.

> `melos run format` 은 어긋난 파일을 **실제로 고치면서 exit 1** 을 낸다. 한 번 실패했다면 재실행해 `0 changed` 를 눈으로 확인한다. `(1 changed)` 는 "고쳤다"가 아니라 "어긋나 있었다"는 뜻이다.

- [ ] **Step 7: 커밋하고 PR 을 올린다**

```bash
git add -- apps/web/lib/src/features/consent/presentation/consent_page.dart apps/web/test/features/consent/consent_page_test.dart
git commit -m "feat(consent): 동의 화면에서 이용약관 전문을 열 수 있게 한다"
git push -u origin feat/consent-terms-link
gh pr create --base develop --title "feat(consent): 이용약관 전문 링크" --body "TERMS 항목에 docUrl 을 추가한다. 약관 문서는 leva.ai.kr/terms 에 게시돼 있어야 한다."
```

---

### Task 5: 재동의 마이그레이션 (shared)

**Files:**
- Create: `src/main/resources/db/migration/V202608121001__terms_v2_reconsent.sql`

**Interfaces:**
- Consumes: 없음
- Produces: `users.consent_status` 가 `PENDING` 인 기존 이용자. Task 6 의 `ConsentType.TERMS = "v2"` 와 짝이다.

- [ ] **Step 1: 브랜치를 만든다**

```bash
cd /d/workspace/dpa/devpath-shared
git switch develop && git pull
git switch -c feat/terms-v2-reconsent
```

- [ ] **Step 2: 마이그레이션을 작성한다**

`src/main/resources/db/migration/V202608121001__terms_v2_reconsent.sql`

```sql
-- 서비스 이용약관(v2) 최초 게시에 따른 재동의.
--
-- 그동안 동의 화면은 「서비스 이용약관 동의」를 필수로 받았지만 약관 문서 자체가
-- 없었다. 문서를 게시했으므로 기존 이용자에게 다시 동의를 받는다.
--
-- 라우터 게이트가 users.consent_status 만 보므로(프론트 router.dart) 이 값을
-- 되돌리는 것만으로 다음 접속 시 동의 화면으로 유도된다.
--
-- 기존 동의 이력(user_consents)은 삭제하지 않는다 — 언제 무엇에 동의했는지는
-- 법정 증빙이므로 보존한다.
UPDATE users
   SET consent_status = 'PENDING'
 WHERE consent_status = 'DONE'
   AND deleted_at IS NULL;
```

- [ ] **Step 3: 로컬 DB 에 적용해 동작을 확인한다**

마이그레이션은 단위 테스트 대상이 아니다. 실제 SQL 이 의도한 행만 건드리는지 직접 본다.

```bash
psql "$LOCAL_DB_URL" -c "SELECT consent_status, count(*) FROM users GROUP BY 1;"
```

Expected: 적용 전후로 `DONE` 이 0이 되고 그만큼 `PENDING` 이 늘어난다. `deleted_at` 이 있는 행은 변하지 않는다.

> 로컬 DB 가 없으면 이 단계를 건너뛰지 말고 컨트롤러에게 보고한다. 운영 데이터를 처음 만지는 SQL 을 검증 없이 올리지 않는다.

- [ ] **Step 4: 커밋하고 PR 을 올린다**

```bash
git add src/main/resources/db/migration/V202608121001__terms_v2_reconsent.sql
git commit -m "feat(consent): 약관 v2 게시에 따른 재동의 마이그레이션"
git push -u origin feat/terms-v2-reconsent
gh pr create --base develop --title "feat(consent): 약관 v2 재동의 마이그레이션" --body "consent_status 를 PENDING 으로 되돌려 다음 접속 시 재동의를 받는다. 동의 이력은 보존한다."
```

- [ ] **Step 5: 머지 후 수동 발행한다**

```bash
gh workflow run publish.yml --ref develop
```

> shared 는 `main` 푸시에서만 자동 발행된다. 이 단계를 빠뜨리면 서비스가 새 마이그레이션을 보지 못한다.

---

### Task 6: 약관 버전 v2 (platform-svc)

**Files:**
- Modify: `src/main/java/ai/devpath/platform/consent/ConsentType.java:5`
- Test: `src/test/java/ai/devpath/platform/consent/ConsentServiceTest.java`

**Interfaces:**
- Consumes: Task 5 의 마이그레이션
- Produces: 재동의 시 `user_consents.version` 에 `"v2"` 로 저장되는 TERMS 동의

- [ ] **Step 1: 브랜치를 만든다**

```bash
cd /d/workspace/dpa/devpath-platform-svc
git switch develop && git pull
git switch -c feat/terms-consent-v2
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`ConsentServiceTest.java` 에 추가한다. 기존 `submitPersistsEachConsentAndSetsBirthYear` 와 같은 방식으로 저장된 엔티티를 확인한다.

`consents` 는 **Mockito mock** 이다(`setup()` 29행). 저장된 엔티티를 조회할 수 없으므로 `ArgumentCaptor` 로 `save()` 인자를 붙잡아 확인한다. `requestWith(birthYear, items...)` 는 기존 헬퍼다(36-38행).

파일 상단 import 에 다음을 추가한다.

```java
import org.mockito.ArgumentCaptor;
```

테스트 본문:

```java
  @Test
  void submitPersistsTermsAtVersionTwo() {
    User user = new User();
    when(users.findById(1L)).thenReturn(Optional.of(user));
    when(consents.findByUserIdOrderByAgreedAtDesc(1L)).thenReturn(List.of());
    ConsentSubmitRequest req =
        requestWith(1990, new ConsentSubmitRequest.Item(ConsentType.TERMS, true));

    service.submit(1L, req);

    ArgumentCaptor<Consent> saved = ArgumentCaptor.forClass(Consent.class);
    verify(consents).save(saved.capture());
    assertThat(saved.getValue().getType()).isEqualTo(ConsentType.TERMS);
    assertThat(saved.getValue().getVersion()).isEqualTo("v2");
  }

  // 약관만 개정했다. 처리방침 버전을 함께 올리면 동의 이력이 사실과 어긋난다
  // (재동의 시 PRIVACY 도 다시 받지만, 받는 것은 여전히 v1 이다).
  @Test
  void privacyStaysAtVersionOne() {
    assertThat(ConsentType.PRIVACY.version).isEqualTo("v1");
  }
```

- [ ] **Step 3: red 를 확인한다**

Run: `./gradlew test --tests '*ConsentServiceTest*'`
Expected: FAIL — `submitPersistsTermsAtVersionTwo` 가 `"v1"` 을 받아 실패한다. `privacyStaysAtVersionOne` 은 통과한다.

- [ ] **Step 4: 버전을 올린다**

`ConsentType.java:5` 을 다음으로 바꾼다.

```java
	TERMS(true, "v2"),
```

나머지 상수는 그대로 둔다.

- [ ] **Step 5: green 을 확인한다**

Run: `./gradlew test`
Expected: PASS (전체 스위트)

> Redis 가 없으면 다른 테스트가 무더기로 깨진다. 이 Task 와 무관한 실패가 나오면 Redis 기동 여부를 먼저 확인한다.

- [ ] **Step 6: 커밋하고 PR 을 올린다**

```bash
git add -- src/main/java/ai/devpath/platform/consent/ConsentType.java src/test/java/ai/devpath/platform/consent/ConsentServiceTest.java
git commit -m "feat(consent): 이용약관 버전을 v2로 올린다"
git push -u origin feat/terms-consent-v2
gh pr create --base develop --title "feat(consent): 약관 버전 v2" --body "약관 최초 게시에 따라 TERMS 버전을 v2 로 올린다. 재동의 발동은 shared 마이그레이션이 담당한다."
```

---

### Task 7: 배포와 라이브 검증

**순서를 지키지 않으면 이용자가 「읽을 수 없는 약관에 동의하라」는 화면을 본다.** 앞 단계가 라이브에서 확인되기 전에 다음 단계를 실행하지 않는다.

**Files:** 없음(배포 작업)

**Interfaces:**
- Consumes: Task 1~6 의 머지된 결과
- Produces: 라이브 약관 페이지 · 앱의 전문 링크 · 재동의 발동

- [ ] **Step 1: home-page 를 배포한다**

home-page 는 머지만으로 배포되지 않는다. wrangler 직접 업로드다.

```bash
cd /d/workspace/dpa/devpath-home-page
git switch develop && git pull
npm run build
npx wrangler pages deploy dist --project-name=devpath-home-page --branch=develop
```

> **CF Pages production 브랜치는 `develop` 이다.** `--branch=main` 으로 올리면 preview 로 가고 `leva.ai.kr` 은 바뀌지 않는다.

- [ ] **Step 2: 라이브를 반복 측정한다**

```bash
curl.exe -4 -s -o /dev/null -w "%{http_code}\n" https://leva.ai.kr/terms
curl.exe -4 -s https://leva.ai.kr/terms | grep -c 'canonical.*leva.ai.kr/terms'
curl.exe -4 -s https://leva.ai.kr/sitemap.xml | grep -c '/terms'
```

Expected: `200` · `1` · `1`

> 배포 직후 단발 측정은 믿을 수 없다. CF 엣지가 경로별로 옛/새를 섞어 응답한 사례가 하루 6회 관측됐다. 같은 명령을 간격을 두고 3회 이상 돌려 값이 안정되는 것을 확인한다.

- [ ] **Step 3: frontend 를 릴리스한다**

```bash
cd /d/workspace/dpa/devpath-frontend
gh pr create --base main --head develop --title "release: 이용약관 링크 + 처리방침 링크" --body "약관 전문 링크(Task 4)와 대기 중이던 처리방침 링크(#124)를 함께 릴리스한다."
```

CI 가 녹색인 것을 확인하고 머지한다.

> `web-deploy` 는 `refs/heads/main` 에서만 돈다. 릴리스하지 않으면 앱에 반영되지 않는다.
> `gh pr checks --watch` 가 504 로 끊기면 CI 미완료 상태로 머지할 위험이 있다. 끊기면 `gh pr checks` 를 다시 호출해 상태를 직접 확인한다.

- [ ] **Step 4: 앱에서 눈으로 확인한다**

`https://app.leva.ai.kr` 동의 화면에서 「서비스 이용약관 동의」 옆 **전문 보기** 버튼이 보이는지, 눌렀을 때 약관 페이지가 새 탭으로 열리는지, 그리고 **버튼을 눌러도 체크가 켜지지 않는지** 확인한다.

- [ ] **Step 5: 재동의를 발동한다 (마지막)**

1·2·3·4 가 모두 확인된 뒤에만 실행한다.

1. shared 발행이 끝났는지 확인한다(Task 5 Step 5).
2. **platform-svc 를 먼저 배포하고** `ConsentType.TERMS` 가 `"v2"` 인 것을 확인한다.
   - 순서가 중요하다. 마이그레이션이 먼저 돌면 그 순간부터 이용자가 `PENDING` 이 되는데,
     platform-svc 가 아직 v1 이면 그 사이에 동의한 이용자의 이력에 **`v1` 이 저장된다.**
     그 이용자는 `consent_status='DONE'` 이 되어 **다시 물을 수 없다.**
3. 마이그레이션 잡을 실행하기 **직전에** 되돌릴 근거를 파일로 남긴다.

   ```sql
   SELECT id, consent_status FROM users WHERE consent_status = 'DONE' AND deleted_at IS NULL;
   ```

   이 UPDATE 는 되돌릴 수 없다. 목록이 없으면 복구할 대상을 특정할 수 없다.
4. 중앙 마이그레이션 잡을 실행한다.
5. 영향 행 수를 3에서 남긴 목록과 대조한다. 수가 다르면 멈추고 원인을 확인한다.

- [ ] **Step 6: 재동의가 실제로 걸리는지 확인한다**

기존 계정으로 앱에 접속해 동의 화면으로 유도되는지, 동의 후 정상 진입하는지 확인한다.

```sql
SELECT type, version, agreed_at FROM user_consents WHERE user_id = <본인 id> ORDER BY agreed_at DESC LIMIT 5;
```

Expected: TERMS 가 `v2` 로, PRIVACY 가 `v1` 로 새로 저장돼 있다.

---

## 완료 조건

- `https://leva.ai.kr/terms` 가 200 으로 응답하고 sitemap 에 있다.
- 앱 동의 화면에서 약관 전문을 열 수 있다.
- 기존 이용자가 다음 접속 시 재동의 화면을 본다.
- `user_consents` 에 TERMS `v2` 동의가 기록된다.
- 기존 동의 이력이 삭제되지 않았다.
