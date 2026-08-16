import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  candidateSpecSha256,
  resolveEvidenceCandidateBinding,
  sha256Bytes,
} from '../scripts/visual-evidence.mjs';
import {
  RELEASE_CANDIDATE_CONTAINER_PATH,
  releaseCandidateDockerArgs,
} from '../scripts/run-visual-evidence-docker.mjs';

describe('Home release-candidate evidence binding', () => {
  it('keeps the committed Home candidate only as a local diagnostic fallback', () => {
    expect(resolveEvidenceCandidateBinding({})).toMatchObject({
      mode: 'home_local_diagnostic',
      sha256: candidateSpecSha256(),
    });
    expect(releaseCandidateDockerArgs({})).toEqual([]);
  });

  it('requires an external raw path and out-of-band SHA together', () => {
    expect(() => resolveEvidenceCandidateBinding({
      MISSION_CANDIDATE_SPEC_SHA256: 'a'.repeat(64),
    })).toThrow(/path.*sha|together|pair/i);
    expect(() => resolveEvidenceCandidateBinding({
      MISSION_CANDIDATE_SPEC_PATH: 'candidate.raw',
    })).toThrow(/path.*sha|together|pair/i);
    expect(() => resolveEvidenceCandidateBinding({
      MISSION_CANDIDATE_SPEC_PATH: resolve('candidate.raw'),
      MISSION_CANDIDATE_SPEC_SHA256: 'A'.repeat(64),
    })).toThrow(/lowercase|format/i);
    expect(() => resolveEvidenceCandidateBinding({
      HOME_VISUAL_CANDIDATE_SPEC_SHA256: 'a'.repeat(64),
    })).toThrow(/external.*pair|path.*sha/i);
    expect(() => resolveEvidenceCandidateBinding({
      MISSION_CANDIDATE_SPEC_PATH: resolve('candidate.raw,target=/work'),
      MISSION_CANDIDATE_SPEC_SHA256: 'a'.repeat(64),
    })).toThrow(/bind mount|safe/i);

    const relativePath = 'e2e/visual/case-catalog.v2.json';
    expect(() => resolveEvidenceCandidateBinding({
      MISSION_CANDIDATE_SPEC_PATH: relativePath,
      MISSION_CANDIDATE_SPEC_SHA256: sha256Bytes(readFileSync(relativePath)),
    })).toThrow(/absolute/i);
  });

  it('hashes the external raw bytes and mounts only that file read-only', () => {
    const temporary = mkdtempSync(join(tmpdir(), 'home-release-candidate-'));
    const candidatePath = join(temporary, 'mission-candidate.raw.json');
    const raw = Buffer.from('{"schema_version":2,"release":"candidate"}\n', 'utf8');
    const sha256 = sha256Bytes(raw);
    writeFileSync(candidatePath, raw);
    try {
      const environment = {
        MISSION_CANDIDATE_SPEC_PATH: candidatePath,
        MISSION_CANDIDATE_SPEC_SHA256: sha256,
      };
      expect(resolveEvidenceCandidateBinding(environment)).toEqual({
        mode: 'external_release',
        path: resolve(candidatePath),
        sha256,
      });
      expect(releaseCandidateDockerArgs(environment)).toEqual([
        '--mount',
        `type=bind,source=${resolve(candidatePath)},target=${RELEASE_CANDIDATE_CONTAINER_PATH},readonly`,
        '-e',
        `MISSION_CANDIDATE_SPEC_PATH=${RELEASE_CANDIDATE_CONTAINER_PATH}`,
        '-e',
        `MISSION_CANDIDATE_SPEC_SHA256=${sha256}`,
      ]);

      writeFileSync(candidatePath, Buffer.from('tampered\n', 'utf8'));
      expect(() => resolveEvidenceCandidateBinding(environment)).toThrow(/raw.*sha|hash.*match/i);
      expect(() => releaseCandidateDockerArgs(environment)).toThrow(/raw.*sha|hash.*match/i);
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });
});
