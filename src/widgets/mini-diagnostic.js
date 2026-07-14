// 무가입 미니진단 위젯 (T5). 3문항(캐닝) → 샘플 로드맵 스니펫.
// 알파 로직 의존 없음 — 전부 정적 캐닝. JS 꺼짐 시 .widget-fallback 유지.

const QUESTIONS = [
  {
    key: 'stage',
    label: '지금 어느 단계인가요?',
    options: [
      { value: 'beginner', label: '입문 (막 시작)' },
      { value: 'learning', label: '학습 중' },
      { value: 'job', label: '취업 준비' },
    ],
  },
  {
    key: 'stack',
    label: '주로 쓰는(쓰고 싶은) 스택은?',
    options: [
      { value: 'none', label: '아직 없음' },
      { value: 'frontend', label: '프론트엔드' },
      { value: 'backend', label: '백엔드' },
    ],
  },
  {
    key: 'stuck',
    label: '가장 막히는 지점은?',
    options: [
      { value: 'what', label: '뭘 배울지' },
      { value: 'depth', label: '어떻게 깊이' },
      { value: 'apply', label: '실전 적용' },
    ],
  },
];

// 캐닝된 샘플 로드맵 스니펫 — 답 조합에서 첫 조각을 골라 보여준다(설득용, 정확도보다 체감).
function sampleRoadmap({ stage, stack, stuck }) {
  const track = stack === 'frontend' ? '프론트엔드'
    : stack === 'backend' ? '백엔드'
    : '기초 다지기';
  const first = stage === 'beginner'
    ? '언어 문법과 작은 프로그램 완성 경험'
    : stage === 'job'
    ? '포트폴리오로 이어질 미니 프로젝트'
    : '한 단계 깊은 핵심 개념 정리';
  const focus = stuck === 'apply' ? '작은 실전 과제로 바로 적용'
    : stuck === 'depth' ? '원리를 설명해보며 깊이 확인'
    : '다음에 배울 것만 콕 집기';
  return {
    track,
    steps: [
      `지금 단계: ${first}`,
      `${track} 다음 한 걸음: ${focus}`,
      '막히면 학습 맥락(LCS)을 붙여 AI 멘토에게 질문',
    ],
  };
}

function questionHtml(q, i) {
  const opts = q.options.map((o) =>
    `<button type="button" class="md-opt" data-q="${q.key}" data-v="${o.value}">${o.label}</button>`,
  ).join('');
  return `
    <fieldset class="md-q" data-step="${i}"${i === 0 ? '' : ' hidden'}>
      <legend class="md-q__label"><span class="md-q__n">${i + 1}/3</span> ${q.label}</legend>
      <div class="md-opts">${opts}</div>
    </fieldset>`;
}

function resultHtml(r) {
  const items = r.steps.map((s) => `<li>${s}</li>`).join('');
  return `
    <div class="md-result">
      <p class="md-result__track">추천 트랙: <strong>${r.track}</strong></p>
      <ol class="md-result__steps">${items}</ol>
      <p class="md-result__cta"><a class="btn btn-primary" href="#lead">정식 진단으로 전체 로드맵 받기</a></p>
      <button type="button" class="md-restart">다시 해보기</button>
    </div>`;
}

export function mount(el) {
  const answers = {};
  el.innerHTML = `
    <h2 class="mini-diagnostic__title">20초 미니 진단</h2>
    <p class="mini-diagnostic__intro">세 가지만 고르면 로드맵의 첫 조각을 바로 보여드려요.</p>
    <div class="md-body">${QUESTIONS.map(questionHtml).join('')}</div>`;

  const body = el.querySelector('.md-body');

  function showStep(n) {
    body.querySelectorAll('.md-q').forEach((f) => { f.hidden = Number(f.dataset.step) !== n; });
  }
  function finish() {
    body.innerHTML = resultHtml(sampleRoadmap(answers));
    body.querySelector('.md-restart')?.addEventListener('click', () => mount(el));
  }

  body.addEventListener('click', (e) => {
    const btn = e.target.closest('.md-opt');
    if (!btn) return;
    answers[btn.dataset.q] = btn.dataset.v;
    const step = Number(btn.closest('.md-q').dataset.step);
    if (step < QUESTIONS.length - 1) showStep(step + 1);
    else finish();
  });
}
