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
