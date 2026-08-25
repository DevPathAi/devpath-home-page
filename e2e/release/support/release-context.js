import { createHash } from 'node:crypto';
import {
  readFileSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { isIP } from 'node:net';
import { isAbsolute, resolve } from 'node:path';

const ANALYTICS_CONTRACT = 'mission-spine.analytics.v1';
const FLAG_CONTRACT = 'mission-spine.flag.v1';
const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const IMAGE_DIGEST = /^sha256:[0-9a-f]{64}$/;
const RELEASE_ID = /^ms-[0-9]{8}-[a-z0-9][a-z0-9-]{2,40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{1,127}$/;
const WEB_TAG = /^[0-9a-f]{40}(?:-mission-(?:off|on))?$/;
const JSON_PATH = /^[A-Za-z0-9_./-]+\.json$/;
const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]{2,63}$/;

const CANDIDATE_TOP_LEVEL = Object.freeze([
  '$schema',
  'schema_version',
  'document_type',
  'release_id',
  'created_at',
  'gitops',
  'services',
  'shared_migration',
  'frontend',
  'home',
  'analytics_privacy',
  'ai_release_eval_config',
  'environments',
  'journey_harness',
  'quality_evidence_inputs',
  'rollout',
]);

const REQUIRED_SERVICES = Object.freeze([
  'devpath-admin',
  'devpath-ai-svc',
  'devpath-community-svc',
  'devpath-gateway',
  'devpath-lcs-svc',
  'devpath-learning-svc',
  'devpath-notification-svc',
  'devpath-platform-svc',
  'devpath-sandbox-svc',
]);

const PRODUCTION_ORDER = Object.freeze([
  'shared-migration',
  'additive-services',
  'frontend-mission-off',
  'compatibility-smoke',
  'frontend-mission-on',
  'canary',
  'landing-last',
]);

const ROLLBACK_ORDER = Object.freeze([
  'landing-prior',
  'frontend-mission-off',
  'frontend-prior',
  'retain-additive-services-and-schema',
]);

const PROJECTION_FIXTURE_IDS = Object.freeze([
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
]);

const FORBIDDEN_CANDIDATE_KEYS = new Set([
  'answers',
  'code',
  'diagnostic_answers',
  'email',
  'error',
  'error_text',
  'guest_token',
  'output',
  'prompt',
  'prompt_text',
  'raw',
  'raw_code',
  'raw_error',
  'raw_output',
  'snapshot',
  'snapshot_content',
  'token',
  'user_content',
]);

function required(environment, name) {
  const value = environment[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required for a live release journey`);
  }
  return value.trim();
}

function object(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value;
}

function exactKeys(value, keys, path) {
  const actual = Object.keys(object(value, path)).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${path} fields do not match the canonical candidate-spec`);
  }
  return value;
}

function exactString(value, path, pattern) {
  if (typeof value !== 'string' || value === '' || !pattern.test(value)) {
    throw new Error(`${path} is invalid`);
  }
  return value;
}

function positiveInteger(value, path, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${path} must be a bounded positive integer`);
  }
  return value;
}

function exactText(value, path, maximum = 300) {
  if (
    typeof value !== 'string'
    || value.trim() !== value
    || value.length === 0
    || value.length > maximum
    || /\r|\n/.test(value)
  ) {
    throw new Error(`${path} must be bounded single-line text`);
  }
  return value;
}

function exactStringArray(value, path) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${path} must be a non-empty array`);
  }
  const entries = value.map((entry, index) => exactText(entry, `${path}[${index}]`));
  if (new Set(entries).size !== entries.length) {
    throw new Error(`${path} entries must be unique`);
  }
  return entries;
}

function canonicalTimestamp(value, path) {
  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)
    || Number.isNaN(Date.parse(value))
  ) {
    throw new Error(`${path} must be an ISO-8601 UTC timestamp`);
  }
  return value;
}

function assertSanitizedCandidate(value, path = 'candidate-spec') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSanitizedCandidate(entry, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_CANDIDATE_KEYS.has(key.toLowerCase().replaceAll('-', '_'))) {
        throw new Error(`${path}.${key} is forbidden in a candidate-spec`);
      }
      assertSanitizedCandidate(nested, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === 'string') {
    if (/\r|\n/.test(value) || /^(?:data|file|javascript):/i.test(value)) {
      throw new Error(`${path} contains an embedded or multiline payload`);
    }
  }
}

function tlsOrigin(value, path) {
  if (typeof value !== 'string') throw new Error(`${path} must be a URL`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${path} must be a URL`);
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`${path} must use credential-free TLS`);
  }
  if (url.pathname !== '/' || url.search || url.hash || value !== url.origin) {
    throw new Error(`${path} must be an HTTPS origin without a path`);
  }
  return url.origin;
}

function safeDnsAddress(address, path) {
  const version = typeof address === 'string' ? isIP(address) : 0;
  if (version === 0 || address.includes('%')) {
    throw new Error(`${path} must be a literal staging ingress IP address`);
  }
  if (version === 4) {
    const octets = address.split('.').map(Number);
    if (
      octets[0] === 0
      || octets[0] === 127
      || octets[0] >= 224
      || (octets[0] === 169 && octets[1] === 254)
    ) {
      throw new Error(`${path} cannot resolve to loopback, wildcard, link-local, or multicast`);
    }
    return address;
  }
  const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1).toLowerCase();
  if (
    normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('::ffff:')
    || /^fe[89ab]/.test(normalized)
    || normalized.startsWith('ff')
  ) {
    throw new Error(`${path} cannot resolve to loopback, wildcard, link-local, or multicast`);
  }
  return normalized;
}

function dnsOverrides(value, expectedHosts) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error('journey_harness.dns_overrides must contain exactly two entries');
  }
  const normalized = {};
  value.forEach((entry, index) => {
    const path = `journey_harness.dns_overrides[${index}]`;
    exactKeys(entry, ['hostname', 'address'], path);
    const hostname = exactString(entry.hostname, `${path}.hostname`, HOSTNAME);
    if (normalized[hostname]) throw new Error('DNS override hostnames must be unique');
    normalized[hostname] = safeDnsAddress(entry.address, `${path}.address`);
  });
  const actualHosts = Object.keys(normalized).sort();
  const canonicalHosts = [...expectedHosts].sort();
  if (
    actualHosts.length !== canonicalHosts.length
    || actualHosts.some((hostname, index) => hostname !== canonicalHosts[index])
  ) {
    throw new Error('DNS overrides must cover exactly the canonical production hostnames');
  }
  return Object.freeze(normalized);
}

function hostResolverRules(overrides) {
  return Object.entries(overrides)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([hostname, address]) => (
      `MAP ${hostname} ${isIP(address) === 6 ? `[${address}]` : address}`
    ))
    .join(',');
}

function validateComponent(value, name) {
  const path = `services.${name}`;
  exactKeys(value, ['repository', 'source_sha', 'image_repository', 'image_digest'], path);
  exactString(value.repository, `${path}.repository`, REPOSITORY);
  exactString(value.source_sha, `${path}.source_sha`, SHA40);
  if (value.image_repository !== `ghcr.io/devpathai/${name}`) {
    throw new Error(`${path}.image_repository is not canonical`);
  }
  exactString(value.image_digest, `${path}.image_digest`, IMAGE_DIGEST);
}

function validateServices(value) {
  exactKeys(value, REQUIRED_SERVICES, 'services');
  REQUIRED_SERVICES.forEach((name) => validateComponent(value[name], name));
}

function validateMigration(value) {
  exactKeys(value, [
    'repository',
    'source_sha',
    'shared_version',
    'shared_jar_sha256',
    'image_repository',
    'image_digest',
    'flyway_target',
    'required_migration',
    'rollback_policy',
  ], 'shared_migration');
  if (
    value.repository !== 'DevPathAi/devpath-shared'
    || value.shared_version !== '0.0.1-et11.20260822'
    || value.image_repository !== 'ghcr.io/devpathai/devpath-migration'
    || value.flyway_target !== '202608221001'
    || value.required_migration !== 'V202608221001__correct_question_bank_accuracy.sql'
    || value.rollback_policy !== 'additive-retained'
  ) {
    throw new Error('shared_migration does not match the canonical additive migration');
  }
  exactString(value.source_sha, 'shared_migration.source_sha', SHA40);
  exactString(value.shared_jar_sha256, 'shared_migration.shared_jar_sha256', SHA256);
  exactString(value.image_digest, 'shared_migration.image_digest', IMAGE_DIGEST);
}

function validatePriorIdentity(value, priorDigest) {
  exactKeys(
    value,
    ['ready', 'release_id', 'candidate_spec_sha256', 'image_digest'],
    'frontend.rollback.prior_identity',
  );
  if (typeof value.ready !== 'boolean') {
    throw new Error('frontend.rollback.prior_identity.ready must be boolean');
  }
  exactString(
    value.candidate_spec_sha256,
    'frontend.rollback.prior_identity.candidate_spec_sha256',
    SHA256,
  );
  exactString(value.image_digest, 'frontend.rollback.prior_identity.image_digest', IMAGE_DIGEST);
  if (!value.ready) {
    if (
      value.release_id !== 'unreleased'
      || value.candidate_spec_sha256 !== '0'.repeat(64)
      || value.image_digest !== `sha256:${'0'.repeat(64)}`
    ) {
      throw new Error('unreleased frontend prior identity must use canonical placeholders');
    }
    return;
  }
  exactString(value.release_id, 'frontend.rollback.prior_identity.release_id', RELEASE_ID);
  if (
    value.candidate_spec_sha256 === '0'.repeat(64)
    || value.image_digest === `sha256:${'0'.repeat(64)}`
    || value.image_digest !== priorDigest
  ) {
    throw new Error('ready frontend prior identity must bind the GitOps base digest');
  }
}

function validateFrontend(value, gitopsBaseDigest, releaseId) {
  exactKeys(value, [
    'repository',
    'source_sha',
    'app_version',
    'analytics_contract_version',
    'flag_contract_version',
    'mission_off',
    'mission_on',
    'selected_on_digest',
    'rollback',
  ], 'frontend');
  if (value.repository !== 'DevPathAi/devpath-frontend') {
    throw new Error('frontend.repository is not canonical');
  }
  const sourceSha = exactString(value.source_sha, 'frontend.source_sha', SHA40);
  if (value.app_version !== releaseId) throw new Error('frontend.app_version must match release_id');
  if (value.analytics_contract_version !== ANALYTICS_CONTRACT) {
    throw new Error(`frontend.analytics_contract_version must be ${ANALYTICS_CONTRACT}`);
  }
  if (value.flag_contract_version !== FLAG_CONTRACT) {
    throw new Error(`frontend.flag_contract_version must be ${FLAG_CONTRACT}`);
  }
  const variants = {};
  for (const [field, suffix] of [
    ['mission_off', 'mission-off'],
    ['mission_on', 'mission-on'],
  ]) {
    exactKeys(value[field], ['tag', 'image_digest'], `frontend.${field}`);
    if (value[field].tag !== `${sourceSha}-${suffix}`) {
      throw new Error(`frontend.${field}.tag does not bind the source SHA`);
    }
    variants[field] = exactString(
      value[field].image_digest,
      `frontend.${field}.image_digest`,
      IMAGE_DIGEST,
    );
  }
  if (variants.mission_off === variants.mission_on) {
    throw new Error('mission-OFF and mission-ON image digests must be distinct');
  }
  const selectedOnDigest = exactString(
    value.selected_on_digest,
    'frontend.selected_on_digest',
    IMAGE_DIGEST,
  );
  if (selectedOnDigest !== variants.mission_on) {
    throw new Error('browser journeys require the exact candidate mission-ON digest');
  }
  exactKeys(
    value.rollback,
    ['mission_off_digest', 'prior_digest', 'prior_identity', 'final_target'],
    'frontend.rollback',
  );
  if (value.rollback.mission_off_digest !== variants.mission_off) {
    throw new Error('frontend rollback OFF digest is not canonical');
  }
  const priorDigest = exactString(
    value.rollback.prior_digest,
    'frontend.rollback.prior_digest',
    IMAGE_DIGEST,
  );
  validatePriorIdentity(value.rollback.prior_identity, priorDigest);
  if (
    priorDigest !== gitopsBaseDigest
    || priorDigest === variants.mission_off
    || priorDigest === variants.mission_on
    || value.rollback.final_target !== 'prior'
  ) {
    throw new Error('frontend rollback target is not the distinct GitOps base digest');
  }
  return Object.freeze({
    sourceSha,
    offTag: value.mission_off.tag,
    onTag: value.mission_on.tag,
    offDigest: variants.mission_off,
    onDigest: variants.mission_on,
    selectedOnDigest,
    priorDigest,
  });
}

function validateHome(value) {
  exactKeys(value, [
    'repository',
    'source_sha',
    'dist_sha256',
    'cloudflare_account_id',
    'cloudflare_project',
    'candidate_deployment_id',
    'prior_production_deployment_id',
  ], 'home');
  if (value.repository !== 'DevPathAi/devpath-home-page') {
    throw new Error('home.repository is not canonical');
  }
  const homeSha = exactString(value.source_sha, 'home.source_sha', SHA40);
  exactString(value.dist_sha256, 'home.dist_sha256', SHA256);
  exactString(value.cloudflare_account_id, 'home.cloudflare_account_id', /^[0-9a-f]{32}$/);
  exactString(value.cloudflare_project, 'home.cloudflare_project', SAFE_IDENTIFIER);
  exactString(value.candidate_deployment_id, 'home.candidate_deployment_id', /^[0-9a-f-]{16,64}$/);
  exactString(
    value.prior_production_deployment_id,
    'home.prior_production_deployment_id',
    /^[0-9a-f-]{16,64}$/,
  );
  if (value.candidate_deployment_id === value.prior_production_deployment_id) {
    throw new Error('Home candidate and prior deployment IDs must be distinct');
  }
  return homeSha;
}

function validatePrivacy(value) {
  exactKeys(value, [
    'collection_mode',
    'approval_source_sha',
    'region',
    'project_identity',
    'retention_days',
    'access_owner',
    'deletion_runbook',
  ], 'analytics_privacy');
  if (!['explicit-consent', 'approved-cookieless'].includes(value.collection_mode)) {
    throw new Error('analytics privacy collection mode is not approved');
  }
  exactString(value.approval_source_sha, 'analytics_privacy.approval_source_sha', SHA40);
  if (value.region !== 'EU') throw new Error('analytics privacy region must be EU');
  for (const field of ['project_identity', 'access_owner', 'deletion_runbook']) {
    exactString(value[field], `analytics_privacy.${field}`, SAFE_IDENTIFIER);
  }
  positiveInteger(value.retention_days, 'analytics_privacy.retention_days', 365);
}

function validateAiReleaseConfig(value) {
  exactKeys(value, [
    'primary_model',
    'fallback_models',
    'prompt_sha256',
    'fixture_revision',
    'fixture_sha256',
    'rendered_config_sha256',
    'ollama_endpoint_sha256',
  ], 'ai_release_eval_config');
  const primary = exactString(value.primary_model, 'ai_release_eval_config.primary_model', SAFE_IDENTIFIER);
  if (!Array.isArray(value.fallback_models) || value.fallback_models.length === 0) {
    throw new Error('ai_release_eval_config.fallback_models is required');
  }
  const fallbacks = value.fallback_models.map((model, index) => (
    exactString(model, `ai_release_eval_config.fallback_models[${index}]`, SAFE_IDENTIFIER)
  ));
  if (new Set(fallbacks).size !== fallbacks.length || fallbacks.includes(primary)) {
    throw new Error('AI fallback models must be unique and distinct from primary');
  }
  exactString(value.prompt_sha256, 'ai_release_eval_config.prompt_sha256', SHA256);
  exactString(value.fixture_revision, 'ai_release_eval_config.fixture_revision', SAFE_IDENTIFIER);
  exactString(value.fixture_sha256, 'ai_release_eval_config.fixture_sha256', SHA256);
  exactString(
    value.rendered_config_sha256,
    'ai_release_eval_config.rendered_config_sha256',
    SHA256,
  );
  exactString(
    value.ollama_endpoint_sha256,
    'ai_release_eval_config.ollama_endpoint_sha256',
    SHA256,
  );
}

function validateEnvironment(value, path) {
  exactKeys(value, [
    'github_environment',
    'kubernetes_context',
    'namespace',
    'web_deployment',
    'web_container',
    'web_origin',
    'landing_origin',
  ], path);
  for (const field of [
    'github_environment',
    'kubernetes_context',
    'namespace',
    'web_deployment',
    'web_container',
  ]) {
    exactString(value[field], `${path}.${field}`, SAFE_IDENTIFIER);
  }
  return Object.freeze({
    ...value,
    web_origin: tlsOrigin(value.web_origin, `${path}.web_origin`),
    landing_origin: tlsOrigin(value.landing_origin, `${path}.landing_origin`),
  });
}

function validateEnvironments(value) {
  exactKeys(value, ['staging', 'production'], 'environments');
  const staging = validateEnvironment(value.staging, 'environments.staging');
  const production = validateEnvironment(value.production, 'environments.production');
  for (const field of [
    'github_environment',
    'kubernetes_context',
    'web_origin',
    'landing_origin',
  ]) {
    if (staging[field] === production[field]) {
      throw new Error(`staging and production ${field} must be distinct`);
    }
  }
  return Object.freeze({ staging, production });
}

function validateJourneyHarness(value, environments) {
  exactKeys(value, [
    'landing_origin',
    'app_origin',
    'api_origin',
    'control_origin',
    'oauth_origin',
    'analytics_spy_origin',
    'dns_overrides',
  ], 'journey_harness');
  const origins = {
    landingOrigin: tlsOrigin(value.landing_origin, 'journey_harness.landing_origin'),
    appOrigin: tlsOrigin(value.app_origin, 'journey_harness.app_origin'),
    apiOrigin: tlsOrigin(value.api_origin, 'journey_harness.api_origin'),
    controlOrigin: tlsOrigin(value.control_origin, 'journey_harness.control_origin'),
    oauthOrigin: tlsOrigin(value.oauth_origin, 'journey_harness.oauth_origin'),
    analyticsSpyOrigin: tlsOrigin(
      value.analytics_spy_origin,
      'journey_harness.analytics_spy_origin',
    ),
  };
  if (
    origins.landingOrigin !== environments.production.landing_origin
    || origins.appOrigin !== environments.production.web_origin
  ) {
    throw new Error('journey harness must use the canonical production origins');
  }
  if (new Set(Object.values(origins)).size !== Object.keys(origins).length) {
    throw new Error('journey harness origins must be distinct');
  }
  const expectedHosts = new Set([
    new URL(origins.landingOrigin).hostname,
    new URL(origins.appOrigin).hostname,
  ]);
  if (expectedHosts.size !== 2) {
    throw new Error('canonical Landing and app hostnames must be distinct');
  }
  const overrides = dnsOverrides(value.dns_overrides, expectedHosts);
  return Object.freeze({
    ...origins,
    dnsOverrides: overrides,
    chromiumHostResolverRules: hostResolverRules(overrides),
  });
}

function validateFixtureIds(value, path) {
  if (JSON.stringify(value) !== JSON.stringify(PROJECTION_FIXTURE_IDS)) {
    throw new Error(`${path} must match the canonical projection fixtures`);
  }
}

function validateSurfaceCounts(value, expected, path) {
  exactKeys(value, ['web', 'admin', 'mobile', 'dp_design'], path);
  if (JSON.stringify(value) !== JSON.stringify(expected)) {
    throw new Error(`${path} must match the canonical surface counts`);
  }
}

function validateFrontendCatalog(value, path, frontendSha, options) {
  const commonKeys = [
    'repository',
    'source_sha',
    'path',
    'sha256',
    'case_catalog_version',
    'case_catalog_schema_version',
    'projection_contract_sha256',
    'fixture_ids',
    'case_count',
    'surface_case_counts',
    'capture_surface',
    'device_evidence',
    'evidence_mode',
    'input_provenance_sha256',
    'input_provenance_file_sha256',
  ];
  exactKeys(value, options.visual
    ? [...commonKeys, 'baseline_status', 'baseline_set_sha256', 'baseline_approval_sha256']
    : commonKeys, path);
  if (
    value.repository !== 'DevPathAi/devpath-frontend'
    || value.source_sha !== frontendSha
    || value.path !== options.path
    || value.case_catalog_version !== 'leva.et13.catalog.v1'
    || value.case_catalog_schema_version !== options.schema
    || value.case_count !== options.caseCount
    || value.capture_surface !== 'flutter_web_release_projection'
    || value.device_evidence !== false
    || value.evidence_mode !== 'release_ready'
  ) {
    throw new Error(`${path} does not match the canonical frontend evidence catalog`);
  }
  for (const field of [
    'sha256',
    'projection_contract_sha256',
    'input_provenance_sha256',
    'input_provenance_file_sha256',
  ]) {
    exactString(value[field], `${path}.${field}`, SHA256);
  }
  validateFixtureIds(value.fixture_ids, `${path}.fixture_ids`);
  validateSurfaceCounts(value.surface_case_counts, options.surfaceCounts, `${path}.surface_case_counts`);
  if (options.visual) {
    if (value.baseline_status !== 'approved') {
      throw new Error(`${path}.baseline_status must be approved`);
    }
    exactString(value.baseline_set_sha256, `${path}.baseline_set_sha256`, SHA256);
    exactString(value.baseline_approval_sha256, `${path}.baseline_approval_sha256`, SHA256);
  }
  return value.projection_contract_sha256;
}

function validateHomeCatalog(value, path, homeSha, expectedCaseCount) {
  exactKeys(value, [
    'repository',
    'source_sha',
    'rendered_product_sha',
    'rendered_product_tree_sha256',
    'path',
    'sha256',
    'case_count',
    'provenance_sha256',
    'font_manifest_sha256',
  ], path);
  if (
    value.repository !== 'DevPathAi/devpath-home-page'
    || value.source_sha !== homeSha
    || value.path !== 'e2e/visual/case-catalog.v2.json'
    || value.case_count !== expectedCaseCount
  ) {
    throw new Error(`${path} does not bind the canonical Home evidence catalog`);
  }
  exactString(value.rendered_product_sha, `${path}.rendered_product_sha`, SHA40);
  for (const field of [
    'rendered_product_tree_sha256',
    'sha256',
    'provenance_sha256',
    'font_manifest_sha256',
  ]) {
    exactString(value[field], `${path}.${field}`, SHA256);
  }
}

function validateManualCatalog(value, path, frontendSha, expectedPath, expectedCaseCount) {
  exactKeys(value, [
    'repository',
    'source_sha',
    'path',
    'sha256',
    'case_count',
    'provenance_sha256',
  ], path);
  if (
    value.repository !== 'DevPathAi/devpath-frontend'
    || value.source_sha !== frontendSha
    || value.path !== expectedPath
    || value.case_count !== expectedCaseCount
  ) {
    throw new Error(`${path} does not bind the canonical manual evidence catalog`);
  }
  exactString(value.sha256, `${path}.sha256`, SHA256);
  exactString(value.provenance_sha256, `${path}.provenance_sha256`, SHA256);
}

function validateProjectionContract(value, expectedSha256) {
  const path = 'quality_evidence_inputs.frontend_projection_contract';
  exactKeys(value, ['schema_version', 'projection_contract_sha256', 'projection_matrix'], path);
  if (
    value.schema_version !== 'leva.et13.projection-contract.v1'
    || value.projection_contract_sha256 !== expectedSha256
  ) {
    throw new Error(`${path} does not match the bound frontend evidence catalogs`);
  }
  if (!Array.isArray(value.projection_matrix)) {
    throw new Error(`${path}.projection_matrix must be an array`);
  }
  const fixtureIds = value.projection_matrix.map((entry, index) => {
    const entryPath = `${path}.projection_matrix[${index}]`;
    exactKeys(entry, ['fixture_id', 'capture_scope', 'source_widget', 'substitutions'], entryPath);
    exactString(entry.fixture_id, `${entryPath}.fixture_id`, SAFE_IDENTIFIER);
    exactString(entry.capture_scope, `${entryPath}.capture_scope`, SAFE_IDENTIFIER);
    exactString(entry.source_widget, `${entryPath}.source_widget`, SAFE_IDENTIFIER);
    exactStringArray(entry.substitutions, `${entryPath}.substitutions`);
    return entry.fixture_id;
  });
  validateFixtureIds(fixtureIds, `${path}.projection_matrix fixture IDs`);
}

function validateMobileArtifacts(value, frontendSha) {
  const path = 'quality_evidence_inputs.mobile_test_artifacts';
  exactKeys(value, [
    'schema_version',
    'repository',
    'source_sha',
    'event',
    'workflow_path',
    'workflow_sha256',
    'workflow_run_id',
    'run_attempt',
    'artifact_id',
    'artifact_name',
    'artifact_archive_sha256',
    'build_provenance_file',
    'build_provenance_sha256',
    'signed_apk_file',
    'signed_apk_sha256',
  ], path);
  if (
    value.schema_version !== 'leva.mission-spine.signed-android-build-binding.v2'
    || value.repository !== 'DevPathAi/devpath-frontend'
    || value.source_sha !== frontendSha
    || value.event !== 'workflow_dispatch'
    || value.workflow_path !== '.github/workflows/mission-spine-signed-mobile-build.yml'
    || value.run_attempt !== 1
    || value.build_provenance_file !== 'build-provenance.v2.json'
    || value.signed_apk_file !== 'mobile/android/leva-release.apk'
  ) {
    throw new Error(`${path} does not match the canonical signed Android build binding`);
  }
  positiveInteger(value.workflow_run_id, `${path}.workflow_run_id`);
  positiveInteger(value.artifact_id, `${path}.artifact_id`);
  exactString(value.artifact_name, `${path}.artifact_name`, SAFE_IDENTIFIER);
  for (const field of [
    'workflow_sha256',
    'artifact_archive_sha256',
    'build_provenance_sha256',
    'signed_apk_sha256',
  ]) {
    exactString(value[field], `${path}.${field}`, SHA256);
  }
}

function validateQualityEvidenceInputs(value, frontendSha, homeSha) {
  const path = 'quality_evidence_inputs';
  exactKeys(value, ['catalogs', 'frontend_projection_contract', 'mobile_test_artifacts'], path);
  const catalogs = value.catalogs;
  exactKeys(catalogs, [
    'frontend-visual',
    'home-visual',
    'frontend-automated-a11y',
    'home-axe-browser-a11y',
    'manual-nvda',
    'manual-talkback',
  ], `${path}.catalogs`);
  const projectionSha256 = validateFrontendCatalog(
    catalogs['frontend-visual'],
    `${path}.catalogs.frontend-visual`,
    frontendSha,
    {
      visual: true,
      path: 'evidence/et13/generated/visual-cases.v1.json',
      schema: 'leva.et13.visual-cases.v1',
      caseCount: 96,
      surfaceCounts: { web: 48, admin: 16, mobile: 16, dp_design: 16 },
    },
  );
  const a11yProjectionSha256 = validateFrontendCatalog(
    catalogs['frontend-automated-a11y'],
    `${path}.catalogs.frontend-automated-a11y`,
    frontendSha,
    {
      visual: false,
      path: 'evidence/et13/generated/a11y-cases.v1.json',
      schema: 'leva.et13.a11y-cases.v1',
      caseCount: 24,
      surfaceCounts: { web: 12, admin: 4, mobile: 4, dp_design: 4 },
    },
  );
  if (projectionSha256 !== a11yProjectionSha256) {
    throw new Error('frontend quality catalogs must share one projection contract');
  }
  validateHomeCatalog(catalogs['home-visual'], `${path}.catalogs.home-visual`, homeSha, 4);
  validateHomeCatalog(
    catalogs['home-axe-browser-a11y'],
    `${path}.catalogs.home-axe-browser-a11y`,
    homeSha,
    11,
  );
  validateManualCatalog(
    catalogs['manual-nvda'],
    `${path}.catalogs.manual-nvda`,
    frontendSha,
    'tool/release-evidence/catalogs/manual-nvda.v1.json',
    2,
  );
  validateManualCatalog(
    catalogs['manual-talkback'],
    `${path}.catalogs.manual-talkback`,
    frontendSha,
    'tool/release-evidence/catalogs/manual-talkback.v1.json',
    4,
  );
  validateProjectionContract(value.frontend_projection_contract, projectionSha256);
  validateMobileArtifacts(value.mobile_test_artifacts, frontendSha);
}

function validateRollout(value) {
  exactKeys(value, [
    'sync_timeout_seconds',
    'canary_seconds',
    'rollback_budget_seconds',
    'synthetic_probe_path',
    'production_order',
    'rollback_order',
  ], 'rollout');
  if (
    value.sync_timeout_seconds !== 300
    || value.canary_seconds !== 900
    || value.rollback_budget_seconds !== 600
    || value.synthetic_probe_path !== '/internal/release/ready'
    || JSON.stringify(value.production_order) !== JSON.stringify(PRODUCTION_ORDER)
    || JSON.stringify(value.rollback_order) !== JSON.stringify(ROLLBACK_ORDER)
  ) {
    throw new Error('rollout order and budgets do not match the canonical candidate-spec');
  }
}

function parseCandidateSpec(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new Error('candidate-spec must be BOM-free UTF-8 JSON');
  }
  let candidate;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    candidate = JSON.parse(text);
  } catch {
    throw new Error('candidate-spec must be valid UTF-8 JSON');
  }
  exactKeys(candidate, CANDIDATE_TOP_LEVEL, 'candidate-spec');
  assertSanitizedCandidate(candidate);
  if (candidate.schema_version !== 1 || candidate.document_type !== 'candidate-spec') {
    throw new Error('browser journeys consume only canonical candidate-spec schema v1 inputs');
  }
  if (candidate.$schema !== '../schema-v1.json') {
    throw new Error('candidate-spec must use the canonical sibling schema reference');
  }
  const releaseId = exactString(candidate.release_id, 'release_id', RELEASE_ID);
  canonicalTimestamp(candidate.created_at, 'created_at');

  exactKeys(
    candidate.gitops,
    ['repository', 'base_sha', 'base_web_tag', 'base_web_digest', 'web_kustomization'],
    'gitops',
  );
  if (
    candidate.gitops.repository !== 'DevPathAi/devpath-gitops'
    || candidate.gitops.web_kustomization !== 'apps/devpath-web/base/kustomization.yaml'
  ) {
    throw new Error('candidate-spec GitOps identity is not canonical');
  }
  exactString(candidate.gitops.base_sha, 'gitops.base_sha', SHA40);
  exactString(candidate.gitops.base_web_tag, 'gitops.base_web_tag', WEB_TAG);
  const baseWebDigest = exactString(
    candidate.gitops.base_web_digest,
    'gitops.base_web_digest',
    IMAGE_DIGEST,
  );

  validateServices(candidate.services);
  validateMigration(candidate.shared_migration);
  const web = validateFrontend(candidate.frontend, baseWebDigest, releaseId);
  if (
    candidate.services['devpath-admin'].repository !== candidate.frontend.repository
    || candidate.services['devpath-admin'].source_sha !== candidate.frontend.source_sha
  ) {
    throw new Error('devpath-admin must bind the canonical frontend source');
  }
  const homeSha = validateHome(candidate.home);
  validatePrivacy(candidate.analytics_privacy);
  validateAiReleaseConfig(candidate.ai_release_eval_config);
  const environments = validateEnvironments(candidate.environments);
  const harness = validateJourneyHarness(candidate.journey_harness, environments);
  validateQualityEvidenceInputs(candidate.quality_evidence_inputs, web.sourceSha, homeSha);
  validateRollout(candidate.rollout);

  return Object.freeze({ candidate, releaseId, homeSha, web, harness });
}

export function loadReleaseContext(environment = process.env) {
  const configuredPath = required(environment, 'MISSION_CANDIDATE_SPEC_PATH');
  if (!isAbsolute(configuredPath)) {
    throw new Error('MISSION_CANDIDATE_SPEC_PATH must be absolute');
  }
  const candidateSpecPath = realpathSync(resolve(configuredPath));
  if (!statSync(candidateSpecPath).isFile()) {
    throw new Error('candidate-spec path must be a regular file');
  }
  const expectedSha256 = required(
    environment,
    'MISSION_CANDIDATE_SPEC_SHA256',
  ).toLowerCase();
  exactString(expectedSha256, 'MISSION_CANDIDATE_SPEC_SHA256', SHA256);
  const bytes = readFileSync(candidateSpecPath);
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (actualSha256 !== expectedSha256) {
    throw new Error('candidate-spec SHA256 does not match the out-of-band pin');
  }

  const parsed = parseCandidateSpec(bytes);
  const evidenceDirectory = required(environment, 'MISSION_RELEASE_EVIDENCE_DIR');
  if (!isAbsolute(evidenceDirectory)) {
    throw new Error('MISSION_RELEASE_EVIDENCE_DIR must be absolute');
  }

  return Object.freeze({
    mode: 'live',
    candidateSpec: parsed.candidate,
    candidateSpecPath,
    candidateSpecSha256: actualSha256,
    releaseId: parsed.releaseId,
    homeSha: parsed.homeSha,
    ...parsed.harness,
    controlCredential: required(environment, 'MISSION_RELEASE_CONTROL_TOKEN'),
    evidenceDirectory: resolve(evidenceDirectory),
    web: parsed.web,
  });
}

export function createListOnlyReleaseContext() {
  return Object.freeze({
    mode: 'list-only',
    candidateSpecSha256: '0'.repeat(64),
    landingOrigin: 'https://leva.ai.kr',
    appOrigin: 'https://app.leva.ai.kr',
    apiOrigin: 'https://api.leva.ai.kr',
    chromiumHostResolverRules: 'MAP app.leva.ai.kr 192.0.2.11,MAP leva.ai.kr 192.0.2.10',
  });
}

export function assertLiveReleaseContext(context) {
  if (context?.mode !== 'live') {
    throw new Error('release journeys cannot execute in list-only mode');
  }
  return context;
}
