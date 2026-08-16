import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { collectNotes } from '../scripts/notes.mjs';

const notes = collectNotes(fileURLToPath(new URL('../content/notes', import.meta.url)));

// 사람이 매번 눈으로 확인하는 방식은 실패한다. 기계로 강제한다.
const FORBIDDEN = [
  { name: 'Cloudflare Account/Zone ID', re: /\b[0-9a-f]{32}\b/ },
  { name: '사업자등록번호', re: /\b\d{3}-\d{2}-\d{5}\b/ },
  { name: 'Apps Script 배포 URL', re: /script\.google\.com\/macros/ },
  { name: '대표자명', re: /김민구/ },
];

describe('원고 공개 금지 정보', () => {
  it('원고가 있다', () => {
    expect(notes.length).toBeGreaterThan(0);
  });

  it.each(FORBIDDEN)('$name을(를) 담지 않는다', ({ re }) => {
    const hits = notes.filter((n) => re.test(n.body) || re.test(n.title) || re.test(n.description));

    expect(hits.map((n) => n.slug)).toEqual([]);
  });

  it('본문이 1,000자 이상이다', () => {
    const thin = notes.filter((n) => n.body.replace(/\s/g, '').length < 1000);

    expect(thin.map((n) => n.slug)).toEqual([]);
  });
});
