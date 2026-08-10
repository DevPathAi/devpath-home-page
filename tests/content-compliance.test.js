import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(
  fileURLToPath(new URL('../index.html', import.meta.url)),
  'utf-8',
);

// 사업계획서: 단계형 단일가, 하한 9,900원 확정, 진입가 하향 미채택.
describe('가격 — 사업계획서 정합', () => {
  it('9,900원 유료 플랜이 있다', () => {
    expect(html).toContain('9,900원');
  });

  it('하한 미만 진입가(4,900원)가 없다', () => {
    expect(html).not.toContain('4,900');
  });

  it('상위 플랜(14,900원)이 없다', () => {
    expect(html).not.toContain('14,900');
  });

  it('유료 플랜 카드가 정확히 하나다', () => {
    const paid = html.match(/pricing__tier pricing__tier--soon/g) ?? [];
    expect(paid).toHaveLength(1);
  });
});
