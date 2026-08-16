import { expect } from '@playwright/test';

import { loadVisualFontAssets } from '../../../scripts/visual-fonts.mjs';
import { loadCaseCatalog, validateCandidateSpec, CANDIDATE_SPEC_PATH } from '../../../scripts/visual-evidence.mjs';
import { readFileSync } from 'node:fs';

const STATS_FIXTURE = Object.freeze({
  ok: true,
  signups: 42,
  diagnoses_completed: 30,
  satisfaction: 4.6,
});

function readCandidate() {
  return validateCandidateSpec(JSON.parse(readFileSync(CANDIDATE_SPEC_PATH, 'utf8')));
}

function fontCss(fonts) {
  const faces = [];
  for (const font of fonts) {
    const source = `/__visual_fonts__/${font.file}`;
    for (const family of font.family === 'Pretendard'
      ? ['Pretendard', 'Pretendard Variable']
      : ['D2Coding']) {
      faces.push(`@font-face {
        font-family: "${family}";
        src: url("${source}") format("woff2");
        font-style: normal;
        font-weight: ${font.weight};
        font-display: block;
      }`);
    }
  }
  return faces.join('\n');
}

async function hydrateDeterministically(page) {
  const widgets = page.locator('[data-widget]');
  for (let index = 0; index < await widgets.count(); index += 1) {
    await widgets.nth(index).scrollIntoViewIfNeeded();
  }
  await expect.poll(
    () => widgets.evaluateAll((elements) => elements.filter((element) => element.dataset.hydrated === 'true').length),
    { timeout: 10_000 },
  ).toBe(await widgets.count());
  await page.evaluate(() => window.scrollTo(0, 0));
}

export async function prepareDeterministicPage(page, { animationsOff = true } = {}) {
  const candidate = readCandidate();
  const fonts = await loadVisualFontAssets();
  const fontByPath = new Map(fonts.map((font) => [`/__visual_fonts__/${font.file}`, font]));
  let externalRequestCount = 0;

  await page.emulateMedia({
    colorScheme: candidate.runtime.color_scheme,
    reducedMotion: candidate.runtime.reduced_motion,
  });

  await page.addInitScript(({ pinnedClock }) => {
    const NativeDate = Date;
    const fixed = NativeDate.parse(pinnedClock);
    class FixedDate extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : [fixed]));
      }

      static now() {
        return fixed;
      }
    }
    Object.setPrototypeOf(FixedDate, NativeDate);
    window.Date = FixedDate;
    Math.random = () => 0.5;
  }, { pinnedClock: candidate.runtime.clock });

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (!local) {
      externalRequestCount += 1;
      await route.abort('blockedbyclient');
      return;
    }
    if (fontByPath.has(url.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'font/woff2',
        body: fontByPath.get(url.pathname).bytes,
      });
      return;
    }
    if (url.pathname === '/api/stats') {
      await route.fulfill({ status: 200, json: STATS_FIXTURE });
      return;
    }
    if (url.pathname === '/api/lead') {
      await route.fulfill({ status: 200, json: { ok: true, lead_id: 'visual-fixture', updated: false } });
      return;
    }
    await route.continue();
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: fontCss(fonts) });
  if (animationsOff) {
    await page.addStyleTag({ content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
      }
    ` });
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const fontState = await page.evaluate(() => ({
    status: document.fonts.status,
    pretendard: document.fonts.check('16px Pretendard'),
    d2coding: document.fonts.check('16px D2Coding'),
  }));
  expect(fontState).toEqual({ status: 'loaded', pretendard: true, d2coding: true });

  await hydrateDeterministically(page);
  const stylesheets = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => (
    links.map((link) => link.getAttribute('href')).filter(Boolean)
  ));
  expect(stylesheets.some((href) => /^\/assets\/tokens\.[0-9a-f]{8}\.css$/.test(href))).toBe(true);
  expect(stylesheets.some((href) => /^\/assets\/styles\.[0-9a-f]{8}\.css$/.test(href))).toBe(true);

  return Object.freeze({
    candidate,
    fontState,
    getExternalRequestCount: () => externalRequestCount,
  });
}

export function catalogCase(id) {
  const entry = loadCaseCatalog().cases.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`unknown visual/a11y case: ${id}`);
  return entry;
}
