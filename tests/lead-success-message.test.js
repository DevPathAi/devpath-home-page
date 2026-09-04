import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { successMessage } from '../src/widgets/lead-form.js';

// 이 시스템에는 확인 메일을 보내는 코드가 없었는데도 성공 화면이
// "확인 메일을 발송했으니 스팸함도 확인해 주세요"라고 단언하고 있었다.
// 하지 않은 일을 했다고 말하지 않도록, 문구를 실제 발송 결과에 종속시킨다.
describe('successMessage', () => {
  it('발송이 확인됐을 때만 메일을 보냈다고 말한다', () => {
    expect(successMessage(true)).toContain('확인 메일');
    expect(successMessage(true)).toContain('스팸함');
    expect(successMessage(true)).toContain('AI 멘토 베타 초대');
  });

  it('발송이 확인되지 않으면 보냈다고 말하지 않는다', () => {
    const msg = successMessage(false);

    expect(msg).not.toContain('발송');
    expect(msg).not.toContain('스팸함');
    expect(msg).toContain('확인 후');
    expect(msg).toContain('AI 멘토 베타 초대');
  });

  // 서버가 이 필드를 안 주는 상태(구 배포·기능 미반영)에서도 거짓말하면 안 된다.
  it('발송 여부를 모르면 보냈다고 말하지 않는다', () => {
    expect(successMessage(undefined)).not.toContain('발송');
    expect(successMessage(null)).not.toContain('발송');
  });
});

describe('정적 마크업', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/widgets/lead-form.js', import.meta.url)),
    'utf-8',
  );
  const markup = source.slice(source.indexOf('function formMarkup'), source.indexOf('export function mount'));

  // 정적 마크업이 발송을 단언하면, 응답과 무관하게 그 문장이 먼저 화면에 뜬다.
  it('초기 마크업이 메일 발송을 단언하지 않는다', () => {
    expect(markup).not.toContain('발송했');
  });

  it('버튼은 공개 진단이 아니라 AI 멘토 초대를 약속한다', () => {
    expect(markup).toContain('AI 멘토 초대받기');
    expect(markup).not.toContain('진단 초대받기');
  });
});
