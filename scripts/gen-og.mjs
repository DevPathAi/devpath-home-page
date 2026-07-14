// OG 이미지 생성 — assets/og-image.template.html 을 1200×630으로 렌더해 PNG 저장.
// 사용: node scripts/gen-og.mjs  (Playwright chromium 필요: npx playwright install chromium)
// 템플릿/카피 수정 후 재실행해 assets/og-image.png 를 갱신한다.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const templateUrl = new URL('../assets/og-image.template.html', import.meta.url).href;
const outPath = fileURLToPath(new URL('../assets/og-image.png', import.meta.url));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(templateUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready); // 웹폰트 로드 대기
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log(`generated ${outPath}`);
} finally {
  await browser.close();
}
