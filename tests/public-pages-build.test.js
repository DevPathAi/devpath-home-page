import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const output = (path) => root(`build/public-pages-dist/${path}`);

describe('Phase 0 공개 페이지 빌드', () => {
  beforeAll(() => {
    execFileSync('node', ['build.mjs'], {
      cwd: root('.'),
      stdio: 'pipe',
      env: { ...process.env, BUILD_OUTPUT_DIR: 'build/public-pages-dist' },
    });
  }, 60_000);

  it('/updates HTML과 feed를 함께 낸다', () => {
    expect(existsSync(output('updates/index.html'))).toBe(true);
    expect(existsSync(output('updates/feed.json'))).toBe(true);
    expect(JSON.parse(readFileSync(output('updates/feed.json'), 'utf8')).items.length).toBeGreaterThan(0);
  });

  it('/contact와 실제 앱 캡처를 배포한다', () => {
    expect(existsSync(output('contact.html'))).toBe(true);
    const assets = readFileSync(output('index.html'), 'utf8');
    expect(assets).toMatch(/\/assets\/live-diagnostic-result\.[0-9a-f]{8}\.png/);
    expect(assets).toMatch(/\/assets\/live-mentor\.[0-9a-f]{8}\.png/);
    expect(assets).toMatch(/\/assets\/live-backend-path\.[0-9a-f]{8}\.png/);
  });

  it('최신 개발 기록 3편을 build-time으로 투영한다', () => {
    const html = readFileSync(output('index.html'), 'utf8');
    expect((html.match(/class="record"/g) ?? [])).toHaveLength(3);
    expect(html).not.toContain('LATEST_NOTES_PLACEHOLDER');
  });
});
