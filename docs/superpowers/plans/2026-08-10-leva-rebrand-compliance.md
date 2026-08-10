# 랜딩–사업계획서 정합화 구현 계획 (브랜드·가격·처리방침)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `leva.ai.kr` 랜딩을 사업계획서와 일치시킨다 — 브랜드를 `Leva`로 전면 교체하고, 가격을 무료+9,900원 2단계로 줄이고, 개인정보 처리방침을 신설한다.

**Architecture:** 정적 사이트의 `index.html` 문자열·마크업을 고치고, OG 이미지를 템플릿에서 재생성하며, `privacy.html`을 새 정적 페이지로 추가해 `DEPLOY_ENTRIES`에 등록한다. 모든 변경은 vitest 회귀 가드로 못박는다.

**Tech Stack:** 바닐라 HTML/CSS · Vitest · Playwright · Cloudflare Pages(직접 업로드)

**설계 스펙:** [`docs/superpowers/specs/2026-08-10-leva-rebrand-compliance-design.md`](../specs/2026-08-10-leva-rebrand-compliance-design.md)

## Global Constraints

- **브랜드는 `Leva` 단독이다.** `DevPath`는 한 글자도 남기지 않는다. ` AI` 접미사도 붙이지 않는다.
- **유료는 9,900원 하나다.** `4,900`·`14,900` 문자열이 `index.html`에 남으면 안 된다.
- **사업장 주소를 게시하지 않는다.** 푸터·처리방침 어디에도 넣지 않는다.
- **주민등록번호를 어떤 파일에도 쓰지 않는다.**
- 푸터 사업자정보 = 상호 `레바` · 사업자등록번호 `796-76-00732`. **대표자명은 푸터에 넣지 않는다.**
- 처리방침 문서 안에만 `개인정보 보호책임자: 김민구` · 연락처 `info@leva.ai.kr`.
- **존재하지 않는 URL을 지어내지 않는다.** 링크 대상이 없으면 평문으로 둔다.
- **이 레포는 공개(PUBLIC)다.**
- **모든 작업은 `develop`에서 분기한 새 브랜치에서 한다.** `main`·`develop` 직접 push 금지.
- **`git` 명령에는 항상 `-C /d/workspace/dpa/devpath-home-page`를 쓴다.**
- **Test-First.** 실패하는 테스트를 먼저 쓰고 실패를 눈으로 확인한 뒤 구현한다.

## 브랜치

단일 브랜치 `feat/leva-rebrand-compliance`에서 Task 1~5를 진행하고 Task 6에서 PR·머지·배포한다.

## File Structure

- Modify: `index.html` — 브랜드 문자열 10곳(Task 1) · 가격 카드(Task 3) · 끊어진 링크(Task 4) · 푸터 처리방침 링크와 사업자정보(Task 5)
- Modify: `assets/styles.css` — 워드마크 색 규칙(Task 1) · 처리방침 문서 스타일(Task 5)
- Modify: `assets/og-image.template.html` — OG 이미지 브랜드(Task 2)
- Regenerate: `assets/og-image.png` — `npm run gen:og` (Task 2)
- Create: `privacy.html` — 개인정보 처리방침 (Task 5)
- Modify: `build.mjs` — `DEPLOY_ENTRIES`에 `privacy.html` 추가 (Task 5)
- Modify: `tests/head-meta.test.js` — 브랜드 회귀 가드 (Task 1)
- Create: `tests/content-compliance.test.js` — 가격·링크·처리방침 회귀 가드 (Task 3·4·5)

---

## Task 1: 브랜드 전면 교체 — `DevPath` → `Leva`

**Files:**
- Modify: `index.html` (8·21·22·30·52·67·124·222·301·312·318행)
- Modify: `assets/styles.css` (217~224행 워드마크)
- Test: `tests/head-meta.test.js` (기존 파일에 케이스 추가)

**Interfaces:**
- Consumes: 없음 (첫 Task)
- Produces: `index.html`에 `DevPath` 0건. Task 2가 OG 이미지에서 같은 작업을 한다.

- [ ] **Step 1: 브랜치 분기**

```bash
git -C /d/workspace/dpa/devpath-home-page fetch origin
git -C /d/workspace/dpa/devpath-home-page switch -c feat/leva-rebrand-compliance origin/develop
```

- [ ] **Step 2: 실패하는 테스트 추가**

`tests/head-meta.test.js`의 `describe('index.html <head> 메타', …)` 블록 **안**, 기존 `it('devpath.ai가 한 곳도 남아 있지 않다', …)` **바로 아래**에 추가한다.

```javascript
  // 브랜드는 Leva 단독이다. 개별 교체 단언만으로는 "안 고친 게 남았다"를
  // 못 잡는다 — 앞선 작업에서 이 형태의 단언이 JSON-LD url과 mailto 2곳을
  // 잡아냈다.
  it('DevPath가 한 곳도 남아 있지 않다', () => {
    expect(html).not.toContain('DevPath');
  });

  it('title과 OG 제목이 Leva를 쓴다', () => {
    expect(html).toContain('<title>Leva — 내 수준에 맞는 다음 단계를 AI가 안내</title>');
    expect(html).toContain('<meta property="og:site_name" content="Leva" />');
  });

  it('워드마크가 Leva 한 조각이다', () => {
    expect(html).toContain('<a class="wordmark" href="/">Leva</a>');
    expect(html).not.toContain('wordmark__ai');
  });
```

- [ ] **Step 3: 테스트를 돌려 실패를 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm test -- head-meta
```

기대: 신규 3건 모두 **실패**.

- [ ] **Step 4: `index.html` 문자열 교체**

각 지점을 정확히 아래로 바꾼다.

8행:
```html
  <title>Leva — 내 수준에 맞는 다음 단계를 AI가 안내</title>
```

21·22행:
```html
  <meta property="og:site_name" content="Leva" />
  <meta property="og:title" content="Leva — 내 수준에 맞는 다음 단계를 AI가 안내" />
```

30행:
```html
  <meta name="twitter:title" content="Leva — 내 수준에 맞는 다음 단계를 AI가 안내" />
```

52행:
```html
    "name": "Leva",
```

67행 — **span을 없애고 한 조각으로**:
```html
      <a class="wordmark" href="/">Leva</a>
```

124행:
```html
          Leva는 그 불안을 <strong>내 수준에서 시작하는 다음 한 걸음</strong>으로 바꿉니다.
```

222행:
```html
            제가 겪은 막막함을 다음 사람은 덜 겪게 하는 것 — 그게 Leva를 만드는 이유입니다.
```

301행 — `mailto` subject:
```html
            <a class="btn btn-primary" href="mailto:info@leva.ai.kr?subject=Leva%20진단%20초대%20신청&body=현재%20단계와%20관심%20스택을%20적어주시면%20안내드릴게요.">이메일로 초대 신청</a>
```

312·318행:
```html
      <p class="site-footer__brand">Leva</p>
```
```html
      <p class="site-footer__copy">© 2026 Leva</p>
```

- [ ] **Step 5: 워드마크 CSS 정리**

`assets/styles.css` 217~224행. `.wordmark__ai` 규칙을 삭제하고, 브랜드 색을 워드마크 전체로 옮긴다.

현재:
```css
.wordmark {
  font-weight: 800;
  font-size: 1.125rem;
  letter-spacing: -0.02em;
  color: var(--slate-900);
}
.wordmark:hover { text-decoration: none; }
.wordmark__ai { color: var(--brand); }
```

교체 후:
```css
.wordmark {
  font-weight: 800;
  font-size: 1.125rem;
  letter-spacing: -0.02em;
  color: var(--brand);
}
.wordmark:hover { text-decoration: none; }
```

> 이유: 기존에는 `DevPath`(기본색) + ` AI`(브랜드색) 두 색이었다. `Leva` 한 조각이 되면 span이 사라지므로, 그대로 두면 헤더에서 브랜드 색 강조가 통째로 없어진다. 색을 `.wordmark`로 옮겨 시각적 정체성을 유지한다.

- [ ] **Step 6: 테스트를 돌려 통과를 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm test
```

기대: 기존 48건 + 신규 3건 전부 PASS.

- [ ] **Step 7: E2E 회귀 확인**

E2E가 `h1`·CTA 텍스트를 단언하므로 브랜드 교체가 깨뜨리지 않는지 본다.

```bash
cd /d/workspace/dpa/devpath-home-page && npm run test:e2e
```

기대: 6건 PASS. 실패하면 메시지를 먼저 읽는다 — 추측으로 고치지 않는다.

- [ ] **Step 8: 커밋**

```bash
git -C /d/workspace/dpa/devpath-home-page add index.html assets/styles.css tests/head-meta.test.js
git -C /d/workspace/dpa/devpath-home-page commit -m "feat(brand): 브랜드를 Leva로 전면 교체한다

명함과 사업계획서는 Leva인데 사이트 전체가 DevPath AI였다. QR을 찍은
심사위원에게 다른 서비스로 보인다.

워드마크는 DevPath(기본색) + ' AI'(브랜드색) 두 조각이었다. Leva 한 조각이
되면서 span을 없애고 브랜드 색을 .wordmark로 옮겼다 - 그대로 두면 헤더의
브랜드 색 강조가 통째로 사라진다.

'DevPath 부재' 단언을 넣었다. 개별 교체 단언은 '고쳤다'만 보장하고
'안 고친 게 남았다'는 못 잡는다."
```

---

## Task 2: OG 이미지 재생성

**Files:**
- Modify: `assets/og-image.template.html`
- Regenerate: `assets/og-image.png`
- Test: `tests/head-meta.test.js` (기존 파일에 케이스 추가)

**Interfaces:**
- Consumes: Task 1의 브랜드 결정(`Leva` 단독)
- Produces: 옛 브랜드가 없는 `assets/og-image.png`

> **왜 별도 Task인가:** OG 이미지는 **텍스트 검사로 잡히지 않는다.** 이미지를 빠뜨리면 공유 미리보기 — 가장 눈에 띄는 자리 — 에만 옛 브랜드가 남는다. 템플릿은 테스트로 가드하되 **결과 이미지는 눈으로 확인**해야 한다.

- [ ] **Step 1: 선결조건 확인 — Playwright chromium**

`npm run gen:og`는 `scripts/gen-og.mjs`가 Playwright chromium으로 템플릿을 1200×630으로 렌더해 PNG를 저장하는 방식이다. 브라우저가 없으면 실패한다.

```bash
cd /d/workspace/dpa/devpath-home-page && npx playwright install chromium
```

기대: 이미 설치돼 있으면 즉시 끝난다.

- [ ] **Step 2: 실패하는 테스트 추가**

`tests/head-meta.test.js` 파일 끝(마지막 `});` 다음)에 새 블록을 추가한다.

```javascript
describe('OG 이미지 템플릿', () => {
  const tpl = readFileSync(
    fileURLToPath(new URL('../assets/og-image.template.html', import.meta.url)),
    'utf-8',
  );

  it('템플릿에 DevPath가 남아 있지 않다', () => {
    expect(tpl).not.toContain('DevPath');
  });

  it('템플릿이 Leva를 쓴다', () => {
    expect(tpl).toContain('Leva');
  });

  it('워드마크가 한 조각이다 (.ai span 제거)', () => {
    expect(tpl).toContain('<div class="wordmark">Leva</div>');
    expect(tpl).not.toContain('class="ai"');
  });
});
```

- [ ] **Step 3: 테스트를 돌려 실패를 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm test -- head-meta
```

기대: OG 템플릿 2건 실패.

- [ ] **Step 4: 템플릿 교체**

`assets/og-image.template.html`에서 `DevPath`는 **63행 한 곳**뿐이며, 사이트 헤더와 같은 두 조각 구조다.

63행 현재:
```html
  <div class="wordmark">DevPath<span class="ai"> AI</span></div>
```

교체 후 — span을 없애고 한 조각으로:
```html
  <div class="wordmark">Leva</div>
```

35행의 `.ai` 규칙은 사용처가 사라지므로 삭제하고, 브랜드 색을 워드마크로 옮긴다(Task 1에서 사이트 CSS에 한 것과 같은 처리).

29~35행 현재:
```css
    .wordmark {
```
…(중간 속성은 그대로 두고)…
```css
    .wordmark .ai { color: #4f46e5; }
```

조치: **`.wordmark .ai` 줄(35행)을 삭제**하고, `.wordmark` 블록에 `color: #4f46e5;`를 추가한다.

> 이유: 기존에는 `DevPath`(기본색) + ` AI`(브랜드색 `#4f46e5`) 두 색이었다. `Leva` 한 조각이 되면 그대로 두었을 때 OG 이미지에서 브랜드 색이 통째로 사라진다. **문구(`headline`·`support`·`badge`)는 건드리지 않는다.**

- [ ] **Step 5: 이미지 재생성**

```bash
cd /d/workspace/dpa/devpath-home-page && npm run gen:og
```

기대: `assets/og-image.png`가 갱신된다(파일 시각 변경).

```bash
ls -l assets/og-image.png
```

- [ ] **Step 6: 🔴 결과 이미지를 눈으로 확인**

`assets/og-image.png`를 열어 **옛 브랜드가 남아 있지 않은지 직접 본다.** 텍스트 검사로는 잡히지 않는 유일한 지점이다.

확인할 것: `Leva`로 표기됐는가 · 글자가 잘리거나 겹치지 않는가 · 크기가 1200×630인가.

```bash
cd /d/workspace/dpa/devpath-home-page && npm test
```

기대: 전체 PASS.

- [ ] **Step 7: 커밋**

```bash
git -C /d/workspace/dpa/devpath-home-page add assets/og-image.template.html assets/og-image.png tests/head-meta.test.js
git -C /d/workspace/dpa/devpath-home-page commit -m "feat(brand): OG 이미지를 Leva로 재생성한다

OG 이미지는 텍스트 검사로 잡히지 않는다. 빠뜨리면 공유 미리보기 - 가장
눈에 띄는 자리 - 에만 옛 브랜드가 남는다. 템플릿은 테스트로 가드하고
결과 이미지는 눈으로 확인했다."
```

---

## Task 3: 가격 2단계로 축소

**Files:**
- Modify: `index.html` (가격 섹션 — `라이트`·`프로` 카드 제거)
- Test: `tests/content-compliance.test.js` (신설)

**Interfaces:**
- Consumes: 없음
- Produces: `index.html`에 `4,900`·`14,900` 0건. Task 4·5가 같은 테스트 파일에 블록을 추가한다.

> 사업계획서: 「단계형 단일가, 하한 9,900원 확정, 그 이하 진입가는 검토 대상에서 제외」 + 3-1 「진입가 하향 미채택」. 랜딩의 `라이트 4,900`이 이와 정면 충돌한다. **유료는 9,900 하나**로 맞춘다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/content-compliance.test.js`를 새로 만든다.

```javascript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(
  fileURLToPath(new URL('../index.html', import.meta.url)),
  'utf-8',
);

// 사업계획서: 단계형 단일가, 하한 9,900원 확정, 진입가 하향 미채택.
describe('가격 — 사업계획서 정합', () => {
  it('9,900원 유료 플랜이 있다', () => {
    expect(html).toContain('9,900원');
  });

  it('하한 미만 진입가(4,900원)가 없다', () => {
    expect(html).not.toContain('4,900');
  });

  it('상위 플랜(14,900원)이 없다', () => {
    expect(html).not.toContain('14,900');
  });

  it('유료 플랜 카드가 정확히 하나다', () => {
    const paid = html.match(/pricing__tier pricing__tier--soon/g) ?? [];
    expect(paid).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm test -- content-compliance
```

기대: `4,900` · `14,900` · 카드 개수 3건 실패, `9,900` 1건 통과.

- [ ] **Step 3: `라이트` 카드 삭제**

`index.html`의 가격 섹션에서 아래 블록을 **통째로 삭제**한다(주석 포함).

```html
          <!-- 유료 (준비 중 — 비활성) -->
          <div class="pricing__tier pricing__tier--soon surface" aria-disabled="true">
            <p class="pricing__soon-badge">준비 중</p>
            <p class="pricing__tier-name">라이트</p>
            <p class="pricing__tier-price"><strong>4,900원</strong><span class="pricing__per">/월</span></p>
            <button class="btn btn-secondary pricing__cta-disabled" type="button" disabled aria-disabled="true">준비 중</button>
          </div>
```

- [ ] **Step 4: `프로` 카드 삭제**

```html
          <div class="pricing__tier pricing__tier--soon surface" aria-disabled="true">
            <p class="pricing__soon-badge">준비 중</p>
            <p class="pricing__tier-name">프로</p>
            <p class="pricing__tier-price"><strong>14,900원</strong><span class="pricing__per">/월</span></p>
            <button class="btn btn-secondary pricing__cta-disabled" type="button" disabled aria-disabled="true">준비 중</button>
          </div>
```

- [ ] **Step 5: 남은 `스탠다드` 카드에 주석 복원**

Step 3에서 `<!-- 유료 (준비 중 — 비활성) -->` 주석이 함께 지워졌다. 남은 `스탠다드` 카드 바로 위에 다시 넣는다.

```html
          <!-- 유료 (준비 중 — 비활성) -->
          <div class="pricing__tier pricing__tier--soon surface" aria-disabled="true">
            <p class="pricing__soon-badge">준비 중</p>
            <p class="pricing__tier-name">스탠다드</p>
```

- [ ] **Step 6: 테스트를 돌려 통과를 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm test -- content-compliance
```

기대: 4건 PASS.

- [ ] **Step 7: 가격 섹션이 시각적으로 깨지지 않는지 확인**

카드가 3개에서 1개로 줄면 그리드 정렬이 어색해질 수 있다.

```bash
cd /d/workspace/dpa/devpath-home-page && npm run dev
```

브라우저에서 `http://127.0.0.1:4321/#pricing`을 열어 **무료 카드와 스탠다드 카드 2개가 정상 배치되는지 눈으로 확인**한다. 확인 후 서버를 끈다.

- [ ] **Step 8: 커밋**

```bash
git -C /d/workspace/dpa/devpath-home-page add index.html tests/content-compliance.test.js
git -C /d/workspace/dpa/devpath-home-page commit -m "feat(pricing): 유료 플랜을 9,900원 하나로 맞춘다

사업계획서는 '단계형 단일가, 하한 9,900원 확정, 그 이하 진입가는 검토
대상에서 제외'이고 3-1에 '진입가 하향 미채택'을 명시했다. 랜딩의
라이트 4,900원이 이와 정면 충돌해 둘 중 하나가 거짓이 된다.

라이트(4,900)와 프로(14,900)를 제거해 무료 + 스탠다드 9,900 2단계로
만들었다."
```

---

## Task 4: 끊어진 링크 정리

**Files:**
- Modify: `index.html` (227·315행)
- Test: `tests/content-compliance.test.js` (Task 3에서 만든 파일에 블록 추가)

**Interfaces:**
- Consumes: Task 3의 `tests/content-compliance.test.js`
- Produces: `index.html`에 `href="#"` 1건만 남음(316행 처리방침 — Task 5가 처리)

> 실측: `href="#"`가 **정확히 4건**(227행 2건 · 315행 1건 · 316행 1건). 내비게이션의 `href="#pricing"` 같은 앵커는 정확 일치가 아니라 무관하다.

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/content-compliance.test.js` 끝에 추가한다.

```javascript
// href="#"는 클릭해도 아무 일이 없는 죽은 링크다. 심사위원이 클릭할 자리다.
// 내비게이션의 href="#pricing" 같은 앵커는 정확 일치가 아니라 무관하다.
describe('끊어진 링크', () => {
  it('제휴가 문의 메일로 연결된다', () => {
    expect(html).toContain('<a href="mailto:info@leva.ai.kr">제휴</a>');
  });

  it('StockPilot과 LearnFlow가 링크가 아닌 평문이다', () => {
    expect(html).not.toContain('>StockPilot</a>');
    expect(html).not.toContain('>LearnFlow</a>');
    expect(html).toContain('StockPilot');
    expect(html).toContain('LearnFlow');
  });

  it('연결 예정 안내 문구가 사라졌다', () => {
    expect(html).not.toContain('링크는 정리 후 연결 예정');
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm test -- content-compliance
```

기대: 신규 3건 실패.

- [ ] **Step 3: 227행 — 링크를 평문으로**

현재:
```html
          <a href="#" rel="noopener">StockPilot</a> · <a href="#" rel="noopener">LearnFlow</a>
          <span class="founder__prev-note">(링크는 정리 후 연결 예정)</span>
```

교체 후 — 링크를 풀고 안내 문구도 함께 지운다:
```html
          StockPilot · LearnFlow
```

> 존재하지 않는 URL을 지어내지 않는다. 두 제품의 실제 주소가 생기면 그때 링크한다. 「연결 예정」 문구는 링크가 사라지면 의미가 없어지므로 함께 지운다.

- [ ] **Step 4: 315행 — 제휴를 메일로**

현재:
```html
        <a href="#">제휴</a>
```

교체 후:
```html
        <a href="mailto:info@leva.ai.kr">제휴</a>
```

- [ ] **Step 5: 테스트를 돌려 통과를 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm test -- content-compliance
```

기대: 7건 PASS(Task 3의 4건 + 신규 3건).

- [ ] **Step 6: 남은 `href="#"`가 1건인지 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && grep -c 'href="#"' index.html
```

기대: **`1`**. 316행 처리방침 링크이며 Task 5가 처리한다. 1이 아니면 Step 3·4를 다시 본다.

- [ ] **Step 7: 커밋**

```bash
git -C /d/workspace/dpa/devpath-home-page add index.html tests/content-compliance.test.js
git -C /d/workspace/dpa/devpath-home-page commit -m "fix(links): 죽은 링크를 정리한다

href=\"#\"는 클릭해도 아무 일이 없다. 심사위원이 클릭할 자리다.

제휴는 문의 메일로 연결했다. StockPilot/LearnFlow는 실제 주소가 없어
링크를 풀고 평문으로 두었다 - 존재하지 않는 URL을 지어내지 않는다.
'(링크는 정리 후 연결 예정)' 안내도 링크가 사라져 의미가 없으므로 지웠다.

남은 href=\"#\" 1건은 처리방침 링크이며 다음 커밋에서 연결한다."
```

---

## Task 5: 개인정보 처리방침 신설

**Files:**
- Create: `privacy.html`
- Modify: `index.html` (316행 링크 · 푸터 사업자정보)
- Modify: `build.mjs` (`DEPLOY_ENTRIES`)
- Modify: `assets/styles.css` (처리방침 문서 스타일)
- Test: `tests/content-compliance.test.js` (블록 추가)

**Interfaces:**
- Consumes: Task 4 이후의 `index.html`(`href="#"` 1건 남은 상태)
- Produces: `privacy.html` · `index.html`에 `href="#"` 0건 · `DEPLOY_ENTRIES`에 `privacy.html`

> **이건 법적 요건이자 애드센스 심사 요건이다.** AdSense 정책은 쿠키·웹비콘·IP 수집과 제3자 광고 사업자의 정보 수집 고지를 명시적으로 요구한다. 이미 애드센스 스크립트를 싣고 심사를 기다리는 상태라 `href="#"`인 채로는 떨어질 사유가 된다.

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/content-compliance.test.js` 상단 import에 `existsSync`를 더한다.

```javascript
import { readFileSync, existsSync } from 'node:fs';
```

파일 끝에 블록을 추가한다.

```javascript
const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

describe('개인정보 처리방침', () => {
  it('privacy.html이 존재한다', () => {
    expect(existsSync(root('privacy.html'))).toBe(true);
  });

  it('배포 화이트리스트에 등록돼 있다', () => {
    const build = readFileSync(root('build.mjs'), 'utf-8');
    const m = build.match(/const DEPLOY_ENTRIES = \[([^\]]*)\]/);
    expect(m?.[1]).toContain("'privacy.html'");
  });

  it('푸터 링크가 privacy.html로 연결된다', () => {
    expect(html).toContain('<a href="/privacy.html">개인정보 처리방침</a>');
  });

  it('index.html에 죽은 링크가 하나도 없다', () => {
    expect(html).not.toContain('href="#"');
  });

  it('푸터에 상호와 사업자등록번호가 있다', () => {
    expect(html).toContain('레바');
    expect(html).toContain('796-76-00732');
  });

  it('푸터에 대표자명과 주소가 없다', () => {
    // 성명은 처리방침 안에만, 주소는 어디에도 넣지 않는다.
    expect(html).not.toContain('김민구');
    expect(html).not.toContain('가람로');
  });
});

describe('처리방침 내용', () => {
  const doc = readFileSync(root('privacy.html'), 'utf-8');

  it('운영주체와 보호책임자를 밝힌다', () => {
    expect(doc).toContain('레바');
    expect(doc).toContain('796-76-00732');
    expect(doc).toContain('김민구');
    expect(doc).toContain('info@leva.ai.kr');
  });

  it('사업장 주소를 게시하지 않는다', () => {
    expect(doc).not.toContain('가람로');
    expect(doc).not.toContain('구포동');
  });

  it('수집 항목을 실제 폼과 일치하게 밝힌다', () => {
    for (const f of ['이메일', '현재 단계', 'UTM', '유입 경로']) {
      expect(doc).toContain(f);
    }
  });

  it('처리위탁처 3곳을 밝힌다', () => {
    expect(doc).toContain('Google');
    expect(doc).toContain('Cloudflare');
    expect(doc).toContain('AdSense');
  });

  it('애드센스 정책이 요구하는 쿠키·제3자 고지를 담는다', () => {
    expect(doc).toContain('쿠키');
    expect(doc).toContain('웹비콘');
    expect(doc).toContain('adssettings.google.com');
  });

  it('PIPA 필수 항목 제목이 모두 있다', () => {
    for (const h of [
      '처리 목적', '보유 기간', '제3자 제공', '처리위탁',
      '정보주체', '파기', '안전성 확보', '개인정보 보호책임자',
      '권익침해', '변경',
    ]) {
      expect(doc).toContain(h);
    }
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm test -- content-compliance
```

기대: `privacy.html`이 없어 `처리방침 내용` 블록이 파일 읽기에서 깨지고, `개인정보 처리방침` 블록도 실패한다.

- [ ] **Step 3: `privacy.html` 작성**

레포 루트에 만든다. 기존 `assets/styles.css`를 재사용한다.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>개인정보 처리방침 — Leva</title>
  <meta name="description" content="Leva 개인정보 처리방침 — 수집 항목, 보유 기간, 처리위탁, 정보주체의 권리를 안내합니다." />
  <link rel="canonical" href="https://leva.ai.kr/privacy.html" />
  <meta name="robots" content="index, follow" />
  <link rel="icon" type="image/png" href="/assets/favicon.svg" />
  <link rel="stylesheet" href="/assets/styles.css" />
</head>
<body>
  <header class="site-header">
    <div class="container site-header__inner">
      <a class="wordmark" href="/">Leva</a>
    </div>
  </header>

  <main id="main" class="container legal">
    <h1>개인정보 처리방침</h1>
    <p class="legal__meta">시행일: 2026년 8월 10일</p>

    <p>
      레바(이하 “회사”)는 「개인정보 보호법」에 따라 정보주체의 개인정보를 보호하고
      이와 관련한 고충을 신속하게 처리할 수 있도록 다음과 같이 개인정보 처리방침을
      수립·공개합니다.
    </p>

    <h2>1. 개인정보의 처리 목적</h2>
    <p>회사는 다음 목적으로 개인정보를 처리하며, 목적 외의 용도로는 이용하지 않습니다.</p>
    <ul>
      <li>서비스 사전 신청자 관리 및 출시·초대 안내</li>
      <li>서비스 수요 확인과 개선을 위한 통계 분석</li>
      <li>문의에 대한 회신</li>
    </ul>

    <h2>2. 처리하는 개인정보 항목</h2>
    <p>사전 신청 양식을 통해 다음 항목을 수집합니다.</p>
    <ul>
      <li><strong>필수</strong> — 이메일, 현재 단계, 개인정보 수집·이용 동의 여부</li>
      <li><strong>선택</strong> — 최근 막혔던 순간(자유 입력)</li>
      <li><strong>자동 수집</strong> — 신청 식별자, 유입 경로(referrer), UTM 파라미터(source·medium·campaign·content), 랜딩 변형 식별자</li>
    </ul>
    <p>
      선택 입력란에는 코드·로그·URL·비밀값을 넣지 않도록 안내하고 있으며, 입력 시
      자동으로 감지해 제출을 막습니다.
    </p>

    <h2>3. 개인정보의 처리 및 보유 기간</h2>
    <p>
      수집일로부터 <strong>2년</strong> 또는 <strong>동의 철회 시</strong> 중 먼저
      도래하는 시점까지 보유하며, 그 시점에 지체 없이 파기합니다. 관계 법령이 별도의
      보존 기간을 정한 경우 그 기간을 따릅니다.
    </p>

    <h2>4. 개인정보의 제3자 제공</h2>
    <p>
      회사는 정보주체의 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 따라
      요구되는 경우에는 예외로 합니다.
    </p>

    <h2>5. 개인정보 처리위탁</h2>
    <p>회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다.</p>
    <table class="legal__table">
      <thead>
        <tr><th>수탁자</th><th>위탁 업무</th></tr>
      </thead>
      <tbody>
        <tr><td>Google LLC (Apps Script · Sheets)</td><td>사전 신청 정보의 저장 및 집계</td></tr>
        <tr><td>Cloudflare, Inc.</td><td>웹사이트 호스팅 및 데이터 전송</td></tr>
        <tr><td>Google LLC (AdSense)</td><td>광고 게재 및 성과 측정</td></tr>
      </tbody>
    </table>
    <p>
      위탁 업무의 내용이나 수탁자가 변경될 경우 이 처리방침을 통해 공개합니다.
    </p>

    <h2>6. 쿠키 등 자동 수집 장치의 설치·운영 및 거부</h2>
    <p>
      회사는 광고 게재를 위해 Google AdSense를 사용합니다. Google을 포함한 제3자
      광고 사업자는 이 사이트 방문 기록에 기반한 광고를 게재하기 위해
      <strong>쿠키</strong>, <strong>웹비콘</strong>, <strong>IP 주소</strong> 등의
      정보를 수집·이용할 수 있습니다.
    </p>
    <p>
      정보주체는 <a href="https://adssettings.google.com" rel="noopener" target="_blank">Google 광고 설정</a>에서
      맞춤 광고를 거부할 수 있으며, 사용하는 웹 브라우저의 설정에서 쿠키 저장을
      거부하거나 삭제할 수 있습니다. 쿠키 저장을 거부해도 사이트 이용에는 지장이 없습니다.
    </p>

    <h2>7. 정보주체의 권리·의무 및 행사 방법</h2>
    <p>
      정보주체는 언제든지 개인정보의 <strong>열람·정정·삭제·처리정지</strong>를
      요구할 수 있습니다. 아래 연락처로 요청하시면 지체 없이 조치합니다.
    </p>
    <p>요청은 대리인을 통해서도 할 수 있으며, 이 경우 위임장을 제출해야 합니다.</p>

    <h2>8. 개인정보의 파기</h2>
    <p>
      보유 기간이 지나거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다.
      전자적 파일은 복구할 수 없는 방법으로 영구 삭제하며, 출력물은 분쇄하거나
      소각합니다.
    </p>

    <h2>9. 개인정보의 안전성 확보 조치</h2>
    <ul>
      <li>개인정보 취급자 최소화 및 접근 권한 관리</li>
      <li>전송 구간 암호화(HTTPS) 적용</li>
      <li>개인정보 처리 시스템에 대한 접근 통제</li>
      <li>선택 입력란의 민감정보 자동 감지 및 제출 차단</li>
    </ul>

    <h2>10. 개인정보 보호책임자 및 열람청구 접수처</h2>
    <p>
      개인정보 처리에 관한 업무를 총괄해서 책임지고, 처리와 관련한 정보주체의 문의·불만·
      피해구제 등을 처리하기 위해 다음과 같이 개인정보 보호책임자를 지정하고 있습니다.
      열람청구도 같은 연락처로 접수합니다.
    </p>
    <ul>
      <li>상호: 레바</li>
      <li>사업자등록번호: 796-76-00732</li>
      <li>개인정보 보호책임자: 김민구</li>
      <li>연락처: <a href="mailto:info@leva.ai.kr">info@leva.ai.kr</a></li>
    </ul>

    <h2>11. 권익침해 구제 방법</h2>
    <p>
      정보주체는 개인정보 침해로 인한 구제를 받기 위하여 아래 기관에 분쟁 해결이나
      상담을 신청할 수 있습니다.
    </p>
    <ul>
      <li>개인정보분쟁조정위원회 — 1833-6972 (www.kopico.go.kr)</li>
      <li>개인정보침해신고센터 — 118 (privacy.kisa.or.kr)</li>
      <li>대검찰청 사이버수사과 — 1301 (www.spo.go.kr)</li>
      <li>경찰청 사이버수사국 — 182 (ecrm.police.go.kr)</li>
    </ul>

    <h2>12. 처리방침의 변경</h2>
    <p>
      이 처리방침은 시행일부터 적용되며, 법령이나 서비스의 변경에 따라 내용이 추가·삭제·
      수정될 경우 변경 사항을 시행 7일 전부터 이 페이지를 통해 공지합니다.
    </p>
  </main>

  <footer class="site-footer">
    <div class="container site-footer__inner">
      <p class="site-footer__brand">Leva</p>
      <nav class="site-footer__links" aria-label="푸터">
        <a href="/">홈</a>
        <a href="mailto:info@leva.ai.kr">연락</a>
      </nav>
      <p class="site-footer__biz">레바 | 사업자등록번호 796-76-00732</p>
      <p class="site-footer__copy">© 2026 Leva</p>
    </div>
  </footer>
</body>
</html>
```

- [ ] **Step 4: 문서 스타일 추가**

`assets/styles.css` 맨 끝에 추가한다. 기존 클래스와 충돌하지 않는 새 이름만 쓴다.

```css
/* ── 법적 고지 문서(처리방침 등) ─────────────────────────────────────── */
.legal {
  max-width: 46rem;
  padding-top: 3rem;
  padding-bottom: 4rem;
  line-height: 1.7;
}
.legal h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
.legal h2 {
  font-size: 1.125rem;
  margin-top: 2.5rem;
  margin-bottom: 0.75rem;
  color: var(--slate-900);
}
.legal p, .legal li { color: var(--slate-700); }
.legal ul { padding-left: 1.25rem; margin: 0.5rem 0; }
.legal li { margin: 0.25rem 0; }
.legal__meta { color: var(--slate-500); font-size: 0.875rem; }
.legal__table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75rem 0;
  font-size: 0.9375rem;
}
.legal__table th, .legal__table td {
  border: 1px solid var(--slate-200);
  padding: 0.5rem 0.75rem;
  text-align: left;
}
.legal__table th { background: var(--slate-50); font-weight: 600; }
.site-footer__biz { color: var(--slate-500); font-size: 0.8125rem; }
```

> **주의:** `--slate-700`·`--slate-500`·`--slate-200`·`--slate-50` 변수가 실제로 정의돼 있는지 먼저 확인한다. 없으면 정의된 값으로 바꾼다.
> ```bash
> cd /d/workspace/dpa/devpath-home-page && grep -nE "^\s*--slate-(50|200|500|700):" assets/styles.css
> ```

- [ ] **Step 5: `index.html` 푸터 수정**

316행 링크를 연결하고, 사업자정보 줄을 추가한다.

현재:
```html
        <a href="#">개인정보 처리방침</a>
      </nav>
      <p class="site-footer__copy">© 2026 Leva</p>
```

교체 후:
```html
        <a href="/privacy.html">개인정보 처리방침</a>
      </nav>
      <p class="site-footer__biz">레바 | 사업자등록번호 796-76-00732</p>
      <p class="site-footer__copy">© 2026 Leva</p>
```

- [ ] **Step 6: `build.mjs`에 등록**

```javascript
const DEPLOY_ENTRIES = ['index.html', 'privacy.html', 'src', 'assets', '_headers', '_redirects', '_routes.json', 'robots.txt', 'favicon.ico', 'ads.txt'];
```

- [ ] **Step 7: 테스트를 돌려 통과를 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm test
```

기대: 전체 PASS.

- [ ] **Step 8: 빌드 산출물 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm run build && ls -l dist/privacy.html
```

기대: `dist/privacy.html` 존재.

- [ ] **Step 9: 화면을 눈으로 확인**

```bash
cd /d/workspace/dpa/devpath-home-page && npm run preview
```

`http://127.0.0.1:4321/privacy.html`을 열어 확인한다: 스타일이 적용됐는가 · 표가 깨지지 않는가 · 홈 링크와 푸터가 동작하는가. 이어서 `http://127.0.0.1:4321/`의 푸터에서 「개인정보 처리방침」을 클릭해 이동되는지 확인한다. 확인 후 서버를 끈다.

- [ ] **Step 10: 커밋**

```bash
git -C /d/workspace/dpa/devpath-home-page add privacy.html index.html build.mjs assets/styles.css tests/content-compliance.test.js
git -C /d/workspace/dpa/devpath-home-page commit -m "feat(legal): 개인정보 처리방침을 신설한다

이메일을 수집하면서 처리방침 링크가 href=\"#\"였다. 법 위반이고,
사업계획서의 '개인정보 영향평가 사전 수행'과도 모순이다.

★애드센스 심사 요건이기도 하다★ - AdSense 정책이 쿠키/웹비콘/IP 수집과
제3자 광고 사업자의 정보 수집 고지를 명시적으로 요구한다. 이미 스크립트를
싣고 심사를 기다리는 상태라 이대로면 떨어질 사유가 된다.

PIPA 제30조 필수 항목을 모두 담고, 수집 항목은 실제 폼(form-utils.js,
lead-form.js)에서 실측한 목록과 일치시켰다.

푸터에는 상호와 사업자등록번호만 넣는다. 대표자명은 처리방침 문서 안에만
두고, 사업장 주소는 게시하지 않는다 - 아파트 주소이고 결제 전이라
전자상거래법상 표시 의무가 아직 없다."
```

---

## Task 6: PR·머지·배포·검증

**Files:** 없음 (통합·배포)

**Interfaces:**
- Consumes: Task 1~5의 커밋
- Produces: 라이브 반영된 `https://leva.ai.kr`

> **선결조건:** Cloudflare API 토큰. 이 프로젝트는 GitHub 연동이 아니라 **직접 업로드**라 `develop` 머지만으로는 배포되지 않는다.

- [ ] **Step 1: 전체 검증 후 푸시**

```bash
cd /d/workspace/dpa/devpath-home-page && npm run test:all
git -C /d/workspace/dpa/devpath-home-page push -u origin feat/leva-rebrand-compliance
```

기대: 유닛 전량 + E2E 6건 PASS.

- [ ] **Step 2: PR 생성**

```bash
gh pr create --repo DevPathAi/devpath-home-page --base develop --head feat/leva-rebrand-compliance \
  --title "feat: 랜딩을 사업계획서와 정합화 — 브랜드 Leva·가격 2단계·처리방침 신설" \
  --body "사업계획서와 대조해 드러난 불일치 3건을 고친다. 셋 다 '둘 중 하나는 거짓말이 된다'는 성격이라 문서 신뢰도를 깎는 자리다.

## 변경
- **브랜드** — 사이트 전체가 \`DevPath AI\`였고 \`Leva\`는 URL·이메일로만 등장했다. 문자열 10곳 + 워드마크 구조 + **OG 이미지 재생성**까지 \`Leva\` 단독으로 교체.
- **가격** — 랜딩 4단계(\`라이트 4,900\` 포함) vs 문서의 '하한 9,900 확정, 진입가 하향 미채택'. **무료 + 9,900 2단계**로 축소.
- **처리방침** — \`href=\\\"#\\\"\`로 문서 자체가 없었다. \`/privacy.html\` 신설 + 푸터 연결.
- **죽은 링크** — \`href=\\\"#\\\"\` 4건 전부 제거.

## 처리방침은 애드센스 심사 요건이기도 하다
AdSense 정책이 쿠키·웹비콘·IP 수집과 제3자 광고 사업자의 정보 수집 고지를 **명시적으로 요구**한다. 이미 스크립트를 싣고 심사를 기다리는 상태라 이대로면 떨어질 사유였다.

## 운영주체 표기
푸터는 \`레바 | 796-76-00732\`만. 대표자명은 처리방침 문서 안에만 두고, **사업장 주소는 게시하지 않는다** — 아파트 주소이고 결제 전이라 전자상거래법상 표시 의무가 아직 없다. 테스트가 주소·성명이 푸터에 새는 것을 막는다.

## 테스트
\`tests/content-compliance.test.js\` 신설 + \`head-meta.test.js\` 확장. \`DevPath\` 부재 · \`4,900\`/\`14,900\` 부재 · \`href=\\\"#\\\"\` 0건 · 처리방침 필수 항목 · 주소/성명 미노출을 모두 단언한다.

⚠️ 처리방침 초안은 PIPA 필수 항목과 애드센스 정책을 채운 실무 표준 수준이나 **작성자는 변호사가 아니다.** 게시 전 검토 필요."
```

- [ ] **Step 3: CI 확인 후 머지**

```bash
gh pr checks --repo DevPathAi/devpath-home-page feat/leva-rebrand-compliance --watch
gh pr merge --repo DevPathAi/devpath-home-page feat/leva-rebrand-compliance --merge
```

- [ ] **Step 4: 배포**

```bash
cd /d/workspace/dpa/devpath-home-page
git switch develop && git pull --ff-only
npm run build
export CLOUDFLARE_API_TOKEN='<사용자가 제공한 토큰>'
npx wrangler pages deploy dist --project-name devpath-home-page --branch develop
```

- [ ] **Step 5: 라이브 검증**

배포 직후 몇 초간 522가 뜰 수 있다(엣지 전파). 재시도를 포함한다.

```bash
for i in $(seq 1 8); do
  ok=1; r=""
  for p in / /privacy.html /ads.txt /robots.txt; do
    c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "https://leva.ai.kr$p")
    r="$r $p=$c"; [ "$c" = "200" ] || ok=0
  done
  echo "$(date +%H:%M:%S)$r"
  [ "$ok" = "1" ] && break
  sleep 20
done
echo "--- DevPath 잔여 ---"; curl -s --max-time 20 https://leva.ai.kr/ | grep -c "DevPath"
echo "--- 4,900 / 14,900 잔여 ---"; curl -s --max-time 20 https://leva.ai.kr/ | grep -cE "4,900|14,900"
echo "--- 푸터 처리방침 링크 ---"; curl -s --max-time 20 https://leva.ai.kr/ | grep -o 'href="/privacy.html"'
echo "--- 처리방침 content-type ---"; curl -s -o /dev/null -w "%{content_type}\n" --max-time 20 https://leva.ai.kr/privacy.html
echo "--- 애드센스 스크립트 유지 ---"; curl -s --max-time 20 https://leva.ai.kr/ | grep -c "adsbygoogle.js?client=ca-pub-2785578834914321"
```

기대:
- 4개 경로 전부 **200**
- `DevPath` 잔여 **0**
- `4,900`/`14,900` 잔여 **0**
- 푸터 링크 `href="/privacy.html"` 존재
- `/privacy.html` → `text/html`
- 애드센스 스크립트 **1** (심사 중이므로 절대 빠지면 안 된다)

- [ ] **Step 6: OG 이미지 라이브 확인**

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type} %{size_download}\n" --max-time 20 https://leva.ai.kr/assets/og-image.png
```

기대: `200 image/png` + 크기가 0이 아님. **이미지 내용은 브라우저로 열어 눈으로 확인한다** — 옛 브랜드가 남아 있으면 공유 미리보기에서 드러난다.

---

## 이 계획의 범위 밖

- 카피·레이아웃 재설계 — 브랜드 문자열만 바꾸고 문장 구조는 유지
- 앱(`app.leva.ai.kr`)의 브랜드 — 이 계획은 랜딩만 다룬다
- 통신판매업 신고·이용약관 — 결제를 받지 않는 현 단계에선 의무가 아니다
- 사업장 주소 게시 — 결제 도입 시 재판단
- **사용자가 보고한 항목 중 2번** — 1·3·4번만 보고돼 2번이 무엇인지 확인되지 않았다
