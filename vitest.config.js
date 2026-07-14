import { defineConfig } from 'vitest/config';

// 유닛 테스트: 순수 로직(api.js, traction fallback, form-utils)은 node 환경,
// DOM 위젯 렌더 테스트는 파일 상단 `// @vitest-environment jsdom` 주석으로 개별 지정.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    globals: false,
  },
});
