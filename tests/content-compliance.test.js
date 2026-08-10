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

// href="#"는 클릭해도 아무 일이 없는 죽은 링크다. 심사위원이 클릭할 자리다.
// 내비게이션의 href="#pricing" 같은 앵커는 정확 일치가 아니라 무관하다.
describe('끊어진 링크', () => {
  it('제휴가 문의 메일로 연결된다', () => {
    expect(html).toContain('<a href="mailto:info@leva.ai.kr">제휴</a>');
  });

  it('StockPilot과 LearnFlow가 링크가 아닌 평문이다', () => {
    expect(html).not.toContain('>StockPilot</a>');
    expect(html).not.toContain('>LearnFlow</a>');
    expect(html).toContain('StockPilot');
    expect(html).toContain('LearnFlow');
  });

  it('연결 예정 안내 문구가 사라졌다', () => {
    expect(html).not.toContain('링크는 정리 후 연결 예정');
  });
});
