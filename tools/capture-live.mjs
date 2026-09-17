// 운영 앱 실캡처 도구(홈 필름스트립·히어로용).
// 사용: node tools/capture-live.mjs diagnostic --out=assets/live-diagnostic-result.png
//   게스트 진단(로그인 불필요)을 자동 진행한다: 트랙 "백엔드 (Spring)" → 15문항을 각 문항의
//   첫 번째 보기로 응답(스킵 없음 → 신뢰도 100%) → 결과 카드가 보이는 화면을 캡처한다.
// 캡처 조건: 1440×900 뷰포트, DPR 2, ko-KR. 결과는 실제 운영 응답이며 데모 데이터가 아니다.
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(3).map((a) => a.replace(/^--/, '').split('=')));
const mode = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ready(page) {
  const placeholder = page.locator('flt-semantics-placeholder').first();
  await placeholder.waitFor({ state: 'attached', timeout: 60000 });
  await placeholder.dispatchEvent('click');
  await page.locator('flt-semantics').first().waitFor({ state: 'attached', timeout: 60000 });
  await sleep(800);
}

async function diagnostic(page) {
  await page.goto('https://app.leva.ai.kr/diagnostic', { waitUntil: 'networkidle' });
  await ready(page);
  await page.getByRole('button', { name: '진단할 트랙' }).click();
  await sleep(400);
  await page.getByRole('menuitem', { name: '백엔드 (Spring)' }).click();
  await sleep(400);
  await page.getByRole('button', { name: '진단 시작하기' }).click();
  for (let question = 1; question <= 15; question += 1) {
    await page.getByText(new RegExp(`${question} / 15`)).waitFor({ timeout: 30000 });
    await sleep(250);
    // 첫 번째 보기(스킵 버튼 '잘 모르겠어요' 제외)를 고른다.
    const options = page.getByRole('button').filter({ hasNotText: '잘 모르겠어요' });
    const count = await options.count();
    let clicked = false;
    for (let index = 0; index < count; index += 1) {
      const name = (await options.nth(index).getAttribute('aria-label')) ?? (await options.nth(index).innerText());
      if (/진단할 트랙|진단 시작|Leva|메뉴|검색/.test(name)) continue;
      await options.nth(index).click();
      clicked = true;
      break;
    }
    if (!clicked) throw new Error(`문항 ${question}: 보기 버튼을 찾지 못했다`);
  }
  await page.getByText('진단 결과').waitFor({ timeout: 30000 });
  await sleep(1200);
  const confidence = await page.getByText(/진단 신뢰도 \d+%/).first().innerText().catch(() => 'n/a');
  const level = await page.getByText(/현재 레벨/).first().innerText().catch(() => 'n/a');
  return { confidence, level };
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'ko-KR' });
const page = await context.newPage();
let meta = {};
if (mode === 'diagnostic') meta = await diagnostic(page);
else throw new Error(`unknown mode ${mode}`);
const out = resolve(args.out ?? `evidence/capture-${mode}.png`);
await page.screenshot({ path: out, fullPage: false });
console.log(JSON.stringify({ mode, out, ...meta, captured_at: new Date().toISOString() }));
await browser.close();
