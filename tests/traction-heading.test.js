// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { renderTraction } from '../src/widgets/traction.js';

describe('traction 제목은 렌더된 근거와 일치한다', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section class="traction">
        <h2 class="traction__title">베타 진행 상황</h2>
        <div class="traction__ticker"></div>
      </section>`;
  });

  it('수치 fallback이면 베타 진행 상황을 유지한다', () => {
    renderTraction(document.querySelector('.traction__ticker'), { mode: 'fallback' });
    expect(document.querySelector('.traction__title').textContent).toBe('베타 진행 상황');
  });

  it('검증된 수치를 렌더할 때만 숫자 제목으로 바꾼다', () => {
    renderTraction(document.querySelector('.traction__ticker'), {
      mode: 'stats',
      stats: { signups: 42, diagnoses_completed: 30, satisfaction: 4.6 },
    });
    expect(document.querySelector('.traction__title').textContent).toBe('숫자로 보는 지금');
  });
});
