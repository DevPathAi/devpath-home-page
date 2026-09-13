import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
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

  it('카드 비교 없이 승인된 3행 가격표만 둔다', () => {
    expect(html.match(/class="price-row"/g) ?? []).toHaveLength(3);
    expect(html).not.toMatch(/pricing__tier|기능 비교/);
  });
});

// href="#"는 클릭해도 아무 일이 없는 죽은 링크다. 심사위원이 클릭할 자리다.
// 내비게이션의 href="#pricing" 같은 앵커는 정확 일치가 아니라 무관하다.
describe('끊어진 링크', () => {
  it('문의와 제품 Q&A를 승인된 경로로 분리한다', () => {
    expect(html).toContain('<a href="/contact">문의·오류 신고</a>');
    expect(html).toContain('<a href="https://app.leva.ai.kr/community">제품 Q&amp;A</a>');
  });

  it('제거하기로 한 과거 프로젝트 링크가 없다', () => {
    expect(html).not.toMatch(/StockPilot|LearnFlow/);
  });

  it('연결 예정 안내 문구가 사라졌다', () => {
    expect(html).not.toContain('링크는 정리 후 연결 예정');
  });
});

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

describe('개인정보 처리방침', () => {
  it('privacy.html이 존재한다', () => {
    expect(existsSync(root('privacy.html'))).toBe(true);
  });

  it('배포 화이트리스트에 등록돼 있다', () => {
    const build = readFileSync(root('build.mjs'), 'utf-8');
    const m = build.match(/const DEPLOY_ENTRIES = \[([^\]]*)\]/);
    expect(m?.[1]).toContain("'privacy.html'");
  });

  // Cloudflare Pages는 .html 확장자를 떼는 clean URL로 308 리다이렉트한다.
  // /privacy.html로 링크하면 불필요한 홉이 한 번 생기므로 정규 경로로 건다.
  it('푸터 링크가 리다이렉트 없는 /privacy로 연결된다', () => {
    expect(html).toContain('<a href="/privacy">개인정보 처리방침</a>');
    expect(html).not.toContain('href="/privacy.html"');
  });

  it('index.html에 죽은 링크가 하나도 없다', () => {
    expect(html).not.toContain('href="#"');
  });

  it('푸터에 상호와 사업자등록번호가 있다', () => {
    expect(html).toContain('레바');
    expect(html).toContain('796-76-00732');
  });

  it('푸터에 대표자명과 주소가 없다', () => {
    // 성명은 처리방침 안에만, 주소는 어디에도 넣지 않는다.
    expect(html).not.toContain('김민구');
    expect(html).not.toContain('가람로');
  });
});

describe('처리방침 내용', () => {
  const doc = readFileSync(root('privacy.html'), 'utf-8');

  it('운영주체와 보호책임자를 밝힌다', () => {
    expect(doc).toContain('레바');
    expect(doc).toContain('796-76-00732');
    expect(doc).toContain('김민구');
    expect(doc).toContain('info@leva.ai.kr');
  });

  it('canonical이 리다이렉트되지 않는 URL을 가리킨다', () => {
    expect(doc).toContain('<link rel="canonical" href="https://leva.ai.kr/privacy" />');
  });

  it('사업장 주소를 게시하지 않는다', () => {
    expect(doc).not.toContain('가람로');
    expect(doc).not.toContain('구포동');
  });

  it('수집 항목을 실제 폼과 일치하게 밝힌다', () => {
    for (const f of ['이메일', '현재 단계', 'UTM', '유입 경로']) {
      expect(doc).toContain(f);
    }
  });

  it('처리위탁처 3곳을 밝힌다', () => {
    expect(doc).toContain('Google');
    expect(doc).toContain('Cloudflare');
    expect(doc).toContain('AdSense');
  });

  it('애드센스 정책이 요구하는 쿠키·제3자 고지를 담는다', () => {
    expect(doc).toContain('쿠키');
    expect(doc).toContain('웹비콘');
    expect(doc).toContain('adssettings.google.com');
  });

  it('PIPA 필수 항목 제목이 모두 있다', () => {
    for (const h of [
      '처리 목적', '보유 기간', '제3자 제공', '처리위탁',
      '정보주체', '파기', '안전성 확보', '개인정보 보호책임자',
      '권익침해', '변경',
    ]) {
      expect(doc).toContain(h);
    }
  });
});
