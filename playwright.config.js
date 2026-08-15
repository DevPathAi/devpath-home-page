import { defineConfig, devices } from '@playwright/test';

// 같은 스펙을 production dist와 빠른 source root 양쪽에서 실행한다.
// release smoke는 반드시 해시 자산이 적용된 dist를 통과해야 한다.
const DIST_PORT = 4321;
const SOURCE_PORT = 4322;

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/release/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'production-dist',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${DIST_PORT}`,
      },
    },
    {
      name: 'source-root',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${SOURCE_PORT}`,
      },
    },
  ],
  webServer: [
    {
      command: `npm run build && node scripts/serve.mjs dist ${DIST_PORT}`,
      url: `http://127.0.0.1:${DIST_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `node scripts/serve.mjs . ${SOURCE_PORT}`,
      url: `http://127.0.0.1:${SOURCE_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
