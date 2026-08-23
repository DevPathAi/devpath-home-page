import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  generateEvidenceManifests,
  isCommitAncestorByObjectGraph,
  loadCaseCatalog,
  productRuntimeTreeSha256,
  validateBaselineReview,
  validateCaseCatalog,
  validateEvidenceManifest,
  validateFontManifest,
  validateProductRuntimeProvenance,
} from '../scripts/visual-evidence.mjs';

const root = join(import.meta.dirname, '..');
const productSha = '8a02ea072831d471ca829aa4f7eb0354ea92daee';
const productTreeSha = 'adc7603015e79ea5b2d6997a6637e59affc0f3c9832315971e3649c37e406d85';
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
        ...environmentOverrides,
      },
    }));
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

describe('independent ET13 audit contracts', () => {
  it('catalogs 44px target coverage at every responsive boundary', () => {
    const catalog = JSON.parse(readFileSync(
      join(root, 'e2e/visual/case-catalog.v2.json'),
      'utf8',
    ));
    expect(catalog.cases
      .filter(({ id }) => id.startsWith('home-targets-44-'))
      .map(({ id, viewport }) => [id, viewport.width])).toEqual([
      ['home-targets-44-320', 320],
      ['home-targets-44-600', 600],
      ['home-targets-44-840', 840],
      ['home-targets-44-1240', 1240],
    ]);

    const css = readFileSync(join(root, 'assets/styles.css'), 'utf8');
    expect(css).toMatch(/\.site-nav a\s*\{[^}]*min-width:\s*44px/s);
    expect(css).toMatch(/\.lf-consent label\s*\{[^}]*min-height:\s*44px/s);
  });

  it('rejects same-count check-label and visual-artifact drift', () => {
    const checkDrift = structuredClone(loadCaseCatalog());
    checkDrift.cases[0].checks[0] = 'full_pages';
    expect(() => validateCaseCatalog(checkDrift)).toThrow(/check|catalog|drift/i);

    const artifactDrift = structuredClone(loadCaseCatalog());
    artifactDrift.cases[0].artifact = 'home-light-compact-alternate.png';
    expect(() => validateCaseCatalog(artifactDrift)).toThrow(/artifact|catalog|drift/i);
  });

  it('catalogs complete compact-menu keyboard coverage', () => {
    const catalog = JSON.parse(readFileSync(
      join(root, 'e2e/visual/case-catalog.v2.json'),
      'utf8',
    ));
    const compactKeyboard = catalog.cases.find(({ id }) => (
      id === 'home-mobile-menu-keyboard'
    ));
    expect(compactKeyboard).toMatchObject({
      kind: 'a11y',
      viewport: { width: 320, height: 900 },
    });
    expect(compactKeyboard.checks).toEqual([
      'open_menu_full_tab_order',
      'open_menu_focus_visible',
      'open_menu_focus_not_offscreen',
      'open_menu_no_focus_trap',
      'open_menu_keyboard_activation',
      'open_menu_escape_return',
    ]);
  });

  it('binds evidence to a verified committed product tree', () => {
    const candidate = JSON.parse(readFileSync(
      join(root, 'e2e/visual/candidate-spec.v2.json'),
      'utf8',
    ));
    const evidenceSource = readFileSync(join(root, 'scripts/visual-evidence.mjs'), 'utf8');
    const updaterSource = readFileSync(join(root, 'scripts/update-visual-baselines.mjs'), 'utf8');
    expect(candidate.surface.rendered_product_tree_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(evidenceSource).toContain('validateProductRuntimeProvenance');
    expect(updaterSource).toContain('validateProductRuntimeProvenance');
    expect(productRuntimeTreeSha256(productSha)).toBe(productTreeSha);
    expect(validateProductRuntimeProvenance({
      candidate,
      evidenceProducerSha: productSha,
      requireClean: false,
    })).toMatchObject({
      rendered_product_sha: productSha,
      evidence_producer_sha: productSha,
      rendered_product_tree_sha256: productTreeSha,
    });

    const staleProduct = structuredClone(candidate);
    staleProduct.surface.rendered_product_sha = '1ee751bfe8e0e26ec1f57d02cef56975859360c7';
    staleProduct.surface.rendered_product_tree_sha256 = productRuntimeTreeSha256(
      staleProduct.surface.rendered_product_sha,
    );
    expect(() => validateProductRuntimeProvenance({
      candidate: staleProduct,
      evidenceProducerSha: productSha,
      requireClean: false,
    })).toThrow(/runtime drift|styles\.css/i);
  });

  it('allows the exact CI-only descendant while retaining runtime drift detection', () => {
    const headSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    const changedPaths = execFileSync('git', ['diff', '--name-only', productSha, headSha], {
      cwd: root,
      encoding: 'utf8',
    }).split(/\r?\n/).filter(Boolean);
    // 렌더 기준 커밋과 HEAD 의 차이는 증거 허용목록 안에서만 일어나야 한다.
    // 대표값으로 이번 재바인딩의 산출물을 지목한다(직전에는 ci.yml 이 그 자리였다).
    expect(changedPaths).toContain('e2e/visual/baselines/review-metadata.v2.json');
    expect(isCommitAncestorByObjectGraph(productSha, headSha)).toBe(true);
    expect(isCommitAncestorByObjectGraph(headSha, productSha)).toBe(false);
    expect(productRuntimeTreeSha256(headSha)).toBe(productRuntimeTreeSha256(productSha));
    expect(productRuntimeTreeSha256('1ee751bfe8e0e26ec1f57d02cef56975859360c7'))
      .not.toBe(productRuntimeTreeSha256(productSha));
  });

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
    expect(visual.evidence_mode).toBe('release_ready');
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
