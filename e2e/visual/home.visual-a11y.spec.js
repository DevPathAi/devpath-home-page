import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

import {
  VISUAL_ROOT,
  loadCaseCatalog,
} from '../../scripts/visual-evidence.mjs';
import {
  catalogCase,
  prepareDeterministicPage,
} from './support/deterministic-page.js';
import {
  runEvidenceCase,
  violationCounts,
} from './support/evidence-recorder.js';

const catalog = loadCaseCatalog();
const baselineDirectory = join(VISUAL_ROOT, 'baselines');

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function visualBaselinePath(entry) {
  return join(baselineDirectory, entry.artifact);
}

async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
}

test.describe('Home production-dist permanent visual evidence', () => {
  for (const entry of catalog.cases.filter((candidate) => candidate.kind === 'visual')) {
    test(entry.id, async ({ page }, testInfo) => {
      await runEvidenceCase({ testInfo, catalogCase: entry }, async () => {
        await page.setViewportSize(entry.viewport);
        await prepareDeterministicPage(page);
        await assertNoHorizontalOverflow(page);

        const baseline = visualBaselinePath(entry);
        if (process.env.HOME_VISUAL_BASELINE_UPDATE !== '1') {
          expect(existsSync(baseline), 'baseline updates require the reviewed update script').toBe(true);
        }
        await expect(page).toHaveScreenshot(entry.artifact, {
          fullPage: true,
          animations: 'disabled',
          caret: 'hide',
          scale: 'css',
          maxDiffPixels: 0,
        });

        return {
          checkCount: entry.checks.length,
          artifactSha256: hashFile(baseline),
        };
      });
    });
  }
});

test.describe('Home production-dist automated accessibility evidence', () => {
  test('home-axe-wcag-aa', async ({ page }, testInfo) => {
    const entry = catalogCase('home-axe-wcag-aa');
    await runEvidenceCase({ testInfo, catalogCase: entry }, async () => {
      await page.setViewportSize(entry.viewport);
      const runtime = await prepareDeterministicPage(page);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const counts = violationCounts(results.violations);
      try {
        expect(results.violations.map(({ id, impact, nodes }) => ({
          id,
          impact,
          targets: nodes.map((node) => node.target),
        }))).toEqual([]);
      } catch (cause) {
        if (cause && typeof cause === 'object') {
          Object.defineProperty(cause, 'sanitizedEvidence', {
            value: { violationCounts: counts },
          });
        }
        throw cause;
      }
      expect(runtime.fontState).toEqual({ status: 'loaded', pretendard: true, d2coding: true });
      // External font/ads requests are blocked before transmission; only the local dist,
      // pinned local fonts, and deterministic same-origin API fixtures may complete.
      expect(runtime.getExternalRequestCount()).toBeGreaterThanOrEqual(1);
      return { checkCount: entry.checks.length, violationCounts: counts };
    });
  });

  test('home-reflow-200-long-ko', async ({ page }, testInfo) => {
    const entry = catalogCase('home-reflow-200-long-ko');
    await runEvidenceCase({ testInfo, catalogCase: entry }, async () => {
      await page.setViewportSize(entry.viewport);
      await prepareDeterministicPage(page);
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await page.locator('.outcome-preview__context dd').first().evaluate((element) => {
        element.textContent = '학습경로식별자-가나다라마바사아자차카타파하-ABCDEF0123456789'.repeat(4);
      });
      await assertNoHorizontalOverflow(page);
      const clipped = await page.locator('body *').evaluateAll((elements) => elements.filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        return element.scrollWidth > element.clientWidth + 1 && style.overflowX === 'visible';
      }).length);
      expect(clipped).toBe(0);
      return { checkCount: entry.checks.length, violationCounts: violationCounts() };
    });
  });

  test('home-keyboard-focus', async ({ page }, testInfo) => {
    const entry = catalogCase('home-keyboard-focus');
    await runEvidenceCase({ testInfo, catalogCase: entry }, async () => {
      await page.setViewportSize(entry.viewport);
      await prepareDeterministicPage(page);
      await page.keyboard.press('Tab');
      const skip = page.locator('.skip-link');
      await expect(skip).toBeFocused();
      await expect(skip).toBeVisible();
      const focus = await skip.evaluate((element) => {
        const style = getComputedStyle(element);
        return { width: style.outlineWidth, style: style.outlineStyle };
      });
      expect(Number.parseFloat(focus.width)).toBeGreaterThanOrEqual(2);
      expect(focus.style).not.toBe('none');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/#main$/);
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
      return { checkCount: entry.checks.length, violationCounts: violationCounts() };
    });
  });

  test('home-heading-primary', async ({ page }, testInfo) => {
    const entry = catalogCase('home-heading-primary');
    await runEvidenceCase({ testInfo, catalogCase: entry }, async () => {
      await page.setViewportSize(entry.viewport);
      await prepareDeterministicPage(page);
      const structure = await page.evaluate(() => {
        const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
          .filter((heading) => getComputedStyle(heading).display !== 'none')
          .map((heading) => Number(heading.tagName.slice(1)));
        const skipped = levels.some((level, index) => index > 0 && level > levels[index - 1] + 1);
        const primaryCounts = [...document.querySelectorAll('header, main > section')].map((region) => (
          [...region.querySelectorAll('.btn-primary')]
            .filter((element) => getComputedStyle(element).display !== 'none').length
        ));
        return {
          h1Count: levels.filter((level) => level === 1).length,
          skipped,
          maxPrimary: Math.max(...primaryCounts),
        };
      });
      expect(structure).toEqual({ h1Count: 1, skipped: false, maxPrimary: 1 });
      return { checkCount: entry.checks.length, violationCounts: violationCounts() };
    });
  });

  test('home-targets-44', async ({ page }, testInfo) => {
    const entry = catalogCase('home-targets-44');
    await runEvidenceCase({ testInfo, catalogCase: entry }, async () => {
      await page.setViewportSize(entry.viewport);
      await prepareDeterministicPage(page);
      await page.locator('.mobile-nav__toggle').click();
      const undersized = await page.locator([
        '.btn',
        '.mobile-nav__toggle',
        '.mobile-nav__panel a',
        '.outcome-preview__action a',
        '.site-footer__links a',
        '.lcs-tab',
        '.lead-form input:not([type="checkbox"])',
        '.lead-form select',
        '.lead-form textarea',
      ].join(',')).evaluateAll((elements) => elements.flatMap((element) => {
        const box = element.getBoundingClientRect();
        const visible = box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden';
        if (!visible || (box.width >= 44 && box.height >= 44)) return [];
        return [{
          tag: element.tagName.toLowerCase(),
          class_name: [...element.classList].sort().join('.'),
          width: Math.round(box.width),
          height: Math.round(box.height),
        }];
      }));
      expect(undersized).toEqual([]);
      return { checkCount: entry.checks.length, violationCounts: violationCounts() };
    });
  });

  test('home-reduced-motion', async ({ page }, testInfo) => {
    const entry = catalogCase('home-reduced-motion');
    await runEvidenceCase({ testInfo, catalogCase: entry }, async () => {
      await page.setViewportSize(entry.viewport);
      await prepareDeterministicPage(page, { animationsOff: false });
      const motion = await page.evaluate(() => ({
        scroll: getComputedStyle(document.documentElement).scrollBehavior,
        transition: getComputedStyle(document.querySelector('.btn')).transitionDuration,
        founderOpacity: getComputedStyle(document.querySelector('.founder__beat')).opacity,
        founderTransform: getComputedStyle(document.querySelector('.founder__beat')).transform,
        runningAnimations: document.getAnimations().filter((animation) => animation.playState === 'running').length,
      }));
      expect(motion.scroll).toBe('auto');
      expect(motion.transition.split(',').every((duration) => duration.trim() === '0s')).toBe(true);
      expect(motion.founderOpacity).toBe('1');
      expect(motion.founderTransform).toBe('none');
      expect(motion.runningAnimations).toBe(0);
      return { checkCount: entry.checks.length, violationCounts: violationCounts() };
    });
  });

  test('home-mobile-menu-escape', async ({ page }, testInfo) => {
    const entry = catalogCase('home-mobile-menu-escape');
    await runEvidenceCase({ testInfo, catalogCase: entry }, async () => {
      await page.setViewportSize(entry.viewport);
      await prepareDeterministicPage(page);
      const details = page.locator('details.mobile-nav');
      const toggle = page.locator('.mobile-nav__toggle');
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(details).toHaveJSProperty('open', true);
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape');
      await expect(details).toHaveJSProperty('open', false);
      await expect(toggle).toBeFocused();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      return { checkCount: entry.checks.length, violationCounts: violationCounts() };
    });
  });
});
