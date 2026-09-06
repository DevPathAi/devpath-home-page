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

  it('Home 리드폼 없이 앱 로그인에서 초대를 신청한다', () => {
    expect(html).not.toContain('data-widget="lead-form"');
    expect(html).toContain('href="https://app.leva.ai.kr/login"');
  });

  it('공개 진단과 AI 멘토 초대 경로를 명확히 구분한다', () => {
    expect(html).toContain('href="https://app.leva.ai.kr/diagnostic"');
    expect(html).toContain('AI 멘토 베타 초대받기');
    expect(html).toContain('초대 대기 명단에 등록');
    expect(html).not.toContain('진단 초대');
  });

  it('초대 처리 기준과 대기 중 가능한 행동을 알린다', () => {
    expect(html).toContain('승인 상태는 로그인 후 확인할 수 있습니다.');
    expect(html).toContain('로드맵 첫 주차 미션을 시작');
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
