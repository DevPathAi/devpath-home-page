import {
  closeSync,
  mkdirSync,
  openSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';

const JOURNEYS = new Set([
  'mission-spine-onboarding',
  'mission-spine-workspace',
]);
const RESULTS = new Set(['passed', 'failed']);
const STEP = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROUTE = /^\/(?:[A-Za-z0-9._~-]+\/?)*$/;
const SHA256 = /^[0-9a-f]{64}$/;

export function evidenceRoute(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return '/';
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '/';
  return parsed.pathname || '/';
}

function evidenceRow({ route, step, result, durationMs }, candidateSpecSha256) {
  if (typeof route !== 'string' || !ROUTE.test(route)) {
    throw new Error('evidence route must be a query-free absolute path');
  }
  if (typeof step !== 'string' || !STEP.test(step)) {
    throw new Error('evidence step must be a bounded slug');
  }
  if (!RESULTS.has(result)) throw new Error('evidence result must be passed or failed');
  if (!Number.isSafeInteger(durationMs) || durationMs < 0 || durationMs > 3_600_000) {
    throw new Error('evidence duration must be a bounded integer');
  }
  return {
    route,
    step,
    result,
    duration_ms: durationMs,
    candidate_spec_sha256: candidateSpecSha256,
  };
}

export class SanitizedEvidence {
  #descriptor;
  #candidateSpecSha256;
  #closed = false;
  #hasRecords = false;

  constructor({ directory, journey, candidateSpecSha256 }) {
    if (!JOURNEYS.has(journey)) throw new Error('unknown release journey');
    if (typeof candidateSpecSha256 !== 'string' || !SHA256.test(candidateSpecSha256)) {
      throw new Error('candidate-spec SHA256 is required for evidence');
    }
    const journeyDirectory = join(directory, journey);
    mkdirSync(journeyDirectory, { recursive: true });
    this.#descriptor = openSync(join(journeyDirectory, 'evidence.json'), 'wx');
    writeSync(this.#descriptor, '[\n', undefined, 'utf8');
    this.#candidateSpecSha256 = candidateSpecSha256;
  }

  record(row) {
    if (this.#closed) throw new Error('evidence writer is closed');
    const sanitized = evidenceRow(row, this.#candidateSpecSha256);
    writeSync(
      this.#descriptor,
      `${this.#hasRecords ? ',\n' : ''}${JSON.stringify(sanitized)}`,
      undefined,
      'utf8',
    );
    this.#hasRecords = true;
  }

  async step({ page, step }, work) {
    const startedAt = performance.now();
    try {
      const value = await work();
      this.record({
        route: evidenceRoute(page.url()),
        step,
        result: 'passed',
        durationMs: Math.round(performance.now() - startedAt),
      });
      return value;
    } catch (error) {
      this.record({
        route: evidenceRoute(page.url()),
        step,
        result: 'failed',
        durationMs: Math.round(performance.now() - startedAt),
      });
      throw error;
    }
  }

  close() {
    if (this.#closed) return;
    writeSync(this.#descriptor, '\n]\n', undefined, 'utf8');
    closeSync(this.#descriptor);
    this.#closed = true;
  }
}
