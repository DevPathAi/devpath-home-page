import { defineConfig, devices } from '@playwright/test';

import {
  createListOnlyReleaseContext,
  loadReleaseContext,
} from './e2e/release/support/release-context.js';

// `--list` is the only intentionally credential-free mode. Hooks in both
// specs reject this context if a caller attempts to execute instead of list.
const listOnly = process.argv.includes('--list');
export const releaseContext = listOnly
  ? createListOnlyReleaseContext()
  : loadReleaseContext(process.env);

export default defineConfig({
  testDir: './e2e/release',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 15 * 60_000,
  globalTimeout: 35 * 60_000,
  expect: { timeout: 30_000 },
  reporter: 'line',
  preserveOutput: 'never',
  use: {
    baseURL: releaseContext.landingOrigin,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    ignoreHTTPSErrors: false,
    serviceWorkers: 'block',
    navigationTimeout: 45_000,
    actionTimeout: 30_000,
    launchOptions: {
      args: [
        `--host-resolver-rules=${releaseContext.chromiumHostResolverRules}`,
      ],
    },
  },
  projects: [
    {
      name: 'release-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
