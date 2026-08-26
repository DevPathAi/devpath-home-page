import { validateAnalyticsEvent } from '../../../src/analytics/contract.js';

const CONTROL_SCHEMA = 'mission-spine.staging-control.v1';
const SHA256 = /^[0-9a-f]{64}$/;
const RUN_KEY = /^[A-Za-z0-9_-]{22,128}$/;
const JOURNEYS = new Set([
  'mission-spine-onboarding',
  'mission-spine-workspace',
]);

export const REQUIRED_CAPABILITIES = Object.freeze({
  'mission-spine-onboarding': Object.freeze([
    'production-artifact-probe',
    'deterministic-oauth',
    'required-consent-control',
    'database-authoritative-claim',
    'claim-replay',
    'content-linked-completion-replay',
    'contentless-completion-replay',
    'analytics-spy',
    'analytics-prepermission-zero',
    'analytics-permission-control',
  ]),
  'mission-spine-workspace': Object.freeze([
    'production-artifact-probe',
    'deterministic-oauth',
    'real-sandbox-runtime',
    'sandbox-owner-recovery',
    'sandbox-disconnect-control',
    'sandbox-timeout-control',
    'sandbox-truncation-control',
    'sandbox-reconciliation-control',
    'kafka-outbox-review',
    'deterministic-review',
    'private-mentor-prompt',
    'mock-mentor-provider-capture',
    'partial-failure-control',
    'analytics-spy',
    'analytics-permission-control',
  ]),
});

const COMMANDS = Object.freeze({
  'mission-spine-onboarding': new Set([
    'replay-oauth-callback',
    'replay-claim',
    'replay-content-linked-completion',
    'replay-contentless-completion',
    'grant-analytics-permission',
  ]),
  'mission-spine-workspace': new Set([
    'next-run-immediate-disconnect',
    'next-run-midstream-disconnect',
    'next-run-timeout',
    'next-run-truncated',
    'seed-stale-allocating',
    'seed-stale-running',
    'fail-next-review',
    'fail-next-mentor',
    'clear-faults',
    'grant-analytics-permission',
  ]),
});

const BANNED_ANALYTICS_PROPERTIES = new Set([
  'email',
  'name',
  'full_name',
  'display_name',
  'nickname',
  'github_handle',
  'provider_subject',
  'oauth_code',
  'oauth_state',
  'access_token',
  'refresh_token',
  'guest_token',
  'password',
  'code',
  'editor_code',
  'output',
  'stdout',
  'stderr',
  'error',
  'prompt',
  'answer',
  'answers',
  'context_snapshot',
  'lcs_snapshot',
  'token',
]);

function requireJourney(journey) {
  if (!JOURNEYS.has(journey)) throw new Error('unknown release journey');
  return journey;
}

function requireRunKey(runKey) {
  if (typeof runKey !== 'string' || !RUN_KEY.test(runKey)) {
    throw new Error('staging run key is invalid');
  }
  return runKey;
}

function browserRunOrigins(value) {
  const fields = [
    'landingOrigin',
    'appOrigin',
    'oauthOrigin',
    'analyticsSpyOrigin',
  ];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('canonical browser run origins are required');
  }
  const origins = fields.map((field) => {
    if (typeof value[field] !== 'string') {
      throw new Error(`canonical browser run ${field} is required`);
    }
    const parsed = new URL(value[field]);
    if (
      parsed.protocol !== 'https:'
      || parsed.username
      || parsed.password
      || parsed.origin !== value[field]
    ) {
      throw new Error(`canonical browser run ${field} must be an HTTPS origin`);
    }
    return parsed.origin;
  });
  if (new Set(origins).size !== fields.length) {
    throw new Error('canonical browser run origins must be distinct');
  }
  return new Set(origins);
}

const RUN_HEADER_NAMES = new Set([
  'x-candidate-spec-sha256',
  'x-release-run-key',
]);
const MAX_TRACKED_BROWSER_REQUESTS = 4_096;

function requestHeadersForHop(headers, candidateSpecSha256, runKey) {
  const entries = Object.entries(headers ?? {})
    .filter(([name]) => !RUN_HEADER_NAMES.has(name.toLowerCase()))
    .map(([name, value]) => ({ name, value: String(value) }));
  entries.push(
    { name: 'x-candidate-spec-sha256', value: candidateSpecSha256 },
    { name: 'x-release-run-key', value: runKey },
  );
  return entries;
}

// Fetch.continueRequest header overrides are scoped to one network hop. This
// keeps Chromium's own DNS/TLS stack in use while every redirect is rechecked.
export async function installHostBoundRunHeaders(page, {
  allowedOrigins,
  candidateSpecSha256,
  runKey,
}) {
  if (!page || typeof page.context !== 'function' || typeof page.close !== 'function') {
    throw new Error('Chromium DevTools session is required');
  }
  const browserContext = page.context();
  if (!browserContext || typeof browserContext.newCDPSession !== 'function') {
    throw new Error('Chromium DevTools session is required');
  }
  if (
    !(allowedOrigins instanceof Set)
    || allowedOrigins.size === 0
    || [...allowedOrigins].some((origin) => {
      if (typeof origin !== 'string') return true;
      try {
        return new URL(origin).origin !== origin;
      } catch {
        return true;
      }
    })
  ) {
    throw new Error('validated browser run origins are required');
  }
  if (typeof candidateSpecSha256 !== 'string' || !SHA256.test(candidateSpecSha256)) {
    throw new Error('browser run candidate-spec SHA256 is invalid');
  }
  requireRunKey(runKey);

  const session = await browserContext.newCDPSession(page);
  const requests = new Map();
  let closingForViolation = false;

  const failClosed = async (requestId) => {
    if (closingForViolation) return;
    closingForViolation = true;
    try {
      await session.send('Fetch.failRequest', {
        requestId,
        errorReason: 'BlockedByClient',
      });
    } finally {
      await page.close({ runBeforeUnload: false });
    }
  };

  const handlePausedRequest = async (event) => {
    const { requestId, redirectedRequestId, request } = event;
    let origin;
    try {
      origin = new URL(request.url).origin;
    } catch {
      await failClosed(requestId);
      return;
    }

    const source = redirectedRequestId
      ? requests.get(redirectedRequestId)
      : undefined;
    if (redirectedRequestId && !source) {
      await failClosed(requestId);
      return;
    }

    const bound = allowedOrigins.has(origin);
    if (source && source.bound !== bound) {
      await failClosed(requestId);
      return;
    }
    if (requests.size >= MAX_TRACKED_BROWSER_REQUESTS) {
      await failClosed(requestId);
      return;
    }
    requests.set(requestId, { origin, bound });

    await session.send('Fetch.continueRequest', {
      requestId,
      ...(bound
        ? { headers: requestHeadersForHop(request.headers, candidateSpecSha256, runKey) }
        : {}),
    });
  };

  session.on('Fetch.requestPaused', (event) => (
    handlePausedRequest(event).catch(async () => {
      try {
        await failClosed(event.requestId);
      } catch {
        // The page is already closing; no request is allowed to resume.
      }
    })
  ));

  await session.send('Fetch.enable', {
    patterns: [{ urlPattern: '*', requestStage: 'Request' }],
  });
}

function responseObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('staging control returned an invalid response');
  }
  return value;
}

function ensurePinnedResponse(body, candidateSpecSha256) {
  responseObject(body);
  if (body.schema_version !== CONTROL_SCHEMA) {
    throw new Error('staging control schema mismatch');
  }
  if (body.candidate_spec_sha256 !== candidateSpecSha256) {
    throw new Error('staging control candidate-spec pin mismatch');
  }
  return body;
}

async function safeJson(response) {
  try {
    return responseObject(await response.json());
  } catch {
    throw new Error('staging control returned invalid JSON');
  }
}

function assertNoBannedAnalyticsProperties(properties) {
  if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) {
    throw new Error('analytics spy properties must be a flat object');
  }
  for (const [property, value] of Object.entries(properties)) {
    if (BANNED_ANALYTICS_PROPERTIES.has(property.toLowerCase())) {
      throw new Error('analytics spy captured a banned property');
    }
    if (value !== null && typeof value === 'object') {
      throw new Error('analytics spy captured nested properties');
    }
  }
}

export function assertAnalyticsSequence(events, expectedEvents) {
  if (!Array.isArray(events) || !Array.isArray(expectedEvents)) {
    throw new Error('analytics sequence must be an array');
  }
  const actualEvents = [];
  const seen = new Set();
  for (const entry of events) {
    responseObject(entry);
    if (typeof entry.event !== 'string' || entry.event === '') {
      throw new Error('analytics spy event is invalid');
    }
    if (seen.has(entry.event)) throw new Error('analytics spy captured a duplicate event');
    seen.add(entry.event);
    assertNoBannedAnalyticsProperties(entry.properties);
    if (!validateAnalyticsEvent(entry.event, entry.properties).valid) {
      throw new Error('analytics spy payload violates the approved contract');
    }
    actualEvents.push(entry.event);
  }
  if (
    actualEvents.length !== expectedEvents.length
    || actualEvents.some((event, index) => event !== expectedEvents[index])
  ) {
    throw new Error('analytics spy event order does not match the approved contract');
  }
  return true;
}

export async function activateFlutterSemantics(page) {
  const semantics = page.locator('flt-semantics').first();
  if (await semantics.count() > 0) return;

  const placeholder = page.locator('flt-semantics-placeholder');
  await page.locator('flt-semantics, flt-semantics-placeholder').first().waitFor({
    state: 'attached',
    timeout: 15_000,
  });
  if (await semantics.count() > 0) return;

  // Flutter places the accessibility activator just outside the viewport, so
  // Playwright's pointer click is not actionable. Keyboard activation matches
  // the control's role while remaining deterministic in headless Chromium.
  await placeholder.first().focus();
  await page.keyboard.press('Enter');
  await semantics.waitFor({
    state: 'attached',
    timeout: 15_000,
  });
}

export async function assertProductionTlsNavigation(page, url, expectedHostname) {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.hostname !== expectedHostname) {
    throw new Error('production artifact navigation target is invalid');
  }
  const response = await page.goto(target.href, { waitUntil: 'domcontentloaded' });
  if (!response || response.status() >= 400) {
    throw new Error('production artifact DNS/TLS probe failed');
  }
  if (new URL(page.url()).hostname !== expectedHostname) {
    throw new Error('production artifact navigation left the expected hostname');
  }
  return response;
}

export class StagingControl {
  #request;
  #origin;
  #credential;
  #candidateSpecSha256;

  constructor({ request, origin, credential, candidateSpecSha256 }) {
    if (!request || typeof request.get !== 'function' || typeof request.post !== 'function' && request.post !== undefined) {
      throw new Error('Playwright request context is required');
    }
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.protocol !== 'https:' || parsedOrigin.origin !== origin) {
      throw new Error('staging control must use an HTTPS origin');
    }
    if (typeof credential !== 'string' || credential === '') {
      throw new Error('staging control credential is required');
    }
    if (typeof candidateSpecSha256 !== 'string' || !SHA256.test(candidateSpecSha256)) {
      throw new Error('staging control candidate-spec SHA256 is invalid');
    }
    this.#request = request;
    this.#origin = origin;
    this.#credential = credential;
    this.#candidateSpecSha256 = candidateSpecSha256;
  }

  #headers(runKey) {
    return {
      accept: 'application/json',
      authorization: `Bearer ${this.#credential}`,
      'x-candidate-spec-sha256': this.#candidateSpecSha256,
      ...(runKey ? { 'x-release-run-key': requireRunKey(runKey) } : {}),
    };
  }

  async #get(path, runKey) {
    const response = await this.#request.get(`${this.#origin}${path}`, {
      headers: this.#headers(runKey),
      failOnStatusCode: false,
    });
    if (!response.ok()) throw new Error('staging control request failed');
    return ensurePinnedResponse(await safeJson(response), this.#candidateSpecSha256);
  }

  async #post(path, runKey, data = {}) {
    if (typeof this.#request.post !== 'function') {
      throw new Error('Playwright request context cannot issue staging controls');
    }
    const response = await this.#request.post(`${this.#origin}${path}`, {
      headers: this.#headers(runKey),
      data,
      failOnStatusCode: false,
    });
    if (!response.ok()) throw new Error('staging control request failed');
    return ensurePinnedResponse(await safeJson(response), this.#candidateSpecSha256);
  }

  async assertPrerequisites(journey) {
    requireJourney(journey);
    const body = await this.#get(`/v1/release/prerequisites/${journey}`);
    if (body.ready !== true || !Array.isArray(body.capabilities)) {
      throw new Error('staging prerequisites are not ready');
    }
    const available = new Set(body.capabilities);
    for (const capability of REQUIRED_CAPABILITIES[journey]) {
      if (!available.has(capability)) {
        throw new Error('required staging capability is missing');
      }
    }
    return body;
  }

  async prepareJourney(journey) {
    requireJourney(journey);
    const body = await this.#post(`/v1/release/journeys/${journey}/prepare`);
    requireRunKey(body.run_key);
    if (typeof body.fixture_revision !== 'string' || !/^[0-9a-f]{40}$/.test(body.fixture_revision)) {
      throw new Error('staging fixture revision is invalid');
    }
    return Object.freeze({
      runKey: body.run_key,
      fixtureRevision: body.fixture_revision,
    });
  }

  async command(journey, runKey, command) {
    requireJourney(journey);
    requireRunKey(runKey);
    if (!COMMANDS[journey].has(command)) throw new Error('unapproved staging command');
    const body = await this.#post(
      `/v1/release/journeys/${journey}/commands/${command}`,
      runKey,
    );
    if (body.accepted !== true) throw new Error('staging command was not accepted');
    return body;
  }

  async checkpoint(journey, runKey, checkpoint) {
    requireJourney(journey);
    requireRunKey(runKey);
    if (typeof checkpoint !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(checkpoint)) {
      throw new Error('staging checkpoint is invalid');
    }
    const body = await this.#get(
      `/v1/release/journeys/${journey}/checkpoints/${checkpoint}`,
      runKey,
    );
    if (body.result !== 'passed') throw new Error('staging checkpoint failed');
    return body;
  }

  async analyticsEvents(journey, runKey) {
    requireJourney(journey);
    requireRunKey(runKey);
    const body = await this.#get(
      `/v1/release/journeys/${journey}/analytics`,
      runKey,
    );
    if (!Array.isArray(body.events)) throw new Error('analytics spy is unavailable');
    return body.events;
  }

  async bindBrowserRun(page, runKey, origins) {
    requireRunKey(runKey);
    const allowedOrigins = browserRunOrigins(origins);
    await installHostBoundRunHeaders(page, {
      allowedOrigins,
      candidateSpecSha256: this.#candidateSpecSha256,
      runKey,
    });
  }
}
