export const RELEASE_ANALYTICS_STORAGE_KEY = 'leva.release.analytics.v1';

const RELEASE_SCHEMA = 'mission-spine.release-analytics.v1';
const CONTROL_SCHEMA = 'mission-spine.staging-control.v1';
const CANDIDATE_SHA256 = /^[0-9a-f]{64}$/;
const PERMISSION_URL = 'https://api.leva.ai.kr/v1/release/browser/analytics-permission';
const CAPTURE_URL = 'https://analytics-spy.staging.leva.ai.kr/v1/release/browser/analytics-events';
const ANALYTICS_ORIGIN = 'https://analytics-spy.staging.leva.ai.kr';

function readMarker(storage) {
  try {
    const value = JSON.parse(storage?.getItem(RELEASE_ANALYTICS_STORAGE_KEY));
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    if (Object.keys(value).sort().join(',') !== [
      'capture_url',
      'permission_url',
      'schema_version',
    ].join(',')) return null;
    if (value.schema_version !== RELEASE_SCHEMA
        || value.permission_url !== PERMISSION_URL
        || value.capture_url !== CAPTURE_URL) return null;
    return value;
  } catch (_) {
    return null;
  }
}

export class ReleaseAnalyticsSpySdk {
  #captureUrl;
  #fetch;

  constructor({ captureUrl, fetch }) {
    this.#captureUrl = captureUrl;
    this.#fetch = fetch;
  }

  capture(event, properties) {
    return this.#fetch(this.#captureUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, properties }),
      credentials: 'omit',
      keepalive: true,
    });
  }

  identify() {}

  reset() {}
}

export async function resolveReleaseAnalytics({
  storage = globalThis.localStorage,
  fetch = globalThis.fetch,
} = {}) {
  const marker = readMarker(storage);
  if (!marker || typeof fetch !== 'function') return null;
  try {
    const response = await fetch(marker.permission_url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      credentials: 'omit',
      cache: 'no-store',
    });
    if (!response?.ok) return null;
    const body = await response.json();
    if (body === null || typeof body !== 'object' || Array.isArray(body)
        || body.schema_version !== CONTROL_SCHEMA
        || !CANDIDATE_SHA256.test(body.candidate_spec_sha256)
        || body.granted !== true
        || body.analytics_origin !== ANALYTICS_ORIGIN) return null;
    return Object.freeze({
      sdk: new ReleaseAnalyticsSpySdk({ captureUrl: marker.capture_url, fetch }),
      bypassAutomationExclusion: true,
    });
  } catch (_) {
    return null;
  }
}
