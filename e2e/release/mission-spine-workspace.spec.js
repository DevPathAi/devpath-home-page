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

const JOURNEY = 'mission-spine-workspace';
const WORKSPACE_EVENTS = Object.freeze([
  'first_mission_started',
  'first_practice_succeeded',
  'contextual_review_viewed',
]);

async function refreshFlutter(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await activateFlutterSemantics(page);
}

async function reachAuthenticatedToday(page, appOrigin) {
  await assertProductionTlsNavigation(
    page,
    `${appOrigin}/dashboard`,
    new URL(appOrigin).hostname,
  );
  await activateFlutterSemantics(page);
  if (new URL(page.url()).pathname === '/login') {
    await page.getByRole('button', { name: 'GitHub로 계속하기', exact: true }).click();
  }
  await page.waitForURL((url) => (
    url.pathname === '/dashboard' || /^\/path\/\d+\/today$/.test(url.pathname)
  ));
  await activateFlutterSemantics(page);
}

async function explicitlySelectCurrentContent(page) {
  await page.getByRole('button', { name: '전송 전에 수정', exact: true }).click();
  const currentContent = page.getByRole('checkbox', { name: /현재 콘텐츠/ });
  if (await currentContent.isChecked()) {
    await currentContent.click();
  }
  await currentContent.click();
  await expect(currentContent).toBeChecked();
  await page.getByRole('button', { name: '완료', exact: true }).click();
}

test.beforeAll(() => {
  assertLiveReleaseContext(releaseContext);
});

test('Today workspace recovers durable runtime evidence and sends only approved Mentor context', async ({
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
      oauthOrigin: context.oauthOrigin,
      analyticsSpyOrigin: context.analyticsSpyOrigin,
    });
    await control.command(JOURNEY, prepared.runKey, 'grant-analytics-permission');

    await evidence.step({ page, step: 'authenticated-authoritative-today' }, async () => {
      await reachAuthenticatedToday(page, context.appOrigin);
      await expect(page.getByRole('button', { name: '미션 열기', exact: true })).toBeVisible();
      await control.checkpoint(JOURNEY, prepared.runKey, 'authoritative-workspace-task');
      await control.checkpoint(JOURNEY, prepared.runKey, 'web-production-artifact');
    });

    await evidence.step({ page, step: 'canonical-content-to-sandbox' }, async () => {
      await page.getByRole('button', { name: '미션 열기', exact: true }).click();
      await page.waitForURL((url) => /^\/mission\/\d+\/content\/\d+$/.test(url.pathname));
      await activateFlutterSemantics(page);
      await page.getByRole('button', { name: '실습 시작', exact: true }).click();
      await page.waitForURL((url) => /^\/mission\/\d+\/sandbox$/.test(url.pathname));
      await activateFlutterSemantics(page);
      await expect(page.getByText('이번 실습 맥락', { exact: true })).toBeVisible();
      await expect(page.getByText('현재 과제', { exact: true })).toBeVisible();
      await expect(page.getByText('현재 단원', { exact: true })).toBeVisible();
      await expect(page.getByText('실행 환경', { exact: true })).toBeVisible();
      await expect(page.getByText('starter 출처', { exact: true })).toBeVisible();
      await control.checkpoint(JOURNEY, prepared.runKey, 'workspace-context-parity');
    });

    await evidence.step({ page, step: 'immediate-disconnect-timeout-recovery' }, async () => {
      await control.command(JOURNEY, prepared.runKey, 'next-run-immediate-disconnect');
      await control.command(JOURNEY, prepared.runKey, 'next-run-timeout');
      await page.getByRole('button', { name: '코드 실행', exact: true }).click();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await activateFlutterSemantics(page);
      await expect(page.getByText(/시간 초과/)).toBeVisible({ timeout: 45_000 });
      await control.checkpoint(JOURNEY, prepared.runKey, 'session-id-within-one-second');
      await control.checkpoint(JOURNEY, prepared.runKey, 'immediate-disconnect-timed-out');
      await control.checkpoint(JOURNEY, prepared.runKey, 'owner-recovery-timed-out');
    });

    await evidence.step({ page, step: 'midstream-disconnect-truncated-recovery' }, async () => {
      await control.command(JOURNEY, prepared.runKey, 'next-run-midstream-disconnect');
      await control.command(JOURNEY, prepared.runKey, 'next-run-truncated');
      await page.getByRole('button', { name: '다시 실행', exact: true }).click();
      await expect(page.getByText(/실행 중입니다/)).toBeVisible();
      await refreshFlutter(page);
      await expect(page.getByText(/실행 완료.*출력 일부만 표시/)).toBeVisible({
        timeout: 45_000,
      });
      await refreshFlutter(page);
      await expect(page.getByText(/실행 완료.*출력 일부만 표시/)).toBeVisible();
      await control.checkpoint(JOURNEY, prepared.runKey, 'midstream-disconnect-completed');
      await control.checkpoint(JOURNEY, prepared.runKey, 'owner-recovery-truncated');
    });

    await evidence.step({ page, step: 'stale-session-reconciliation' }, async () => {
      await control.command(JOURNEY, prepared.runKey, 'seed-stale-allocating');
      await control.command(JOURNEY, prepared.runKey, 'seed-stale-running');
      await control.checkpoint(JOURNEY, prepared.runKey, 'stale-allocating-reconciled');
      await control.checkpoint(JOURNEY, prepared.runKey, 'stale-running-reconciled');
    });

    await evidence.step({ page, step: 'outbox-review-durable' }, async () => {
      await page.getByRole('button', { name: '리뷰 확인', exact: true }).click();
      await expect(page.getByText('잘한 점', { exact: true })).toBeVisible({
        timeout: 45_000,
      });
      await control.checkpoint(JOURNEY, prepared.runKey, 'kafka-outbox-review-correlated');
      await control.command(JOURNEY, prepared.runKey, 'fail-next-review');
      await control.checkpoint(JOURNEY, prepared.runKey, 'partial-review-retains-run-and-review');
      await expect(page.getByText('잘한 점', { exact: true })).toBeVisible();
      await control.command(JOURNEY, prepared.runKey, 'clear-faults');
    });

    await evidence.step({ page, step: 'private-context-preview-commit' }, async () => {
      await page.getByRole('button', { name: 'AI 멘토에게 질문', exact: true }).click();
      await page.waitForURL((url) => /^\/mission\/\d+\/mentor$/.test(url.pathname));
      await activateFlutterSemantics(page);
      await page.getByPlaceholder('현재 미션에서 막힌 점을 질문하세요').fill(
        '다음 디버깅 단계를 알려주세요.',
      );
      await explicitlySelectCurrentContent(page);
      await page.getByRole('button', { name: '맥락 미리보기', exact: true }).click();
      await expect(page.getByRole('button', {
        name: '비공개로 질문 보내기',
        exact: true,
      })).toBeVisible();
      await control.checkpoint(JOURNEY, prepared.runKey, 'private-mentor-prompt-preview');
    });

    await evidence.step({ page, step: 'mentor-partial-retry-payload-parity' }, async () => {
      await control.command(JOURNEY, prepared.runKey, 'fail-next-mentor');
      await page.getByRole('button', {
        name: '비공개로 질문 보내기',
        exact: true,
      }).click();
      await expect(page.getByText(/부분답변|받은 답변은 그대로|다시 시도/)).toBeVisible({
        timeout: 45_000,
      });
      await control.checkpoint(JOURNEY, prepared.runKey, 'private-mentor-prompt-committed');
      await control.checkpoint(JOURNEY, prepared.runKey, 'mentor-partial-retained');
      await control.command(JOURNEY, prepared.runKey, 'clear-faults');
      await page.getByRole('button', { name: '같은 질문 다시 보내기', exact: true }).click();
      await control.checkpoint(JOURNEY, prepared.runKey, 'mentor-provider-payload-exact');
      await control.checkpoint(JOURNEY, prepared.runKey, 'mentor-terminal-complete');
    });

    await evidence.step({ page, step: 'workspace-analytics-and-boundaries' }, async () => {
      const events = await control.analyticsEvents(JOURNEY, prepared.runKey);
      assertAnalyticsSequence(events, WORKSPACE_EVENTS);
      await control.checkpoint(JOURNEY, prepared.runKey, 'urls-logs-artifacts-clean');
      await control.checkpoint(JOURNEY, prepared.runKey, 'sensitive-boundaries-clean');
    });
  } finally {
    evidence.close();
  }
});
