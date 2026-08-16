import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  generateEvidenceManifests,
  loadCaseCatalog,
  validateBaselineReview,
  validateCaseCatalog,
  validateEvidenceManifest,
  validateFontManifest,
} from '../scripts/visual-evidence.mjs';

const root = join(import.meta.dirname, '..');
const productSha = 'be9e34881fcf3aca686481f231372f9377a02544';
const producerSha = 'a'.repeat(40);
const baselineHashes = new Map(JSON.parse(readFileSync(
  join(root, 'e2e/visual/baselines/review-metadata.v2.json'),
  'utf8',
)).artifacts.map(({ case_id: caseId, sha256 }) => [caseId, sha256]));

function passingEvidence(environmentOverrides = {}) {
  const temporary = mkdtempSync(join(tmpdir(), 'home-audit-evidence-'));
  const records = join(temporary, 'records');
  for (const entry of loadCaseCatalog().cases) {
    const directory = join(records, entry.id);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'sanitized-evidence.json'), JSON.stringify({
      schema_version: 2,
      document_type: 'home-visual-a11y-case-record',
      case_id: entry.id,
      kind: entry.kind,
      status: 'passed',
      check_count: entry.checks.length,
      failed_check_count: 0,
      artifact_sha256: entry.kind === 'visual' ? baselineHashes.get(entry.id) : null,
      violation_counts: entry.kind === 'a11y'
        ? { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 }
        : null,
    }));
  }
  try {
    return structuredClone(generateEvidenceManifests({
      recordsDirectory: records,
      outputDirectory: join(temporary, 'out'),
      environment: {
        HOME_RENDERED_PRODUCT_SHA: productSha,
        HOME_EVIDENCE_PRODUCER_SHA: producerSha,
        HOME_VISUAL_CANDIDATE_SPEC_SHA256: 'b'.repeat(64),
        ...environmentOverrides,
      },
    }));
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

describe('independent ET13 audit contracts', () => {
  it('distinguishes rendered product source from the evidence producer', () => {
    const candidate = JSON.parse(readFileSync(
      join(root, 'e2e/visual/candidate-spec.v2.json'),
      'utf8',
    ));
    expect(candidate.surface.rendered_product_sha).toBe(productSha);

    const { visual, a11y } = passingEvidence();
    expect(visual.binding).toMatchObject({
      rendered_product_sha: productSha,
      evidence_producer_sha: producerSha,
    });
    expect(visual.evidence_mode).toBe('diagnostic_pending_review');
    expect(a11y.evidence_mode).toBe('release_ready');
  });

  it('rejects catalog order drift and non-passing release evidence', () => {
    const reorderedCatalog = structuredClone(loadCaseCatalog());
    [reorderedCatalog.cases[9], reorderedCatalog.cases[10]] = [
      reorderedCatalog.cases[10],
      reorderedCatalog.cases[9],
    ];
    expect(() => validateCaseCatalog(reorderedCatalog)).toThrow(/order|catalog/i);

    const { a11y } = passingEvidence();
    [a11y.cases[0], a11y.cases[1]] = [a11y.cases[1], a11y.cases[0]];
    expect(() => validateEvidenceManifest(a11y, {
      enforceCatalog: true,
    })).toThrow(/order|catalog/i);

    const { visual } = passingEvidence();
    visual.cases[0].status = 'failed';
    visual.cases[0].failed_check_count = 1;
    visual.cases[0].artifact_sha256 = '0'.repeat(64);
    visual.summary.passed -= 1;
    visual.summary.failed += 1;
    visual.evidence_mode = 'diagnostic_failure';
    expect(() => validateEvidenceManifest(visual)).not.toThrow();
    expect(() => validateEvidenceManifest(visual, {
      environment: {
        HOME_RENDERED_PRODUCT_SHA: productSha,
        HOME_EVIDENCE_PRODUCER_SHA: producerSha,
        HOME_VISUAL_CANDIDATE_SPEC_SHA256: 'b'.repeat(64),
      },
      enforceBindings: true,
    })).not.toThrow();
    expect(() => validateEvidenceManifest(visual, {
      requirePassing: true,
    })).toThrow(/passing|required|failed/i);
  });

  it('verifies baseline bindings and every on-disk PNG hash', () => {
    const review = JSON.parse(readFileSync(
      join(root, 'e2e/visual/baselines/review-metadata.v2.json'),
      'utf8',
    ));
    review.artifacts[0].sha256 = 'f'.repeat(64);
    expect(() => validateBaselineReview(review, {
      enforceBindings: true,
    })).toThrow(/artifact|hash|candidate|catalog|source/i);

    const { visual } = passingEvidence();
    visual.cases[0].artifact_sha256 = 'f'.repeat(64);
    expect(() => validateEvidenceManifest(visual, {
      environment: {
        HOME_RENDERED_PRODUCT_SHA: productSha,
        HOME_EVIDENCE_PRODUCER_SHA: producerSha,
        HOME_VISUAL_CANDIDATE_SPEC_SHA256: 'b'.repeat(64),
      },
      enforceBindings: true,
    })).toThrow(/artifact|baseline|hash/i);
  });

  it('binds governed-update diagnostics to the incoming review metadata', () => {
    const { visual } = passingEvidence({
      HOME_VISUAL_BASELINE_UPDATE: '1',
      HOME_VISUAL_BASELINE_STATUS: 'pending_external_review',
      HOME_VISUAL_BASELINE_REVIEW_ID: 'incoming-review',
    });
    expect(visual.baseline_review).toEqual({
      status: 'pending_external_review',
      review_id: 'incoming-review',
    });
    expect(visual.evidence_mode).toBe('diagnostic_pending_review');
  });

  it('pins and requires the complete production font tuple set', () => {
    const manifest = JSON.parse(readFileSync(
      join(root, 'e2e/visual/fonts/manifest.v2.json'),
      'utf8',
    ));
    expect(() => validateFontManifest(manifest)).not.toThrow();
    expect(manifest.fonts.map(({ family, weight }) => [family, weight])).toEqual([
      ['Pretendard', 400],
      ['Pretendard', 500],
      ['Pretendard', 600],
      ['Pretendard', 700],
      ['D2Coding', 400],
    ]);
  });

  it('documents one canonical pinned-Docker command and marks host runs non-authoritative', () => {
    const docs = readFileSync(join(root, 'docs/visual-a11y-evidence.md'), 'utf8');
    const wrapper = readFileSync(join(root, 'scripts/run-visual-evidence-docker.mjs'), 'utf8');
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(pkg.scripts['visual:evidence:docker']).toBe('node scripts/run-visual-evidence-docker.mjs');
    expect(docs).toContain('npm run visual:evidence:docker');
    expect(docs).toMatch(/non-authoritative/i);
    expect(wrapper).toContain("['status', '--porcelain']");
    expect(wrapper).toContain('type=volume,destination=/work/node_modules');
  });
});
