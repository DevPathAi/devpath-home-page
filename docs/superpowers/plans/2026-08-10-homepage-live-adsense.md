# 홈페이지 라이브 + 애드센스 심사 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `leva.ai.kr` 루트를 라이브로 만들고, 애드센스 심사를 신청할 수 있는 상태까지 도달한다.

**Architecture:** 정적 사이트 `devpath-home-page`에 애드센스 스크립트·canonical 교정·`robots.txt`를 넣고, Cloudflare Pages로 배포한 뒤 도메인 NS를 가비아에서 Cloudflare로 이전해 루트 도메인을 CNAME flattening으로 연결한다. 광고 슬롯은 배치하지 않는다.

**Tech Stack:** 바닐라 HTML/CSS/ES모듈 · Vitest(유닛) · Playwright(E2E) · Cloudflare Pages + Pages Functions · wrangler

**설계 스펙:** [`docs/superpowers/specs/2026-08-10-homepage-live-adsense-design.md`](../specs/2026-08-10-homepage-live-adsense-design.md)

## Global Constraints

- **퍼블리셔 ID는 `ca-pub-2785578834914321`** (공개 값, 커밋 가능). `ads.txt`에는 `ca-` 접두사 없이 `pub-2785578834914321`로 들어간다.
- **광고 슬롯(`<ins class="adsbygoogle">`)을 배치하지 않는다.** 심사 신청에 필요한 것은 `<head>` 스크립트와 `ads.txt`뿐이고, 슬롯을 두면 심사 대기 동안 빈 자리만 남는다.
- **자동 광고(Auto ads)를 켜지 않는다.** 리드폼이 목표인 페이지의 전환율을 해친다.
- **애드센스 스크립트는 `<head>`에 정적으로 둔다.** 심사 크롤러가 페이지에서 찾아야 하므로 지연 주입 금지.
- **정규 도메인은 `https://leva.ai.kr/`이다.** `devpath.ai`는 이 레포 어디에도 남으면 안 된다.
- **Cloudflare API 토큰을 커밋하지 않는다.** 셸 환경변수로만 전달한다.
- **모든 작업은 `develop`에서 분기한 새 브랜치에서 한다.** `main`·`develop` 직접 push 금지.
- **`git` 명령에는 항상 `-C /d/workspace/dpa/devpath-home-page`를 쓴다.** `cd` 후 상대경로 금지.
- **Test-First.** 실패하는 테스트를 먼저 쓰고, 실패를 눈으로 확인한 뒤 최소 구현을 한다.

## 브랜치와 PR

| 순서 | 브랜치 | Task |
|---|---|---|
| 1 | `feat/homepage-adsense-live` | Task 1 ~ 4 |
| 2 | — (인프라 작업, 커밋 없음) | Task 5 ~ 7 |
| 3 | `docs/adsense-review-runbook` | Task 8 |

## File Structure

**devpath-home-page**
- Modify: `index.html` — canonical·OG 도메인 교정(Task 1), 애드센스 스크립트 추가(Task 2)
- Create: `robots.txt` — 크롤러 허용 + sitemap 지시 (Task 3)
- Create: `tests/head-meta.test.js` — `<head>` 메타 정합성 회귀 가드 (Task 1·2)
- Create: `tests/deploy-entries.test.js` — 배포 화이트리스트와 실제 파일의 일치 가드 (Task 3)
- Create: `docs/superpowers/runbooks/2026-08-10-adsense-review.md` — 심사 신청 절차 (Task 8)

---

## Task 1: canonical·OG 도메인 교정

**Files:**
- Modify: `index.html` (4곳: 10·18·19·26행)
- Test: `tests/head-meta.test.js` (신설)

**Interfaces:**
- Consumes: 없음 (첫 Task)
- Produces: `index.html`의 정규 도메인이 `https://leva.ai.kr/`. Task 2가 같은 테스트 파일에 케이스를 추가한다.

> **왜 이게 먼저인가:** 존재하지 않는 도메인(`devpath.ai`)을 정규 URL로 선언한 채 배포하면 SEO와 애드센스 크롤러 양쪽이 엉뚱한 곳을 본다. 배포 전 필수 수정이다.

- [ ] **Step 1: 브랜치 분기**

```bash
git -C /d/workspace/dpa/devpath-home-page fetch origin
git -C /d/workspace/dpa/devpath-home-page switch -c feat/homepage-adsense-live origin/develop
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/head-meta.test.js`를 새로 만든다. 기존 테스트와 같은 vitest 스타일이다.

```javascript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(
  fileURLToPath(new URL('../index.html', import.meta.url)),
  'utf-8',
);

const SITE = 'https://leva.ai.kr';

describe('index.html <head> 메타', () => {
  it('canonical이 leva.ai.kr을 가리킨다', () => {
    expect(html).toContain(`<link rel="canonical" href="${SITE}/" />`);
  });

  it('og:url이 leva.ai.kr을 가리킨다', () => {
    expect(html).toContain(`<meta property="og:url" content="${SITE}/" />`);
  });

  it('og:image가 leva.ai.kr 절대경로다', () => {
    expect(html).toContain(
      `<meta property="og:image" content="${SITE}/assets/og-image.png" />`,
    );
  });

  it('twitter:image가 leva.ai.kr 절대경로다', () => {
    expect(html).toContain(
      `<meta name="twitter:image" content="${SITE}/assets/og-image.png" />`,
    );
  });

  // 개별 단언은 "고쳤다"만 보장하고 "안 고친 게 남았다"는 못 잡는다.
  // 이 사이트의 옛 도메인이 어디에도 남지 않았음을 별도로 못박는다.
  it('devpath.ai가 한 곳도 남아 있지 않다', () => {
    expect(html).not.toContain('devpath.ai');
  });
});
```

- [ ] **Step 3: 테스트를 돌려 실패를 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm test -- head-meta
```

기대: 5개 중 **canonical·og:url·og:image·twitter:image·devpath.ai 전부 실패.** 현재 값이 `https://devpath.ai/`이기 때문이다.

- [ ] **Step 4: `index.html` 4곳 교정**

각각 정확히 아래로 바꾼다.

10행:
```html
  <link rel="canonical" href="https://leva.ai.kr/" />
```

18행:
```html
  <meta property="og:url" content="https://leva.ai.kr/" />
```

19행:
```html
  <meta property="og:image" content="https://leva.ai.kr/assets/og-image.png" />
```

26행:
```html
  <meta name="twitter:image" content="https://leva.ai.kr/assets/og-image.png" />
```

- [ ] **Step 5: 테스트를 돌려 통과를 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm test -- head-meta
```

기대: 5개 PASS.

- [ ] **Step 6: 기존 테스트 회귀 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm test
```

기대: 기존 유닛 32건 + 신규 5건 전부 PASS.

- [ ] **Step 7: 커밋**

```bash
git -C /d/workspace/dpa/devpath-home-page add index.html tests/head-meta.test.js
git -C /d/workspace/dpa/devpath-home-page commit -m "fix(seo): 정규 도메인을 leva.ai.kr로 교정한다

canonical과 OG/twitter 이미지가 존재하지 않는 devpath.ai를 가리키고 있었다.
이 상태로 배포하면 SEO와 애드센스 크롤러 양쪽이 엉뚱한 도메인을 본다.

개별 단언만으로는 '안 고친 게 남았다'를 못 잡으므로 devpath.ai 부재를
별도 케이스로 못박는다."
```

---

## Task 2: 애드센스 스크립트 배선

**Files:**
- Modify: `index.html` (`<head>`, SEO 블록 뒤)
- Test: `tests/head-meta.test.js` (Task 1에서 만든 파일에 케이스 추가)

**Interfaces:**
- Consumes: Task 1의 `tests/head-meta.test.js`
- Produces: `<head>`에 `adsbygoogle.js?client=ca-pub-2785578834914321` 스크립트. Task 5의 배포 검증이 이걸 실측한다.

> **광고 슬롯을 넣지 않는다.** 심사 신청에 필요한 건 스크립트와 `ads.txt`뿐이다.

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/head-meta.test.js`의 기존 `describe` 블록 **아래**에 새 블록을 추가한다.

```javascript
describe('애드센스 배선', () => {
  const PUB = 'ca-pub-2785578834914321';

  it('애드센스 스크립트가 퍼블리셔 ID와 함께 있다', () => {
    expect(html).toContain(
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUB}`,
    );
  });

  it('스크립트가 async + crossorigin으로 로드된다', () => {
    const tag = html.match(/<script[^>]*adsbygoogle\.js[^>]*>/)?.[0] ?? '';
    expect(tag).toContain('async');
    expect(tag).toContain('crossorigin="anonymous"');
  });

  it('스크립트가 </head> 앞에 있다 (심사 크롤러가 head에서 찾는다)', () => {
    const headEnd = html.indexOf('</head>');
    const script = html.indexOf('adsbygoogle.js');
    expect(script).toBeGreaterThan(-1);
    expect(script).toBeLessThan(headEnd);
  });

  // 심사 전에는 광고가 나오지 않는다. 슬롯을 두면 빈 자리만 남는다.
  it('광고 슬롯(<ins>)은 배치하지 않는다', () => {
    expect(html).not.toContain('adsbygoogle"');
    expect(html).not.toContain('<ins');
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm test -- head-meta
```

기대: 애드센스 블록 3건 실패(스크립트 부재), `<ins>` 부재 1건은 통과.

- [ ] **Step 3: `index.html`에 스크립트 추가**

`<meta name="theme-color" content="#f8fafc" />` **바로 다음 줄**에 넣는다(SEO 블록 끝).

```html

  <!-- ── 구글 애드센스 ───────────────────────────────────────────────── -->
  <!-- 퍼블리셔 ID는 공개 값이다. 심사 크롤러가 <head>에서 스크립트를 찾아야
       하므로 지연 주입하지 않는다. 광고 슬롯은 승인 후 별도 결정. -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2785578834914321"
          crossorigin="anonymous"></script>
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm test -- head-meta
```

기대: 9개(Task 1의 5 + 신규 4) 전부 PASS.

- [ ] **Step 5: E2E 회귀 확인**

애드센스 스크립트가 외부 네트워크를 타므로 기존 E2E가 깨지지 않는지 본다.

```bash
cd /d/workspace/dpa/devpath-home-page && npm run test:e2e
```

기대: 기존 E2E 6건 PASS. 실패하면 네트워크 대기 때문일 수 있으니 실패 메시지를 먼저 읽는다 — 추측으로 고치지 않는다.

- [ ] **Step 6: 커밋**

```bash
git -C /d/workspace/dpa/devpath-home-page add index.html tests/head-meta.test.js
git -C /d/workspace/dpa/devpath-home-page commit -m "feat(ads): 애드센스 스크립트를 head에 배선한다

퍼블리셔 ID ca-pub-2785578834914321(공개 값). 심사 크롤러가 head에서 찾아야
하므로 정적으로 둔다.

광고 슬롯은 배치하지 않는다 - 심사 전에는 광고가 나오지 않아 빈 자리만
남는다. 테스트가 <ins> 부재를 단언해 실수로 들어가는 것을 막는다."
```

---

## Task 3: `robots.txt` 신설과 배포 화이트리스트 가드

**Files:**
- Create: `robots.txt`
- Test: `tests/deploy-entries.test.js` (신설)

**Interfaces:**
- Consumes: 없음
- Produces: `robots.txt`가 배포 산출물(`dist/`)에 포함된다. Task 7의 최종 검증이 `https://leva.ai.kr/robots.txt`를 확인한다.

> **이 Task가 잡는 진짜 함정:** `build.mjs`의 `DEPLOY_ENTRIES`에 `'robots.txt'`가 **이미 등록돼 있는데 파일이 실재하지 않는다.** 반대 방향(파일은 있는데 목록에 없음)은 `ads.txt`에서 이미 밟은 적 있다 — 그때는 `build.mjs`를 함께 고쳐서 해결했다. 두 방향을 모두 막는 테스트를 만든다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/deploy-entries.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const buildSrc = readFileSync(root('build.mjs'), 'utf-8');

// build.mjs의 DEPLOY_ENTRIES 배열 리터럴을 그대로 읽어낸다.
function deployEntries() {
  const m = buildSrc.match(/const DEPLOY_ENTRIES = \[([^\]]*)\]/);
  if (!m) throw new Error('DEPLOY_ENTRIES를 찾지 못했다');
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

// 크롤러가 반드시 읽어야 하는 파일. 이 둘만 양방향으로 못박는다.
const CRAWLER_FILES = ['robots.txt', 'ads.txt'];

describe('배포 화이트리스트', () => {
  // build.mjs는 없는 엔트리를 ENOENT로 조용히 건너뛴다("빌드 초기 단계 허용").
  // 그래서 "목록에 있는데 파일이 없다"가 빌드를 깨지 않고 조용히 배포에서 빠진다.
  // 실제로 _redirects·favicon.ico는 지금도 목록에만 있고 파일이 없다 — 이는
  // 의도된 허용이므로 전수 검사는 하지 않고, 크롤러 필수 파일만 단언한다.
  it.each(CRAWLER_FILES)('%s는 목록에 있고 파일도 존재한다', (name) => {
    expect(deployEntries()).toContain(name); // 목록 누락 → dist/로 안 나감
    expect(existsSync(root(name))).toBe(true); // 파일 부재 → 조용히 건너뜀
  });

  it('robots.txt가 크롤러를 허용한다', () => {
    const txt = readFileSync(root('robots.txt'), 'utf-8');
    expect(txt).toContain('User-agent: *');
    expect(txt).toContain('Allow: /');
  });

  it('ads.txt가 퍼블리셔 ID를 담고 있다', () => {
    const txt = readFileSync(root('ads.txt'), 'utf-8');
    expect(txt).toContain('pub-2785578834914321');
    expect(txt).toContain('DIRECT');
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm test -- deploy-entries
```

기대: **2건 실패** — `it.each`의 `robots.txt` 케이스가 파일 부재로 실패하고, 「robots.txt가 크롤러를 허용한다」가 읽기 실패로 깨진다. `ads.txt` 케이스 2건은 통과한다(PR #10에서 파일·목록 등록 모두 완료됨).

> `_redirects`·`favicon.ico`는 목록에만 있고 파일이 없지만 **의도된 허용**이라 단언하지 않는다. `build.mjs`가 `ENOENT`를 조용히 건너뛰도록 명시적으로 작성돼 있다.

- [ ] **Step 3: `robots.txt` 작성**

레포 루트에 만든다.

```
User-agent: *
Allow: /

Sitemap: https://leva.ai.kr/sitemap.xml
```

> `sitemap.xml`은 이번에 만들지 않는다. 단일 페이지 사이트라 실익이 없고, 없는 파일을 가리키는 `Sitemap:` 지시는 크롤러가 무시한다. 콘텐츠가 늘어나는 2단계에서 함께 만들 때 이 파일을 다시 건드리지 않으려고 지금 넣어둔다.

- [ ] **Step 4: 테스트를 돌려 통과를 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm test -- deploy-entries
```

기대: 4개 PASS.

- [ ] **Step 5: 빌드 산출물을 눈으로 확인**

테스트는 소스만 본다. 실제로 `dist/`에 나가는지는 빌드해서 확인한다.

```bash
cd /d/workspace/dpa/devpath-home-page && npm run build && ls -l dist/robots.txt dist/ads.txt && cat dist/robots.txt
```

기대: 두 파일 모두 존재하고 `dist/robots.txt` 내용이 위와 같다.

- [ ] **Step 6: 전체 테스트**

```bash
cd /d/workspace/dpa/devpath-home-page && npm run test:all
```

기대: 유닛(기존 32 + 신규 9 + 신규 4) + E2E 6 전부 PASS.

- [ ] **Step 7: 커밋**

```bash
git -C /d/workspace/dpa/devpath-home-page add robots.txt tests/deploy-entries.test.js
git -C /d/workspace/dpa/devpath-home-page commit -m "feat(seo): robots.txt를 추가하고 배포 화이트리스트를 가드한다

build.mjs의 DEPLOY_ENTRIES에 robots.txt가 등록돼 있었으나 파일이 실재하지
않았다. 이 레포는 화이트리스트 복사 빌드라 두 방향 모두 조용히 실패한다:
목록에 있는데 파일이 없거나, 파일은 있는데 목록에 없거나.

테스트가 양방향을 모두 막는다."
```

---

## Task 4: PR과 머지

**Files:** 없음 (통합 작업)

**Interfaces:**
- Consumes: Task 1~3의 커밋
- Produces: `develop`에 반영된 코드. Task 5가 이 커밋을 배포한다.

- [ ] **Step 1: 푸시**

```bash
git -C /d/workspace/dpa/devpath-home-page push -u origin feat/homepage-adsense-live
```

- [ ] **Step 2: PR 생성**

```bash
gh pr create --repo DevPathAi/devpath-home-page --base develop --head feat/homepage-adsense-live \
  --title "feat: 애드센스 심사 준비 — 스크립트 배선·정규 도메인 교정·robots.txt" \
  --body "leva.ai.kr을 라이브로 만들고 애드센스 심사를 신청하기 위한 코드 변경 3건.

## 변경
- **애드센스 스크립트**를 \`<head>\`에 배선(\`ca-pub-2785578834914321\`). 광고 슬롯은 배치하지 않는다 — 심사 전에는 광고가 나오지 않아 빈 자리만 남는다.
- **정규 도메인 교정** — canonical·og:url·og:image·twitter:image가 존재하지 않는 \`devpath.ai\`를 가리키고 있었다.
- **robots.txt 신설** — \`DEPLOY_ENTRIES\`에 등록돼 있었으나 파일이 실재하지 않았다.

## 테스트
- \`tests/head-meta.test.js\` 9건 신설 — 개별 단언에 더해 \`devpath.ai\` 부재와 \`<ins>\` 부재를 못박는다(고쳤다만이 아니라 '남은 게 없다'를 검증).
- \`tests/deploy-entries.test.js\` 4건 신설 — 화이트리스트와 실제 파일의 불일치를 양방향으로 막는다.
- \`npm run test:all\` 전부 통과.

설계: \`docs/superpowers/specs/2026-08-10-homepage-live-adsense-design.md\`"
```

- [ ] **Step 3: CI 확인 후 머지**

```bash
gh pr checks --repo DevPathAi/devpath-home-page feat/homepage-adsense-live --watch
gh pr merge --repo DevPathAi/devpath-home-page feat/homepage-adsense-live --merge
```

기대: CI 녹색 후 머지. **CI가 빨간 상태로 머지하지 않는다.**

---

## Task 5: Cloudflare Pages 배포 (도메인 연결 전)

**Files:** 없음 (인프라 작업)

**Interfaces:**
- Consumes: Task 4가 머지한 `develop`
- Produces: `https://<project>.pages.dev`에서 동작하는 사이트. Task 7이 여기에 커스텀 도메인을 붙인다.

> **선결조건:** Cloudflare **API 토큰**과 **Account ID**. 토큰 권한 = `Account: Cloudflare Pages:Edit` + `Zone: DNS:Edit` + `Zone: Zone:Edit`. **토큰을 커밋하거나 파일에 쓰지 않는다** — 셸 환경변수로만 전달한다. 값이 없으면 이 Task를 시작하지 말고 사용자에게 요청한다.

- [ ] **Step 1: 토큰 확인**

```bash
export CLOUDFLARE_API_TOKEN='<사용자가 제공한 토큰>'
export CLOUDFLARE_ACCOUNT_ID='<사용자가 제공한 계정 ID>'
npx wrangler whoami
```

기대: 계정이 표시되고 토큰 권한 목록에 Pages·DNS·Zone 편집이 보인다. 권한이 부족하면 여기서 멈추고 사용자에게 알린다.

- [ ] **Step 2: develop 최신화 후 빌드**

```bash
git -C /d/workspace/dpa/devpath-home-page switch develop
git -C /d/workspace/dpa/devpath-home-page pull --ff-only
cd /d/workspace/dpa/devpath-home-page && npm run build
```

기대: `dist/`에 `index.html`·`ads.txt`·`robots.txt`·`assets`·`src`·`_headers`가 있다.

- [ ] **Step 3: Pages 프로젝트 생성**

```bash
cd /d/workspace/dpa/devpath-home-page && npx wrangler pages project create devpath-home-page --production-branch develop
```

기대: 프로젝트가 생성되고 `devpath-home-page.pages.dev` 도메인이 안내된다. 이미 있으면 이 단계를 건너뛴다.

- [ ] **Step 4: 배포**

```bash
cd /d/workspace/dpa/devpath-home-page && npx wrangler pages deploy dist --project-name devpath-home-page --branch develop
```

기대: 배포 URL이 출력된다.

- [ ] **Step 5: `*.pages.dev`에서 동작 검증 — 도메인 연결 전에 여기서 먼저 잡는다**

`<배포URL>`을 실제 값으로 바꿔 실행한다.

```bash
BASE='<배포URL>'
echo "--- 상태코드 ---"
for p in / /ads.txt /robots.txt; do printf "%-14s " "$p"; curl -s -o /dev/null -w "%{http_code} %{content_type}\n" --max-time 15 "$BASE$p"; done
echo "--- ads.txt 본문 ---"; curl -s --max-time 15 "$BASE/ads.txt"
echo "--- head에 애드센스 ---"; curl -s --max-time 15 "$BASE/" | grep -c "adsbygoogle.js?client=ca-pub-2785578834914321"
echo "--- devpath.ai 잔여 ---"; curl -s --max-time 15 "$BASE/" | grep -c "devpath.ai"
```

기대:
- `/` → `200 text/html`
- `/ads.txt` → **`200 text/plain`** 이고 본문이 `google.com, pub-2785578834914321, DIRECT, f08c47fec0942fa0`
- `/robots.txt` → `200 text/plain`
- 애드센스 스크립트 grep → `1`
- `devpath.ai` grep → **`0`**

> ⚠️ **`/ads.txt`의 `content-type`을 반드시 본다.** 앱 쪽에서 이미 밟은 함정이다 — SPA 폴백이 `/ads.txt`에 `index.html`을 200으로 돌려줘서 상태코드만 보면 정상으로 보였다. `text/plain`이 아니면 실패로 처리한다.

- [ ] **Step 6: `APPS_SCRIPT_URL` 처리 (조건부)**

리드폼은 `/api/lead`(CF Pages Function)를 거쳐 Apps Script로 포워딩된다. `config.js`가 미설정 시 "폼은 검증까지 동작하고 제출 단계에서 안내 메시지로 graceful degrade"하도록 설계돼 있어 **심사 배포의 선결조건이 아니다.**

사용자에게 Apps Script Web App `/exec` URL이 있는지 묻는다.

- **있으면** 등록한다:
  ```bash
  npx wrangler pages secret put APPS_SCRIPT_URL --project-name devpath-home-page
  ```
- **없으면** 등록하지 않고 넘어간다. 리드폼이 제출 단계에서 안내 메시지를 띄우는 상태가 되며, 이는 정상 동작이다. 값이 확보되면 나중에 위 명령으로 추가한다.

어느 쪽이든 **심사 신청을 막지 않는다.**

- [ ] **Step 7: 결과 보고**

`pages.dev` URL과 Step 5의 검증 결과, `APPS_SCRIPT_URL` 등록 여부를 사용자에게 보고한다. **여기서 멈추고 다음 Task로 넘어가기 전에 확인을 받는다** — 다음부터는 DNS를 건드린다.

---

## Task 6: Cloudflare 존 추가와 레코드 대조 게이트

**Files:** 없음 (인프라 작업)

**Interfaces:**
- Consumes: Task 5의 토큰·계정
- Produces: Cloudflare에 `leva.ai.kr` 존과 가져온 레코드. Task 7이 NS 변경 후 이걸 사용한다.

> **이 Task는 아무것도 되돌릴 수 없게 만들지 않는다.** 존을 추가해도 가비아 NS가 그대로면 실제 DNS는 바뀌지 않는다. 되돌릴 수 없는 지점은 Task 7의 NS 변경이다.

- [ ] **Step 1: 이전 전 현재 레코드를 다시 실측해 기록**

```bash
for r in "MX leva.ai.kr" "TXT google._domainkey.leva.ai.kr" "A app.leva.ai.kr" "A api.leva.ai.kr" "A admin.leva.ai.kr"; do
  set -- $r; printf "%-38s " "$1 $2"; nslookup -type=$1 $2 8.8.8.8 2>&1 | grep -i "mail exchanger\|text =\|^Address" | tail -1
done
```

기대(2026-08-10 실측 기준):

| 유형 | 이름 | 값 |
|---|---|---|
| `MX` | `leva.ai.kr` | `smtp.google.com` (preference 1) |
| `TXT` | `google._domainkey` | Google Workspace DKIM |
| `A` | `app` | `13.124.153.105` |
| `A` | `api` | `13.124.153.105` |
| `A` | `admin` | `13.124.153.105` |

**출력을 그대로 저장해 둔다.** 다음 단계의 대조 기준이다.

- [ ] **Step 2: Cloudflare에 존 추가**

```bash
curl -sS -X POST "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"name\":\"leva.ai.kr\",\"account\":{\"id\":\"$CLOUDFLARE_ACCOUNT_ID\"},\"type\":\"full\"}" \
  | py -c "import sys,json;d=json.load(sys.stdin);print('success:',d['success']);print('errors:',d.get('errors'));r=d.get('result') or {};print('zone_id:',r.get('id'));print('name_servers:',r.get('name_servers'))"
```

기대: `success: True`, `zone_id`와 `name_servers` 2개가 출력된다. **`zone_id`와 `name_servers`를 기록한다.**

- [ ] **Step 3: Cloudflare가 가져온 레코드 조회**

```bash
export CF_ZONE_ID='<Step 2의 zone_id>'
curl -sS "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records?per_page=100" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  | py -c "
import sys,json
d=json.load(sys.stdin)
for r in sorted(d['result'], key=lambda x:(x['type'],x['name'])):
    print(f\"{r['type']:6} {r['name']:36} {r['content']}\")
"
```

- [ ] **Step 4: 누락된 레코드를 직접 추가**

Cloudflare 자동 스캔은 **모든 레코드를 찾지 못할 수 있다**(특히 DKIM 같은 TXT). Step 1의 표와 Step 3의 출력을 대조해 빠진 것을 추가한다.

예시 — `app` A 레코드가 없다면:

```bash
curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"type":"A","name":"app","content":"13.124.153.105","ttl":300,"proxied":false}'
```

> **`proxied`는 반드시 `false`로 둔다.** `app`·`api`·`admin`을 Cloudflare 프록시로 통과시키면 기존 TLS 인증서(k3s가 발급·관리)와 충돌하고, gateway의 SSE 스트리밍이 프록시 버퍼링에 걸릴 수 있다. 이번 범위는 DNS 이전이지 CDN 도입이 아니다.

MX 예시:

```bash
curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"type":"MX","name":"@","content":"smtp.google.com","priority":1,"ttl":300}'
```

DKIM은 값이 길다. Step 1에서 실측한 전체 문자열을 그대로 넣는다.

```bash
curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"type":"TXT","name":"google._domainkey","content":"<Step 1에서 실측한 DKIM 전체 값>","ttl":300}'
```

- [ ] **Step 5: 🔴 대조 게이트 — 사용자 확인을 받는다**

Step 3을 다시 실행해 최종 상태를 출력하고, Step 1의 표와 **1:1로 대조한 결과**를 사용자에게 제시한다.

제시할 형식:

| 유형 | 이름 | 가비아(현재) | Cloudflare(이전 후) | 일치? |
|---|---|---|---|---|
| MX | @ | smtp.google.com (1) | … | ✅/❌ |
| TXT | google._domainkey | … | … | ✅/❌ |
| A | app | 13.124.153.105 | … | ✅/❌ |
| A | api | 13.124.153.105 | … | ✅/❌ |
| A | admin | 13.124.153.105 | … | ✅/❌ |

**하나라도 ❌면 Task 7로 넘어가지 않는다.** 전부 ✅여도 **사용자의 명시적 확인을 받은 뒤에만** 진행한다. NS 변경은 되돌리는 데 전파 시간이 걸리고, MX가 빠지면 그 사이 메일이 유실된다.

---

## Task 7: NS 이전과 커스텀 도메인 연결

**Files:** 없음 (인프라 작업)

**Interfaces:**
- Consumes: Task 5의 Pages 프로젝트, Task 6의 존과 `name_servers`
- Produces: 라이브 `https://leva.ai.kr`. Task 8의 심사 신청이 이걸 대상으로 한다.

- [ ] **Step 1: 사용자가 가비아에서 NS 변경**

사용자에게 Task 6 Step 2의 `name_servers` 2개를 전달하고, 가비아 콘솔에서 `leva.ai.kr`의 네임서버를 그 값으로 변경해 달라고 요청한다. **이 단계는 사용자만 할 수 있다.**

- [ ] **Step 2: 전파 확인**

```bash
for i in $(seq 1 30); do
  ns=$(nslookup -type=NS leva.ai.kr 8.8.8.8 2>&1 | grep -i "nameserver" | head -2 | tr '\n' ' ')
  echo "$(date +%H:%M:%S) $ns"
  echo "$ns" | grep -qi "cloudflare\|ns.cloudflare.com" && { echo "→ 전파 완료"; break; }
  sleep 60
done
```

기대: NS가 Cloudflare 값으로 바뀐다. 수분~수시간 걸릴 수 있다.

- [ ] **Step 3: 이전 직후 회귀 확인 — 여기서 사고를 잡는다**

```bash
echo "--- 기존 서비스 ---"
for u in https://app.leva.ai.kr https://api.leva.ai.kr/actuator/health https://admin.leva.ai.kr; do
  printf "%-45s " "$u"; curl -s -o /dev/null -w "%{http_code}\n" --max-time 15 "$u"
done
echo "--- 메일 레코드 ---"
nslookup -type=MX leva.ai.kr 8.8.8.8 2>&1 | grep -i "mail exchanger"
nslookup -type=TXT google._domainkey.leva.ai.kr 8.8.8.8 2>&1 | grep -ci "text ="
```

기대: 3개 서비스 전부 **200**, MX가 `smtp.google.com`, DKIM TXT가 **1건 이상**.

**하나라도 어긋나면 즉시 사용자에게 알리고 NS를 가비아로 되돌릴지 확인한다.** 추측으로 고치지 않는다.

- [ ] **Step 4: 커스텀 도메인 연결**

```bash
for d in leva.ai.kr www.leva.ai.kr; do
  curl -sS -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/devpath-home-page/domains" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
    --data "{\"name\":\"$d\"}" | py -c "import sys,json;d=json.load(sys.stdin);print(d['success'], d.get('errors'))"
done
```

기대: 둘 다 `True`. Cloudflare가 루트는 CNAME flattening으로, `www`는 CNAME으로 자동 연결하고 인증서를 발급한다.

- [ ] **Step 5: 인증서 발급 대기 후 최종 검증**

```bash
for i in $(seq 1 20); do
  c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 https://leva.ai.kr 2>&1)
  echo "$(date +%H:%M:%S) leva.ai.kr=$c"; [ "$c" = "200" ] && break; sleep 30
done
echo "=== 최종 검증 ==="
for p in / /ads.txt /robots.txt; do printf "%-16s " "$p"; curl -s -o /dev/null -w "%{http_code} %{content_type}\n" --max-time 15 "https://leva.ai.kr$p"; done
echo "--- ads.txt 본문 ---"; curl -s --max-time 15 https://leva.ai.kr/ads.txt
echo "--- head 애드센스 ---"; curl -s --max-time 15 https://leva.ai.kr/ | grep -c "adsbygoogle.js?client=ca-pub-2785578834914321"
echo "--- devpath.ai 잔여 ---"; curl -s --max-time 15 https://leva.ai.kr/ | grep -c "devpath.ai"
echo "--- 기존 서비스 재확인 ---"
for u in https://app.leva.ai.kr https://api.leva.ai.kr/actuator/health https://admin.leva.ai.kr; do
  printf "%-45s " "$u"; curl -s -o /dev/null -w "%{http_code}\n" --max-time 15 "$u"
done
```

기대(스펙 §5 검증표):

| # | 확인 | 기대 |
|---|---|---|
| 1 | `https://leva.ai.kr` | 200 |
| 2 | `/ads.txt` | **200 + `text/plain`** + 퍼블리셔 ID 일치 |
| 3 | `<head>` 애드센스 grep | 1 |
| 4 | `devpath.ai` grep | **0** |
| 5 | `/robots.txt` | 200 |
| 6 | `app`·`api`·`admin` | **여전히 200** |

- [ ] **Step 6: 메일 수신 실측 — 사용자 수행**

사용자에게 외부 계정에서 이 도메인의 Google Workspace 주소로 **메일 1건을 보내 도착을 확인**해 달라고 요청한다. DNS 조회만으로는 실제 수신을 보장하지 못한다.

**도착하지 않으면 즉시 보고하고 NS 원복을 검토한다.**

---

## Task 8: 심사 신청 런북

**Files:**
- Create: `docs/superpowers/runbooks/2026-08-10-adsense-review.md`

**Interfaces:**
- Consumes: Task 7의 라이브 사이트
- Produces: 사용자가 따라 할 수 있는 심사 신청 절차

- [ ] **Step 1: 브랜치 분기**

```bash
git -C /d/workspace/dpa/devpath-home-page fetch origin
git -C /d/workspace/dpa/devpath-home-page switch -c docs/adsense-review-runbook origin/develop
mkdir -p /d/workspace/dpa/devpath-home-page/docs/superpowers/runbooks
```

- [ ] **Step 2: 런북 작성**

`docs/superpowers/runbooks/2026-08-10-adsense-review.md`:

````markdown
# 애드센스 심사 신청 런북

- 대상 사이트: `https://leva.ai.kr`
- 퍼블리셔 ID: `ca-pub-2785578834914321`
- 전제: Task 7까지 완료되어 위 URL이 200으로 응답한다

## 신청 전 자가 점검

```bash
for p in / /ads.txt /robots.txt; do
  printf "%-16s " "$p"; curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "https://leva.ai.kr$p"
done
curl -s https://leva.ai.kr/ | grep -c "adsbygoogle.js?client=ca-pub-2785578834914321"
```

전부 200이고 `/ads.txt`가 `text/plain`, 스크립트 grep이 `1`이어야 한다.

## 신청 절차 (사용자 수행)

1. <https://adsense.google.com> 로그인
2. **사이트** → **사이트 추가** → `leva.ai.kr` 입력
3. 소유권 확인 — 스크립트가 이미 `<head>`에 있으므로 「AdSense 코드 스니펫」 방식이 자동 감지된다
4. **검토 요청**
5. 결과 수신까지 수일~수주

## 심사 중 하지 말 것

- 애드센스 스크립트를 `<head>`에서 빼거나 지연 로딩으로 바꾸지 않는다 — 크롤러가 찾지 못한다
- `ads.txt`를 지우거나 퍼블리셔 ID를 바꾸지 않는다
- 사이트를 내리지 않는다 (Cloudflare Pages는 상시 가동이라 AWS 정지와 무관하다)

## 거절되면

가장 흔한 사유는 **「가치 있는 콘텐츠 부족」**이다. 이 사이트는 제품 소개 1페이지라 해당될 가능성이 실재한다. 그 경우 2단계에서 읽을거리(블로그·학습 가이드 등 정적 문서)를 늘린 뒤 재신청한다. 재신청에 횟수 제한은 없다.

거절 사유가 정책 위반이면 사유를 그대로 기록하고 대응을 다시 설계한다.

## 승인되면

광고 슬롯 배치를 별도로 결정한다. 이 스펙은 **슬롯을 배치하지 않았다** — 리드폼이 목표인 페이지의 전환율을 해칠 수 있어 승인 후 판단하기로 했다.

앱(`app.leva.ai.kr`)의 애드센스는 이미 코드가 `develop`에 있으나 배포되지 않았다(이미지 빌드가 `main` push에서만 동작). 별도 릴리스 결정이 필요하다.
````

- [ ] **Step 3: 커밋과 PR**

```bash
git -C /d/workspace/dpa/devpath-home-page add docs/superpowers/runbooks/2026-08-10-adsense-review.md
git -C /d/workspace/dpa/devpath-home-page commit -m "docs(ads): 애드센스 심사 신청 런북"
git -C /d/workspace/dpa/devpath-home-page push -u origin docs/adsense-review-runbook
gh pr create --repo DevPathAi/devpath-home-page --base develop --head docs/adsense-review-runbook \
  --title "docs(ads): 애드센스 심사 신청 런북" \
  --body "Task 7까지 완료된 상태에서 사용자가 따라 할 신청 절차. 신청 전 자가 점검 명령, 심사 중 금지 사항, 거절 시 대응을 담았다."
```

- [ ] **Step 4: CI 확인 후 머지**

```bash
gh pr checks --repo DevPathAi/devpath-home-page docs/adsense-review-runbook --watch
gh pr merge --repo DevPathAi/devpath-home-page docs/adsense-review-runbook --merge
```

---

## 이 계획의 범위 밖

- **인터뷰 이식** — `devpath-landing-page`의 AI 학습 진단 인터뷰를 홈페이지로 옮기는 작업. 2단계 별도 스펙(선결: `ANTHROPIC_API_KEY`·`TURNSTILE_SECRET`·Cloudflare KV·Apps Script).
- **광고 슬롯 배치와 자동 광고** — 승인 후 결정.
- **`app.leva.ai.kr` 재배포** — frontend가 main 대비 +243커밋이라 별도 릴리스 결정이 필요하다.
- **`sitemap.xml`** — 단일 페이지라 실익이 없다. 콘텐츠가 늘어나는 2단계에서.
- **SPF 레코드 신설** — 존에 SPF가 없다. 메일 도달률 이슈지만 이번 범위 밖.
- **심사 승인** — 이 계획이 보장하는 것은 *신청 가능 상태*까지다.
