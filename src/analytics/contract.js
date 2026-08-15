export const ANALYTICS_CONTRACT_VERSION = 'mission-spine.analytics.v1';
export const ANALYTICS_PRIVACY_POLICY_VERSION =
  'mission-spine.analytics-privacy.v1';
export const ANALYTICS_VALUE_POLICY_VERSION =
  'mission-spine.analytics-values.v1';
export const ANALYTICS_CONSENT_REQUIREMENT = 'analytics_permission';
export const ANALYTICS_TIMESTAMP_SOURCE = 'client_event_time';

export const ANALYTICS_COMMON_PROPERTIES = Object.freeze([
  'contract_version',
  'occurred_at',
  'environment',
  'app_version',
  'session_id',
  'journey_id',
]);

const eventSpec = (allowed, required, dedupe, requiredAny = []) => Object.freeze({
  consent_requirement: ANALYTICS_CONSENT_REQUIREMENT,
  timestamp_source: ANALYTICS_TIMESTAMP_SOURCE,
  allowed: Object.freeze(allowed),
  required: Object.freeze(required),
  requiredAny: Object.freeze(requiredAny.map((group) => Object.freeze(group))),
  dedupe: Object.freeze(dedupe.map((group) => Object.freeze(group))),
});

// This insertion order is part of the cross-repository replay contract.
export const ANALYTICS_EVENT_SPECS = Object.freeze({
  landing_viewed: eventSpec(
    ['page_view_id'],
    ['page_view_id'],
    [['session_id', 'page_view_id']],
  ),
  landing_diagnostic_cta_clicked: eventSpec(
    ['page_view_id', 'cta_location'],
    ['page_view_id', 'cta_location'],
    [['page_view_id', 'cta_location']],
  ),
  diagnostic_started: eventSpec(
    ['track', 'guest_id', 'assessment_id'],
    ['track'],
    [['guest_id'], ['assessment_id']],
    [['guest_id', 'assessment_id']],
  ),
  diagnostic_completed: eventSpec(
    ['guest_id', 'assessment_id', 'diagnosed_level', 'duration_ms'],
    ['diagnosed_level', 'duration_ms'],
    [['guest_id'], ['assessment_id']],
    [['guest_id', 'assessment_id']],
  ),
  result_claimed: eventSpec(
    ['guest_id', 'assessment_id', 'user_id', 'claim_outcome'],
    ['guest_id', 'user_id', 'claim_outcome'],
    [['assessment_id'], ['guest_id', 'user_id']],
  ),
  path_generated: eventSpec(
    ['path_id', 'assessment_id', 'user_id'],
    ['path_id', 'assessment_id', 'user_id'],
    [['path_id']],
  ),
  existing_path_continued: eventSpec(
    ['user_id', 'path_id', 'assessment_id', 'guest_id'],
    ['user_id', 'path_id'],
    [
      ['user_id', 'path_id', 'assessment_id'],
      ['user_id', 'path_id', 'guest_id'],
    ],
    [['assessment_id', 'guest_id']],
  ),
  path_first_viewed: eventSpec(
    ['user_id', 'path_id', 'originating_session_id'],
    ['user_id', 'path_id', 'originating_session_id'],
    [['user_id', 'path_id']],
  ),
  first_mission_started: eventSpec(
    ['user_id', 'path_id', 'week_num', 'task_id', 'first_open'],
    ['user_id', 'path_id', 'week_num', 'task_id', 'first_open'],
    [['user_id', 'task_id', 'first_open']],
  ),
  first_practice_succeeded: eventSpec(
    [
      'user_id',
      'path_id',
      'task_id',
      'content_id',
      'run_id',
      'first_successful_run',
    ],
    [
      'user_id',
      'path_id',
      'task_id',
      'content_id',
      'run_id',
      'first_successful_run',
    ],
    [['user_id', 'task_id', 'first_successful_run']],
  ),
  contextual_review_viewed: eventSpec(
    [
      'user_id',
      'task_id',
      'review_id',
      'approved_context_field_count',
      'next_action_outcome',
      'first_view',
    ],
    [
      'user_id',
      'task_id',
      'review_id',
      'approved_context_field_count',
      'next_action_outcome',
      'first_view',
    ],
    [['user_id', 'task_id', 'review_id', 'first_view']],
  ),
});

export const ANALYTICS_BANNED_PROPERTIES = Object.freeze([
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
]);

const BANNED_PROPERTIES = new Set(ANALYTICS_BANNED_PROPERTIES);

const OPAQUE_ID_PROPERTIES = new Set([
  'session_id',
  'journey_id',
  'page_view_id',
  'originating_session_id',
]);

const DATABASE_ID_PROPERTIES = new Set([
  'assessment_id',
  'path_id',
  'task_id',
  'content_id',
  'run_id',
  'review_id',
]);

const TRACKS = new Set([
  'BACKEND_SPRING',
  'FRONTEND_REACT',
  'MOBILE_FLUTTER',
  'DEVOPS',
  'FULLSTACK',
  'PYTHON_BACKEND',
]);
const CTA_LOCATIONS = new Set(['header', 'hero', 'mini_diagnostic', 'pricing']);
const DIAGNOSED_LEVELS = new Set(['JUNIOR', 'MID', 'SENIOR']);
const ISO_UTC_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const invalid = (code, property) => ({
  valid: false,
  code,
  ...(property ? { property } : {}),
});

export function isBannedAnalyticsProperty(property) {
  return BANNED_PROPERTIES.has(String(property).toLowerCase());
}

export function isOpaqueAnalyticsIdentifier(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{22}$/.test(value);
}

export function isPlatformUserId(value) {
  return typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value);
}

function isPositiveDatabaseId(value) {
  if (Number.isSafeInteger(value)) return value > 0;
  return typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value);
}

function isAllowedScalar(value) {
  return typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value));
}

function hasProperty(properties, name) {
  return Object.prototype.hasOwnProperty.call(properties, name);
}

function isStrictIsoUtcMillis(value) {
  if (typeof value !== 'string' || !ISO_UTC_MILLIS.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    && new Date(timestamp).toISOString() === value;
}

function validateKnownValue(name, value) {
  if (OPAQUE_ID_PROPERTIES.has(name) && !isOpaqueAnalyticsIdentifier(value)) {
    return invalid('invalid_identifier', name);
  }
  if (DATABASE_ID_PROPERTIES.has(name) && !isPositiveDatabaseId(value)) {
    return invalid('invalid_identifier', name);
  }
  if (name === 'user_id' && !isPlatformUserId(value)) {
    return invalid('invalid_identifier', name);
  }
  if (name === 'guest_id'
      && (typeof value !== 'string' || !UUID_V4.test(value))) {
    return invalid('invalid_identifier', name);
  }
  if (name === 'occurred_at' && !isStrictIsoUtcMillis(value)) {
    return invalid('invalid_property_value', name);
  }
  if (name === 'environment'
      && !['production', 'staging', 'development', 'test'].includes(value)) {
    return invalid('invalid_property_value', name);
  }
  if (name === 'app_version'
      && (typeof value !== 'string' || !/^[A-Za-z0-9._+-]{1,128}$/.test(value))) {
    return invalid('invalid_property_value', name);
  }
  if (name === 'track' && !TRACKS.has(value)) {
    return invalid('invalid_property_value', name);
  }
  if (name === 'cta_location' && !CTA_LOCATIONS.has(value)) {
    return invalid('invalid_property_value', name);
  }
  if (name === 'diagnosed_level' && !DIAGNOSED_LEVELS.has(value)) {
    return invalid('invalid_property_value', name);
  }
  if (name === 'claim_outcome'
      && !['new_path_eligible', 'existing_active_path'].includes(value)) {
    return invalid('invalid_property_value', name);
  }
  if (name === 'next_action_outcome'
      && !['path_adjusted', 'next_mission'].includes(value)) {
    return invalid('invalid_property_value', name);
  }
  if (['duration_ms', 'week_num'].includes(name)
      && (!Number.isSafeInteger(value) || value <= 0)) {
    return invalid('invalid_property_value', name);
  }
  if (name === 'approved_context_field_count'
      && (!Number.isSafeInteger(value) || value <= 0)) {
    return invalid('invalid_property_value', name);
  }
  if (['first_open', 'first_successful_run', 'first_view'].includes(name)
      && value !== true) {
    return invalid('invalid_property_value', name);
  }
  return null;
}

export function validateAnalyticsEvent(event, properties) {
  const spec = ANALYTICS_EVENT_SPECS[event];
  if (!spec) return invalid('unknown_event');
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return invalid('invalid_properties');
  }

  const allowed = new Set([...ANALYTICS_COMMON_PROPERTIES, ...spec.allowed]);
  for (const [name, value] of Object.entries(properties)) {
    if (isBannedAnalyticsProperty(name)) return invalid('banned_property', name);
    if (!allowed.has(name)) return invalid('unknown_property', name);
    if (!isAllowedScalar(value)) return invalid('nested_property', name);
    const valueError = validateKnownValue(name, value);
    if (valueError) return valueError;
  }

  for (const name of [...ANALYTICS_COMMON_PROPERTIES, ...spec.required]) {
    if (!hasProperty(properties, name)) return invalid('missing_property', name);
  }
  for (const alternatives of spec.requiredAny) {
    if (!alternatives.some((name) => hasProperty(properties, name))) {
      return invalid('missing_property', alternatives.join('|'));
    }
  }
  if (properties.contract_version !== ANALYTICS_CONTRACT_VERSION) {
    return invalid('contract_version_mismatch', 'contract_version');
  }
  return { valid: true };
}

export function analyticsDeduplicationKey(event, properties) {
  const spec = ANALYTICS_EVENT_SPECS[event];
  if (!spec) return null;
  const fields = spec.dedupe.find((candidate) =>
    candidate.every((name) => hasProperty(properties, name)));
  if (!fields) return null;
  return `${ANALYTICS_CONTRACT_VERSION}:${event}:${fields
    .map((name) => `${name}=${String(properties[name])}`)
    .join('&')}`;
}
