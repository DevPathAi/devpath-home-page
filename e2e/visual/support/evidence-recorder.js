import { writeFileSync } from 'node:fs';

const EMPTY_VIOLATIONS = Object.freeze({
  critical: 0,
  serious: 0,
  moderate: 0,
  minor: 0,
  total: 0,
});

export function violationCounts(violations = []) {
  const counts = { ...EMPTY_VIOLATIONS };
  for (const violation of violations) {
    const impact = ['critical', 'serious', 'moderate', 'minor'].includes(violation.impact)
      ? violation.impact
      : 'minor';
    counts[impact] += 1;
    counts.total += 1;
  }
  return counts;
}

function writeRecord(testInfo, value) {
  writeFileSync(
    testInfo.outputPath('sanitized-evidence.json'),
    `${JSON.stringify(value, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );
}

export async function runEvidenceCase({ testInfo, catalogCase }, work) {
  const base = {
    schema_version: 2,
    document_type: 'home-visual-a11y-case-record',
    case_id: catalogCase.id,
    kind: catalogCase.kind,
  };
  try {
    const result = await work();
    writeRecord(testInfo, {
      ...base,
      status: 'passed',
      check_count: result.checkCount,
      failed_check_count: 0,
      artifact_sha256: catalogCase.kind === 'visual' ? result.artifactSha256 : null,
      violation_counts: catalogCase.kind === 'a11y'
        ? (result.violationCounts ?? EMPTY_VIOLATIONS)
        : null,
    });
    return result;
  } catch (cause) {
    const sanitizedEvidence = cause && typeof cause === 'object'
      ? cause.sanitizedEvidence
      : undefined;
    writeRecord(testInfo, {
      ...base,
      status: 'failed',
      check_count: catalogCase.checks.length,
      failed_check_count: sanitizedEvidence?.failedCheckCount ?? 1,
      artifact_sha256: catalogCase.kind === 'visual' ? '0'.repeat(64) : null,
      violation_counts: catalogCase.kind === 'a11y'
        ? (sanitizedEvidence?.violationCounts ?? EMPTY_VIOLATIONS)
        : null,
    });
    throw cause;
  }
}
