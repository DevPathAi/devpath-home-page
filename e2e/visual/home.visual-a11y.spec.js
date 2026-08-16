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
const TEXT_RESIZE_200_CSS = `
  :root {
    --dp-type-display-small: 400 72px/88px "Pretendard";
    --dp-type-headline-small: 600 48px/64px "Pretendard";
    --dp-type-title-large: 700 40px/56px "Pretendard";
    --dp-type-title-medium: 600 32px/48px "Pretendard";
    --dp-type-title-small: 600 28px/40px "Pretendard";
    --dp-type-body-large: 400 32px/51.2px "Pretendard";
    --dp-type-body-medium: 400 28px/44.8px "Pretendard";
    --dp-type-body-small: 400 26px/40px "Pretendard";
    --dp-type-label-large: 600 28px/40px "Pretendard";
    --dp-type-label-medium: 600 24px/32px "Pretendard";
    --dp-type-label-small: 500 22px/32px "Pretendard";
    --dp-type-code: 400 28px/42px "D2Coding";
  }
  html { font-size: 200% !important; }
`;
const TARGET_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');
const INLINE_TARGET_EXCEPTIONS = Object.freeze([
  {
    selector: '.traction__fallback a',
    case: 'wcag-2.5.8-inline-text',
    reason: 'The traction link is embedded in fallback prose.',
  },
  {
    selector: '.faq__list dd a',
    case: 'wcag-2.5.8-inline-text',
    reason: 'FAQ links are embedded in answer sentences.',
  },
]);
const REQUIRED_TARGET_SELECTORS = Object.freeze([
  '.skip-link',
  '.wordmark',
  '.founder__more a',
  '.traction__fallback a',
]);

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

async function fontSizes(page) {
  return page.evaluate(() => Object.fromEntries([
    ['body', '.hero__support'],
    ['label', '.eyebrow'],
    ['heading', '#outcome-preview-title'],
  ].map(([name, selector]) => [
    name,
    Number.parseFloat(getComputedStyle(document.querySelector(selector)).fontSize),
  ])));
}

async function visibleFocusOrder(page) {
  return page.evaluate((selector) => {
    const controls = [...new Set(document.querySelectorAll(selector))]
      .filter((element) => {
        const style = getComputedStyle(element);
        return element.tabIndex >= 0
          && style.display !== 'none'
          && style.visibility !== 'hidden'
          && element.getClientRects().length > 0;
      });
    controls.forEach((element, index) => {
      element.dataset.auditFocusId = `focus-${index}`;
    });
    document.body.setAttribute('tabindex', '-1');
    document.body.focus({ preventScroll: true });
    document.body.removeAttribute('tabindex');
    window.scrollTo(0, 0);
    return controls.map((element) => element.dataset.auditFocusId);
  }, TARGET_SELECTOR);
}

async function assertFullTabJourney(page, expectedOrder) {
  const visited = [];
  for (const expectedId of expectedOrder) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const element = document.activeElement;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        id: element.dataset.auditFocusId,
        outlineWidth: Number.parseFloat(style.outlineWidth),
        outlineStyle: style.outlineStyle,
        outlineColor: style.outlineColor,
        rect: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left },
        viewport: { width: innerWidth, height: innerHeight },
      };
    });
    expect(focus.id).toBe(expectedId);
    expect(focus.outlineWidth).toBeGreaterThanOrEqual(2);
    expect(focus.outlineStyle).not.toBe('none');
    expect(focus.outlineColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(focus.rect.top).toBeGreaterThanOrEqual(-1);
    expect(focus.rect.left).toBeGreaterThanOrEqual(-1);
    expect(focus.rect.bottom).toBeLessThanOrEqual(focus.viewport.height + 1);
    expect(focus.rect.right).toBeLessThanOrEqual(focus.viewport.width + 1);
    visited.push(focus.id);
  }
  expect(visited).toEqual(expectedOrder);
  expect(new Set(visited).size).toBe(expectedOrder.length);
  await page.keyboard.press('Tab');
  if (await page.evaluate(() => document.activeElement === document.body)) {
    await page.keyboard.press('Tab');
  }
  expect(await page.evaluate(() => document.activeElement.dataset.auditFocusId)).toBe(expectedOrder[0]);
}

async function assertKeyboardActivation(page, expectedOrder, { beforeControl } = {}) {
  for (const id of expectedOrder) {
    const control = page.locator(`[data-audit-focus-id="${id}"]`);
    if (beforeControl) await beforeControl(control);
    const descriptor = await control.evaluate((element) => ({
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute('type') || '',
      selectedIndex: element instanceof HTMLSelectElement ? element.selectedIndex : null,
    }));
    await control.focus();
    if (['a', 'button', 'summary'].includes(descriptor.tag)) {
      await control.evaluate((element, activationId) => {
        window.__auditActivation = null;
        element.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          window.__auditActivation = activationId;
        }, { capture: true, once: true });
      }, id);
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => window.__auditActivation)).toBe(id);
    } else if (descriptor.type === 'checkbox') {
      const before = await control.isChecked();
      await page.keyboard.press('Space');
      expect(await control.isChecked()).toBe(!before);
      await control.setChecked(before);
    } else if (descriptor.tag === 'select') {
      await page.keyboard.press('ArrowDown');
      expect(await control.evaluate((element) => element.selectedIndex)).not.toBe(descriptor.selectedIndex);
      await control.evaluate((element, index) => { element.selectedIndex = index; }, descriptor.selectedIndex);
    } else if (['input', 'textarea'].includes(descriptor.tag)) {
      await page.keyboard.type('x');
      expect(await control.inputValue()).toBe('x');
      await control.fill('');
    }
  }
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
      await page.setViewportSize({ width: 320, height: entry.viewport.height });
      const runtime = await prepareDeterministicPage(page);
      const states = [];
      for (const width of [320, 600, 840, 1240]) {
        await page.setViewportSize({ width, height: entry.viewport.height });
        if (width !== 320) {
          await page.locator('details.mobile-nav').evaluate((details) => details.removeAttribute('open'));
        }
        states.push({ name: `${width}-closed`, width });
        if (width === 320) {
          await page.locator('.mobile-nav__toggle').click();
          states.push({ name: '320-open', width });
        }
      }
      const violations = [];
      for (const state of states) {
        await page.setViewportSize({ width: state.width, height: entry.viewport.height });
        await page.locator('details.mobile-nav').evaluate((details, open) => {
          details.toggleAttribute('open', open);
        }, state.name.endsWith('-open'));
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        violations.push(...results.violations.map((violation) => ({
          ...violation,
          state: state.name,
        })));
      }
      const counts = violationCounts(violations);
      try {
        expect(violations.map(({ id, impact, nodes, state }) => ({
          id,
          impact,
          state,
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
      expect(runtime.fontState.required).toEqual([
        { family: 'Pretendard', weight: 400, loaded: true },
        { family: 'Pretendard', weight: 500, loaded: true },
        { family: 'Pretendard', weight: 600, loaded: true },
        { family: 'Pretendard', weight: 700, loaded: true },
        { family: 'D2Coding', weight: 400, loaded: true },
      ]);
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
      const before = await fontSizes(page);
      await page.addStyleTag({ content: TEXT_RESIZE_200_CSS });
      const after = await fontSizes(page);
      expect(after).toEqual({
        body: before.body * 2,
        label: before.label * 2,
        heading: before.heading * 2,
      });
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
      const expectedOrder = await visibleFocusOrder(page);
      expect(expectedOrder.length).toBeGreaterThan(20);
      await assertFullTabJourney(page, expectedOrder);

      const skip = page.locator('.skip-link');
      await skip.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/#main$/);
      await page.evaluate(() => history.replaceState(null, '', `${location.pathname}${location.search}`));

      await assertKeyboardActivation(page, expectedOrder);
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

  for (const entry of catalog.cases.filter(({ id }) => id.startsWith('home-targets-44-'))) {
    test(entry.id, async ({ page }, testInfo) => {
      await runEvidenceCase({ testInfo, catalogCase: entry }, async () => {
        await page.setViewportSize(entry.viewport);
        await prepareDeterministicPage(page, {
          statsFixture: { ok: true, signups: 0, diagnoses_completed: 0, satisfaction: null },
        });
        if (entry.viewport.width < 840) await page.locator('.mobile-nav__toggle').click();
        const audit = await page.evaluate(({ selector, exceptionRules, requiredSelectors }) => {
          const elements = [...new Set(document.querySelectorAll(selector))]
            .filter((element) => {
              const style = getComputedStyle(element);
              return style.display !== 'none'
                && style.visibility !== 'hidden'
                && element.getClientRects().length > 0;
            });
          const undersized = [];
          const exceptions = [];
          const invalidExceptions = [];
          for (const [index, element] of elements.entries()) {
            element.dataset.auditTargetId = `target-${index}`;
            const rule = exceptionRules.find(({ selector: candidate }) => element.matches(candidate));
            if (rule) {
              const inline = getComputedStyle(element).display === 'inline';
              const embeddedInProse = element.parentElement
                && element.parentElement.textContent.trim() !== element.textContent.trim();
              exceptions.push({ selector: rule.selector, case: rule.case, reason: rule.reason });
              if (!inline || !embeddedInProse) {
                invalidExceptions.push({ selector: rule.selector, inline, embeddedInProse });
              }
              continue;
            }
            element.focus({ preventScroll: true });
            const hitTarget = element.matches('input[type="checkbox"]')
              ? element.closest('label') || element
              : element;
            const box = hitTarget.getBoundingClientRect();
            if (box.width < 44 || box.height < 44) {
              undersized.push({
                id: element.dataset.auditTargetId,
                tag: element.tagName.toLowerCase(),
                class_name: [...element.classList].sort().join('.'),
                width: Math.round(box.width),
                height: Math.round(box.height),
              });
            }
          }
          return {
            enumerated: elements.length,
            requiredTargets: Object.fromEntries(requiredSelectors.map((requiredSelector) => [
              requiredSelector,
              elements.filter((element) => element.matches(requiredSelector)).length,
            ])),
            undersized,
            exceptions,
            invalidExceptions,
          };
        }, {
          selector: TARGET_SELECTOR,
          exceptionRules: INLINE_TARGET_EXCEPTIONS,
          requiredSelectors: REQUIRED_TARGET_SELECTORS,
        });
        expect(audit.enumerated).toBeGreaterThan(25);
        expect(audit.requiredTargets).toEqual(Object.fromEntries(
          REQUIRED_TARGET_SELECTORS.map((selector) => [selector, 1]),
        ));
        expect(audit.invalidExceptions).toEqual([]);
        expect(new Set(audit.exceptions.map((exception) => exception.selector))).toEqual(
          new Set(INLINE_TARGET_EXCEPTIONS.map((exception) => exception.selector)),
        );
        expect(audit.exceptions.every((exception) => exception.case && exception.reason)).toBe(true);
        expect(audit.undersized).toEqual([]);
        return { checkCount: entry.checks.length, violationCounts: violationCounts() };
      });
    });
  }

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

  test('home-mobile-menu-keyboard', async ({ page }, testInfo) => {
    const entry = catalogCase('home-mobile-menu-keyboard');
    await runEvidenceCase({ testInfo, catalogCase: entry }, async () => {
      await page.setViewportSize(entry.viewport);
      await prepareDeterministicPage(page);
      const details = page.locator('details.mobile-nav');
      const toggle = page.locator('.mobile-nav__toggle');
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(details).toHaveJSProperty('open', true);

      const expectedOrder = await visibleFocusOrder(page);
      const menuFocusIds = await page.locator('.mobile-nav__toggle, .mobile-nav__panel a')
        .evaluateAll((elements) => elements.map((element) => element.dataset.auditFocusId));
      expect(menuFocusIds.length).toBeGreaterThan(5);
      expect(menuFocusIds.every((id) => expectedOrder.includes(id))).toBe(true);
      expect(expectedOrder.length).toBeGreaterThan(25);
      await assertFullTabJourney(page, expectedOrder);
      await expect(details).toHaveJSProperty('open', true);
      await assertKeyboardActivation(page, expectedOrder, {
        beforeControl: async (control) => {
          const isMenuControl = await control.evaluate((element) => (
            element.matches('.mobile-nav__toggle, .mobile-nav__panel a')
          ));
          if (isMenuControl && !(await details.evaluate((element) => element.open))) {
            await toggle.focus();
            await page.keyboard.press('Enter');
            await expect(details).toHaveJSProperty('open', true);
          }
        },
      });
      if (!(await details.evaluate((element) => element.open))) {
        await toggle.focus();
        await page.keyboard.press('Enter');
      }
      await expect(details).toHaveJSProperty('open', true);

      await page.locator('.mobile-nav__panel a').first().focus();
      await page.keyboard.press('Escape');
      await expect(details).toHaveJSProperty('open', false);
      await expect(toggle).toBeFocused();
      return { checkCount: entry.checks.length, violationCounts: violationCounts() };
    });
  });
});
