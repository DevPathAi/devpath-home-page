import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../terms.html', import.meta.url)), 'utf-8');

// <h2>제목</h2> 부터 다음 <h2> 직전까지를 한 조로 자른다.
function article(titleFragment) {
  const heads = [...html.matchAll(/<h2>([\s\S]*?)<\/h2>/g)];
  const idx = heads.findIndex((h) => h[1].includes(titleFragment));
  if (idx === -1) return null;
  const start = heads[idx].index;
  const end = idx + 1 < heads.length ? heads[idx + 1].index : html.length;
  return html.slice(start, end);
}

const text = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('약관이 실제 서비스를 규정한다', () => {
  it('제공하는 서비스가 모두 적혀 있다', () => {
    const t = text(article('서비스의 내용'));
    for (const item of ['진단', '학습 경로', 'AI 멘토', '커뮤니티', '코드']) {
      expect(t).toContain(item);
    }
  });

  it('베타이며 무상 제공임을 밝힌다', () => {
    expect(text(article('서비스의 내용'))).toMatch(/베타/);
    expect(text(article('서비스의 내용'))).toMatch(/무상|무료/);
  });

  it('만 14세 미만 제한이 서버 차단과 일치한다', () => {
    expect(text(article('이용계약의 성립'))).toContain('만 14세 미만');
  });
});

describe('나중에 바꾸기 어려운 조항', () => {
  // 저작권 귀속을 뒤집으면 이미 게시한 회원의 권리에 영향을 준다.
  it('콘텐츠 저작권이 회원에게 있다고 못박는다', () => {
    const t = text(article('콘텐츠의 권리'));
    expect(t).toMatch(/저작권은.*회원에게/);
    expect(t).toContain('비독점');
  });

  it('AI 생성물의 정확성을 보장하지 않는다고 밝힌다', () => {
    const t = text(article('AI 생성물'));
    expect(t).toMatch(/보장하지 않/);
    expect(t).toMatch(/참고/);
  });

  // 신고→판정→비공개는 이미 구현된 기능이다. 약관에 근거가 없으면
  // 제재를 할 수 없다.
  it('신고와 제재 절차의 근거가 있다', () => {
    const t = text(article('커뮤니티'));
    for (const item of ['신고', '비공개', '이용']) {
      expect(t).toContain(item);
    }
  });
});

describe('범위를 넘지 않는다', () => {
  // 결제는 구현돼 있지 않다. 없는 기능을 규정하면 약관이 사실과 어긋난다.
  it('결제·환불·청약철회 조항이 없다', () => {
    const t = text(html);
    for (const forbidden of ['청약철회', '환불', '결제대금']) {
      expect(t).not.toContain(forbidden);
    }
  });

  // 무상 서비스라 표시의무 대상이 아니다. privacy.html 과 같은 기준.
  it('사업장 주소를 게시하지 않는다', () => {
    expect(text(html)).not.toMatch(/주소\s*:/);
  });
});

describe('표기 일관성', () => {
  it('사업자 표기가 처리방침과 같다', () => {
    expect(html).toContain('796-76-00732');
    expect(html).toContain('info@leva.ai.kr');
  });

  it('옛 브랜드가 남아 있지 않다', () => {
    expect(html).not.toContain('DevPath');
    expect(html).not.toContain('devpath.ai');
  });

  it('시행일이 명시돼 있다', () => {
    expect(html).toContain('시행일: 2026년 8월 12일');
  });
});
