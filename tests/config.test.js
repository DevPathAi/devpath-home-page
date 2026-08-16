// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// config.js는 import 시점에 전역을 한 번 읽는다. 매 테스트마다 모듈을 다시 평가한다.
describe('런타임 설정 오버라이드', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { delete window.LEVA_CONFIG; });

  it('window.LEVA_CONFIG로 폼 엔드포인트를 덮어쓴다', async () => {
    window.LEVA_CONFIG = { formEndpoint: 'https://script.example.test/exec' };

    const { config } = await import('../src/config.js');

    expect(config.formEndpoint).toBe('https://script.example.test/exec');
  });

  it('오버라이드가 없으면 동일 출처 프록시 경로가 기본값이다', async () => {
    const { config } = await import('../src/config.js');

    expect(config.formEndpoint).toBe('/api/lead');
    expect(config.statsEndpoint).toBe('/api/stats');
    expect(config.appVersion).toBe('dev');
    expect(config.analyticsEnvironment).toBe('development');
  });

  it('production analytics identity must be explicitly supplied together', async () => {
    window.LEVA_CONFIG = {
      appVersion: 'abc123',
      analyticsEnvironment: 'production',
    };

    const { config } = await import('../src/config.js');

    expect(config.appVersion).toBe('abc123');
    expect(config.analyticsEnvironment).toBe('production');
  });
});
