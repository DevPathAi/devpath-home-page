# 애드센스 심사 신청 런북

- 대상 사이트: `https://leva.ai.kr`
- 퍼블리셔 ID: `ca-pub-2785578834914321`
- 전제: Task 7까지 완료되어 위 URL이 200으로 응답한다 (2026-08-10 달성)

## 배포 구성 (2026-08-10 시점)

| 항목 | 값 |
|---|---|
| 호스팅 | Cloudflare Pages 프로젝트 `devpath-home-page` (직접 업로드) |
| 프로덕션 브랜치 | `develop` |
| 기본 도메인 | `devpath-home-page.pages.dev` |
| 커스텀 도메인 | `leva.ai.kr` (CNAME flattening) · `www.leva.ai.kr` |
| DNS | Cloudflare (`mallory.ns.cloudflare.com` · `matias.ns.cloudflare.com`) |
| 존 요금제 | Free Website ($0) |

`app`·`api`·`admin` 서브도메인은 여전히 k3s(`13.124.153.105`)를 가리키며 **`proxied=false`** 다. 프록시를 켜면 k3s가 관리하는 TLS 인증서와 충돌하고 gateway의 SSE 스트리밍이 버퍼링에 걸린다. **켜지 말 것.**

## 재배포 방법

이 프로젝트는 GitHub 연동이 아니라 **직접 업로드**다. `develop`에 머지해도 자동 배포되지 않는다.

```bash
cd /d/workspace/dpa/devpath-home-page
git switch develop && git pull --ff-only
npm run build
export CLOUDFLARE_API_TOKEN='<토큰>'
npx wrangler pages deploy dist --project-name devpath-home-page --branch develop
```

## 신청 전 자가 점검

```bash
for p in / /ads.txt /robots.txt; do
  printf "%-16s " "$p"; curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "https://leva.ai.kr$p"
done
curl -s https://leva.ai.kr/ | grep -c "adsbygoogle.js?client=ca-pub-2785578834914321"
```

기대: 셋 다 200이고 `/ads.txt`가 **`text/plain`**, 스크립트 grep이 **1**.

> ⚠️ `/ads.txt`는 **상태코드만 보면 안 된다.** SPA 폴백이 `index.html`을 200으로 돌려주는 함정을 앱 쪽에서 이미 밟았다. `content-type`이 `text/plain`인지 반드시 확인한다.

## 신청 절차 (사용자 수행)

1. <https://adsense.google.com> 로그인
2. **사이트** → **사이트 추가** → `leva.ai.kr` 입력
3. 소유권 확인 — 스크립트가 이미 `<head>`에 있으므로 「AdSense 코드 스니펫」 방식이 자동 감지된다
4. **검토 요청**
5. 결과 수신까지 수일~수주

## 심사 중 하지 말 것

- 애드센스 스크립트를 `<head>`에서 빼거나 지연 로딩으로 바꾸지 않는다 — 크롤러가 찾지 못한다
- `ads.txt`를 지우거나 퍼블리셔 ID를 바꾸지 않는다
- 사이트를 내리지 않는다. **Cloudflare Pages는 상시 가동이라 AWS 정지와 무관하다** — EC2를 꺼도 `leva.ai.kr`은 살아 있다(`app`·`api`·`admin`만 죽는다)

## 알아둘 것 — Cloudflare가 메일 주소를 가린다

Free 플랜 기본 기능인 **Email Address Obfuscation**이 `mailto:` 링크를 `/cdn-cgi/l/email-protection#<hex>`로 바꾸고 디코더 스크립트를 주입한다. 스팸 수집 봇 차단용이며 **정상 동작**이다. 페이지 소스에서 `info@leva.ai.kr`을 grep해도 안 나오는 게 맞다(2026-08-10 디코딩으로 값 일치 확인).

부작용: JS가 꺼진 브라우저에서는 메일 링크가 동작하지 않는다. 원치 않으면 Cloudflare 대시보드 → Scrape Shield에서 끌 수 있다.

## 거절되면

가장 흔한 사유는 **「가치 있는 콘텐츠 부족」**이다. 이 사이트는 제품 소개 1페이지라 해당될 가능성이 실재한다. 그 경우 2단계에서 읽을거리(블로그·학습 가이드 등 정적 문서)를 늘린 뒤 재신청한다. 재신청에 횟수 제한은 없다.

거절 사유가 정책 위반이면 사유를 그대로 기록하고 대응을 다시 설계한다.

## 승인되면

광고 슬롯 배치를 별도로 결정한다. 이 스펙은 **슬롯을 배치하지 않았다** — 리드폼이 목표인 페이지의 전환율을 해칠 수 있어 승인 후 판단하기로 했다.

앱(`app.leva.ai.kr`)의 애드센스는 이미 코드가 `develop`에 있으나 배포되지 않았다(이미지 빌드가 `main` push에서만 동작하고 frontend는 main 대비 +243커밋). 별도 릴리스 결정이 필요하다.

## 후속 과제 (이번 범위 밖)

| 항목 | 내용 |
|---|---|
| `_routes.json` | Functions가 있는 Pages 프로젝트는 **기본적으로 모든 요청이 Function을 호출**해 Workers Free 한도(100,000 req/일)를 소모한다. `/api/*`만 포함하고 나머지를 제외하면 정적 요청이 무제한 무료로 남는다 |
| 랜딩 프로젝트 시크릿 | `devpath-landing-page`의 `ANTHROPIC_API_KEY`·`TURNSTILE_SECRET`이 암호화 secret이 아니라 **`plain_text`** 로 저장돼 API로 평문 조회가 가능하다. 과금이 걸린 자격증명이라 조치 필요 |
| SPF·DMARC | 존에 둘 다 없다. 메일 도달률 이슈 |
| `APPS_SCRIPT_URL` | 미설정. 리드폼이 `endpoint_not_configured`로 graceful degrade 중이다. 값 확보 시 `npx wrangler pages secret put APPS_SCRIPT_URL --project-name devpath-home-page` |
| 인터뷰 이식 | `devpath-landing-page`의 AI 학습 진단 인터뷰를 홈페이지로 옮기는 2단계 스펙 |
