# 홈페이지 라이브 + 애드센스 심사 — 설계

- 작성일: 2026-08-10
- 관련 레포: `devpath-home-page` (코드) · 가비아(DNS) · Cloudflare(호스팅·DNS)
- 선행: [devpath-platform-svc `2026-08-09-adsense-integration-design.md`](https://github.com/DevPathAi/devpath-platform-svc/blob/develop/docs/superpowers/specs/2026-08-09-adsense-integration-design.md) — 퍼블리셔 ID와 `ads.txt` 위치 결정이 여기서 나왔다

## 1. 배경

애드센스 병행 도입(위 선행 스펙)으로 웹앱 `app.leva.ai.kr`에는 애드센스 배선이 끝났다. 그러나 **심사를 신청할 수 없다.** 두 가지 이유다.

**첫째, 심사 대상으로 삼을 만한 사이트가 라이브가 아니다.** 2026-08-10 실측:

| 도메인 | 상태 |
|---|---|
| `leva.ai.kr` (루트) | **A 레코드 없음** — 아무것도 서빙되지 않는다 |
| `app.leva.ai.kr` | 200 (k3s) |
| `api.leva.ai.kr` | 200 |
| `admin.leva.ai.kr` | 200 |

루트가 죽어 있는 원인은 홈페이지가 **한 번도 배포된 적이 없기 때문**이다. `HANDOFF.md:8`이 "배포 = Cloudflare Pages(**미연결**)"라고 적고 있고, 이관 항목 1번(CF Pages 프로젝트 생성 · 도메인 DNS + SSL)이 그대로 남아 있다.

**둘째, 앱은 심사 대상으로 부적합하다.** 광고 슬롯 3곳이 전부 로그인 뒤(`gateRedirect`) 화면이고, Flutter CanvasKit이라 크롤러가 읽을 텍스트가 사실상 없다. 반면 홈페이지는 정적 HTML에 실제 콘텐츠(문제 정의·기능·진행방식·창업자 스토리·요금)가 있어 크롤링된다.

따라서 **홈페이지를 먼저 띄우고 그것으로 심사받는다.**

## 2. 범위

### 이 스펙이 하는 것
`leva.ai.kr` 루트를 라이브로 만들고, 애드센스 심사를 **신청할 수 있는 상태**까지 도달한다.

### 이 스펙이 하지 않는 것
- **인터뷰 이식** — `devpath-landing-page`의 AI 학습 진단 인터뷰를 홈페이지로 옮기는 작업은 **2단계 별도 스펙**이다. 사유는 §7 참조.
- **광고 슬롯 배치** — 심사 전에는 광고가 나오지 않는다. 배치는 승인 후 별도 결정.
- **자동 광고(Auto ads)** — 리드폼이 목표인 마케팅 페이지에 광고가 끼어들어 전환율을 해칠 수 있어 채택하지 않는다.
- **`app.leva.ai.kr` 재배포** — 앱의 애드센스 배선은 `develop`에 머지됐으나 배포되지 않았다(이미지 빌드가 `main` push에서만 동작, frontend는 main 대비 +243커밋). 이 릴리스는 별건이다.
- **SPF 레코드 신설** — 존에 SPF가 없다(§4.1). 메일 도달률 이슈지만 이번 범위 밖.

### 완료 조건이 아닌 것
**심사 승인.** 애드센스는 콘텐츠 분량을 본다. 홈페이지는 제품 소개 1페이지라 「가치 있는 콘텐츠 부족」으로 거절될 가능성이 실재한다. 이 스펙은 *신청 가능 상태*를 보장하지, 승인을 보장하지 않는다(§7).

## 3. 코드 변경 (`devpath-home-page`)

### 3.1 애드센스 스크립트

`index.html` `<head>`에 추가한다.

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2785578834914321"
        crossorigin="anonymous"></script>
```

**광고 슬롯(`<ins>`)은 배치하지 않는다.** 심사 신청에 필요한 것은 스크립트와 `ads.txt`이며, 슬롯을 두면 심사 대기 동안 빈 자리만 남는다.

`<head>`에 정적으로 두는 이유는 심사 크롤러가 페이지에서 스크립트를 찾아야 하기 때문이다 — 지연 주입하면 안 된다.

### 3.2 canonical·OG 도메인 교정

`index.html`이 존재하지 않는 도메인을 정규 URL로 선언하고 있다. 실측:

| 행 | 현재 | 교정 |
|---|---|---|
| 10 | `<link rel="canonical" href="https://devpath.ai/">` | `https://leva.ai.kr/` |
| 18 | `og:url` = `https://devpath.ai/` | `https://leva.ai.kr/` |
| 19 | `og:image` = `https://devpath.ai/assets/og-image.png` | `https://leva.ai.kr/assets/og-image.png` |
| 26 | `twitter:image` = `https://devpath.ai/assets/og-image.png` | `https://leva.ai.kr/assets/og-image.png` |

이 상태로 배포하면 SEO와 애드센스 크롤러 양쪽이 엉뚱한 도메인을 본다. **배포 전 필수 수정이다.**

### 3.3 `robots.txt` 신설

`build.mjs`의 `DEPLOY_ENTRIES`에 `'robots.txt'`가 이미 등록돼 있으나 **파일이 실재하지 않는다.** 크롤러를 명시적으로 허용한다.

```
User-agent: *
Allow: /

Sitemap: https://leva.ai.kr/sitemap.xml
```

> `sitemap.xml`은 이번에 만들지 않는다. 단일 페이지 사이트라 실익이 없고, 존재하지 않는 파일을 가리키는 `Sitemap:` 지시는 크롤러가 무시한다. 콘텐츠가 늘어나는 2단계에서 함께 만든다. **이 줄을 지금 넣는 이유는 그때 robots.txt를 다시 건드리지 않기 위해서다.**

### 3.4 `ads.txt`

**추가 작업 없음.** [PR #10](https://github.com/DevPathAi/devpath-home-page/pull/10)에서 이미 머지됐다 — 레포 루트의 `ads.txt`와 `build.mjs`의 `DEPLOY_ENTRIES` 등록까지 완료돼 `npm run build` 시 `dist/ads.txt`로 나간다(검증 완료).

## 4. 배포 아키텍처

### 4.1 왜 Cloudflare Pages인가

선택이 아니라 **기존 코드가 강제한다.** `functions/api/lead.js`·`stats.js`가 CF Pages Functions 규약으로 작성돼 있어(같은 출처 프록시로 Apps Script에 포워딩, CORS 회피) GitHub Pages나 k3s 정적 호스팅으로 옮기면 리드폼이 깨진다.

### 4.2 DNS — 왜 NS를 이전하는가

CF Pages 커스텀 도메인은 CNAME을 요구하는데, **DNS 표준상 zone apex에는 CNAME을 쓸 수 없다.** 우회하려면 DNS 제공자가 ALIAS/ANAME을 지원해야 하는데, 2026-08-10 확인 결과 **가비아는 A / CNAME / MX / TXT / SRV / SPF만 제공하고 ALIAS·ANAME이 없다**([가비아 고객센터](https://customer.gabia.com/manual/38/3041/3040)).

따라서 가비아를 유지한 채로는 루트를 CF Pages에 붙일 수 없다. **NS를 Cloudflare로 이전**하면 CNAME flattening으로 apex가 해결되고, 이후 레코드를 API로 관리할 수 있다.

기각한 대안: `www`만 사용하고 루트를 포기하는 방법. 가장 안전하지만 **루트가 계속 죽어 있고**(방문자가 `leva.ai.kr`을 치면 아무것도 안 나온다) 심사 대상·canonical·`ads.txt`가 전부 `www` 기준이 된다. 루트가 죽은 채로 심사를 넣는 것은 불리하다.

### 4.3 이전해야 할 레코드 (2026-08-10 권한 NS 실측)

| 유형 | 이름 | 값 |
|---|---|---|
| `MX` | apex | `smtp.google.com` (preference 1) — **Google Workspace. 누락 시 메일 수신 중단** |
| `TXT` | `google._domainkey` | Google Workspace **DKIM** |
| `A` | `app` | `13.124.153.105` |
| `A` | `api` | `13.124.153.105` |
| `A` | `admin` | `13.124.153.105` |

**없는 것**(확인 완료): apex A · apex TXT · SPF · `_dmarc` · `www` CNAME · `_acme-challenge`.

존이 작아 이전 위험이 낮다. 다만 위 5건 중 하나라도 빠지면 **메일 또는 서비스가 죽는다.**

### 4.4 이전 절차 — 되돌릴 수 있게

**선결조건**: Cloudflare **API 토큰**과 **Account ID**. 토큰 권한은 `Account: Cloudflare Pages:Edit` + `Zone: DNS:Edit` + `Zone: Zone:Edit`가 필요하다. 토큰은 **커밋하지 않는다** — 셸 환경변수로만 전달한다.

| # | 단계 | 수행 |
|---|---|---|
| 1 | wrangler로 CF Pages 프로젝트 생성 → 배포 → **`*.pages.dev`에서 먼저 동작 검증**(도메인 연결 전) | 에이전트 |
| 2 | CF에 `leva.ai.kr` 존 추가 → 기존 레코드 자동 스캔 | 에이전트 |
| 3 | **가져온 레코드를 §4.3 표와 1:1 대조** → 결과를 사용자에게 제시하고 **명시적 확인을 받는다** | 에이전트 제시 / **사용자 승인** |
| 4 | 가비아 콘솔에서 NS를 CF가 지정한 값으로 변경 | **사용자** (가비아 계정 필요) |
| 5 | 전파 확인 후 `leva.ai.kr`·`www.leva.ai.kr`을 커스텀 도메인으로 연결(루트는 CNAME flattening) | 에이전트 |

3단계는 **되돌릴 수 없는 4단계 직전의 게이트다.** 여기서 멈추지 않고 넘어가면 안 된다.

**롤백**: NS를 가비아 것으로 되돌리면 원상복구된다. 3단계 대조를 건너뛰지 않는 한 되돌릴 수 없는 상태로 가지 않는다.

### 4.5 환경변수

| 키 | 값 | 필수? |
|---|---|---|
| `APPS_SCRIPT_URL` | Apps Script Web App `/exec` URL | **아니오** |

`config.js`가 미설정 시 "폼은 검증까지 동작하고 제출 단계에서 안내 메시지로 graceful degrade"하도록 설계돼 있어 **심사 배포의 선결조건이 아니다.** 값이 확보되면 CF Pages 대시보드에 등록한다.

## 5. 검증

배포 후 다음을 실측한다. 하나라도 어긋나면 심사를 신청하지 않는다.

| # | 확인 | 기대 |
|---|---|---|
| 1 | `https://leva.ai.kr` | **200** |
| 2 | `https://leva.ai.kr/ads.txt` | **200** + `content-type: text/plain` + 퍼블리셔 ID 일치 |
| 3 | 응답 HTML `<head>` | `adsbygoogle.js?client=ca-pub-2785578834914321` 포함 |
| 4 | `canonical`·`og:url` | `leva.ai.kr` (`devpath.ai` 잔여 0건) |
| 5 | `https://leva.ai.kr/robots.txt` | **200**, 크롤러 허용 |
| 6 | `app`·`api`·`admin` `.leva.ai.kr` | **여전히 200** (NS 이전 회귀 확인) |
| 7 | **메일 수신** | 외부에서 1건 발송해 실제 도착 확인 |

> ⚠️ **`/ads.txt`의 `content-type`을 반드시 본다.** 앱 쪽에서 이 함정을 이미 밟았다 — SPA 폴백이 `/ads.txt` 요청에 `index.html`을 200으로 돌려줘서, 상태코드만 보면 정상으로 보였다. 본문과 `content-type`까지 확인해야 한다.

기존 테스트(Vitest 유닛 32 + Playwright E2E 6)는 코드 변경 후 전부 통과해야 한다.

## 6. 심사 신청 — 사용자 실행

애드센스 콘솔 작업은 사용자 구글 계정에서만 가능하다. 구현 산출물에 단계별 런북을 남긴다.

1. 애드센스 콘솔 → 사이트 → `leva.ai.kr` 추가
2. 사이트 소유권 확인(스크립트가 이미 `<head>`에 있으므로 자동 감지)
3. 심사 요청
4. 결과 수신까지 수일~수주

## 7. 2단계로 미루는 것과 그 이유

**인터뷰 이식**(`devpath-landing-page` → 홈페이지)을 이 스펙에서 뺀 이유는 두 가지다.

첫째, **심사에 기여하지 않는다.** 인터뷰는 인터랙티브 JS라 크롤러가 읽을 콘텐츠를 늘려주지 않는다.

둘째, **배포 선결조건을 크게 늘린다.** 실측한 의존성은 `ANTHROPIC_API_KEY`(실제 토큰 비용) · `TURNSTILE_SECRET` + site key · **Cloudflare KV 네임스페이스**(`INTERVIEW_KV` — rate limit·예산 상한) · Apps Script/Sheets다. 이걸 다 갖추길 기다리면 심사 신청이 그만큼 늦어진다.

심사는 결과까지 수일~수주가 걸리므로, **그 대기 시간에 인터뷰를 작업하는 것**이 전체 일정상 유리하다.

## 8. 위험

| 위험 | 대응 |
|---|---|
| **심사 거절(콘텐츠 부족)** — 제품 소개 1페이지 | 이 스펙의 완료 조건이 아님을 명시. 거절 시 2단계에서 콘텐츠(블로그·학습 가이드) 보강 |
| NS 이전 중 MX·DKIM 누락 → **메일 중단** | §4.4 3단계에서 대조 검증 후 사용자 확인. 검증 항목 7에 메일 실수신 포함 |
| NS 이전 중 app·api·admin A 레코드 누락 → **서비스 중단** | 동일. 검증 항목 6 |
| NS 전파 지연 | 롤백 가능(NS 원복). 전파 확인 후에만 다음 단계 |
| `ads.txt`가 폴백 HTML로 응답 | 검증 항목 2에서 `content-type`까지 확인 |
