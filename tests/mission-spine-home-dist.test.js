import { createHash } from 'node:crypto';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createCanonicalHomeArchive,
  createHomeDistEvidence,
  inspectCanonicalHomeTar,
  packageHomeDist,
  validateHomeArtifactMetadata,
  validateHomeArtifactZip,
  validateHomeDistPackage,
  validateHomeWorkflowRunFacts,
} from '../scripts/mission-spine-home-dist.mjs';

const root = resolve(import.meta.dirname, '..');
const candidateSha = '1'.repeat(64);
const homeSha = '1234567890abcdef1234567890abcdef12345678';
const releaseId = 'ms-20260817-home-contract';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}

function storedZip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, body] of files) {
    const nameBytes = Buffer.from(name, 'utf8');
    const bytes = Buffer.from(body);
    const checksum = crc32(bytes);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(bytes.length, 18);
    localHeader.writeUInt32LE(bytes.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    local.push(localHeader, nameBytes, bytes);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(bytes.length, 20);
    centralHeader.writeUInt32LE(bytes.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + bytes.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBytes, end]);
}

function fixture() {
  const temporary = mkdtempSync(join(tmpdir(), 'home-dist-contract-'));
  const dist = join(temporary, 'dist');
  const output = join(temporary, 'package');
  mkdirSync(join(dist, 'nested'), { recursive: true });
  writeFileSync(join(dist, 'z-last.txt'), 'last\n');
  writeFileSync(join(dist, 'nested', 'a-first.txt'), 'first\n');
  writeFileSync(join(dist, 'index.html'), '<!doctype html>\n');
  return { temporary, dist, output };
}

describe('Mission Spine Home distribution producer', () => {
  it('creates byte-deterministic canonical tar.gz bytes independent of mtimes and modes', () => {
    const { temporary, dist } = fixture();
    try {
      const first = createCanonicalHomeArchive(dist);
      utimesSync(join(dist, 'index.html'), new Date(1_800_000_000_000), new Date(1_800_000_000_000));
      chmodSync(join(dist, 'index.html'), 0o600);
      const second = createCanonicalHomeArchive(dist);

      expect(second).toEqual(first);
      expect([...first.subarray(4, 8)]).toEqual([0, 0, 0, 0]);
      const entries = inspectCanonicalHomeTar(first);
      expect(entries.map((entry) => entry.path)).toEqual([
        'dist/index.html',
        'dist/nested/a-first.txt',
        'dist/z-last.txt',
      ]);
      expect(entries.every((entry) => entry.mode === 0o644)).toBe(true);

      rmSync(join(dist, 'index.html'));
      expect(() => createCanonicalHomeArchive(dist)).toThrow(/dist\/index\.html/i);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  it('creates and validates the exact two-file evidence package', () => {
    const { temporary, dist, output } = fixture();
    try {
      const archive = createCanonicalHomeArchive(dist);
      const expectedDistSha = sha256(archive);
      const result = packageHomeDist({
        distRoot: dist,
        outputRoot: output,
        candidateSpecSha256: candidateSha,
        homeSourceSha: homeSha,
        expectedDistSha256: expectedDistSha,
        producerRunId: 701,
        producerRunAttempt: 1,
      });

      expect(result.distSha256).toBe(expectedDistSha);
      expect(result.evidence).toEqual({
        candidate_spec_sha256: candidateSha,
        status: 'passed',
        producer_run_id: 701,
        producer_run_attempt: 1,
        home_source_sha: homeSha,
        dist_sha256: expectedDistSha,
      });
      expect(validateHomeDistPackage({
        distRoot: dist,
        packageRoot: output,
        candidateSpecSha256: candidateSha,
        homeSourceSha: homeSha,
        expectedDistSha256: expectedDistSha,
        producerRunId: 701,
        producerRunAttempt: 1,
      }).distSha256).toBe(expectedDistSha);

      writeFileSync(join(output, 'raw-review-notes.txt'), 'forbidden\n');
      expect(() => validateHomeDistPackage({
        distRoot: dist,
        packageRoot: output,
        candidateSpecSha256: candidateSha,
        homeSourceSha: homeSha,
        expectedDistSha256: expectedDistSha,
        producerRunId: 701,
        producerRunAttempt: 1,
      })).toThrow(/exactly dist\.tar\.gz and evidence\.json/i);
      rmSync(join(output, 'raw-review-notes.txt'));
      const evidencePath = join(output, 'evidence.json');
      const extraEvidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
      extraEvidence.raw_notes = 'forbidden';
      writeFileSync(evidencePath, `${JSON.stringify(extraEvidence)}\n`);
      expect(() => validateHomeDistPackage({
        distRoot: dist,
        packageRoot: output,
        candidateSpecSha256: candidateSha,
        homeSourceSha: homeSha,
        expectedDistSha256: expectedDistSha,
        producerRunId: 701,
        producerRunAttempt: 1,
      })).toThrow(/exact ordered key set/i);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  it('fails closed on reruns, hash substitution, unsafe tar paths, and evidence extras', () => {
    expect(() => createHomeDistEvidence({
      candidateSpecSha256: candidateSha,
      homeSourceSha: homeSha,
      distSha256: '2'.repeat(64),
      producerRunId: 701,
      producerRunAttempt: 2,
    })).toThrow(/attempt 1|fresh dispatch/i);

    const { temporary, dist, output } = fixture();
    try {
      const archive = createCanonicalHomeArchive(dist);
      const expectedDistSha = sha256(archive);
      expect(() => packageHomeDist({
        distRoot: dist,
        outputRoot: output,
        candidateSpecSha256: candidateSha,
        homeSourceSha: homeSha,
        expectedDistSha256: '3'.repeat(64),
        producerRunId: 701,
        producerRunAttempt: 1,
      })).toThrow(/produced dist SHA-256/i);

      const tampered = Buffer.from(archive);
      const tar = inspectCanonicalHomeTar(tampered, { returnTarBytes: true }).tarBytes;
      const pathOffset = tar.indexOf(Buffer.from('dist/index.html'));
      const wrongRoot = Buffer.from(tar);
      Buffer.from('root').copy(wrongRoot, pathOffset);
      expect(() => inspectCanonicalHomeTar(wrongRoot, { inputIsTar: true }))
        .toThrow(/single dist\/ root/i);

      tar.fill(0, pathOffset, pathOffset + 100);
      Buffer.from('dist/../escape.txt').copy(tar, pathOffset);
      expect(() => inspectCanonicalHomeTar(tar, { inputIsTar: true })).toThrow(/unsafe|canonical|checksum/i);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  it('authenticates current protected master and uploaded artifact metadata', () => {
    const workflowBytes = Buffer.from('trusted workflow\n');
    expect(validateHomeWorkflowRunFacts({
      sourceSha: homeSha,
      runId: 701,
      runAttempt: 1,
      run: {
        id: 701,
        run_attempt: 1,
        event: 'workflow_dispatch',
        status: 'in_progress',
        conclusion: null,
        head_sha: homeSha,
        head_branch: 'master',
        path: '.github/workflows/mission-spine-home-dist.yml@refs/heads/master',
        repository: { full_name: 'DevPathAi/devpath-home-page' },
        head_repository: { full_name: 'DevPathAi/devpath-home-page' },
      },
      branch: { name: 'master', commit: { sha: homeSha }, protected: true },
      workflowBytes,
      localWorkflowBytes: Buffer.from(workflowBytes),
    })).toMatchObject({ sourceSha: homeSha });

    expect(() => validateHomeWorkflowRunFacts({
      sourceSha: homeSha,
      runId: 701,
      runAttempt: 1,
      run: {
        id: 701,
        run_attempt: 1,
        event: 'workflow_dispatch',
        status: 'in_progress',
        conclusion: null,
        head_sha: homeSha,
        head_branch: 'master',
        path: '.github/workflows/mission-spine-home-dist.yml',
        repository: { full_name: 'DevPathAi/devpath-home-page' },
        head_repository: { full_name: 'DevPathAi/devpath-home-page' },
      },
      branch: { name: 'master', commit: { sha: homeSha }, protected: false },
      workflowBytes,
      localWorkflowBytes: workflowBytes,
    })).toThrow(/protected/i);

    const digest = '4'.repeat(64);
    expect(validateHomeArtifactMetadata({
      metadata: {
        id: 801,
        name: `${releaseId}-home-dist-run-701-attempt-1`,
        expired: false,
        size_in_bytes: 1024,
        digest: `sha256:${digest}`,
        workflow_run: { id: 701, head_sha: homeSha },
      },
      artifactId: 801,
      artifactName: `${releaseId}-home-dist-run-701-attempt-1`,
      artifactDigest: digest,
      runId: 701,
      sourceSha: homeSha,
    })).toBe(true);
  });

  it('rejects an artifact ZIP unless it contains the exact package bytes', () => {
    const { temporary, dist, output } = fixture();
    try {
      const archive = createCanonicalHomeArchive(dist);
      const expectedDistSha = sha256(archive);
      packageHomeDist({
        distRoot: dist,
        outputRoot: output,
        candidateSpecSha256: candidateSha,
        homeSourceSha: homeSha,
        expectedDistSha256: expectedDistSha,
        producerRunId: 701,
        producerRunAttempt: 1,
      });
      const zipFixture = storedZip([
        ['dist.tar.gz', readFileSync(join(output, 'dist.tar.gz'))],
        ['evidence.json', readFileSync(join(output, 'evidence.json'))],
      ]);
      expect(validateHomeArtifactZip({
        zipBytes: zipFixture,
        packageRoot: output,
        expectedZipSha256: sha256(zipFixture),
      })).toBe(true);

      const substituted = Buffer.from(zipFixture);
      substituted[substituted.length - 1] ^= 1;
      expect(() => validateHomeArtifactZip({
        zipBytes: substituted,
        packageRoot: output,
        expectedZipSha256: sha256(zipFixture),
      })).toThrow(/ZIP SHA-256/i);

      const substitutedPackage = storedZip([
        ['dist.tar.gz', Buffer.from('not the package archive')],
        ['evidence.json', readFileSync(join(output, 'evidence.json'))],
      ]);
      expect(() => validateHomeArtifactZip({
        zipBytes: substitutedPackage,
        packageRoot: output,
        expectedZipSha256: sha256(substitutedPackage),
      })).toThrow(/differs from the validated package bytes/i);

      const traversal = storedZip([
        ['dist.tar.gz', readFileSync(join(output, 'dist.tar.gz'))],
        ['../evidence.json', readFileSync(join(output, 'evidence.json'))],
      ]);
      expect(() => validateHomeArtifactZip({
        zipBytes: traversal,
        packageRoot: output,
        expectedZipSha256: sha256(traversal),
      })).toThrow(/unsafe|root/i);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  it('pins the exact workflow dispatch, build, validation, and artifact contract', () => {
    const workflow = readFileSync(
      join(root, '.github', 'workflows', 'mission-spine-home-dist.yml'),
      'utf8',
    );
    const dispatch = workflow.match(/\non:\n([\s\S]*?)\npermissions:/)?.[1];
    expect(dispatch).toBeTruthy();
    expect(dispatch.match(/^  [A-Za-z_][A-Za-z0-9_-]*:/gm)).toEqual([
      '  workflow_dispatch:',
    ]);
    for (const input of [
      'release_id',
      'candidate_spec_sha256',
      'home_source_sha',
      'dist_sha256',
    ]) {
      expect(dispatch).toMatch(new RegExp(
        `      ${input}:\\n        description: [^\\n]+\\n        required: true\\n        type: string(?:\\n|$)`,
      ));
    }
    expect(dispatch.match(/^      [A-Za-z_][A-Za-z0-9_-]*:/gm)).toHaveLength(4);
    expect(dispatch).not.toMatch(/\n\s+(?:default|options):/);
    expect(workflow).toContain('test "${GITHUB_RUN_ATTEMPT}" = 1');
    expect(workflow).toContain('test "${GITHUB_REF}" = refs/heads/master');
    expect(workflow).toContain("node-version: '24.12.0'");
    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('npm run build');
    expect(workflow).toContain('test -z "$(git status --porcelain=v1 --untracked-files=all)"');
    expect(workflow).toContain('package-home-dist');
    expect(workflow).toContain('validate-home-dist');
    expect(workflow).toContain('${{ inputs.release_id }}-home-dist-run-${{ github.run_id }}-attempt-${{ github.run_attempt }}');
    expect(workflow).toContain('overwrite: false');
    expect(workflow).toContain(
      'actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803  # v6.1.0',
    );
    expect(workflow).toContain(
      'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.4.0',
    );
    expect(workflow).toContain(
      'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02  # v4.6.2',
    );
    expect(workflow).not.toMatch(/secrets\.|wrangler|deploy/i);

    const uses = [...workflow.matchAll(/^\s*(?:-\s+)?uses: ([^@\s]+)@([^\s#]+)(?:\s+#\s*(\S+))?\s*$/gm)];
    expect(uses.length).toBeGreaterThan(0);
    for (const use of uses) {
      expect(use[2]).toMatch(/^[0-9a-f]{40}$/);
      expect(use[3]).toMatch(/^v\d+(?:\.\d+){0,2}$/);
    }
  });
});
