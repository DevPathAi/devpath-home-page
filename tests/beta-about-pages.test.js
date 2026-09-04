import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf-8');

// 정적 페이지는 원고와 금지 목록이 다르다. 사업자등록번호와 성명은
// 처리방침·푸터에 이미 의도적으로 게시돼 있다.
const FORBIDDEN = [
  { name: 'CF Account/Zone ID', re: /\b[0-9a-f]{32}\b/ },
  { name: 'Apps Script 배포 URL', re: /script\.google\.com\/macros/ },
];

describe('/beta 페이지', () => {
  const html = read('beta.html');

  it('canonical이 확장자·슬래시 없는 자기 URL이다', () => {
    expect(html).toContain('<link rel="canonical" href="https://leva.ai.kr/beta" />');
    expect(html).toContain('<meta property="og:url" content="https://leva.ai.kr/beta" />');
  });

  it('색인을 허용한다', () => {
    expect(html).toMatch(/<meta name="robots" content="index, follow"/);
  });

  it('애드센스 스크립트는 넣되 광고 슬롯은 넣지 않는다', () => {
    expect(html).toContain('ca-pub-2785578834914321');
    expect(html).not.toContain('adsbygoogle"');
  });

  // 위젯은 [data-widget] 셀렉터로 마운트되므로 main.js가 있어야 동작한다.
  it('신청 폼 위젯과 그 위젯을 마운트할 스크립트가 함께 있다', () => {
    expect(html).toContain('data-widget="lead-form"');
    expect(html).toMatch(/<script[^>]+src="\/src\/main\.js"/);
  });

  it('공개 진단과 AI 멘토 초대 경로를 명확히 구분한다', () => {
    expect(html).toContain('href="https://app.leva.ai.kr/diagnostic"');
    expect(html).toContain('AI 멘토 베타 초대받기');
    expect(html).toContain('AI 멘토는 대기자 등록 후 순차 초대');
    expect(html).not.toContain('진단 초대');
  });

  // 「며칠」 같은 낱말 자체를 막으면 무관한 문장까지 걸린다(실제로 커뮤니티
  // 문단의 "며칠을 줄이기도 합니다"가 걸렸다). 기간을 약속하는 형태만 막는다.
  it('확정되지 않은 초대 기간을 약속하지 않는다', () => {
    expect(html).not.toMatch(/(며칠|영업일|\d+\s*일)\s*(안에|이내|내로)/);
  });

  it.each(FORBIDDEN)('$name을(를) 담지 않는다', ({ re }) => {
    expect(re.test(html)).toBe(false);
  });
});

describe('/about 페이지', () => {
  const html = read('about.html');

  it('canonical이 확장자·슬래시 없는 자기 URL이다', () => {
    expect(html).toContain('<link rel="canonical" href="https://leva.ai.kr/about" />');
    expect(html).toContain('<meta property="og:url" content="https://leva.ai.kr/about" />');
  });

  it('색인을 허용한다', () => {
    expect(html).toMatch(/<meta name="robots" content="index, follow"/);
  });

  it('애드센스 스크립트는 넣되 광고 슬롯은 넣지 않는다', () => {
    expect(html).toContain('ca-pub-2785578834914321');
    expect(html).not.toContain('adsbygoogle"');
  });

  it('회사 정보와 연락처를 싣는다', () => {
    expect(html).toContain('레바');
    expect(html).toContain('796-76-00732');
    expect(html).toContain('mailto:info@leva.ai.kr');
  });

  // 결제 기능이 없어 표시의무가 없다. 실수로 넣지 않도록 막는다.
  it('사업장 주소를 싣지 않는다', () => {
    expect(html).not.toMatch(/[가-힣]+시\s+[가-힣]+구/);
  });

  // 처리방침의 법정 기재는 그대로 두되, 소개 페이지에서는 다루지 않기로 했다.
  it('창업자 서사에 실명을 쓰지 않는다', () => {
    expect(html).not.toContain('김민구');
  });

  it.each(FORBIDDEN)('$name을(를) 담지 않는다', ({ re }) => {
    expect(re.test(html)).toBe(false);
  });
});

describe('홈에서 소개로', () => {
  it('창업자 섹션이 /about으로 잇는다', () => {
    expect(read('index.html')).toContain('href="/about"');
  });
});
