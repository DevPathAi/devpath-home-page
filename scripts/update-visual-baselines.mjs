import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BASELINE_REVIEW_PATH,
  CANDIDATE_SPEC_PATH,
  CASE_CATALOG_PATH,
  ROOT,
  VISUAL_ROOT,
  candidateSpecSha256,
  loadCaseCatalog,
  sha256File,
  validateBaselineReview,
  validateCandidateSpec,
} from './visual-evidence.mjs';

const SAFE_ID = /^[a-z0-9]+(?:[a-z0-9._-]*[a-z0-9])?$/;
const PLATFORM = 'mcr.microsoft.com/playwright:v1.61.1-noble@sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48';

function required(name, pattern = SAFE_ID, maximum = 240) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new Error(`${name} is required and must be bounded`);
  }
  if (pattern && !pattern.test(value)) throw new Error(`${name} has an invalid format`);
  return value;
}

function baselineFiles() {
  return loadCaseCatalog().cases
    .filter((entry) => entry.kind === 'visual')
    .map((entry) => ({ ...entry, path: join(VISUAL_ROOT, 'baselines', entry.artifact) }));
}

function existingReviewStatus() {
  if (!existsSync(BASELINE_REVIEW_PATH)) return null;
  const value = JSON.parse(readFileSync(BASELINE_REVIEW_PATH, 'utf8'));
  return validateBaselineReview(value).status;
}

function ensureAuthorizedMode(hasExistingBaselines) {
  if (process.env.CI) throw new Error('visual baselines cannot be updated in CI');
  if (process.platform !== 'linux' || process.env.HOME_VISUAL_BASELINE_PLATFORM !== PLATFORM) {
    throw new Error(`baseline updates must run in the pinned ${PLATFORM} environment`);
  }
  const status = required('HOME_VISUAL_BASELINE_STATUS', /^(pending_external_review|approved)$/);
  const existingStatus = existingReviewStatus();
  if (hasExistingBaselines && existingStatus === 'approved' && status !== 'approved') {
    throw new Error('an approved baseline cannot be replaced by pending review metadata');
  }
  if (status === 'pending_external_review') {
    if (hasExistingBaselines && existingStatus !== 'pending_external_review') {
      throw new Error('only an already-pending baseline candidate may remain pending');
    }
    if (process.env.HOME_VISUAL_BASELINE_BOOTSTRAP !== 'true') {
      throw new Error('an unapproved baseline candidate requires explicit bootstrap acknowledgement');
    }
  }
  return status;
}

function rollbackGuard(paths) {
  const directory = mkdtempSync(join(tmpdir(), 'home-visual-baseline-'));
  const entries = paths.map((path, index) => {
    const backup = join(directory, String(index));
    const existed = existsSync(path);
    if (existed) copyFileSync(path, backup);
    return { path, backup, existed };
  });
  return {
    restore() {
      for (const entry of entries) {
        if (entry.existed) copyFileSync(entry.backup, entry.path);
        else rmSync(entry.path, { force: true });
      }
    },
    dispose() {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

export function updateVisualBaselines() {
  const files = baselineFiles();
  const existingCount = files.filter((entry) => existsSync(entry.path)).length;
  if (existingCount !== 0 && existingCount !== files.length) {
    throw new Error('partial visual baseline set is forbidden');
  }
  const status = ensureAuthorizedMode(existingCount > 0);
  const reviewId = required('HOME_VISUAL_BASELINE_REVIEW_ID');
  const reviewer = required('HOME_VISUAL_BASELINE_REVIEWER');
  const reason = required('HOME_VISUAL_BASELINE_REASON', null, 240);
  const reviewedAt = status === 'approved'
    ? required('HOME_VISUAL_BASELINE_REVIEWED_AT', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 24)
    : null;
  const candidate = validateCandidateSpec(JSON.parse(readFileSync(CANDIDATE_SPEC_PATH, 'utf8')));
  const rollback = rollbackGuard([...files.map((entry) => entry.path), BASELINE_REVIEW_PATH]);
  let complete = false;

  try {
    const cli = join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
    const run = spawnSync(process.execPath, [
      cli,
      'test',
      '--config=playwright.visual.config.js',
      '--update-snapshots=all',
    ], {
      cwd: ROOT,
      env: { ...process.env, HOME_VISUAL_BASELINE_UPDATE: '1' },
      encoding: 'utf8',
      stdio: 'inherit',
    });
    if (run.error) throw run.error;
    if (run.status !== 0) throw new Error(`Playwright baseline update failed with status ${run.status}`);
    for (const entry of files) {
      if (!existsSync(entry.path)) throw new Error(`baseline was not generated: ${entry.artifact}`);
    }

    const metadata = validateBaselineReview({
      schema_version: 2,
      document_type: 'home-visual-baseline-review',
      status,
      review_id: reviewId,
      reviewer,
      reason,
      reviewed_at: reviewedAt,
      rendered_product_sha: candidate.surface.rendered_product_sha,
      candidate_spec_sha256: candidateSpecSha256(),
      case_catalog_sha256: sha256File(CASE_CATALOG_PATH),
      artifacts: files.map((entry) => ({ case_id: entry.id, sha256: sha256File(entry.path) })),
    }, { enforceBindings: true });
    writeFileSync(BASELINE_REVIEW_PATH, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    complete = true;
  } finally {
    if (!complete) rollback.restore();
    rollback.dispose();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  updateVisualBaselines();
  process.stdout.write(`visual baseline metadata written to ${BASELINE_REVIEW_PATH}\n`);
}
