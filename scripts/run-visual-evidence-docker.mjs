import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT } from './visual-evidence.mjs';

const PLATFORM = 'mcr.microsoft.com/playwright:v1.61.1-noble@sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48';
const COMMANDS = `set -e
npm ci
npm run visual:contracts
npm run visual:fonts
npm run visual:fonts:verify
npm run test:visual
npm run visual:evidence:validate`;

export function runPinnedVisualEvidence() {
  const worktreeStatus = execFileSync('git', ['status', '--porcelain'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  if (worktreeStatus) {
    throw new Error('canonical visual evidence requires a clean Git worktree');
  }
  const producerSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim().toLowerCase();
  const result = spawnSync('docker', [
    'run',
    '--rm',
    '--ipc=host',
    '--mount',
    `type=bind,source=${ROOT},target=/work`,
    '--mount',
    'type=volume,destination=/work/node_modules',
    '-e',
    `HOME_EVIDENCE_PRODUCER_SHA=${producerSha}`,
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
