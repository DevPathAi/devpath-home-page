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
  candidateSpecSha256,
  generateEvidenceManifests,
  loadCaseCatalog,
  sha256Bytes,
  validateEvidenceManifest,
} from '../scripts/visual-evidence.mjs';
import { updateVisualBaselines } from '../scripts/update-visual-baselines.mjs';
import { runEvidenceCase } from '../e2e/visual/support/evidence-recorder.js';

const root = join(import.meta.dirname, '..');
const baselineHashes = new Map(JSON.parse(readFileSync(
  join(root, 'e2e/visual/baselines/review-metadata.v2.json'),
  'utf8',
)).artifacts.map(({ case_id: caseId, sha256 }) => [caseId, sha256]));

describe('Home visual/a11y evidence v2 contract', () => {
  it('pins a production-dist, deterministic light-theme candidate spec', () => {
    const candidate = JSON.parse(readFileSync(
      join(root, 'e2e/visual/candidate-spec.v2.json'),
      'utf8',
    ));

    expect(candidate.schema_version).toBe(2);
    expect(candidate.surface).toEqual({
      repository: 'DevPathAi/devpath-home-page',
      route: '/',
      build: 'production-dist',
      rendered_product_sha: '8a02ea072831d471ca829aa4f7eb0354ea92daee',
      rendered_product_tree_sha256: 'adc7603015e79ea5b2d6997a6637e59affc0f3c9832315971e3649c37e406d85',
    });
    expect(candidate.runtime).toMatchObject({
      locale: 'ko-KR',
      timezone_id: 'UTC',
      device_scale_factor: 1,
      color_scheme: 'light',
      reduced_motion: 'reduce',
      animations: 'disabled',
      network_policy: 'loopback-only',
    });
    expect(candidateSpecSha256()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('catalogs four light widths and records dark as explicitly not applicable', () => {
    const catalog = loadCaseCatalog();
    const visualWidths = catalog.cases
      .filter((entry) => entry.kind === 'visual' && entry.status === 'required')
      .map((entry) => entry.viewport.width);

    expect(visualWidths).toEqual([320, 600, 840, 1240]);
    expect(catalog.theme_coverage.dark).toMatchObject({
      status: 'not_applicable',
      approval: { required: true, status: 'pending' },
    });
    expect(catalog.theme_coverage.dark.reason).not.toHaveLength(0);
  });

  it('rejects raw-content fields from sanitized evidence manifests', () => {
    expect(() => validateEvidenceManifest({
      schema_version: 2,
      document_type: 'home-a11y-evidence',
      raw_content: 'private learner text',
    })).toThrow(/raw content|exact keys|sanitized/i);
  });

  it('retains aggregate axe counts without copying failure details', async () => {
    const temporary = mkdtempSync(join(tmpdir(), 'home-a11y-record-'));
    const failure = new Error('private selector must stay out of evidence');
    const counts = { critical: 0, serious: 1, moderate: 0, minor: 0, total: 1 };
    Object.defineProperty(failure, 'sanitizedEvidence', {
      value: { violationCounts: counts },
    });
    try {
      await expect(runEvidenceCase({
        testInfo: { outputPath: (name) => join(temporary, name) },
        catalogCase: loadCaseCatalog().cases.find((entry) => entry.id === 'home-axe-wcag-aa'),
      }, async () => {
        throw failure;
      })).rejects.toThrow('private selector');

      const record = JSON.parse(readFileSync(join(temporary, 'sanitized-evidence.json'), 'utf8'));
      expect(record).toMatchObject({
        status: 'failed',
        failed_check_count: 1,
        violation_counts: counts,
      });
      expect(JSON.stringify(record)).not.toContain('private selector');
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  it('generates allowlisted manifests bound to both Home and candidate-spec SHAs', () => {
    const temporary = mkdtempSync(join(tmpdir(), 'home-visual-evidence-'));
    const records = join(temporary, 'records');
    const output = join(temporary, 'manifests');
    const releaseCandidatePath = join(temporary, 'global-candidate.raw.json');
    const releaseCandidateBytes = Buffer.from('{"document_type":"candidate-spec"}\n', 'utf8');
    const releaseCandidateSha256 = sha256Bytes(releaseCandidateBytes);
    try {
      writeFileSync(releaseCandidatePath, releaseCandidateBytes);
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

      const result = generateEvidenceManifests({
        recordsDirectory: records,
        outputDirectory: output,
        environment: {
          HOME_RENDERED_PRODUCT_SHA: '8a02ea072831d471ca829aa4f7eb0354ea92daee',
          HOME_EVIDENCE_PRODUCER_SHA: 'a'.repeat(40),
          MISSION_CANDIDATE_SPEC_PATH: releaseCandidatePath,
          MISSION_CANDIDATE_SPEC_SHA256: releaseCandidateSha256,
        },
      });
      expect(result.visual.binding).toMatchObject({
        rendered_product_sha: '8a02ea072831d471ca829aa4f7eb0354ea92daee',
        rendered_product_tree_sha256: 'adc7603015e79ea5b2d6997a6637e59affc0f3c9832315971e3649c37e406d85',
        evidence_producer_sha: 'a'.repeat(40),
        candidate_spec_sha256: releaseCandidateSha256,
      });
      expect(result.visual.summary.failed).toBe(0);
      expect(result.a11y.summary.failed).toBe(0);
      expect(result.visual.theme_coverage.dark).toMatchObject({
        status: 'not_applicable',
        approval: { required: true, status: 'pending' },
      });
      expect(JSON.stringify(result)).not.toMatch(/private learner|"screenshot_path"|"selector"/);
      const environment = {
        HOME_RENDERED_PRODUCT_SHA: '8a02ea072831d471ca829aa4f7eb0354ea92daee',
        HOME_EVIDENCE_PRODUCER_SHA: 'a'.repeat(40),
        MISSION_CANDIDATE_SPEC_PATH: releaseCandidatePath,
        MISSION_CANDIDATE_SPEC_SHA256: releaseCandidateSha256,
      };
      expect(() => validateEvidenceManifest(result.visual, {
        environment,
        enforceBindings: true,
      })).not.toThrow();
      expect(() => validateEvidenceManifest(result.a11y, {
        environment,
        enforceBindings: true,
      })).not.toThrow();

      const tampered = structuredClone(result.visual);
      tampered.binding.candidate_spec_sha256 = 'd'.repeat(64);
      expect(() => validateEvidenceManifest(tampered, {
        environment,
        enforceBindings: true,
      })).toThrow(/current candidate/);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  it('pins CI actions/container and never updates snapshots in CI', () => {
    const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
    const checkoutSteps = [...workflow.matchAll(
      /^\s*- uses: actions\/checkout@([0-9a-f]{40})[^\r\n]*\r?\n\s+with:\r?\n((?:\s{10,}[^\r\n]+\r?\n?)+)/gm,
    )].map((match) => ({ sha: match[1], withBlock: match[2] }));
    expect(checkoutSteps).toHaveLength(2);
    for (const checkout of checkoutSteps) {
      expect(checkout.sha).toBe('11bd71901bbe5b1630ceea73d27597364c9af683');
      expect(checkout.withBlock).toMatch(/^\s+fetch-depth:\s*0\s*$/m);
      expect(checkout.withBlock).toMatch(/^\s+persist-credentials:\s*false\s*$/m);
    }
    expect(workflow).toContain('mcr.microsoft.com/playwright:v1.61.1-noble@sha256:');
    expect(workflow).toContain('actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683');
    const visualJob = workflow.slice(workflow.indexOf('  visual-a11y:'));
    expect(visualJob).toContain(
      'ref: ${{ github.event.pull_request.head.sha || github.sha }}',
    );
    expect(visualJob).toContain('test -n "${GITHUB_WORKSPACE}"');
    expect(visualJob).toContain(
      'git config --global --add safe.directory "${GITHUB_WORKSPACE}"',
    );
    expect(visualJob).toContain('git fetch --no-tags --unshallow origin');
    expect(visualJob).toContain(
      'test "$(git rev-parse --is-shallow-repository)" = false',
    );
    expect(visualJob).toContain(
      'test "$(git rev-parse --show-toplevel)" = "${GITHUB_WORKSPACE}"',
    );
    expect(workflow).not.toContain('--update-snapshots');
    expect(workflow).not.toMatch(/uses:\s+actions\/[a-z-]+@v\d/);

    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(pkg.devDependencies['@axe-core/playwright']).toBe('4.13.0');
    expect(pkg.devDependencies['@playwright/test']).toBe('1.61.1');

    const defaultPlaywright = readFileSync(join(root, 'playwright.config.js'), 'utf8');
    expect(defaultPlaywright).toContain('[\\\\/]visual[\\\\/]');
  });

  it('fails closed before any baseline update in CI', () => {
    const previous = process.env.CI;
    process.env.CI = 'true';
    try {
      expect(() => updateVisualBaselines()).toThrow(/cannot be updated in CI/);
    } finally {
      if (previous === undefined) delete process.env.CI;
      else process.env.CI = previous;
    }
  });
});
