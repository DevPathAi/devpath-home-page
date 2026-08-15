import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  ANALYTICS_BANNED_PROPERTIES,
  ANALYTICS_COMMON_PROPERTIES,
  ANALYTICS_CONTRACT_VERSION,
  ANALYTICS_EVENT_SPECS,
  ANALYTICS_PRIVACY_POLICY_VERSION,
  ANALYTICS_VALUE_POLICY_VERSION,
  validateAnalyticsEvent,
} from '../src/analytics/contract.js';

const common = {
  contract_version: 'mission-spine.analytics.v1',
  occurred_at: '2026-08-15T10:00:00.000Z',
  environment: 'production',
  app_version: 'abc123',
  session_id: 'AQIDBAUGBwgJCgsMDQ4PEA',
  journey_id: 'EREREREREREREREREREREQ',
};

const canonicalContractSha256 =
  '486256fd212b96ea2fec0c6a95e22676b708989f94c0ca974276d6bd5f6b4908';

const expectedSpecs = {
  landing_viewed: {
    allowed: ['page_view_id'], required: ['page_view_id'], requiredAny: [],
    dedupe: [['session_id', 'page_view_id']],
  },
  landing_diagnostic_cta_clicked: {
    allowed: ['page_view_id', 'cta_location'],
    required: ['page_view_id', 'cta_location'], requiredAny: [],
    dedupe: [['page_view_id', 'cta_location']],
  },
  diagnostic_started: {
    allowed: ['track', 'guest_id', 'assessment_id'], required: ['track'],
    requiredAny: [['guest_id', 'assessment_id']],
    dedupe: [['guest_id'], ['assessment_id']],
  },
  diagnostic_completed: {
    allowed: ['guest_id', 'assessment_id', 'diagnosed_level', 'duration_ms'],
    required: ['diagnosed_level', 'duration_ms'],
    requiredAny: [['guest_id', 'assessment_id']],
    dedupe: [['guest_id'], ['assessment_id']],
  },
  result_claimed: {
    allowed: ['guest_id', 'assessment_id', 'user_id', 'claim_outcome'],
    required: ['guest_id', 'user_id', 'claim_outcome'], requiredAny: [],
    dedupe: [['assessment_id'], ['guest_id', 'user_id']],
  },
  path_generated: {
    allowed: ['path_id', 'assessment_id', 'user_id'],
    required: ['path_id', 'assessment_id', 'user_id'], requiredAny: [],
    dedupe: [['path_id']],
  },
  existing_path_continued: {
    allowed: ['user_id', 'path_id', 'assessment_id', 'guest_id'],
    required: ['user_id', 'path_id'],
    requiredAny: [['assessment_id', 'guest_id']],
    dedupe: [
      ['user_id', 'path_id', 'assessment_id'],
      ['user_id', 'path_id', 'guest_id'],
    ],
  },
  path_first_viewed: {
    allowed: ['user_id', 'path_id', 'originating_session_id'],
    required: ['user_id', 'path_id', 'originating_session_id'], requiredAny: [],
    dedupe: [['user_id', 'path_id']],
  },
  first_mission_started: {
    allowed: ['user_id', 'path_id', 'week_num', 'task_id', 'first_open'],
    required: ['user_id', 'path_id', 'week_num', 'task_id', 'first_open'],
    requiredAny: [], dedupe: [['user_id', 'task_id', 'first_open']],
  },
  first_practice_succeeded: {
    allowed: [
      'user_id', 'path_id', 'task_id', 'content_id', 'run_id',
      'first_successful_run',
    ],
    required: [
      'user_id', 'path_id', 'task_id', 'content_id', 'run_id',
      'first_successful_run',
    ],
    requiredAny: [],
    dedupe: [['user_id', 'task_id', 'first_successful_run']],
  },
  contextual_review_viewed: {
    allowed: [
      'user_id', 'task_id', 'review_id', 'approved_context_field_count',
      'next_action_outcome', 'first_view',
    ],
    required: [
      'user_id', 'task_id', 'review_id', 'approved_context_field_count',
      'next_action_outcome', 'first_view',
    ],
    requiredAny: [],
    dedupe: [['user_id', 'task_id', 'review_id', 'first_view']],
  },
};

const validEventProperties = {
  landing_viewed: { page_view_id: 'ISEhISEhISEhISEhISEhIQ' },
  landing_diagnostic_cta_clicked: {
    page_view_id: 'ISEhISEhISEhISEhISEhIQ', cta_location: 'hero',
  },
  diagnostic_started: {
    track: 'BACKEND_SPRING', guest_id: '123e4567-e89b-42d3-a456-426614174000',
  },
  diagnostic_completed: {
    assessment_id: 11, diagnosed_level: 'MID', duration_ms: 12_000,
  },
  result_claimed: {
    guest_id: '123e4567-e89b-42d3-a456-426614174000', assessment_id: 11,
    user_id: '101', claim_outcome: 'new_path_eligible',
  },
  path_generated: { path_id: 21, assessment_id: 11, user_id: '101' },
  existing_path_continued: { user_id: '101', path_id: 21, assessment_id: 11 },
  path_first_viewed: {
    user_id: '101', path_id: 21, originating_session_id: 'AQIDBAUGBwgJCgsMDQ4PEA',
  },
  first_mission_started: {
    user_id: '101', path_id: 21, week_num: 1, task_id: 31, first_open: true,
  },
  first_practice_succeeded: {
    user_id: '101', path_id: 21, task_id: 31, content_id: 41, run_id: 51,
    first_successful_run: true,
  },
  contextual_review_viewed: {
    user_id: '101', task_id: 31, review_id: 61,
    approved_context_field_count: 1, next_action_outcome: 'next_mission',
    first_view: true,
  },
};

describe('Mission Spine analytics contract', () => {
  it('matches the canonical versioned JSON contract', () => {
    const path = fileURLToPath(new URL(
      '../src/analytics/mission-spine.analytics.v1.json',
      import.meta.url,
    ));
    const canonicalBytes = readFileSync(path);
    const canonical = JSON.parse(canonicalBytes.toString('utf8'));

    expect(createHash('sha256').update(canonicalBytes).digest('hex'))
      .toBe(canonicalContractSha256);
    expect(canonical.version).toBe(ANALYTICS_CONTRACT_VERSION);
    expect(canonical.privacyPolicyVersion)
      .toBe(ANALYTICS_PRIVACY_POLICY_VERSION);
    expect(canonical.valuePolicyVersion).toBe(ANALYTICS_VALUE_POLICY_VERSION);
    expect(canonical.commonProperties).toEqual(ANALYTICS_COMMON_PROPERTIES);
    expect(canonical.bannedProperties).toEqual(ANALYTICS_BANNED_PROPERTIES);
    expect(canonical.events).toEqual(ANALYTICS_EVENT_SPECS);
  });

  it('uses the approved version and exact event allowlist', () => {
    expect(ANALYTICS_CONTRACT_VERSION).toBe('mission-spine.analytics.v1');
    expect(Object.keys(ANALYTICS_EVENT_SPECS)).toEqual([
      'landing_viewed',
      'landing_diagnostic_cta_clicked',
      'diagnostic_started',
      'diagnostic_completed',
      'result_claimed',
      'path_generated',
      'existing_path_continued',
      'path_first_viewed',
      'first_mission_started',
      'first_practice_succeeded',
      'contextual_review_viewed',
    ]);
    const schemaOnly = Object.fromEntries(Object.entries(ANALYTICS_EVENT_SPECS)
      .map(([event, spec]) => [event, {
        allowed: spec.allowed,
        required: spec.required,
        requiredAny: spec.requiredAny,
        dedupe: spec.dedupe,
      }]));
    expect(schemaOnly).toEqual(expectedSpecs);
  });

  it('declares consent and timestamp semantics for every event', () => {
    for (const spec of Object.values(ANALYTICS_EVENT_SPECS)) {
      expect(spec.consent_requirement).toBe('analytics_permission');
      expect(spec.timestamp_source).toBe('client_event_time');
    }
  });

  it('validates every event fixture against its exact property set', () => {
    for (const [event, properties] of Object.entries(validEventProperties)) {
      expect(validateAnalyticsEvent(event, { ...common, ...properties }), event)
        .toEqual({ valid: true });
    }
  });

  it('accepts a flat allowlisted event and rejects an unknown event/property', () => {
    expect(validateAnalyticsEvent('landing_viewed', {
      ...common,
      page_view_id: 'ISEhISEhISEhISEhISEhIQ',
    })).toEqual({ valid: true });

    expect(validateAnalyticsEvent('landing_opened', common)).toMatchObject({
      valid: false,
      code: 'unknown_event',
    });
    expect(validateAnalyticsEvent('landing_viewed', {
      ...common,
      page_view_id: 'ISEhISEhISEhISEhISEhIQ',
      experiment_bucket: 'invented',
    })).toMatchObject({ valid: false, code: 'unknown_property' });
  });

  it.each([
    ['email', 'person@example.com'],
    ['github_handle', 'octocat'],
    ['prompt', 'explain this code'],
    ['answer', 'raw diagnostic answer'],
    ['guest_token', 'secret'],
    ['context_snapshot', 'raw snapshot'],
  ])('rejects banned property %s before any SDK sees it', (name, value) => {
    expect(validateAnalyticsEvent('landing_viewed', {
      ...common,
      page_view_id: 'ISEhISEhISEhISEhISEhIQ',
      [name]: value,
    })).toMatchObject({ valid: false, code: 'banned_property' });
  });

  it.each([
    { nested: 'map' },
    ['nested', 'list'],
  ])('rejects nested analytics values: %j', (nested) => {
    expect(validateAnalyticsEvent('landing_viewed', {
      ...common,
      page_view_id: nested,
    })).toMatchObject({ valid: false, code: 'nested_property' });
  });

  it('requires the exact contract version and all common properties', () => {
    expect(validateAnalyticsEvent('landing_viewed', {
      ...common,
      contract_version: 'mission-spine.analytics.v0',
      page_view_id: 'ISEhISEhISEhISEhISEhIQ',
    })).toMatchObject({ valid: false, code: 'contract_version_mismatch' });

    const { session_id: _, ...withoutSession } = common;
    expect(validateAnalyticsEvent('landing_viewed', {
      ...withoutSession,
      page_view_id: 'ISEhISEhISEhISEhISEhIQ',
    })).toMatchObject({ valid: false, code: 'missing_property' });
  });

  it.each(['octocat', 'person@example.com', '홍길동', '0', '-1'])(
    'rejects non-platform user_id %s',
    (userId) => {
      expect(validateAnalyticsEvent('path_generated', {
        ...common,
        path_id: 21,
        assessment_id: 11,
        user_id: userId,
      })).toMatchObject({ valid: false, code: 'invalid_identifier' });
    },
  );

  it('rejects unbounded enum/scalar values and false first-trigger markers', () => {
    expect(validateAnalyticsEvent('diagnostic_started', {
      ...common,
      track: 'raw answer text',
      assessment_id: 11,
    })).toMatchObject({ valid: false, code: 'invalid_property_value' });
    expect(validateAnalyticsEvent('first_mission_started', {
      ...common,
      user_id: '101', path_id: 21, week_num: 0, task_id: 31, first_open: false,
    })).toMatchObject({ valid: false, code: 'invalid_property_value' });
    expect(validateAnalyticsEvent('landing_viewed', {
      ...common,
      occurred_at: 'August 15, 2026',
      page_view_id: 'ISEhISEhISEhISEhISEhIQ',
    })).toMatchObject({ valid: false, code: 'invalid_property_value' });
    expect(validateAnalyticsEvent('landing_viewed', {
      ...common,
      occurred_at: '2026-99-99T99:99:99.999Z',
      page_view_id: 'ISEhISEhISEhISEhISEhIQ',
    })).toMatchObject({ valid: false, code: 'invalid_property_value' });
  });

  it('rejects zero or negative approved context counts', () => {
    const properties = {
      ...common,
      ...validEventProperties.contextual_review_viewed,
      approved_context_field_count: 0,
    };
    expect(validateAnalyticsEvent('contextual_review_viewed', properties))
      .toMatchObject({ valid: false, code: 'invalid_property_value' });
    expect(validateAnalyticsEvent('contextual_review_viewed', {
      ...properties,
      approved_context_field_count: -1,
    })).toMatchObject({ valid: false, code: 'invalid_property_value' });
  });

  it.each([
    ['path_generated', 'path_id'],
    ['diagnostic_completed', 'duration_ms'],
    ['first_mission_started', 'week_num'],
    ['contextual_review_viewed', 'approved_context_field_count'],
  ])('keeps %s.%s within the cross-runtime safe integer range', (
    event,
    property,
  ) => {
    const properties = { ...common, ...validEventProperties[event] };
    expect(validateAnalyticsEvent(event, {
      ...properties,
      [property]: Number.MAX_SAFE_INTEGER,
    })).toEqual({ valid: true });
    expect(validateAnalyticsEvent(event, {
      ...properties,
      [property]: Number.MAX_SAFE_INTEGER + 1,
    })).toMatchObject({ valid: false });
  });
});
