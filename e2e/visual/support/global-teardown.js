import { join } from 'node:path';

import { generateEvidenceManifests } from '../../../scripts/visual-evidence.mjs';

export default async function globalTeardown(config) {
  const outputDirectory = config.projects[0].outputDir;
  generateEvidenceManifests({
    recordsDirectory: outputDirectory,
    outputDirectory: join(outputDirectory, 'manifests'),
  });
}
