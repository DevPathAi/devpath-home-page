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
  // 이 단언이 실제로 JSON-LD url과 mailto 3곳을 잡아냈다.
  it('devpath.ai가 한 곳도 남아 있지 않다', () => {
    expect(html).not.toContain('devpath.ai');
  });

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
});

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
