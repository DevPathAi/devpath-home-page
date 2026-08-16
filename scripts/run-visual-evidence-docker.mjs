import { execFileSync, spawnSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ROOT,
  resolveEvidenceCandidateBinding,
  validateProductRuntimeProvenance,
} from './visual-evidence.mjs';

const PLATFORM = 'mcr.microsoft.com/playwright:v1.61.1-noble@sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48';
export const RELEASE_CANDIDATE_CONTAINER_PATH = '/mission-candidate/spec.raw';
const COMMANDS = `set -e
npm ci
npm run visual:contracts
npm run visual:fonts
npm run visual:fonts:verify
npm run test:visual
npm run visual:evidence:validate`;

export function releaseCandidateDockerArgs(environment = process.env) {
  const binding = resolveEvidenceCandidateBinding(environment);
  if (binding.mode === 'home_local_diagnostic') return [];
  return [
    '--mount',
    `type=bind,source=${binding.path},target=${RELEASE_CANDIDATE_CONTAINER_PATH},readonly`,
    '-e',
    `MISSION_CANDIDATE_SPEC_PATH=${RELEASE_CANDIDATE_CONTAINER_PATH}`,
    '-e',
    `MISSION_CANDIDATE_SPEC_SHA256=${binding.sha256}`,
  ];
}

export function runPinnedVisualEvidence() {
  const worktreeStatus = execFileSync('git', ['status', '--porcelain'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  if (worktreeStatus) {
    throw new Error('canonical visual evidence requires a clean Git worktree');
  }
  const provenance = validateProductRuntimeProvenance();
  const producerSha = provenance.evidence_producer_sha;
  const gitCommonDirectory = execFileSync(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    { cwd: ROOT, encoding: 'utf8' },
  ).trim();
  const gitWorktreeDirectory = execFileSync(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-dir'],
    { cwd: ROOT, encoding: 'utf8' },
  ).trim();
  const gitDirectoryRelative = relative(gitCommonDirectory, gitWorktreeDirectory)
    .replaceAll('\\', '/');
  const containerGitDirectory = gitDirectoryRelative
    ? `/git-common/${gitDirectoryRelative}`
    : '/git-common';
  const result = spawnSync('docker', [
    'run',
    '--rm',
    '--ipc=host',
    '--mount',
    `type=bind,source=${ROOT},target=/work`,
    '--mount',
    'type=volume,destination=/work/node_modules',
    '--mount',
    `type=bind,source=${gitCommonDirectory},target=/git-common,readonly`,
    ...releaseCandidateDockerArgs(process.env),
    '-e',
    `HOME_EVIDENCE_PRODUCER_SHA=${producerSha}`,
    '-e',
    `GIT_DIR=${containerGitDirectory}`,
    '-e',
    'GIT_COMMON_DIR=/git-common',
    '-e',
    'GIT_WORK_TREE=/work',
    '-e',
    'GIT_OPTIONAL_LOCKS=0',
    '-e',
    'GIT_CONFIG_COUNT=3',
    '-e',
    'GIT_CONFIG_KEY_0=safe.directory',
    '-e',
    'GIT_CONFIG_VALUE_0=/work',
    '-e',
    'GIT_CONFIG_KEY_1=core.filemode',
    '-e',
    'GIT_CONFIG_VALUE_1=false',
    '-e',
    'GIT_CONFIG_KEY_2=core.autocrlf',
    '-e',
    'GIT_CONFIG_VALUE_2=true',
    '-w',
    '/work',
    PLATFORM,
    'bash',
    '-lc',
    COMMANDS,
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pinned visual evidence container failed with status ${result.status}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runPinnedVisualEvidence();
}
