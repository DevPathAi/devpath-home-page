import {
  ANALYTICS_COMMON_PROPERTIES,
  ANALYTICS_CONTRACT_VERSION,
  analyticsDeduplicationKey,
  isPlatformUserId,
  validateAnalyticsEvent,
} from './contract.js';

export const AnalyticsCaptureStatus = Object.freeze({
  accepted: 'accepted',
  optedOut: 'opted_out',
  excluded: 'excluded',
  duplicate: 'duplicate',
  rejected: 'rejected',
});

export class NoopJourneyAnalyticsSdk {
  capture() {}
  identify() {}
  reset() {}
}

const defaultSchedule = (work) => globalThis.setTimeout(work, 0);

function safelyRun(work) {
  try {
    const result = work();
    if (result && typeof result.then === 'function') result.catch(() => {});
  } catch (_) {
    // Analytics is a secondary side effect. Product actions must keep moving.
  }
}

export class JourneyAnalyticsAdapter {
  #sdk;
  #context;
  #schedule;
  #optedOut;
  #baseExcluded;
  #accountExcluded = false;
  #isInternalUser;
  #sdkActivated = false;
  #dedupe = new Set();
  #currentUserId = null;
  #identifiedUserId = null;

  constructor({
    sdk = new NoopJourneyAnalyticsSdk(),
    context,
    optedOut = true,
    excluded = false,
    isInternalUser = () => false,
    schedule = defaultSchedule,
  }) {
    this.#sdk = sdk;
    this.#context = context;
    this.#optedOut = optedOut;
    this.#baseExcluded = excluded || shouldExcludeAnalyticsTraffic({
      environment: context.environment,
      appVersion: context.appVersion,
    });
    this.#isInternalUser = isInternalUser;
    this.#schedule = schedule;
  }

  setOptedOut(optedOut) {
    const next = Boolean(optedOut);
    if (next === this.#optedOut) return;
    if (next) {
      this.#resetSdkIdentity();
      this.#optedOut = true;
      this.#dedupe.clear();
      return;
    }
    this.#optedOut = false;
    this.#activateCurrentIdentity();
  }

  capture(event, eventProperties = {}) {
    if (eventProperties === null
        || typeof eventProperties !== 'object'
        || Array.isArray(eventProperties)) {
      return AnalyticsCaptureStatus.rejected;
    }
    if (ANALYTICS_COMMON_PROPERTIES.some((property) =>
      Object.prototype.hasOwnProperty.call(eventProperties, property))) {
      return AnalyticsCaptureStatus.rejected;
    }
    const properties = {
      contract_version: ANALYTICS_CONTRACT_VERSION,
      occurred_at: this.#context.now().toISOString(),
      environment: this.#context.environment,
      app_version: this.#context.appVersion,
      session_id: this.#context.sessionId,
      journey_id: this.#context.journeyId,
      ...eventProperties,
    };
    const validation = validateAnalyticsEvent(event, properties);
    if (!validation.valid) return AnalyticsCaptureStatus.rejected;
    if (this.#optedOut) return AnalyticsCaptureStatus.optedOut;
    if (this.#baseExcluded || this.#accountExcluded) {
      return AnalyticsCaptureStatus.excluded;
    }

    const dedupeKey = analyticsDeduplicationKey(event, properties);
    if (!dedupeKey) return AnalyticsCaptureStatus.rejected;
    if (this.#dedupe.has(dedupeKey)) return AnalyticsCaptureStatus.duplicate;
    this.#dedupe.add(dedupeKey);
    this.#sdkActivated = true;
    this.#deliver(() => this.#sdk.capture?.(event, { ...properties }));
    return AnalyticsCaptureStatus.accepted;
  }

  identify(userId) {
    if (!isPlatformUserId(userId)) return false;
    if (this.#currentUserId !== null && this.#currentUserId !== userId) {
      this.#dedupe.clear();
      this.#resetSdkIdentity();
    }
    this.#currentUserId = userId;
    if (this.#isInternalUser(userId)) {
      this.#resetSdkIdentity();
      this.#accountExcluded = true;
      return false;
    }
    this.#accountExcluded = false;
    return this.#activateCurrentIdentity();
  }

  #activateCurrentIdentity() {
    if (this.#optedOut || this.#baseExcluded || this.#accountExcluded
        || this.#currentUserId === null) return false;
    const userId = this.#currentUserId;
    if (this.#identifiedUserId === userId) return true;
    if (this.#identifiedUserId !== null) this.#resetSdkIdentity();
    this.#identifiedUserId = userId;
    this.#sdkActivated = true;
    this.#deliver(() => this.#sdk.identify?.(userId));
    return true;
  }

  reset() {
    this.#dedupe.clear();
    this.#currentUserId = null;
    this.#accountExcluded = false;
    this.#resetSdkIdentity();
  }

  #resetSdkIdentity() {
    const shouldDeliver = this.#sdkActivated && !this.#baseExcluded;
    this.#sdkActivated = false;
    this.#identifiedUserId = null;
    if (shouldDeliver) this.#deliver(() => this.#sdk.reset?.());
  }

  #deliver(work) {
    try {
      this.#schedule(() => safelyRun(work));
    } catch (_) {
      // A scheduler/SDK failure is deliberately isolated from the product flow.
    }
  }
}

export function shouldExcludeAnalyticsTraffic({
  environment,
  appVersion,
  userAgent = '',
  isInternalAccount = false,
}) {
  return environment !== 'production'
    || appVersion === 'dev'
    || isInternalAccount
    || /bot|crawler|spider|playwright|headless|selenium/i.test(userAgent);
}
