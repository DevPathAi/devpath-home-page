import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assertLiveReleaseContext,
  createListOnlyReleaseContext,
  loadReleaseContext,
} from '../e2e/release/support/release-context.js';
import {
  REQUIRED_CAPABILITIES,
  StagingControl,
  activateFlutterSemantics,
  assertAnalyticsSequence,
} from '../e2e/release/support/staging-control.js';
import {
  SanitizedEvidence,
  evidenceRoute,
} from '../e2e/release/support/sanitized-evidence.js';

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const temporaryDirectories = [];

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'leva-release-harness-'));
  temporaryDirectories.push(directory);
  return directory;
}

function validCandidateSpec(overrides = {}) {
  const digest = (character) => `sha256:${character.repeat(64)}`;
  const fixtureIds = [
    'web-today-available',
    'web-path-current-week',
    'web-content-reading',
    'web-workspace-idle',
    'web-review-loaded',
    'web-mentor-context-preview',
    'admin-kpi-dashboard',
    'admin-support-long-wire',
    'mobile-today-available',
    'mobile-content-reading',
    'dp-design-mission-ledger',
    'dp-design-context-payload-preview',
  ];
  const component = (repository, name, sourceCharacter, digestCharacter) => ({
    repository,
    source_sha: sourceCharacter.repeat(40),
    image_repository: `ghcr.io/devpathai/${name}`,
    image_digest: digest(digestCharacter),
  });
  return {
    $schema: '../schema-v1.json',
    schema_version: 1,
    document_type: 'candidate-spec',
    release_id: 'ms-20990101-contract-fixture',
    created_at: '2099-01-01T00:00:00Z',
    gitops: {
      repository: 'DevPathAi/devpath-gitops',
      base_sha: '1'.repeat(40),
      base_web_tag: `${'1'.repeat(40)}-mission-on`,
      base_web_digest: digest('c'),
      web_kustomization: 'apps/devpath-web/base/kustomization.yaml',
    },
    services: {
      'devpath-admin': component('DevPathAi/devpath-frontend', 'devpath-admin', '2', '1'),
      'devpath-ai-svc': component('DevPathAi/devpath-ai-svc', 'devpath-ai-svc', '3', '2'),
      'devpath-community-svc': component('DevPathAi/devpath-community-svc', 'devpath-community-svc', '4', '3'),
      'devpath-gateway': component('DevPathAi/devpath-gateway', 'devpath-gateway', '5', '4'),
      'devpath-lcs-svc': component('DevPathAi/devpath-lcs-svc', 'devpath-lcs-svc', '6', '5'),
      'devpath-learning-svc': component('DevPathAi/devpath-learning-svc', 'devpath-learning-svc', '7', '6'),
      'devpath-notification-svc': component('DevPathAi/devpath-notification-svc', 'devpath-notification-svc', '8', '7'),
      'devpath-platform-svc': component('DevPathAi/devpath-platform-svc', 'devpath-platform-svc', '9', '8'),
      'devpath-sandbox-svc': component('DevPathAi/devpath-sandbox-svc', 'devpath-sandbox-svc', 'a', '9'),
    },
    shared_migration: {
      repository: 'DevPathAi/devpath-shared',
      source_sha: 'b'.repeat(40),
      shared_version: '0.0.1-et11.20260822',
      shared_jar_sha256: 'f'.repeat(64),
      image_repository: 'ghcr.io/devpathai/devpath-migration',
      image_digest: digest('d'),
      flyway_target: '202608221001',
      required_migration: 'V202608221001__correct_question_bank_accuracy.sql',
      rollback_policy: 'additive-retained',
    },
    frontend: {
      repository: 'DevPathAi/devpath-frontend',
      source_sha: '2'.repeat(40),
      app_version: 'ms-20990101-contract-fixture',
      analytics_contract_version: 'mission-spine.analytics.v1',
      flag_contract_version: 'mission-spine.flag.v1',
      mission_off: {
        tag: `${'2'.repeat(40)}-mission-off`,
        image_digest: digest('a'),
      },
      mission_on: {
        tag: `${'2'.repeat(40)}-mission-on`,
        image_digest: digest('b'),
      },
      selected_on_digest: digest('b'),
      rollback: {
        mission_off_digest: digest('a'),
        prior_digest: digest('c'),
        prior_identity: {
          ready: false,
          release_id: 'unreleased',
          candidate_spec_sha256: '0'.repeat(64),
          image_digest: digest('0'),
        },
        final_target: 'prior',
      },
    },
    home: {
      repository: 'DevPathAi/devpath-home-page',
      source_sha: '21caf102d947c77e38164bf2f7deac9f6f36ef01',
      dist_sha256: 'd'.repeat(64),
      cloudflare_account_id: '0123456789abcdef0123456789abcdef',
      cloudflare_project: 'devpath-home-page',
      candidate_deployment_id: '11111111-1111-1111-1111-111111111111',
      prior_production_deployment_id: '22222222-2222-2222-2222-222222222222',
    },
    analytics_privacy: {
      collection_mode: 'explicit-consent',
      approval_source_sha: 'e'.repeat(40),
      region: 'EU',
      project_identity: 'posthog-eu-mission-spine',
      retention_days: 90,
      access_owner: 'devpathai/privacy-owners',
      deletion_runbook: 'documents/privacy/posthog-deletion-v1',
    },
    ai_release_eval_config: {
      primary_model: 'claude-sonnet-release',
      fallback_models: ['qwen-release-fallback'],
      prompt_sha256: '3'.repeat(64),
      fixture_revision: 'mentor-eval.v1',
      fixture_sha256: '4'.repeat(64),
      rendered_config_sha256: '5'.repeat(64),
      ollama_endpoint_sha256: '6'.repeat(64),
    },
    environments: {
      staging: {
        github_environment: 'mission-spine-staging',
        kubernetes_context: 'devpath-staging',
        namespace: 'devpath',
        web_deployment: 'devpath-web',
        web_container: 'devpath-web',
        web_origin: 'https://staging-app.leva.ai.kr',
        landing_origin: 'https://staging.leva.ai.kr',
      },
      production: {
        github_environment: 'mission-spine-production',
        kubernetes_context: 'devpath-production',
        namespace: 'devpath',
        web_deployment: 'devpath-web',
        web_container: 'devpath-web',
        web_origin: 'https://app.leva.ai.kr',
        landing_origin: 'https://leva.ai.kr',
      },
    },
    journey_harness: {
      landing_origin: 'https://leva.ai.kr',
      app_origin: 'https://app.leva.ai.kr',
      api_origin: 'https://api.leva.ai.kr',
      control_origin: 'https://release-control.staging.leva.ai.kr',
      oauth_origin: 'https://oauth.staging.leva.ai.kr',
      analytics_spy_origin: 'https://analytics-spy.staging.leva.ai.kr',
      dns_overrides: [
        { hostname: 'leva.ai.kr', address: '10.24.0.10' },
        { hostname: 'app.leva.ai.kr', address: '10.24.0.11' },
      ],
    },
    quality_evidence_inputs: {
      catalogs: {
        'frontend-visual': {
          repository: 'DevPathAi/devpath-frontend',
          source_sha: '2'.repeat(40),
          path: 'evidence/et13/generated/visual-cases.v1.json',
          sha256: '7'.repeat(64),
          case_catalog_version: 'leva.et13.catalog.v1',
          case_catalog_schema_version: 'leva.et13.visual-cases.v1',
          projection_contract_sha256: '8'.repeat(64),
          fixture_ids: fixtureIds,
          case_count: 96,
          surface_case_counts: { web: 48, admin: 16, mobile: 16, dp_design: 16 },
          capture_surface: 'flutter_web_release_projection',
          device_evidence: false,
          evidence_mode: 'release_ready',
          input_provenance_sha256: '9'.repeat(64),
          input_provenance_file_sha256: 'a'.repeat(64),
          baseline_status: 'approved',
          baseline_set_sha256: 'b'.repeat(64),
          baseline_approval_sha256: 'c'.repeat(64),
        },
        'home-visual': {
          repository: 'DevPathAi/devpath-home-page',
          source_sha: '21caf102d947c77e38164bf2f7deac9f6f36ef01',
          rendered_product_sha: 'd'.repeat(40),
          rendered_product_tree_sha256: 'd'.repeat(64),
          path: 'e2e/visual/case-catalog.v2.json',
          sha256: 'e'.repeat(64),
          case_count: 4,
          provenance_sha256: 'f'.repeat(64),
          font_manifest_sha256: '1'.repeat(64),
        },
        'frontend-automated-a11y': {
          repository: 'DevPathAi/devpath-frontend',
          source_sha: '2'.repeat(40),
          path: 'evidence/et13/generated/a11y-cases.v1.json',
          sha256: '2'.repeat(64),
          case_catalog_version: 'leva.et13.catalog.v1',
          case_catalog_schema_version: 'leva.et13.a11y-cases.v1',
          projection_contract_sha256: '8'.repeat(64),
          fixture_ids: fixtureIds,
          case_count: 24,
          surface_case_counts: { web: 12, admin: 4, mobile: 4, dp_design: 4 },
          capture_surface: 'flutter_web_release_projection',
          device_evidence: false,
          evidence_mode: 'release_ready',
          input_provenance_sha256: '3'.repeat(64),
          input_provenance_file_sha256: '4'.repeat(64),
        },
        'home-axe-browser-a11y': {
          repository: 'DevPathAi/devpath-home-page',
          source_sha: '21caf102d947c77e38164bf2f7deac9f6f36ef01',
          rendered_product_sha: 'd'.repeat(40),
          rendered_product_tree_sha256: 'd'.repeat(64),
          path: 'e2e/visual/case-catalog.v2.json',
          sha256: 'e'.repeat(64),
          case_count: 11,
          provenance_sha256: 'f'.repeat(64),
          font_manifest_sha256: '1'.repeat(64),
        },
        'manual-nvda': {
          repository: 'DevPathAi/devpath-frontend',
          source_sha: '2'.repeat(40),
          path: 'tool/release-evidence/catalogs/manual-nvda.v1.json',
          sha256: '5'.repeat(64),
          case_count: 2,
          provenance_sha256: '6'.repeat(64),
        },
        'manual-talkback': {
          repository: 'DevPathAi/devpath-frontend',
          source_sha: '2'.repeat(40),
          path: 'tool/release-evidence/catalogs/manual-talkback.v1.json',
          sha256: '7'.repeat(64),
          case_count: 4,
          provenance_sha256: '8'.repeat(64),
        },
      },
      frontend_projection_contract: {
        schema_version: 'leva.et13.projection-contract.v1',
        projection_contract_sha256: '8'.repeat(64),
        projection_matrix: fixtureIds.map((fixtureId) => ({
          fixture_id: fixtureId,
          capture_scope: 'body_projection',
          source_widget: 'FixtureProjection',
          substitutions: ['approved deterministic fixture'],
        })),
      },
      mobile_test_artifacts: {
        schema_version: 'leva.mission-spine.signed-android-build-binding.v2',
        repository: 'DevPathAi/devpath-frontend',
        source_sha: '2'.repeat(40),
        event: 'workflow_dispatch',
        workflow_path: '.github/workflows/mission-spine-signed-mobile-build.yml',
        workflow_sha256: '9'.repeat(64),
        workflow_run_id: 123456,
        run_attempt: 1,
        artifact_id: 654321,
        artifact_name: 'ms-20990101-contract-fixture-signed-android-build',
        artifact_archive_sha256: 'a'.repeat(64),
        build_provenance_file: 'build-provenance.v2.json',
        build_provenance_sha256: 'b'.repeat(64),
        signed_apk_file: 'mobile/android/leva-release.apk',
        signed_apk_sha256: 'c'.repeat(64),
      },
    },
    rollout: {
      sync_timeout_seconds: 300,
      canary_seconds: 900,
      rollback_budget_seconds: 600,
      synthetic_probe_path: '/internal/release/ready',
      production_order: [
        'shared-migration',
        'additive-services',
        'frontend-mission-off',
        'compatibility-smoke',
        'frontend-mission-on',
        'canary',
        'landing-last',
      ],
      rollback_order: [
        'landing-prior',
        'frontend-mission-off',
        'frontend-prior',
        'retain-additive-services-and-schema',
      ],
    },
    ...overrides,
  };
}

function writePinnedCandidateSpec(candidateSpec = validCandidateSpec()) {
  const directory = temporaryDirectory();
  const path = join(directory, 'candidate-spec.json');
  const bytes = `${JSON.stringify(candidateSpec, null, 2)}\n`;
  writeFileSync(path, bytes);
  return {
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    evidenceDirectory: join(directory, 'evidence'),
  };
}

function validEnvironment(candidateSpec = validCandidateSpec()) {
  const pinned = writePinnedCandidateSpec(candidateSpec);
  return {
    MISSION_CANDIDATE_SPEC_PATH: pinned.path,
    MISSION_CANDIDATE_SPEC_SHA256: pinned.sha256,
    MISSION_RELEASE_CONTROL_TOKEN: 'ephemeral-staging-control-credential',
    MISSION_RELEASE_EVIDENCE_DIR: pinned.evidenceDirectory,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('release context fail-closed contract', () => {
  it('loads one out-of-band hash-pinned immutable canonical candidate-spec', () => {
    const context = loadReleaseContext(validEnvironment());

    expect(context.mode).toBe('live');
    expect(context.releaseId).toBe('ms-20990101-contract-fixture');
    expect(context.landingOrigin).toBe('https://leva.ai.kr');
    expect(context.appOrigin).toBe('https://app.leva.ai.kr');
    expect(context.apiOrigin).toBe('https://api.leva.ai.kr');
    expect(context.chromiumHostResolverRules).toBe(
      'MAP app.leva.ai.kr 10.24.0.11,MAP leva.ai.kr 10.24.0.10',
    );
    expect(context.web.offDigest).not.toBe(context.web.onDigest);
    expect(context.web.selectedOnDigest).toBe(context.web.onDigest);
    expect(context.candidateSpec.document_type).toBe('candidate-spec');
    expect(context.candidateSpecSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(assertLiveReleaseContext(context)).toBe(context);
  });

  it.each([
    'MISSION_CANDIDATE_SPEC_PATH',
    'MISSION_CANDIDATE_SPEC_SHA256',
    'MISSION_RELEASE_CONTROL_TOKEN',
    'MISSION_RELEASE_EVIDENCE_DIR',
  ])('rejects missing live environment input %s', (name) => {
    const environment = validEnvironment();
    delete environment[name];
    expect(() => loadReleaseContext(environment)).toThrow(/required/i);
  });

  it('rejects an unpinned or modified candidate-spec', () => {
    const environment = validEnvironment();
    environment.MISSION_CANDIDATE_SPEC_SHA256 = '0'.repeat(64);
    expect(() => loadReleaseContext(environment)).toThrow(/sha256/i);
  });

  it.each([
    [
      'non-TLS app origin',
      () => {
        const candidate = validCandidateSpec();
        candidate.journey_harness.app_origin = 'http://app.leva.ai.kr';
        return candidate;
      },
    ],
    [
      'non-production app hostname',
      () => {
        const candidate = validCandidateSpec();
        candidate.journey_harness.app_origin = 'https://app.staging.leva.ai.kr';
        candidate.journey_harness.dns_overrides[1].hostname = 'app.staging.leva.ai.kr';
        return candidate;
      },
    ],
    [
      'missing production DNS override',
      () => {
        const candidate = validCandidateSpec();
        candidate.journey_harness.dns_overrides.pop();
        return candidate;
      },
    ],
    [
      'loopback DNS override',
      () => {
        const candidate = validCandidateSpec();
        candidate.journey_harness.dns_overrides[1].address = '127.0.0.1';
        return candidate;
      },
    ],
    [
      'OFF/ON digest collision',
      () => {
        const candidate = validCandidateSpec();
        candidate.frontend.mission_on.image_digest = candidate.frontend.mission_off.image_digest;
        candidate.frontend.selected_on_digest = candidate.frontend.mission_off.image_digest;
        return candidate;
      },
    ],
    [
      'rebuilt selected ON digest',
      () => {
        const candidate = validCandidateSpec();
        candidate.frontend.selected_on_digest = `sha256:${'e'.repeat(64)}`;
        return candidate;
      },
    ],
    [
      'quality catalog bound to another frontend source',
      () => {
        const candidate = validCandidateSpec();
        candidate.quality_evidence_inputs.catalogs['frontend-visual'].source_sha = 'f'.repeat(40);
        return candidate;
      },
    ],
    [
      'unknown post-run field nested in quality inputs',
      () => {
        const candidate = validCandidateSpec();
        candidate.quality_evidence_inputs.mobile_test_artifacts.result = 'passed';
        return candidate;
      },
    ],
    [
      'noncanonical synthetic probe path',
      () => {
        const candidate = validCandidateSpec();
        candidate.rollout.synthetic_probe_path = '/health';
        return candidate;
      },
    ],
    [
      'post-execution output injected into candidate input',
      () => ({ ...validCandidateSpec(), journeys: {} }),
    ],
    [
      'final release-manifest used as browser input',
      () => ({ ...validCandidateSpec(), document_type: 'release-manifest' }),
    ],
  ])('rejects %s', (_, candidateFactory) => {
    expect(() => loadReleaseContext(validEnvironment(candidateFactory())))
      .toThrow();
  });

  it('permits deterministic --list discovery but cannot execute in that mode', () => {
    const context = createListOnlyReleaseContext();
    expect(context.mode).toBe('list-only');
    expect(() => assertLiveReleaseContext(context)).toThrow(/list-only/i);
  });
});

describe('staging control contract', () => {
  it('DOM-activates the offscreen Flutter accessibility placeholder', async () => {
    const calls = [];
    let semanticsAttached = false;
    const locator = (selector) => ({
      first() {
        return this;
      },
      async count() {
        calls.push(`count:${selector}`);
        return selector === 'flt-semantics' && semanticsAttached ? 1 : 0;
      },
      async isVisible() {
        calls.push(`visible:${selector}`);
        return false;
      },
      async waitFor() {
        calls.push(`wait:${selector}`);
        if (selector === 'flt-semantics' && !semanticsAttached) {
          throw new Error('semantics did not attach');
        }
      },
      async focus() {
        calls.push(`focus:${selector}`);
      },
      async evaluate(callback) {
        calls.push(`evaluate:${selector}`);
        callback({
          click() {
            semanticsAttached = true;
          },
        });
      },
    });
    const page = { locator };

    await expect(activateFlutterSemantics(page)).resolves.toBeUndefined();
    expect(calls).toEqual([
      'count:flt-semantics',
      'wait:flt-semantics, flt-semantics-placeholder',
      'count:flt-semantics',
      'focus:flt-semantics-placeholder',
      'evaluate:flt-semantics-placeholder',
      'wait:flt-semantics',
    ]);
  });

  it('requires OAuth, analytics spy, durable service and fault controls', async () => {
    const candidateSpecSha256 = 'e'.repeat(64);
    const responseBody = {
      schema_version: 'mission-spine.staging-control.v1',
      candidate_spec_sha256: candidateSpecSha256,
      ready: true,
      capabilities: [...REQUIRED_CAPABILITIES['mission-spine-workspace']],
    };
    const requests = [];
    const request = {
      async get(url, options) {
        requests.push({ url, options });
        return {
          ok: () => true,
          status: () => 200,
          json: async () => responseBody,
        };
      },
    };
    const control = new StagingControl({
      request,
      origin: 'https://release-control.staging.leva.ai.kr',
      credential: 'not-for-evidence',
      candidateSpecSha256,
    });

    await expect(control.assertPrerequisites('mission-spine-workspace'))
      .resolves.toEqual(responseBody);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(
      'https://release-control.staging.leva.ai.kr/v1/release/prerequisites/mission-spine-workspace',
    );
    expect(requests[0].options.headers.authorization).toBe('Bearer not-for-evidence');
    expect(requests[0].options.headers['x-candidate-spec-sha256'])
      .toBe(candidateSpecSha256);
    expect(requests[0].options.headers).not.toHaveProperty('x-release-manifest-sha256');
  });

  it('sends only an exact positive prior session binding with review fault commands', async () => {
    const candidateSpecSha256 = 'e'.repeat(64);
    const requests = [];
    const request = {
      async get() {},
      async post(url, options) {
        requests.push({ url, options });
        return {
          ok: () => true,
          json: async () => ({
            schema_version: 'mission-spine.staging-control.v1',
            candidate_spec_sha256: candidateSpecSha256,
            accepted: true,
          }),
        };
      },
    };
    const control = new StagingControl({
      request,
      origin: 'https://release-control.staging.leva.ai.kr',
      credential: 'not-for-evidence',
      candidateSpecSha256,
    });
    const args = ['mission-spine-workspace', 'R'.repeat(43), 'fail-next-review'];

    await expect(control.command(...args)).rejects.toThrow(/prior sandbox session/i);
    await expect(control.command(...args, { prior_sandbox_session_id: 0 }))
      .rejects.toThrow(/prior sandbox session/i);
    await expect(control.command(
      'mission-spine-workspace',
      'R'.repeat(43),
      'next-run-timeout',
      { prior_sandbox_session_id: 80 },
    )).rejects.toThrow(/payload/i);
    await expect(control.command(...args, { prior_sandbox_session_id: 80 }))
      .resolves.toMatchObject({ accepted: true });

    expect(requests).toHaveLength(1);
    expect(requests[0].options.data).toEqual({ prior_sandbox_session_id: 80 });
  });

  it('fails closed when a prerequisite, spy, or candidate pin is absent', async () => {
    const capabilities = [...REQUIRED_CAPABILITIES['mission-spine-onboarding']];
    capabilities.pop();
    const request = {
      async get() {
        return {
          ok: () => true,
          status: () => 200,
          json: async () => ({
            schema_version: 'mission-spine.staging-control.v1',
            candidate_spec_sha256: 'f'.repeat(64),
            ready: true,
            capabilities,
          }),
        };
      },
    };
    const control = new StagingControl({
      request,
      origin: 'https://release-control.staging.leva.ai.kr',
      credential: 'not-for-evidence',
      candidateSpecSha256: 'f'.repeat(64),
    });

    await expect(control.assertPrerequisites('mission-spine-onboarding'))
      .rejects.toThrow(/capabilit/i);
  });

  it.each(['deterministic-oauth', 'analytics-spy'])(
    'fails closed when required capability %s is missing',
    async (missingCapability) => {
      const candidateSpecSha256 = 'c'.repeat(64);
      const request = {
        async get() {
          return {
            ok: () => true,
            json: async () => ({
              schema_version: 'mission-spine.staging-control.v1',
              candidate_spec_sha256: candidateSpecSha256,
              ready: true,
              capabilities: REQUIRED_CAPABILITIES['mission-spine-onboarding']
                .filter((capability) => capability !== missingCapability),
            }),
          };
        },
      };
      const control = new StagingControl({
        request,
        origin: 'https://release-control.staging.leva.ai.kr',
        credential: 'not-for-evidence',
        candidateSpecSha256,
      });

      await expect(control.assertPrerequisites('mission-spine-onboarding'))
        .rejects.toThrow(/capabilit/i);
    },
  );

  it('rejects a staging response bound to any other candidate-spec', async () => {
    const request = {
      async get() {
        return {
          ok: () => true,
          json: async () => ({
            schema_version: 'mission-spine.staging-control.v1',
            candidate_spec_sha256: 'd'.repeat(64),
            ready: true,
            capabilities: [...REQUIRED_CAPABILITIES['mission-spine-workspace']],
          }),
        };
      },
    };
    const control = new StagingControl({
      request,
      origin: 'https://release-control.staging.leva.ai.kr',
      credential: 'not-for-evidence',
      candidateSpecSha256: 'e'.repeat(64),
    });

    await expect(control.assertPrerequisites('mission-spine-workspace'))
      .rejects.toThrow(/pin mismatch/i);
  });

  it('binds the run only to canonical browser origins', async () => {
    const candidateSpecSha256 = 'e'.repeat(64);
    const control = new StagingControl({
      request: { async get() {} },
      origin: 'https://release-control.staging.leva.ai.kr',
      credential: 'not-for-evidence',
      candidateSpecSha256,
    });
    let pausedHandler;
    let closed = false;
    const sent = [];
    const session = {
      on(event, handler) {
        expect(event).toBe('Fetch.requestPaused');
        pausedHandler = handler;
      },
      async send(method, parameters) {
        sent.push({ method, parameters });
      },
    };
    const browserContext = {
      async newCDPSession(target) {
        expect(target).toBe(page);
        return session;
      },
    };
    const page = {
      context: () => browserContext,
      addInitScript: vi.fn(async () => {}),
      async close(options) {
        expect(options).toEqual({ runBeforeUnload: false });
        closed = true;
      },
    };
    await control.bindBrowserRun(page, 'A'.repeat(22), {
      landingOrigin: 'https://leva.ai.kr',
      appOrigin: 'https://app.leva.ai.kr',
      apiOrigin: 'https://api.leva.ai.kr',
      oauthOrigin: 'https://oauth.staging.leva.ai.kr',
      analyticsSpyOrigin: 'https://analytics-spy.staging.leva.ai.kr',
    });

    expect(sent).toEqual([{
      method: 'Fetch.enable',
      parameters: { patterns: [{ urlPattern: '*', requestStage: 'Request' }] },
    }]);
    expect(page.addInitScript).toHaveBeenCalledOnce();
    const [initScript, initConfig] = page.addInitScript.mock.calls[0];
    expect(typeof initScript).toBe('function');
    expect(initConfig).toEqual({
      productOrigins: ['https://leva.ai.kr', 'https://app.leva.ai.kr'],
      marker: {
        schema_version: 'mission-spine.release-analytics.v1',
        permission_url: 'https://api.leva.ai.kr/v1/release/browser/analytics-permission',
        capture_url: 'https://analytics-spy.staging.leva.ai.kr/v1/release/browser/analytics-events',
      },
    });
    const pausedRequest = (requestId, url, redirectedRequestId) => ({
      requestId,
      request: { url, headers: { accept: 'text/html' } },
      ...(redirectedRequestId ? { redirectedRequestId } : {}),
    });
    await pausedHandler(pausedRequest('allowed-app', 'https://app.leva.ai.kr/dashboard'));
    await pausedHandler(pausedRequest('allowed-api', 'https://api.leva.ai.kr/auth/refresh'));
    await pausedHandler(pausedRequest('external', 'https://fonts.example.net/font.woff2'));

    for (const allowedContinue of sent.slice(1, 3)) {
      expect(allowedContinue.method).toBe('Fetch.continueRequest');
      expect(Object.fromEntries(allowedContinue.parameters.headers.map(({ name, value }) => [
        name.toLowerCase(), value,
      ]))).toMatchObject({
        accept: 'text/html',
        'x-candidate-spec-sha256': candidateSpecSha256,
        'x-release-run-key': 'A'.repeat(22),
      });
    }
    expect(sent[3]).toEqual({
      method: 'Fetch.continueRequest',
      parameters: { requestId: 'external' },
    });

    await pausedHandler(pausedRequest(
      'redirect-target',
      'https://fonts.example.net/redirected.woff2',
      'allowed-app',
    ));
    expect(sent[4]).toEqual({
      method: 'Fetch.failRequest',
      parameters: { requestId: 'redirect-target', errorReason: 'BlockedByClient' },
    });
    expect(closed).toBe(true);
  });

  it('does not close the page when Chromium cancels an intercepted request', async () => {
    const candidateSpecSha256 = 'e'.repeat(64);
    const control = new StagingControl({
      request: { async get() {} },
      origin: 'https://release-control.staging.leva.ai.kr',
      credential: 'not-for-evidence',
      candidateSpecSha256,
    });
    let pausedHandler;
    const sent = [];
    const session = {
      on(_event, handler) {
        pausedHandler = handler;
      },
      async send(method, parameters) {
        sent.push({ method, parameters });
        if (method === 'Fetch.continueRequest') {
          throw new Error(
            'cdpSession.send: Protocol error (Fetch.continueRequest): Invalid InterceptionId.',
          );
        }
      },
    };
    let closed = false;
    const page = {
      context: () => ({ newCDPSession: async () => session }),
      addInitScript: vi.fn(async () => {}),
      close: vi.fn(async () => { closed = true; }),
    };
    await control.bindBrowserRun(page, 'A'.repeat(22), {
      landingOrigin: 'https://leva.ai.kr',
      appOrigin: 'https://app.leva.ai.kr',
      apiOrigin: 'https://api.leva.ai.kr',
      oauthOrigin: 'https://oauth.staging.leva.ai.kr',
      analyticsSpyOrigin: 'https://analytics-spy.staging.leva.ai.kr',
    });

    await pausedHandler({
      requestId: 'canceled',
      request: { url: 'https://leva.ai.kr/app.js', headers: {} },
    });

    expect(closed).toBe(false);
    expect(sent.map(({ method }) => method)).toEqual([
      'Fetch.enable',
      'Fetch.continueRequest',
    ]);
  });

  it('binds review failure away from the recovered prior session before the truncated rerun', () => {
    const source = readFileSync(root('e2e/release/mission-spine-workspace.spec.js'), 'utf8');
    const start = source.indexOf("step: 'immediate-disconnect-timeout-recovery'");
    const end = source.indexOf("step: 'private-context-preview-commit'", start);
    const reviewStep = source.slice(start, end);
    const orderedOperations = [
      "'owner-recovery-timed-out'",
      'priorSandboxSessionId',
      "'next-run-midstream-disconnect'",
      "'fail-next-review'",
      'prior_sandbox_session_id:',
      'previousSessionValues',
      "request.method() === 'POST'",
      "'midstream-disconnect-completed'",
      "step: 'outbox-review-durable'",
      "'partial-review-retains-run-and-review'",
      "'clear-faults'",
      'retryReviewInBrowser(page)',
      "'kafka-outbox-review-correlated'",
    ];
    let cursor = 0;
    const positions = orderedOperations.map((operation) => {
      const position = reviewStep.indexOf(operation, cursor);
      if (position >= 0) cursor = position + operation.length;
      return position;
    });

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(source).not.toMatch(/async function triggerReviewProducingRun/);
    expect(source).toMatch(
      /async function retryReviewInBrowser[\s\S]*getByRole\('button', \{ name: '다시 시도'/,
    );
    expect(source).toMatch(
      /finally \{[\s\S]*control\.command\(JOURNEY, prepared\.runKey, 'clear-faults'\)[\s\S]*evidence\.close\(\)/,
    );
  });

  it('accepts only an exact ordered, deduplicated analytics allowlist', () => {
    const common = {
      contract_version: 'mission-spine.analytics.v1',
      occurred_at: '2026-08-16T00:00:00.000Z',
      environment: 'production',
      app_version: 'b8ccff1f662f4a46b292486d99f4928faf19649c',
      session_id: 'AQIDBAUGBwgJCgsMDQ4PEA',
      journey_id: 'EREREREREREREREREREREQ',
    };
    const entry = (event, properties) => ({
      event,
      properties: { ...common, ...properties },
    });
    const events = [
      entry('landing_viewed', { page_view_id: 'ISEhISEhISEhISEhISEhIQ' }),
      entry('landing_diagnostic_cta_clicked', {
        page_view_id: 'ISEhISEhISEhISEhISEhIQ', cta_location: 'hero',
      }),
      entry('diagnostic_started', {
        track: 'BACKEND_SPRING', guest_id: '123e4567-e89b-42d3-a456-426614174000',
      }),
      entry('diagnostic_completed', {
        assessment_id: 11, diagnosed_level: 'MID', duration_ms: 12_000,
      }),
      entry('result_claimed', {
        guest_id: '123e4567-e89b-42d3-a456-426614174000', assessment_id: 11,
        user_id: '101', claim_outcome: 'new_path_eligible',
      }),
      entry('path_generated', { path_id: 21, assessment_id: 11, user_id: '101' }),
      entry('path_first_viewed', {
        user_id: '101', path_id: 21,
        originating_session_id: 'AQIDBAUGBwgJCgsMDQ4PEA',
      }),
      entry('first_mission_started', {
        user_id: '101', path_id: 21, week_num: 1, task_id: 31, first_open: true,
      }),
    ];
    expect(() => assertAnalyticsSequence(events, events.map((entry) => entry.event)))
      .not.toThrow();
    expect(() => assertAnalyticsSequence([...events, events.at(-1)], events.map((entry) => entry.event)))
      .toThrow(/duplicate/i);
    expect(() => assertAnalyticsSequence([
      ...events.slice(0, -1),
      entry('first_mission_started', {
        user_id: '101', path_id: 21, week_num: 1, task_id: 31,
        first_open: true, prompt: 'forbidden',
      }),
    ], events.map((entry) => entry.event))).toThrow(/banned/i);
    expect(() => assertAnalyticsSequence([
      ...events.slice(0, -1),
      entry('first_mission_started', {
        user_id: '101', path_id: 21, week_num: 1, task_id: 31,
        first_open: true, invented: 'not-allowlisted',
      }),
    ], events.map((item) => item.event))).toThrow(/contract/i);
  });
});

describe('sanitized evidence contract', () => {
  it('writes only route, step, result, duration, and candidate-spec SHA', () => {
    const directory = temporaryDirectory();
    const candidateSpecSha256 = 'a'.repeat(64);
    const evidence = new SanitizedEvidence({
      directory,
      journey: 'mission-spine-onboarding',
      candidateSpecSha256,
    });
    evidence.record({
      route: '/diagnostic',
      step: 'guest-preview',
      result: 'passed',
      durationMs: 42,
    });
    evidence.close();

    expect(readdirSync(directory)).toEqual(['mission-spine-onboarding']);
    const journeyDirectory = join(directory, 'mission-spine-onboarding');
    expect(readdirSync(journeyDirectory)).toEqual(['evidence.json']);
    const rows = JSON.parse(readFileSync(join(journeyDirectory, 'evidence.json'), 'utf8'));
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0])).toEqual([
      'route',
      'step',
      'result',
      'duration_ms',
      'candidate_spec_sha256',
    ]);
    expect(rows[0]).toEqual({
      route: '/diagnostic',
      step: 'guest-preview',
      result: 'passed',
      duration_ms: 42,
      candidate_spec_sha256: candidateSpecSha256,
    });
  });

  it('removes query and fragment data from observed URLs', () => {
    expect(evidenceRoute('https://app.leva.ai.kr/diagnostic?journeyId=secret#preview'))
      .toBe('/diagnostic');
    expect(evidenceRoute('about:blank')).toBe('/');
    expect(evidenceRoute('not a URL')).toBe('/');
  });

  it.each([
    { route: '/diagnostic?token=secret', step: 'preview', result: 'passed', durationMs: 1 },
    { route: '/diagnostic', step: 'raw prompt', result: 'passed', durationMs: 1 },
    { route: '/diagnostic', step: 'preview', result: 'skipped', durationMs: 1 },
    { route: '/diagnostic', step: 'preview', result: 'passed', durationMs: -1 },
  ])('rejects unsafe evidence row %#', (row) => {
    const directory = temporaryDirectory();
    const evidence = new SanitizedEvidence({
      directory,
      journey: 'mission-spine-onboarding',
      candidateSpecSha256: 'b'.repeat(64),
    });
    expect(() => evidence.record(row)).toThrow();
    evidence.close();
  });
});

describe('release suite topology and CI isolation', () => {
  it('contains exactly the two approved cross-service specs with no skip path', () => {
    const specDirectory = root('e2e/release');
    const specs = readdirSync(specDirectory)
      .filter((name) => name.endsWith('.spec.js'))
      .sort();
    expect(specs).toEqual([
      'mission-spine-onboarding.spec.js',
      'mission-spine-workspace.spec.js',
    ]);
    for (const spec of specs) {
      const source = readFileSync(join(specDirectory, spec), 'utf8');
      expect(source).not.toMatch(/\b(?:test|describe)\.(?:skip|fixme)\b/);
      expect(source).toContain('assertLiveReleaseContext');
      expect(source).toContain('activateFlutterSemantics');
      expect(source).toContain('candidateSpecSha256: context.candidateSpecSha256');
      expect(source).not.toContain('manifestSha256');
    }
  });

  it('disables sensitive Playwright artifacts and keeps TLS verification on', () => {
    const config = readFileSync(root('playwright.release.config.js'), 'utf8');
    const transport = readFileSync(
      root('e2e/release/support/staging-control.js'),
      'utf8',
    );
    expect(config).toContain("trace: 'off'");
    expect(config).toContain("screenshot: 'off'");
    expect(config).toContain("video: 'off'");
    expect(config).toContain('ignoreHTTPSErrors: false');
    expect(config).toContain('--host-resolver-rules=');
    expect(config).not.toContain('webServer:');
    expect(transport).toContain("session.send('Fetch.continueRequest'");
    expect(transport).not.toContain('route.fetch(');
    expect(transport).not.toContain('route.continue(');
  });

  it('keeps credentialed release specs out of the ordinary source/dist suite', () => {
    const ordinaryConfig = readFileSync(root('playwright.config.js'), 'utf8');
    expect(ordinaryConfig).toContain("testIgnore: '**/release/**'");
  });

  it('lists but never executes live release journeys in Home PR CI', () => {
    const workflow = readFileSync(root('.github/workflows/ci.yml'), 'utf8');
    const packageJson = JSON.parse(readFileSync(root('package.json'), 'utf8'));
    expect(packageJson.scripts['test:release']).toBe(
      'playwright test --config=playwright.release.config.js',
    );
    expect(packageJson.scripts['test:release:list']).toBe(
      'playwright test --config=playwright.release.config.js --list',
    );
    expect(workflow).toContain('npm run test:release:list');
    expect(workflow).not.toContain('npm run test:release\n');
    expect(workflow).not.toContain('MISSION_RELEASE_CONTROL_TOKEN');
    expect(workflow).not.toContain('MISSION_CANDIDATE_SPEC_PATH');
  });
});
