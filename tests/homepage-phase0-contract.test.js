import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const html = readFileSync(root('index.html'), 'utf8');

describe('Phase 0 승인 홈페이지 계약', () => {
  it('승인된 Hero와 네 단계 문구를 그대로 사용한다', () => {
    expect(html).toContain('사수 없는 0~3년차 개발자의 첫 AI 사수 · 지금은 무료 베타');
    expect(html).toContain('막힐 때마다 AI에게');
    expect(html).toContain('내 상황을 처음부터');
    expect(html).toContain('다시 설명하고 있나요?');
    expect(html).toContain('레바는 학습 이력과 직전 오류를 질문에 자동으로 붙입니다.');
    for (const step of ['진단', '로드맵', 'AI 멘토', '경로 보정']) {
      expect(html).toContain(`<h3>${step}</h3>`);
    }
    expect(html).toContain('진행을 확인하고 다음 미션을 제안합니다. 받아들이면 경로가 바뀝니다.');
  });

  it('같은 질문을 한 번만 보여 주고 After에만 자동 맥락을 둔다', () => {
    const question = 'Spring Boot에서 같은 이메일을 저장할 때 duplicate key 오류가 나는 이유는 무엇인가요?';
    expect(html.split(question)).toHaveLength(2);
    const before = html.slice(html.indexOf('answer before'), html.indexOf('answer after'));
    const afterStart = html.indexOf('answer after');
    const after = html.slice(afterStart, html.indexOf('<section', afterStart));
    expect(before).not.toContain('자동 첨부된 맥락');
    expect(after).toContain('자동 첨부된 맥락');
    expect(after).toContain('학습 주제');
    expect(after).toContain('로드맵 진도');
    expect(after).toContain('직전 오류');
  });

  it('가격·대상·전송 범위·마지막 CTA를 승인 내용으로 제한한다', () => {
    for (const text of ['현재', '무료 베타', '순차 초대 중', '월 9,900원 예정']) {
      expect(html).toContain(text);
    }
    for (const text of ['학습 주제', '로드맵 진도', '직전 오류', '마스킹 표시']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('사수 없이 일하는 0~3년차 현직 개발자');
    expect(html).toContain('오늘 시작할 한 가지 미션을 확인하세요.');
    expect(html).not.toMatch(/코드 파일|DB 스키마|설정 파일/);
  });

  it('Footer의 제품 Q&A와 지원 경로가 분리돼 있다', () => {
    expect(html).toContain('href="https://app.leva.ai.kr/community">제품 Q&amp;A</a>');
    expect(html).toContain('href="#faq">FAQ</a>');
    expect(html).toContain('href="/updates">공지·변경 기록</a>');
    expect(html).toContain('href="/contact">문의·오류 신고</a>');
    expect(html).toContain('href="https://app.leva.ai.kr/login">AI 멘토 초대 신청</a>');
  });

  it('개발용 편집 UI와 내부 용어를 공개하지 않는다', () => {
    expect(html).not.toMatch(/contentEditable|data-pretext|fixture|Phase 0|BACKEND 경로 fixture/i);
    expect(html).not.toContain('data-widget="lead-form"');
    expect(html).not.toContain('id="traction"');
  });
});
