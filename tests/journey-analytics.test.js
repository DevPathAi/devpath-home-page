import { describe, expect, it, vi } from 'vitest';

import {
  AnalyticsCaptureStatus,
  JourneyAnalyticsAdapter,
  shouldExcludeAnalyticsTraffic,
} from '../src/analytics/journey-analytics.js';

const context = {
  environment: 'production',
  appVersion: 'abc123',
  sessionId: 'AQIDBAUGBwgJCgsMDQ4PEA',
  journeyId: 'EREREREREREREREREREREQ',
  now: () => new Date('2026-08-15T10:00:00.000Z'),
};

describe('JourneyAnalyticsAdapter', () => {
  it('starts opted out and makes no SDK calls', () => {
    const sdk = { capture: vi.fn(), identify: vi.fn(), reset: vi.fn() };
    const analytics = new JourneyAnalyticsAdapter({ sdk, context });

    expect(analytics.capture('landing_viewed', {
      page_view_id: 'ISEhISEhISEhISEhISEhIQ',
    })).toBe(AnalyticsCaptureStatus.optedOut);
    expect(analytics.identify('101')).toBe(false);
    analytics.reset();

    expect(sdk.capture).not.toHaveBeenCalled();
    expect(sdk.identify).not.toHaveBeenCalled();
    expect(sdk.reset).not.toHaveBeenCalled();
  });

  it('rejects unknown, PII, and nested properties before scheduling the SDK', () => {
    const scheduled = [];
    const sdk = { capture: vi.fn() };
    const analytics = new JourneyAnalyticsAdapter({
      sdk,
      context,
      optedOut: false,
      schedule: (work) => scheduled.push(work),
    });

    for (const properties of [
      { page_view_id: 'ISEhISEhISEhISEhISEhIQ', unknown: true },
      { page_view_id: 'ISEhISEhISEhISEhISEhIQ', email: 'person@example.com' },
      { page_view_id: { nested: true } },
    ]) {
      expect(analytics.capture('landing_viewed', properties)).toBe(
        AnalyticsCaptureStatus.rejected,
      );
    }
    expect(scheduled).toHaveLength(0);
    expect(sdk.capture).not.toHaveBeenCalled();
  });

  it('rejects null or non-object properties without throwing', () => {
    const sdk = { capture: vi.fn() };
    const analytics = new JourneyAnalyticsAdapter({
      sdk,
      context,
      optedOut: false,
      schedule: (work) => work(),
    });

    for (const properties of [null, 'invalid', ['invalid']]) {
      expect(() => analytics.capture('landing_viewed', properties))
        .not.toThrow();
      expect(analytics.capture('landing_viewed', properties)).toBe(
        AnalyticsCaptureStatus.rejected,
      );
    }
    expect(sdk.capture).not.toHaveBeenCalled();
  });

  it.each([
    'contract_version',
    'occurred_at',
    'environment',
    'app_version',
    'session_id',
    'journey_id',
  ])('rejects caller override of adapter-owned %s', (property) => {
    const scheduled = [];
    const sdk = { capture: vi.fn() };
    const analytics = new JourneyAnalyticsAdapter({
      sdk,
      context,
      optedOut: false,
      schedule: (work) => scheduled.push(work),
    });

    expect(analytics.capture('landing_viewed', {
      page_view_id: 'ISEhISEhISEhISEhISEhIQ',
      [property]: property === 'occurred_at'
        ? '2026-08-15T11:00:00.000Z'
        : 'attacker-controlled',
    })).toBe(AnalyticsCaptureStatus.rejected);
    expect(scheduled).toHaveLength(0);
    expect(sdk.capture).not.toHaveBeenCalled();
  });

  it('does not emit contextual review without an approved context field', () => {
    const scheduled = [];
    const sdk = { capture: vi.fn() };
    const analytics = new JourneyAnalyticsAdapter({
      sdk,
      context,
      optedOut: false,
      schedule: (work) => scheduled.push(work),
    });

    expect(analytics.capture('contextual_review_viewed', {
      user_id: '101',
      task_id: 31,
      review_id: 61,
      approved_context_field_count: 0,
      next_action_outcome: 'next_mission',
      first_view: true,
    })).toBe(AnalyticsCaptureStatus.rejected);
    expect(scheduled).toHaveLength(0);
    expect(sdk.capture).not.toHaveBeenCalled();
  });

  it('deduplicates by the event contract before SDK delivery', () => {
    const sdk = { capture: vi.fn() };
    const analytics = new JourneyAnalyticsAdapter({
      sdk,
      context,
      optedOut: false,
      schedule: (work) => work(),
    });
    const properties = { page_view_id: 'ISEhISEhISEhISEhISEhIQ' };

    expect(analytics.capture('landing_viewed', properties)).toBe(
      AnalyticsCaptureStatus.accepted,
    );
    expect(analytics.capture('landing_viewed', properties)).toBe(
      AnalyticsCaptureStatus.duplicate,
    );
    expect(sdk.capture).toHaveBeenCalledTimes(1);
  });

  it('swallows synchronous and async SDK failure', async () => {
    const sdk = {
      capture: vi
        .fn()
        .mockImplementationOnce(() => { throw new Error('blocked'); })
        .mockRejectedValueOnce(new Error('network denied')),
    };
    const analytics = new JourneyAnalyticsAdapter({
      sdk,
      context,
      optedOut: false,
      schedule: (work) => work(),
    });

    expect(() => analytics.capture('landing_viewed', {
      page_view_id: 'AQIDBAUGBwgJCgsMDQ4PEA',
    })).not.toThrow();
    expect(() => analytics.capture('landing_viewed', {
      page_view_id: 'EREREREREREREREREREREQ',
    })).not.toThrow();
    await Promise.resolve();
  });

  it('supports explicit opt-in, opaque identify, logout reset, and test exclusion', () => {
    const sdk = { capture: vi.fn(), identify: vi.fn(), reset: vi.fn() };
    const analytics = new JourneyAnalyticsAdapter({
      sdk,
      context,
      schedule: (work) => work(),
    });

    analytics.setOptedOut(false);
    expect(analytics.identify('101')).toBe(true);
    expect(analytics.identify('person@example.com')).toBe(false);
    expect(analytics.identify('octocat')).toBe(false);
    expect(analytics.identify('홍길동')).toBe(false);
    analytics.reset();
    expect(sdk.identify).toHaveBeenCalledWith('101');
    expect(sdk.reset).toHaveBeenCalledTimes(1);

    const testAnalytics = new JourneyAnalyticsAdapter({
      sdk,
      context: { ...context, environment: 'test' },
      optedOut: false,
      schedule: (work) => work(),
    });
    expect(testAnalytics.capture('landing_viewed', {
      page_view_id: 'ISEhISEhISEhISEhISEhIQ',
    })).toBe(AnalyticsCaptureStatus.excluded);
  });

  it('retains auth identity in memory and identifies only after permission', () => {
    const sdk = { capture: vi.fn(), identify: vi.fn(), reset: vi.fn() };
    const analytics = new JourneyAnalyticsAdapter({
      sdk,
      context,
      schedule: (work) => work(),
    });

    expect(analytics.identify('101')).toBe(false);
    expect(sdk.identify).not.toHaveBeenCalled();
    analytics.setOptedOut(false);
    expect(sdk.identify).toHaveBeenCalledTimes(1);
    expect(sdk.identify).toHaveBeenLastCalledWith('101');

    analytics.setOptedOut(true);
    expect(sdk.reset).toHaveBeenCalledTimes(1);
    analytics.setOptedOut(false);
    expect(sdk.identify).toHaveBeenCalledTimes(2);
    expect(sdk.identify).toHaveBeenLastCalledWith('101');
  });

  it('retains internal exclusion across the pre-permission transition', () => {
    const sdk = { capture: vi.fn(), identify: vi.fn(), reset: vi.fn() };
    const analytics = new JourneyAnalyticsAdapter({
      sdk,
      context,
      isInternalUser: (userId) => userId === '999',
      schedule: (work) => work(),
    });

    expect(analytics.identify('999')).toBe(false);
    analytics.setOptedOut(false);
    expect(analytics.capture('landing_viewed', {
      page_view_id: 'ISEhISEhISEhISEhISEhIQ',
    })).toBe(AnalyticsCaptureStatus.excluded);
    expect(sdk.identify).not.toHaveBeenCalled();
    expect(sdk.capture).not.toHaveBeenCalled();
  });

  it('exposes automated-UA, dev-build and internal-account exclusion seams', () => {
    expect(shouldExcludeAnalyticsTraffic({
      environment: 'production', appVersion: 'abc123', userAgent: 'Playwright',
    })).toBe(true);
    expect(shouldExcludeAnalyticsTraffic({
      environment: 'development', appVersion: 'abc123',
    })).toBe(true);
    expect(shouldExcludeAnalyticsTraffic({
      environment: 'production', appVersion: 'dev',
    })).toBe(true);

    const sdk = { capture: vi.fn(), identify: vi.fn(), reset: vi.fn() };
    const analytics = new JourneyAnalyticsAdapter({
      sdk,
      context,
      optedOut: false,
      isInternalUser: (userId) => userId === '999',
      schedule: (work) => work(),
    });
    expect(analytics.identify('999')).toBe(false);
    expect(analytics.capture('landing_viewed', {
      page_view_id: 'ISEhISEhISEhISEhISEhIQ',
    })).toBe(AnalyticsCaptureStatus.excluded);
    expect(sdk.capture).not.toHaveBeenCalled();
  });
});
