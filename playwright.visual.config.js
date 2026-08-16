import { defineConfig } from '@playwright/test';

import { validateCandidateSpec, CANDIDATE_SPEC_PATH } from './scripts/visual-evidence.mjs';
import { readFileSync } from 'node:fs';

const candidate = validateCandidateSpec(JSON.parse(readFileSync(CANDIDATE_SPEC_PATH, 'utf8')));
const PORT = 4333;

if (process.env.CI && process.env.HOME_VISUAL_BASELINE_UPDATE === '1') {
  throw new Error('visual baselines cannot be updated in CI');
}

export default defineConfig({
  testDir: './e2e/visual',
  testMatch: 'home.visual-a11y.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? 'github' : 'list',
  outputDir: 'test-results/visual-a11y',
  snapshotPathTemplate: '{testDir}/baselines/{arg}{ext}',
  globalTeardown: './e2e/visual/support/global-teardown.js',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: 'chromium',
    locale: candidate.runtime.locale,
    timezoneId: candidate.runtime.timezone_id,
    deviceScaleFactor: candidate.runtime.device_scale_factor,
    colorScheme: candidate.runtime.color_scheme,
    reducedMotion: candidate.runtime.reduced_motion,
    serviceWorkers: 'block',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'production-dist-light',
      use: { viewport: { width: 1240, height: 900 } },
    },
  ],
  webServer: {
    command: `npm run build && node scripts/serve.mjs dist ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
