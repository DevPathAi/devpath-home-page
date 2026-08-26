import { expect, test } from '@playwright/test';

import { releaseContext } from '../../playwright.release.config.js';
import { assertLiveReleaseContext } from './support/release-context.js';
import { SanitizedEvidence } from './support/sanitized-evidence.js';
import {
  StagingControl,
  activateFlutterSemantics,
  assertAnalyticsSequence,
  assertProductionTlsNavigation,
} from './support/staging-control.js';

const JOURNEY = 'mission-spine-onboarding';
const ONBOARDING_EVENTS = Object.freeze([
  'landing_viewed',
  'landing_diagnostic_cta_clicked',
  'diagnostic_started',
  'diagnostic_completed',
  'result_claimed',
  'path_generated',
  'path_first_viewed',
  'first_mission_started',
]);

async function refreshFlutter(page, pathname) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await activateFlutterSemantics(page);
  await expect.poll(() => new URL(page.url()).pathname).toBe(pathname);
}

async function chooseBackendTrack(page) {
  await page.getByRole('button', { name: /진단할 트랙/ }).click();
  await page.getByRole('menuitem', { name: /백엔드.*Spring/i }).click();
}

async function completeFifteenQuestions(page) {
  for (let index = 1; index <= 15; index += 1) {
    await expect(page.getByText(new RegExp(`${index} \\/ 15`))).toBeVisible();
    await page.getByRole('button', { name: '잘 모르겠어요', exact: true }).click();
  }
  await expect(page.getByText('진단 결과', { exact: true })).toBeVisible();
}

async function previewProjection(page) {
  return {
    level: await page.getByText(/^현재 레벨 /).textContent(),
    confidence: await page.getByText(/^진단 신뢰도 /).textContent(),
  };
}

async function openToday(page) {
  await page.getByText('오늘', { exact: true }).first().click();
  await expect.poll(() => new URL(page.url()).pathname).toMatch(
    /^\/(?:dashboard|path\/\d+\/today)$/,
  );
}

test.beforeAll(() => {
  assertLiveReleaseContext(releaseContext);
});

test('Landing guest diagnosis is claimed once and advances authoritative Today', async ({
  page,
  request,
}) => {
  const context = assertLiveReleaseContext(releaseContext);
  const control = new StagingControl({
    request,
    origin: context.controlOrigin,
    credential: context.controlCredential,
    candidateSpecSha256: context.candidateSpecSha256,
  });
  const evidence = new SanitizedEvidence({
    directory: context.evidenceDirectory,
    journey: JOURNEY,
    candidateSpecSha256: context.candidateSpecSha256,
  });

  try {
    await control.assertPrerequisites(JOURNEY);
    const prepared = await control.prepareJourney(JOURNEY);
    await control.bindBrowserRun(page, prepared.runKey, {
      landingOrigin: context.landingOrigin,
      appOrigin: context.appOrigin,
      apiOrigin: context.apiOrigin,
      oauthOrigin: context.oauthOrigin,
      analyticsSpyOrigin: context.analyticsSpyOrigin,
    });

    let prePermissionAnalyticsRequests = 0;
    const spyHostname = new URL(context.analyticsSpyOrigin).hostname;
    page.on('request', (browserRequest) => {
      if (new URL(browserRequest.url()).hostname === spyHostname) {
        prePermissionAnalyticsRequests += 1;
      }
    });

    await evidence.step({ page, step: 'landing-prepermission-zero' }, async () => {
      await assertProductionTlsNavigation(
        page,
        context.landingOrigin,
        new URL(context.landingOrigin).hostname,
      );
      await expect(page.locator('[data-diagnostic-cta="primary"]')).toHaveCount(4);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('다음 미션');
      expect(prePermissionAnalyticsRequests).toBe(0);
      await control.checkpoint(JOURNEY, prepared.runKey, 'analytics-prepermission-zero');
      await control.checkpoint(JOURNEY, prepared.runKey, 'landing-production-artifact');
    });

    await control.command(JOURNEY, prepared.runKey, 'grant-analytics-permission');
    await page.reload({ waitUntil: 'domcontentloaded' });

    await evidence.step({ page, step: 'opaque-journey-handoff' }, async () => {
      await page.locator('.hero [data-diagnostic-cta="primary"]').click();
      const appHostname = new URL(context.appOrigin).hostname;
      await page.waitForURL((url) => (
        url.hostname === appHostname
        && url.pathname === '/diagnostic'
        && !url.searchParams.has('journeyId')
      ));
      await activateFlutterSemantics(page);
      await control.checkpoint(JOURNEY, prepared.runKey, 'journey-handoff-consumed');
    });

    await evidence.step({ page, step: 'guest-diagnostic-fifteen' }, async () => {
      await expect(page.getByText('실력 진단 15문항', { exact: true })).toBeVisible();
      await refreshFlutter(page, '/diagnostic');
      await chooseBackendTrack(page);
      await page.getByRole('button', { name: '진단 시작하기', exact: true }).click();
      await expect(page.getByText(/1 \/ 15/)).toBeVisible();
      await refreshFlutter(page, '/diagnostic');
      await completeFifteenQuestions(page);
      await control.checkpoint(JOURNEY, prepared.runKey, 'guest-preview-owned-by-guest');
    });

    let guestPreview;
    await evidence.step({ page, step: 'guest-preview-refresh' }, async () => {
      guestPreview = await previewProjection(page);
      await refreshFlutter(page, '/diagnostic');
      expect(await previewProjection(page)).toEqual(guestPreview);
    });

    await evidence.step({ page, step: 'oauth-callback-replay' }, async () => {
      await page.getByRole('button', { name: '저장하고 계속', exact: true }).click();
      await page.waitForURL((url) => (
        url.hostname === 'app.leva.ai.kr' && url.pathname === '/consent'
      ));
      await control.checkpoint(JOURNEY, prepared.runKey, 'deterministic-oauth-complete');
      await control.command(JOURNEY, prepared.runKey, 'replay-oauth-callback');
      await page.goto(`${context.appOrigin}/auth/callback`, { waitUntil: 'domcontentloaded' });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForURL((url) => url.pathname === '/consent');
      await activateFlutterSemantics(page);
    });

    await evidence.step({ page, step: 'required-consent-claim-replay' }, async () => {
      await refreshFlutter(page, '/consent');
      await page.getByRole('checkbox', { name: /서비스 이용약관 동의/ }).click();
      await page.getByRole('checkbox', { name: /개인정보 수집·이용 동의/ }).click();
      await page.getByLabel('출생 연도 (필수)').fill('1995');
      await control.command(JOURNEY, prepared.runKey, 'replay-claim');
      await page.getByRole('button', { name: '동의하고 계속하기', exact: true }).click();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForURL((url) => url.pathname === '/diagnostic');
      await activateFlutterSemantics(page);
      await expect(page.getByText('계정에 안전하게 저장됐어요.', { exact: true })).toBeVisible();
      expect(await previewProjection(page)).toEqual(guestPreview);
      await control.checkpoint(JOURNEY, prepared.runKey, 'claim-replay-one-owned-result');
      await control.checkpoint(JOURNEY, prepared.runKey, 'saved-preview-deep-equal');
    });

    await evidence.step({ page, step: 'explicit-path-to-today' }, async () => {
      await refreshFlutter(page, '/diagnostic');
      await page.getByRole('button', { name: '학습 경로로 계속', exact: true }).click();
      await page.waitForURL((url) => url.pathname === '/path');
      await activateFlutterSemantics(page);
      await openToday(page);
      await expect(page.getByRole('button', { name: /^미션 열기/ })).toBeVisible();
      await control.checkpoint(JOURNEY, prepared.runKey, 'authoritative-first-task');
    });

    await evidence.step({ page, step: 'content-linked-completion-replay' }, async () => {
      await page.getByRole('button', { name: /^미션 열기/ }).click();
      await page.waitForURL((url) => /^\/mission\/\d+\/content\/\d+$/.test(url.pathname));
      await activateFlutterSemantics(page);
      await control.checkpoint(JOURNEY, prepared.runKey, 'content-linked-below-threshold');
      await page.keyboard.press('End');
      await page.waitForTimeout(1_500);
      await openToday(page);
      await control.command(JOURNEY, prepared.runKey, 'replay-content-linked-completion');
      await control.checkpoint(JOURNEY, prepared.runKey, 'content-linked-advanced-once');
      await expect(page.getByRole('button', { name: '미션 완료', exact: true })).toBeVisible();
    });

    await evidence.step({ page, step: 'contentless-completion-replay' }, async () => {
      await page.getByRole('button', { name: '미션 완료', exact: true }).click();
      await control.command(JOURNEY, prepared.runKey, 'replay-contentless-completion');
      await control.checkpoint(JOURNEY, prepared.runKey, 'contentless-advanced-once');
      await control.checkpoint(JOURNEY, prepared.runKey, 'completion-replays-noop');
    });

    await evidence.step({ page, step: 'onboarding-analytics-ordered' }, async () => {
      const events = await control.analyticsEvents(JOURNEY, prepared.runKey);
      assertAnalyticsSequence(events, ONBOARDING_EVENTS);
      await control.checkpoint(JOURNEY, prepared.runKey, 'sensitive-boundaries-clean');
    });
  } finally {
    evidence.close();
  }
});
