import { describe, expect, it, vi } from 'vitest';

import {
  RELEASE_ANALYTICS_STORAGE_KEY,
  ReleaseAnalyticsSpySdk,
  resolveReleaseAnalytics,
} from '../src/analytics/release-spy.js';

const marker = JSON.stringify({
  schema_version: 'mission-spine.release-analytics.v1',
  permission_url: 'https://api.leva.ai.kr/v1/release/browser/analytics-permission',
  capture_url: 'https://analytics-spy.staging.leva.ai.kr/v1/release/browser/analytics-events',
});

function storage(value = marker) {
  return { getItem: vi.fn(() => value) };
}

describe('release analytics spy transport', () => {
  it('stays inert when the browser-bound marker is absent or malformed', async () => {
    const fetch = vi.fn();
    await expect(resolveReleaseAnalytics({ storage: storage(null), fetch }))
      .resolves.toBeNull();
    await expect(resolveReleaseAnalytics({ storage: storage('{broken'), fetch }))
      .resolves.toBeNull();
    await expect(resolveReleaseAnalytics({
      storage: storage(JSON.stringify({
        schema_version: 'mission-spine.release-analytics.v1',
        permission_url: 'https://attacker.example/permission',
        capture_url: 'https://analytics-spy.staging.leva.ai.kr/v1/release/browser/analytics-events',
      })),
      fetch,
    })).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not initialize capture before server-side permission', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        schema_version: 'mission-spine.staging-control.v1',
        candidate_spec_sha256: 'a'.repeat(64),
        granted: false,
        analytics_origin: 'https://analytics-spy.staging.leva.ai.kr',
      }),
    }));

    await expect(resolveReleaseAnalytics({ storage: storage(), fetch }))
      .resolves.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.leva.ai.kr/v1/release/browser/analytics-permission',
      expect.objectContaining({ credentials: 'omit', cache: 'no-store' }),
    );
  });

  it('delivers exact allowlisted event payload after permission', async () => {
    const fetch = vi.fn(async (url) => ({
      ok: true,
      json: async () => url.includes('analytics-permission') ? ({
        schema_version: 'mission-spine.staging-control.v1',
        candidate_spec_sha256: 'a'.repeat(64),
        granted: true,
        analytics_origin: 'https://analytics-spy.staging.leva.ai.kr',
      }) : ({ accepted: true }),
    }));

    const release = await resolveReleaseAnalytics({ storage: storage(), fetch });
    expect(release?.sdk).toBeInstanceOf(ReleaseAnalyticsSpySdk);
    expect(release?.bypassAutomationExclusion).toBe(true);
    await release.sdk.capture('landing_viewed', { page_view_id: 'P123' });

    expect(fetch).toHaveBeenNthCalledWith(2,
      'https://analytics-spy.staging.leva.ai.kr/v1/release/browser/analytics-events',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event: 'landing_viewed',
          properties: { page_view_id: 'P123' },
        }),
        credentials: 'omit',
        keepalive: true,
      });
  });

  it('uses the exact non-secret storage key', () => {
    expect(RELEASE_ANALYTICS_STORAGE_KEY).toBe('leva.release.analytics.v1');
  });
});
