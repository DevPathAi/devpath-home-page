import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const VISUAL_ROOT = join(ROOT, 'e2e', 'visual');
export const CANDIDATE_SPEC_PATH = join(VISUAL_ROOT, 'candidate-spec.v2.json');
export const CASE_CATALOG_PATH = join(VISUAL_ROOT, 'case-catalog.v2.json');
export const FONT_MANIFEST_PATH = join(VISUAL_ROOT, 'fonts', 'manifest.v2.json');
export const BASELINE_REVIEW_PATH = join(VISUAL_ROOT, 'baselines', 'review-metadata.v2.json');

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const SAFE_ID = /^[a-z0-9]+(?:[a-z0-9._-]*[a-z0-9])?$/;
const CASE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PNG_SIGNATURE = '89504e470d0a1a0a';
const MAX_ANCESTRY_COMMITS = 4096;
const EVIDENCE_ONLY_PATHS = Object.freeze([
  { exact: '.github/workflows/ci.yml' },
  { exact: '.github/workflows/mission-spine-home-dist.yml' },
  { exact: 'README.md' },
  { exact: 'docs/visual-a11y-evidence.md' },
  { prefix: 'e2e/visual/' },
  { exact: 'playwright.visual.config.js' },
  { exact: 'scripts/mission-spine-home-dist.mjs' },
  { exact: 'scripts/run-visual-evidence-docker.mjs' },
  { exact: 'scripts/update-visual-baselines.mjs' },
  { exact: 'scripts/visual-evidence.mjs' },
  { exact: 'tests/mission-spine-home-dist.test.js' },
  { exact: 'tests/visual-evidence-audit-contract.test.js' },
  { exact: 'tests/visual-evidence-contract.test.js' },
  { exact: 'tests/visual-evidence-release-binding.test.js' },
]);
const EXPECTED_CASES = Object.freeze([
  {
    id: 'home-light-compact-320', kind: 'visual', width: 320, height: 900,
    artifact: 'home-light-compact-320.png',
    checks: ['full_page', 'no_horizontal_overflow', 'production_dist'],
  },
  {
    id: 'home-light-medium-600', kind: 'visual', width: 600, height: 900,
    artifact: 'home-light-medium-600.png',
    checks: ['full_page', 'no_horizontal_overflow', 'production_dist'],
  },
  {
    id: 'home-light-expanded-840', kind: 'visual', width: 840, height: 900,
    artifact: 'home-light-expanded-840.png',
    checks: ['full_page', 'no_horizontal_overflow', 'production_dist'],
  },
  {
    id: 'home-light-large-1240', kind: 'visual', width: 1240, height: 900,
    artifact: 'home-light-large-1240.png',
    checks: ['full_page', 'no_horizontal_overflow', 'production_dist'],
  },
  {
    id: 'home-axe-wcag-aa', kind: 'a11y', width: 1240, height: 900, artifact: null,
    checks: ['axe_320_closed', 'axe_320_open', 'axe_600_closed', 'axe_840_closed', 'axe_1240_closed', 'axe_wcag2a', 'axe_wcag2aa', 'axe_wcag21a', 'axe_wcag21aa', 'axe_wcag22aa', 'local_fonts', 'local_network'],
  },
  {
    id: 'home-reflow-200-long-ko', kind: 'a11y', width: 320, height: 900, artifact: null,
    checks: ['text_resize_200', 'body_font_exact_2x', 'label_font_exact_2x', 'heading_font_exact_2x', 'long_korean_identifier', 'no_horizontal_overflow'],
  },
  {
    id: 'home-keyboard-focus', kind: 'a11y', width: 1240, height: 900, artifact: null,
    checks: ['full_focus_order', 'focus_visible', 'focus_not_offscreen', 'no_focus_trap', 'keyboard_activation', 'skip_link', 'form_controls'],
  },
  {
    id: 'home-heading-primary', kind: 'a11y', width: 1240, height: 900, artifact: null,
    checks: ['one_h1', 'heading_order', 'one_primary_per_section'],
  },
  {
    id: 'home-targets-44-320', kind: 'a11y', width: 320, height: 900, artifact: null,
    checks: ['all_independent_targets_enumerated', 'controls_44', 'inline_exceptions_explicit', 'exception_allowlist_exhausted'],
  },
  {
    id: 'home-targets-44-600', kind: 'a11y', width: 600, height: 900, artifact: null,
    checks: ['all_independent_targets_enumerated', 'controls_44', 'inline_exceptions_explicit', 'exception_allowlist_exhausted'],
  },
  {
    id: 'home-targets-44-840', kind: 'a11y', width: 840, height: 900, artifact: null,
    checks: ['all_independent_targets_enumerated', 'controls_44', 'inline_exceptions_explicit', 'exception_allowlist_exhausted'],
  },
  {
    id: 'home-targets-44-1240', kind: 'a11y', width: 1240, height: 900, artifact: null,
    checks: ['all_independent_targets_enumerated', 'controls_44', 'inline_exceptions_explicit', 'exception_allowlist_exhausted'],
  },
  {
    id: 'home-reduced-motion', kind: 'a11y', width: 1240, height: 900, artifact: null,
    checks: ['prefers_reduced_motion', 'animations_disabled'],
  },
  {
    id: 'home-mobile-menu-escape', kind: 'a11y', width: 320, height: 900, artifact: null,
    checks: ['menu_keyboard_open', 'menu_escape', 'focus_return'],
  },
  {
    id: 'home-mobile-menu-keyboard', kind: 'a11y', width: 320, height: 900, artifact: null,
    checks: ['open_menu_full_tab_order', 'open_menu_focus_visible', 'open_menu_focus_not_offscreen', 'open_menu_no_focus_trap', 'open_menu_keyboard_activation', 'open_menu_escape_return'],
  },
]);
const EXPECTED_FONT_FILES = Object.freeze([
  {
    family: 'Pretendard',
    weight: 400,
    file: 'Pretendard-Regular.woff2',
    url: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff2/Pretendard-Regular.woff2',
    sha256: 'fad853f7f47c6c8b103171e7193fa095708cdcd70850a71d93aa5379e8a61d63',
  },
  {
    family: 'Pretendard',
    weight: 500,
    file: 'Pretendard-Medium.woff2',
    url: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff2/Pretendard-Medium.woff2',
    sha256: 'd03481330eeba0659ab5b87f25ceb504a35de377dd90a0d0aba2982eb2d05e2c',
  },
  {
    family: 'Pretendard',
    weight: 600,
    file: 'Pretendard-SemiBold.woff2',
    url: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff2/Pretendard-SemiBold.woff2',
    sha256: 'c863f76a7de5c1ddc1ed8b2fa794964530774592c4f31407a84e2a2ae93f17f0',
  },
  {
    family: 'Pretendard',
    weight: 700,
    file: 'Pretendard-Bold.woff2',
    url: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff2/Pretendard-Bold.woff2',
    sha256: '4609c3356e536fafe38f4add0daeceb3d8595d3057bce13c428c33ddbd43d362',
  },
  {
    family: 'D2Coding',
    weight: 400,
    file: 'D2Coding-Regular.woff2',
    url: 'https://cdn.jsdelivr.net/npm/d2coding@1.3.2/fonts/d2coding-subset.woff2',
    sha256: '5d54097ce55cf1893761203191fa6795d49cab22120675b966eae1082f6f9c3c',
  },
]);
const FORBIDDEN_EVIDENCE_KEYS = new Set([
  'raw_content',
  'content',
  'html',
  'text',
  'code',
  'prompt',
  'error',
  'output',
  'url',
  'selector',
  'target',
  'nodes',
  'request',
  'response',
  'screenshot_path',
  'trace',
]);

function object(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value;
}

function exactKeys(value, expected, path) {
  object(value, path);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${path} must use exact keys: ${wanted.join(', ')}`);
  }
}

function exactString(value, path, pattern, max = 256) {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new Error(`${path} must be a bounded string`);
  }
  if (pattern && !pattern.test(value)) throw new Error(`${path} has an invalid format`);
  return value;
}

function boundedInteger(value, path, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${path} must be an integer from ${minimum} through ${maximum}`);
  }
  return value;
}

function readJson(path) {
  const bytes = readFileSync(path);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new Error(`${path} must be BOM-free UTF-8 JSON`);
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha256File(path) {
  return sha256Bytes(readFileSync(path));
}

export function candidateSpecSha256() {
  return sha256File(CANDIDATE_SPEC_PATH);
}

export function resolveEvidenceCandidateBinding(environment = process.env) {
  const configuredPath = environment.MISSION_CANDIDATE_SPEC_PATH;
  const configuredSha256 = environment.MISSION_CANDIDATE_SPEC_SHA256;
  const hasPath = configuredPath !== undefined;
  const hasSha256 = configuredSha256 !== undefined;
  if (hasPath !== hasSha256) {
    throw new Error('MISSION_CANDIDATE_SPEC_PATH and MISSION_CANDIDATE_SPEC_SHA256 must be provided together');
  }
  if (!hasPath) {
    if (environment.HOME_VISUAL_CANDIDATE_SPEC_SHA256 !== undefined) {
      throw new Error('a candidate SHA override requires the external MISSION_CANDIDATE_SPEC_PATH/SHA256 pair');
    }
    return {
      mode: 'home_local_diagnostic',
      path: CANDIDATE_SPEC_PATH,
      sha256: candidateSpecSha256(),
    };
  }

  exactString(configuredPath, 'MISSION_CANDIDATE_SPEC_PATH', undefined, 4096);
  if (!isAbsolute(configuredPath)) {
    throw new Error('MISSION_CANDIDATE_SPEC_PATH must be absolute');
  }
  if (/[\0\r\n,]/.test(configuredPath)) {
    throw new Error('MISSION_CANDIDATE_SPEC_PATH is not safe for an exact read-only bind mount');
  }
  exactString(
    configuredSha256,
    'MISSION_CANDIDATE_SPEC_SHA256 (lowercase SHA-256)',
    SHA256,
    64,
  );
  const candidatePath = resolve(ROOT, configuredPath);
  if (candidatePath === CANDIDATE_SPEC_PATH) {
    throw new Error('external release binding cannot point to the Home-local diagnostic candidate fixture');
  }
  if (!existsSync(candidatePath) || !statSync(candidatePath).isFile()) {
    throw new Error('MISSION_CANDIDATE_SPEC_PATH must name a readable regular file');
  }
  const actualSha256 = sha256File(candidatePath);
  if (actualSha256 !== configuredSha256) {
    throw new Error('external candidate raw SHA-256 does not match the out-of-band expected hash');
  }
  return {
    mode: 'external_release',
    path: candidatePath,
    sha256: configuredSha256,
  };
}

function isEvidenceOnlyPath(path) {
  return EVIDENCE_ONLY_PATHS.some((rule) => (
    rule.exact === path || (rule.prefix && path.startsWith(rule.prefix))
  ));
}

function ensureCommit(sha, path) {
  exactString(sha, path, SHA40, 40);
  const result = spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path} does not name a committed Git tree`);
}

export function isCommitAncestorByObjectGraph(ancestorSha, descendantSha) {
  const pending = [descendantSha];
  const seen = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === ancestorSha) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    if (seen.size > MAX_ANCESTRY_COMMITS) {
      throw new Error('commit ancestry traversal exceeded its safety limit');
    }
    const commit = spawnSync('git', ['cat-file', '-p', current], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    if (commit.error) throw commit.error;
    if (commit.status !== 0) {
      throw new Error('commit ancestry graph is incomplete');
    }
    const headers = String(commit.stdout || '').split(/\r?\n\r?\n/, 1)[0];
    for (const line of headers.split(/\r?\n/)) {
      const match = /^parent ([0-9a-f]{40})$/.exec(line);
      if (match) pending.push(match[1]);
    }
  }
  return false;
}

export function productRuntimeTreeSha256(commitSha) {
  ensureCommit(commitSha, 'rendered product SHA');
  const raw = execFileSync('git', ['ls-tree', '-r', '-z', '--full-tree', commitSha], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const productEntries = raw.split('\0').filter(Boolean).filter((entry) => {
    const separator = entry.indexOf('\t');
    if (separator === -1) throw new Error('Git tree entry is malformed');
    return !isEvidenceOnlyPath(entry.slice(separator + 1));
  });
  return sha256Bytes(Buffer.from(`${productEntries.join('\0')}\0`, 'utf8'));
}

export function validateProductRuntimeProvenance({
  candidate = validateCandidateSpec(readJson(CANDIDATE_SPEC_PATH)),
  environment = process.env,
  evidenceProducerSha = currentEvidenceProducerSha(environment),
  requireClean = true,
} = {}) {
  candidate = validateCandidateSpec(candidate);
  const renderedProductSha = candidate.surface.rendered_product_sha;
  ensureCommit(renderedProductSha, 'candidate rendered product SHA');
  ensureCommit(evidenceProducerSha, 'evidence producer SHA');

  const ancestor = spawnSync(
    'git',
    ['merge-base', '--is-ancestor', renderedProductSha, evidenceProducerSha],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (ancestor.error) throw ancestor.error;
  if (ancestor.status !== 0) {
    const shallow = spawnSync(
      'git',
      ['rev-parse', '--is-shallow-repository'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const detail = String(ancestor.stderr || '').trim().replace(/\s+/g, ' ') || 'none';
    const shallowState = String(shallow.stdout || '').trim() || 'unknown';
    if (
      ancestor.status === 1
      && shallowState === 'true'
      && isCommitAncestorByObjectGraph(renderedProductSha, evidenceProducerSha)
    ) {
      // Exact-SHA GitHub checkouts can retain a shallow marker after fetching
      // every object. Direct commit-object traversal preserves fail-closed
      // ancestry validation without trusting the shallow revision boundary.
    } else {
      throw new Error(
        `rendered product commit must be an ancestor of the evidence producer `
        + `(status=${ancestor.status}, shallow=${shallowState}, stderr=${detail})`,
      );
    }
  }

  if (requireClean) {
    const headSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim().toLowerCase();
    if (headSha !== evidenceProducerSha) {
      throw new Error('evidence producer SHA must equal the checked-out HEAD');
    }
    const status = execFileSync(
      'git',
      ['status', '--porcelain=v1', '--untracked-files=all'],
      { cwd: ROOT, encoding: 'utf8' },
    ).trim();
    if (status) throw new Error('product render provenance requires a clean Git worktree');
  }

  const renderedTreeSha256 = productRuntimeTreeSha256(renderedProductSha);
  if (renderedTreeSha256 !== candidate.surface.rendered_product_tree_sha256) {
    throw new Error('candidate rendered product tree hash does not match its Git commit');
  }
  const producerTreeSha256 = productRuntimeTreeSha256(evidenceProducerSha);
  if (producerTreeSha256 !== renderedTreeSha256) {
    const driftedPaths = execFileSync(
      'git',
      ['diff', '--name-only', renderedProductSha, evidenceProducerSha],
      { cwd: ROOT, encoding: 'utf8' },
    ).split(/\r?\n/).filter(Boolean).filter((path) => !isEvidenceOnlyPath(path));
    throw new Error(`product runtime drifted from rendered commit: ${driftedPaths.join(', ')}`);
  }
  return {
    rendered_product_sha: renderedProductSha,
    evidence_producer_sha: evidenceProducerSha,
    rendered_product_tree_sha256: renderedTreeSha256,
  };
}

export function validateCandidateSpec(value) {
  exactKeys(value, ['$schema', 'schema_version', 'document_type', 'surface', 'runtime', 'inputs'], 'candidate-spec');
  if (value.schema_version !== 2 || value.document_type !== 'home-visual-a11y-candidate-spec') {
    throw new Error('candidate-spec must be schema v2');
  }
  exactString(value.$schema, 'candidate-spec.$schema', /^\.\/schema\/candidate-spec-v2\.schema\.json$/);
  exactKeys(
    value.surface,
    ['repository', 'route', 'build', 'rendered_product_sha', 'rendered_product_tree_sha256'],
    'candidate-spec.surface',
  );
  if (
    value.surface.repository !== 'DevPathAi/devpath-home-page'
    || value.surface.route !== '/'
    || value.surface.build !== 'production-dist'
  ) {
    throw new Error('candidate-spec surface must be canonical production-dist Home');
  }
  exactString(
    value.surface.rendered_product_sha,
    'candidate-spec.surface.rendered_product_sha',
    SHA40,
    40,
  );
  exactString(
    value.surface.rendered_product_tree_sha256,
    'candidate-spec.surface.rendered_product_tree_sha256',
    SHA256,
    64,
  );
  exactKeys(value.runtime, [
    'browser',
    'playwright_version',
    'locale',
    'timezone_id',
    'device_scale_factor',
    'color_scheme',
    'reduced_motion',
    'animations',
    'clock',
    'network_policy',
    'workers',
  ], 'candidate-spec.runtime');
  const expectedRuntime = {
    browser: 'chromium',
    playwright_version: '1.61.1',
    locale: 'ko-KR',
    timezone_id: 'UTC',
    device_scale_factor: 1,
    color_scheme: 'light',
    reduced_motion: 'reduce',
    animations: 'disabled',
    network_policy: 'loopback-only',
    workers: 1,
  };
  for (const [key, expected] of Object.entries(expectedRuntime)) {
    if (value.runtime[key] !== expected) throw new Error(`candidate-spec.runtime.${key} drifted`);
  }
  if (value.runtime.clock !== '2026-08-16T00:00:00.000Z') {
    throw new Error('candidate-spec runtime clock must be pinned');
  }
  exactKeys(value.inputs, ['case_catalog', 'font_manifest'], 'candidate-spec.inputs');
  if (
    value.inputs.case_catalog !== 'e2e/visual/case-catalog.v2.json'
    || value.inputs.font_manifest !== 'e2e/visual/fonts/manifest.v2.json'
  ) {
    throw new Error('candidate-spec inputs must be canonical');
  }
  return value;
}

function validateViewport(value, path) {
  exactKeys(value, ['width', 'height'], path);
  if (![320, 600, 840, 1240].includes(value.width)) {
    throw new Error(`${path}.width is not an approved boundary`);
  }
  boundedInteger(value.height, `${path}.height`, 720, 1200);
}

export function validateCaseCatalog(value) {
  exactKeys(value, ['$schema', 'schema_version', 'document_type', 'surface', 'theme_coverage', 'baseline_policy', 'cases'], 'case-catalog');
  if (value.schema_version !== 2 || value.document_type !== 'home-visual-a11y-case-catalog') {
    throw new Error('case-catalog must be schema v2');
  }
  exactKeys(value.surface, ['repository', 'route', 'build'], 'case-catalog.surface');
  if (
    value.surface.repository !== 'DevPathAi/devpath-home-page'
    || value.surface.route !== '/'
    || value.surface.build !== 'production-dist'
  ) {
    throw new Error('case-catalog surface must be canonical production-dist Home');
  }
  exactKeys(value.theme_coverage, ['light', 'dark'], 'case-catalog.theme_coverage');
  exactKeys(value.theme_coverage.light, ['status'], 'case-catalog.theme_coverage.light');
  if (value.theme_coverage.light.status !== 'required') throw new Error('light theme is required');
  exactKeys(value.theme_coverage.dark, ['status', 'reason', 'approval'], 'case-catalog.theme_coverage.dark');
  if (value.theme_coverage.dark.status !== 'not_applicable') {
    throw new Error('dark must remain explicitly not_applicable until production activation is approved');
  }
  exactString(value.theme_coverage.dark.reason, 'case-catalog.theme_coverage.dark.reason', undefined, 240);
  exactKeys(value.theme_coverage.dark.approval, ['required', 'status', 'owner', 'artifact'], 'case-catalog.theme_coverage.dark.approval');
  if (
    value.theme_coverage.dark.approval.required !== true
    || value.theme_coverage.dark.approval.status !== 'pending'
    || value.theme_coverage.dark.approval.owner !== 'product-design'
    || value.theme_coverage.dark.approval.artifact !== null
  ) {
    throw new Error('dark approval must remain pending and explicit');
  }
  exactKeys(value.baseline_policy, ['platform', 'update_in_ci', 'review_metadata_required'], 'case-catalog.baseline_policy');
  if (
    value.baseline_policy.platform !== 'mcr.microsoft.com/playwright:v1.61.1-noble@sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48'
    || value.baseline_policy.update_in_ci !== false
    || value.baseline_policy.review_metadata_required !== true
  ) {
    throw new Error('baseline policy drifted');
  }
  if (!Array.isArray(value.cases) || value.cases.length === 0) throw new Error('case-catalog.cases is required');
  const ids = new Set();
  for (const [index, entry] of value.cases.entries()) {
    const path = `case-catalog.cases[${index}]`;
    const expected = entry.kind === 'visual'
      ? ['id', 'kind', 'status', 'theme', 'route', 'viewport', 'artifact', 'checks']
      : ['id', 'kind', 'status', 'theme', 'route', 'viewport', 'checks'];
    exactKeys(entry, expected, path);
    exactString(entry.id, `${path}.id`, CASE_ID, 80);
    if (ids.has(entry.id)) throw new Error(`duplicate case id: ${entry.id}`);
    ids.add(entry.id);
    if (!['visual', 'a11y'].includes(entry.kind)) throw new Error(`${path}.kind is invalid`);
    if (entry.status !== 'required' || entry.theme !== 'light' || entry.route !== '/') {
      throw new Error(`${path} must be a required light Home case`);
    }
    validateViewport(entry.viewport, `${path}.viewport`);
    if (entry.kind === 'visual') exactString(entry.artifact, `${path}.artifact`, /^[a-z0-9-]+\.png$/, 100);
    if (!Array.isArray(entry.checks) || entry.checks.length === 0) throw new Error(`${path}.checks is required`);
    for (const [checkIndex, check] of entry.checks.entries()) {
      exactString(check, `${path}.checks[${checkIndex}]`, /^[a-z0-9_]+$/, 64);
    }
  }
  const widths = value.cases
    .filter((entry) => entry.kind === 'visual')
    .map((entry) => entry.viewport.width);
  if (JSON.stringify(widths) !== JSON.stringify([320, 600, 840, 1240])) {
    throw new Error('visual cases must cover exactly 320/600/840/1240 in order');
  }
  const caseContract = value.cases.map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    width: entry.viewport.width,
    height: entry.viewport.height,
    artifact: entry.kind === 'visual' ? entry.artifact : null,
    checks: [...entry.checks],
  }));
  if (JSON.stringify(caseContract) !== JSON.stringify(EXPECTED_CASES)) {
    throw new Error('case catalog ID/kind/viewport/artifact/ordered-check contract drifted');
  }
  return value;
}

export function loadCaseCatalog() {
  return validateCaseCatalog(readJson(CASE_CATALOG_PATH));
}

export function validateFontManifest(value) {
  exactKeys(value, ['$schema', 'schema_version', 'document_type', 'cache_directory', 'fonts'], 'font-manifest');
  if (value.schema_version !== 2 || value.document_type !== 'home-visual-font-manifest') {
    throw new Error('font-manifest must be schema v2');
  }
  if (value.cache_directory !== '.visual-cache/fonts') throw new Error('font cache path drifted');
  if (!Array.isArray(value.fonts) || value.fonts.length !== EXPECTED_FONT_FILES.length) {
    throw new Error('the complete pinned production font tuple set is required');
  }
  const files = new Set();
  for (const [index, font] of value.fonts.entries()) {
    const path = `font-manifest.fonts[${index}]`;
    exactKeys(font, ['family', 'weight', 'style', 'file', 'url', 'sha256'], path);
    if (!['Pretendard', 'D2Coding'].includes(font.family)) throw new Error(`${path}.family is invalid`);
    boundedInteger(font.weight, `${path}.weight`, 100, 900);
    if (font.style !== 'normal') throw new Error(`${path}.style must be normal`);
    exactString(font.file, `${path}.file`, /^[A-Za-z0-9-]+\.woff2$/, 100);
    if (files.has(font.file)) throw new Error(`duplicate font file: ${font.file}`);
    files.add(font.file);
    exactString(font.url, `${path}.url`, /^https:\/\/cdn\.jsdelivr\.net\//, 300);
    exactString(font.sha256, `${path}.sha256`, SHA256, 64);
  }
  const pinnedFiles = value.fonts.map(({ family, weight, file, url, sha256 }) => ({
    family,
    weight,
    file,
    url,
    sha256,
  }));
  if (JSON.stringify(pinnedFiles) !== JSON.stringify(EXPECTED_FONT_FILES)) {
    throw new Error('font family/weight tuple, URL, or SHA-256 drifted');
  }
  return value;
}

export function loadFontManifest() {
  return validateFontManifest(readJson(FONT_MANIFEST_PATH));
}

function assertSanitized(value, path = 'evidence') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSanitized(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_EVIDENCE_KEYS.has(key)) {
      throw new Error(`${path}.${key} is forbidden raw content in sanitized evidence`);
    }
    assertSanitized(nested, `${path}.${key}`);
  }
}

function validateRuntime(value, path) {
  exactKeys(value, [
    'browser',
    'playwright_version',
    'locale',
    'timezone_id',
    'device_scale_factor',
    'color_scheme',
    'reduced_motion',
    'animations',
    'clock',
    'network_policy',
    'workers',
  ], path);
  const expected = validateCandidateSpec(readJson(CANDIDATE_SPEC_PATH)).runtime;
  if (JSON.stringify(value) !== JSON.stringify(expected)) throw new Error(`${path} does not match candidate-spec`);
}

function validateEvidenceCase(entry, expected, documentType, path) {
  const visual = documentType === 'home-visual-evidence';
  const required = visual
    ? ['case_id', 'status', 'theme', 'viewport', 'check_count', 'failed_check_count', 'artifact_sha256']
    : ['case_id', 'status', 'theme', 'viewport', 'check_count', 'failed_check_count', 'violation_counts'];
  exactKeys(entry, required, path);
  exactString(entry.case_id, `${path}.case_id`, CASE_ID, 80);
  if (entry.case_id !== expected.id) throw new Error(`${path}.case_id drifted from catalog order`);
  if (!['passed', 'failed'].includes(entry.status)) throw new Error(`${path}.status is invalid`);
  if (entry.theme !== 'light') throw new Error(`${path}.theme must be light`);
  validateViewport(entry.viewport, `${path}.viewport`);
  if (JSON.stringify(entry.viewport) !== JSON.stringify(expected.viewport)) {
    throw new Error(`${path}.viewport drifted from catalog`);
  }
  boundedInteger(entry.check_count, `${path}.check_count`, 1, 1000);
  if (entry.check_count !== expected.checks.length) {
    throw new Error(`${path}.check_count drifted from catalog`);
  }
  boundedInteger(entry.failed_check_count, `${path}.failed_check_count`, 0, entry.check_count);
  if (entry.status === 'passed' && entry.failed_check_count !== 0) {
    throw new Error(`${path} passed but reports failed checks`);
  }
  if (entry.status === 'failed' && entry.failed_check_count < 1) {
    throw new Error(`${path} failed without a failed check`);
  }
  if (visual) {
    exactString(entry.artifact_sha256, `${path}.artifact_sha256`, SHA256, 64);
  } else {
    exactKeys(entry.violation_counts, ['critical', 'serious', 'moderate', 'minor', 'total'], `${path}.violation_counts`);
    for (const [key, count] of Object.entries(entry.violation_counts)) {
      boundedInteger(count, `${path}.violation_counts.${key}`, 0, 10000);
    }
    const total = entry.violation_counts.critical
      + entry.violation_counts.serious
      + entry.violation_counts.moderate
      + entry.violation_counts.minor;
    if (entry.violation_counts.total !== total) throw new Error(`${path}.violation_counts.total is inconsistent`);
    if (entry.status === 'passed' && total !== 0) {
      throw new Error(`${path} passed with accessibility violations`);
    }
  }
}

export function validateEvidenceManifest(
  value,
  {
    environment = process.env,
    enforceBindings = false,
    requirePassing = false,
  } = {},
) {
  assertSanitized(value);
  exactKeys(value, [
    '$schema',
    'schema_version',
    'document_type',
    'evidence_mode',
    'binding',
    'runtime',
    'theme_coverage',
    'baseline_review',
    'summary',
    'cases',
    'privacy',
  ], 'evidence');
  if (value.schema_version !== 2 || !['home-visual-evidence', 'home-a11y-evidence'].includes(value.document_type)) {
    throw new Error('evidence must be a visual/a11y schema v2 manifest');
  }
  if (!['release_ready', 'diagnostic_pending_review', 'diagnostic_failure'].includes(value.evidence_mode)) {
    throw new Error('evidence mode is invalid');
  }
  exactKeys(value.binding, [
    'repository',
    'rendered_product_sha',
    'rendered_product_tree_sha256',
    'evidence_producer_sha',
    'candidate_spec_sha256',
    'case_catalog_sha256',
    'font_manifest_sha256',
  ], 'evidence.binding');
  if (value.binding.repository !== 'DevPathAi/devpath-home-page') throw new Error('evidence repository is not canonical');
  exactString(value.binding.rendered_product_sha, 'evidence.binding.rendered_product_sha', SHA40, 40);
  exactString(
    value.binding.rendered_product_tree_sha256,
    'evidence.binding.rendered_product_tree_sha256',
    SHA256,
    64,
  );
  exactString(value.binding.evidence_producer_sha, 'evidence.binding.evidence_producer_sha', SHA40, 40);
  for (const field of ['candidate_spec_sha256', 'case_catalog_sha256', 'font_manifest_sha256']) {
    exactString(value.binding[field], `evidence.binding.${field}`, SHA256, 64);
  }
  if (enforceBindings) {
    const candidate = validateCandidateSpec(readJson(CANDIDATE_SPEC_PATH));
    const renderedTreeSha256 = productRuntimeTreeSha256(candidate.surface.rendered_product_sha);
    if (candidate.surface.rendered_product_tree_sha256 !== renderedTreeSha256) {
      throw new Error('candidate rendered product tree hash does not match its Git commit');
    }
    const expectedBinding = {
      rendered_product_sha: renderedProductSha(candidate, environment),
      rendered_product_tree_sha256: renderedTreeSha256,
      evidence_producer_sha: currentEvidenceProducerSha(environment),
      candidate_spec_sha256: evidenceCandidateSha(environment),
      case_catalog_sha256: sha256File(CASE_CATALOG_PATH),
      font_manifest_sha256: sha256File(FONT_MANIFEST_PATH),
    };
    for (const [field, expected] of Object.entries(expectedBinding)) {
      if (value.binding[field] !== expected) {
        throw new Error(`evidence.binding.${field} does not match the current candidate`);
      }
    }
  }
  validateRuntime(value.runtime, 'evidence.runtime');
  exactKeys(value.theme_coverage, ['light', 'dark'], 'evidence.theme_coverage');
  if (value.theme_coverage.light !== 'covered') {
    throw new Error('evidence light theme must be covered');
  }
  exactKeys(value.theme_coverage.dark, ['status', 'reason', 'approval'], 'evidence.theme_coverage.dark');
  if (value.theme_coverage.dark.status !== 'not_applicable') {
    throw new Error('evidence dark theme must be explicitly not_applicable');
  }
  exactString(value.theme_coverage.dark.reason, 'evidence.theme_coverage.dark.reason', undefined, 240);
  exactKeys(
    value.theme_coverage.dark.approval,
    ['required', 'status', 'owner', 'artifact'],
    'evidence.theme_coverage.dark.approval',
  );
  if (
    value.theme_coverage.dark.approval.required !== true
    || value.theme_coverage.dark.approval.status !== 'pending'
    || value.theme_coverage.dark.approval.owner !== 'product-design'
    || value.theme_coverage.dark.approval.artifact !== null
  ) {
    throw new Error('evidence dark-theme approval must remain explicit and pending');
  }
  exactKeys(value.baseline_review, ['status', 'review_id'], 'evidence.baseline_review');
  if (!['missing', 'pending_external_review', 'approved'].includes(value.baseline_review.status)) {
    throw new Error('evidence baseline review status is invalid');
  }
  if (value.baseline_review.review_id !== null) {
    exactString(value.baseline_review.review_id, 'evidence.baseline_review.review_id', SAFE_ID, 80);
  }
  if (enforceBindings) {
    const expectedSummary = baselineReviewSummary(environment);
    if (JSON.stringify(value.baseline_review) !== JSON.stringify(expectedSummary)) {
      throw new Error('evidence baseline review summary does not match verified baseline metadata');
    }
  }
  exactKeys(value.summary, ['required', 'passed', 'failed'], 'evidence.summary');
  for (const [key, count] of Object.entries(value.summary)) boundedInteger(count, `evidence.summary.${key}`, 0, 1000);
  if (value.summary.required !== value.summary.passed + value.summary.failed) {
    throw new Error('evidence summary counts are inconsistent');
  }
  if (!Array.isArray(value.cases)) throw new Error('evidence.cases must be an array');
  const kind = value.document_type === 'home-visual-evidence' ? 'visual' : 'a11y';
  const expectedCases = loadCaseCatalog().cases.filter((entry) => entry.kind === kind);
  if (value.cases.length !== expectedCases.length || value.summary.required !== expectedCases.length) {
    throw new Error('evidence required case count drifted from catalog');
  }
  value.cases.forEach((entry, index) => validateEvidenceCase(
    entry,
    expectedCases[index],
    value.document_type,
    `evidence.cases[${index}]`,
  ));
  if (enforceBindings && kind === 'visual') {
    for (const [index, expected] of expectedCases.entries()) {
      const artifactPath = join(VISUAL_ROOT, 'baselines', expected.artifact);
      if (!existsSync(artifactPath)) {
        throw new Error(`evidence baseline artifact is missing: ${expected.artifact}`);
      }
      if (
        value.cases[index].status === 'passed'
        && value.cases[index].artifact_sha256 !== sha256File(artifactPath)
      ) {
        throw new Error(`evidence artifact hash does not match baseline PNG: ${expected.id}`);
      }
    }
  }
  const actualPassed = value.cases.filter((entry) => entry.status === 'passed').length;
  const actualFailed = value.cases.length - actualPassed;
  if (value.summary.passed !== actualPassed || value.summary.failed !== actualFailed) {
    throw new Error('evidence summary does not match ordered case results');
  }
  const expectedMode = actualFailed > 0
    ? 'diagnostic_failure'
    : kind === 'visual' && value.baseline_review.status !== 'approved'
      ? 'diagnostic_pending_review'
      : 'release_ready';
  if (value.evidence_mode !== expectedMode) {
    throw new Error(`evidence_mode must be ${expectedMode}`);
  }
  if (requirePassing && (actualFailed !== 0 || actualPassed !== expectedCases.length)) {
    throw new Error('all required evidence cases must be passing with failed=0');
  }
  exactKeys(value.privacy, ['classification', 'contains_raw_content'], 'evidence.privacy');
  if (value.privacy.classification !== 'sanitized-aggregate-only' || value.privacy.contains_raw_content !== false) {
    throw new Error('evidence privacy contract is invalid');
  }
  return value;
}

export function validateBaselineReview(value, { enforceBindings = false } = {}) {
  exactKeys(value, ['schema_version', 'document_type', 'status', 'review_id', 'reviewer', 'reason', 'reviewed_at', 'rendered_product_sha', 'rendered_product_tree_sha256', 'candidate_spec_sha256', 'case_catalog_sha256', 'artifacts'], 'baseline-review');
  if (value.schema_version !== 2 || value.document_type !== 'home-visual-baseline-review') {
    throw new Error('baseline review must be schema v2');
  }
  if (!['pending_external_review', 'approved'].includes(value.status)) throw new Error('baseline review status is invalid');
  exactString(value.review_id, 'baseline-review.review_id', SAFE_ID, 80);
  exactString(value.reviewer, 'baseline-review.reviewer', SAFE_ID, 80);
  exactString(value.reason, 'baseline-review.reason', undefined, 240);
  if (value.status === 'approved') {
    exactString(value.reviewed_at, 'baseline-review.reviewed_at', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 24);
  } else if (value.reviewed_at !== null) {
    throw new Error('pending baseline review must not claim a review timestamp');
  }
  exactString(value.rendered_product_sha, 'baseline-review.rendered_product_sha', SHA40, 40);
  exactString(
    value.rendered_product_tree_sha256,
    'baseline-review.rendered_product_tree_sha256',
    SHA256,
    64,
  );
  exactString(value.candidate_spec_sha256, 'baseline-review.candidate_spec_sha256', SHA256, 64);
  exactString(value.case_catalog_sha256, 'baseline-review.case_catalog_sha256', SHA256, 64);
  if (!Array.isArray(value.artifacts) || value.artifacts.length !== 4) throw new Error('baseline review requires four artifacts');
  for (const [index, artifact] of value.artifacts.entries()) {
    exactKeys(artifact, ['case_id', 'sha256'], `baseline-review.artifacts[${index}]`);
    exactString(artifact.case_id, `baseline-review.artifacts[${index}].case_id`, CASE_ID, 80);
    exactString(artifact.sha256, `baseline-review.artifacts[${index}].sha256`, SHA256, 64);
  }
  if (enforceBindings) {
    const candidate = validateCandidateSpec(readJson(CANDIDATE_SPEC_PATH));
    const catalog = loadCaseCatalog();
    if (value.rendered_product_sha !== candidate.surface.rendered_product_sha) {
      throw new Error('baseline rendered product source does not match candidate-spec');
    }
    if (value.rendered_product_tree_sha256 !== candidate.surface.rendered_product_tree_sha256) {
      throw new Error('baseline rendered product tree does not match candidate-spec');
    }
    if (
      value.rendered_product_tree_sha256
      !== productRuntimeTreeSha256(candidate.surface.rendered_product_sha)
    ) {
      throw new Error('baseline rendered product tree does not match the committed product');
    }
    if (value.candidate_spec_sha256 !== candidateSpecSha256()) {
      throw new Error('baseline candidate-spec hash does not match');
    }
    if (value.case_catalog_sha256 !== sha256File(CASE_CATALOG_PATH)) {
      throw new Error('baseline case-catalog hash does not match');
    }
    const expectedArtifacts = catalog.cases.filter((entry) => entry.kind === 'visual');
    for (const [index, expected] of expectedArtifacts.entries()) {
      const artifact = value.artifacts[index];
      if (artifact.case_id !== expected.id) {
        throw new Error('baseline artifact order does not match case catalog');
      }
      const path = join(VISUAL_ROOT, 'baselines', expected.artifact);
      if (!existsSync(path)) throw new Error(`baseline artifact is missing: ${expected.artifact}`);
      const bytes = readFileSync(path);
      if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== PNG_SIGNATURE) {
        throw new Error(`baseline artifact is not a valid PNG: ${expected.artifact}`);
      }
      if (bytes.readUInt32BE(16) !== expected.viewport.width) {
        throw new Error(`baseline PNG width drifted: ${expected.artifact}`);
      }
      if (artifact.sha256 !== sha256Bytes(bytes)) {
        throw new Error(`baseline artifact hash mismatch: ${expected.artifact}`);
      }
    }
  }
  return value;
}

function findFiles(directory, basename) {
  if (!existsSync(directory)) return [];
  const found = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...findFiles(path, basename));
    else if (entry === basename) found.push(path);
  }
  return found.sort();
}

function loadRecords(recordsDirectory) {
  const records = findFiles(recordsDirectory, 'sanitized-evidence.json').map(readJson);
  const byId = new Map();
  for (const record of records) {
    exactKeys(record, ['schema_version', 'document_type', 'case_id', 'kind', 'status', 'check_count', 'failed_check_count', 'artifact_sha256', 'violation_counts'], 'case-record');
    if (record.schema_version !== 2 || record.document_type !== 'home-visual-a11y-case-record') {
      throw new Error('case record must be schema v2');
    }
    exactString(record.case_id, 'case-record.case_id', CASE_ID, 80);
    if (byId.has(record.case_id)) throw new Error(`duplicate evidence record: ${record.case_id}`);
    if (!['visual', 'a11y'].includes(record.kind) || !['passed', 'failed'].includes(record.status)) {
      throw new Error(`case record ${record.case_id} has an invalid kind/status`);
    }
    boundedInteger(record.check_count, 'case-record.check_count', 1, 1000);
    boundedInteger(record.failed_check_count, 'case-record.failed_check_count', 0, record.check_count);
    if (record.kind === 'visual') {
      exactString(record.artifact_sha256, 'case-record.artifact_sha256', SHA256, 64);
      if (record.violation_counts !== null) throw new Error('visual record cannot carry violation counts');
    } else {
      if (record.artifact_sha256 !== null) throw new Error('a11y record cannot carry an artifact hash');
      exactKeys(record.violation_counts, ['critical', 'serious', 'moderate', 'minor', 'total'], 'case-record.violation_counts');
    }
    byId.set(record.case_id, record);
  }
  return byId;
}

function currentEvidenceProducerSha(environment = process.env) {
  const configured = environment.HOME_EVIDENCE_PRODUCER_SHA;
  const sha = configured || execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim().toLowerCase();
  return exactString(sha, 'HOME_EVIDENCE_PRODUCER_SHA', SHA40, 40);
}

function renderedProductSha(candidate, environment = process.env) {
  const configured = environment.HOME_RENDERED_PRODUCT_SHA;
  if (configured) {
    exactString(configured, 'HOME_RENDERED_PRODUCT_SHA', SHA40, 40);
    if (configured !== candidate.surface.rendered_product_sha) {
      throw new Error('HOME_RENDERED_PRODUCT_SHA does not match candidate-spec');
    }
  }
  return candidate.surface.rendered_product_sha;
}

function evidenceCandidateSha(environment = process.env) {
  return resolveEvidenceCandidateBinding(environment).sha256;
}

function baselineReviewSummary(environment = process.env) {
  if (environment.HOME_VISUAL_BASELINE_UPDATE === '1') {
    const status = environment.HOME_VISUAL_BASELINE_STATUS;
    const reviewId = environment.HOME_VISUAL_BASELINE_REVIEW_ID;
    if (!['pending_external_review', 'approved'].includes(status)) {
      throw new Error('baseline update evidence requires an explicit review status');
    }
    exactString(reviewId, 'HOME_VISUAL_BASELINE_REVIEW_ID', SAFE_ID, 80);
    return { status, review_id: reviewId };
  }
  if (!existsSync(BASELINE_REVIEW_PATH)) return { status: 'missing', review_id: null };
  const review = validateBaselineReview(readJson(BASELINE_REVIEW_PATH), { enforceBindings: true });
  return { status: review.status, review_id: review.review_id };
}

function emptyViolations() {
  return { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 };
}

export function generateEvidenceManifests({ recordsDirectory, outputDirectory, environment = process.env }) {
  const candidate = validateCandidateSpec(readJson(CANDIDATE_SPEC_PATH));
  const catalog = loadCaseCatalog();
  validateFontManifest(readJson(FONT_MANIFEST_PATH));
  const records = loadRecords(recordsDirectory);
  const catalogById = new Map(catalog.cases.map((entry) => [entry.id, entry]));
  for (const [caseId, record] of records.entries()) {
    const expected = catalogById.get(caseId);
    if (!expected) throw new Error(`evidence record is not in the case catalog: ${caseId}`);
    if (record.kind !== expected.kind) throw new Error(`evidence record kind drifted: ${caseId}`);
  }
  const binding = {
    repository: 'DevPathAi/devpath-home-page',
    rendered_product_sha: renderedProductSha(candidate, environment),
    rendered_product_tree_sha256: candidate.surface.rendered_product_tree_sha256,
    evidence_producer_sha: currentEvidenceProducerSha(environment),
    candidate_spec_sha256: evidenceCandidateSha(environment),
    case_catalog_sha256: sha256File(CASE_CATALOG_PATH),
    font_manifest_sha256: sha256File(FONT_MANIFEST_PATH),
  };
  const runtime = readJson(CANDIDATE_SPEC_PATH).runtime;
  const common = {
    $schema: 'https://leva.ai.kr/schemas/home-visual-a11y-evidence-v2.json',
    schema_version: 2,
    binding,
    runtime,
    theme_coverage: {
      light: 'covered',
      dark: {
        status: catalog.theme_coverage.dark.status,
        reason: catalog.theme_coverage.dark.reason,
        approval: { ...catalog.theme_coverage.dark.approval },
      },
    },
    baseline_review: baselineReviewSummary(environment),
    privacy: { classification: 'sanitized-aggregate-only', contains_raw_content: false },
  };

  const build = (kind) => {
    const cases = catalog.cases.filter((entry) => entry.kind === kind).map((entry) => {
      const record = records.get(entry.id);
      const base = {
        case_id: entry.id,
        status: record?.status ?? 'failed',
        theme: 'light',
        viewport: entry.viewport,
        check_count: record?.check_count ?? entry.checks.length,
        failed_check_count: record?.failed_check_count ?? entry.checks.length,
      };
      if (kind === 'visual') {
        return { ...base, artifact_sha256: record?.artifact_sha256 ?? '0'.repeat(64) };
      }
      return { ...base, violation_counts: record?.violation_counts ?? emptyViolations() };
    });
    const summary = {
      required: cases.length,
      passed: cases.filter((entry) => entry.status === 'passed').length,
      failed: cases.filter((entry) => entry.status === 'failed').length,
    };
    const baseline = common.baseline_review;
    const evidenceMode = summary.failed > 0
      ? 'diagnostic_failure'
      : kind === 'visual' && baseline.status !== 'approved'
        ? 'diagnostic_pending_review'
        : 'release_ready';
    return validateEvidenceManifest({
      ...common,
      document_type: kind === 'visual' ? 'home-visual-evidence' : 'home-a11y-evidence',
      evidence_mode: evidenceMode,
      summary,
      cases,
    }, { environment, enforceBindings: true });
  };

  const visual = build('visual');
  const a11y = build('a11y');
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(join(outputDirectory, 'visual-evidence.v2.json'), `${JSON.stringify(visual, null, 2)}\n`, 'utf8');
  writeFileSync(join(outputDirectory, 'a11y-evidence.v2.json'), `${JSON.stringify(a11y, null, 2)}\n`, 'utf8');
  return { visual, a11y };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function cli() {
  const command = process.argv[2];
  if (command === 'candidate-sha') {
    process.stdout.write(`${candidateSpecSha256()}\n`);
    return;
  }
  if (command === 'contracts') {
    validateCandidateSpec(readJson(CANDIDATE_SPEC_PATH));
    loadCaseCatalog();
    loadFontManifest();
    resolveEvidenceCandidateBinding();
    validateProductRuntimeProvenance();
    process.stdout.write('visual/a11y contracts valid\n');
    return;
  }
  if (command === 'generate') {
    validateProductRuntimeProvenance();
    const recordsDirectory = resolve(argument('--records') || join(ROOT, 'test-results', 'visual-a11y'));
    const outputDirectory = resolve(argument('--out') || join(recordsDirectory, 'manifests'));
    const result = generateEvidenceManifests({ recordsDirectory, outputDirectory });
    if (result.visual.summary.failed || result.a11y.summary.failed) {
      throw new Error('required visual/a11y evidence is incomplete or failed');
    }
    process.stdout.write(`sanitized evidence written to ${outputDirectory}\n`);
    return;
  }
  if (command === 'validate' || command === 'validate-diagnostic') {
    validateProductRuntimeProvenance();
    const directory = resolve(argument('--dir') || join(ROOT, 'test-results', 'visual-a11y', 'manifests'));
    for (const name of ['visual-evidence.v2.json', 'a11y-evidence.v2.json']) {
      validateEvidenceManifest(readJson(join(directory, name)), {
        environment: process.env,
        enforceBindings: true,
        requirePassing: command === 'validate',
      });
    }
    process.stdout.write('sanitized evidence manifests valid\n');
    return;
  }
  throw new Error('usage: visual-evidence.mjs <candidate-sha|contracts|generate|validate|validate-diagnostic>');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) cli();
