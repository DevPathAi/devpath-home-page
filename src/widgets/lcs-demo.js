// LCS 나란히 데모 위젯 (T6). 맥락 없음 vs 맥락 첨부 답변을 나란히 비교.
// 캐닝 2~3쌍 전환. 최상급("최초" 등) 표현 없이 "맥락이 답의 쓸모를 높인다"는 검증 가능 프레이밍.

const PAIRS = [
  {
    id: 'jpa',
    q: 'JPA에서 N+1 문제 어떻게 해결해요?',
    plain: `일반적으로 fetch join이나 @EntityGraph를 쓰면 됩니다.
지연 로딩을 즉시 로딩으로 바꾸는 방법도 있습니다.`,
    context: `지금 배우는 주문-회원 예제 기준으로 설명할게요.
Order를 목록 조회할 때 Member가 지연 로딩이라
주문 수만큼 회원 쿼리가 더 나갑니다(N+1).

1) 목록 조회엔 fetch join으로 한 번에:
   select o from Order o join fetch o.member
2) 페이징이 필요하면 @BatchSize로 IN 절 묶기.
이번 예제에선 1번이 맞고, 다음 단계인
페이징 실습에서 2번을 다시 볼게요.`,
  },
  {
    id: 'react',
    q: 'useEffect가 무한으로 다시 실행돼요.',
    plain: `의존성 배열을 확인하세요. 매 렌더마다 새로 만들어지는
객체나 함수가 배열에 들어가면 무한 루프가 납니다.`,
    context: `지금 만드는 검색 입력 컴포넌트 기준이에요.
effect 안에서 setState로 만든 results 객체를
의존성 배열에 넣어서, 상태 갱신 → 재렌더 →
effect 재실행이 반복되고 있어요.

- query(문자열)만 의존성에 두세요.
- 함수는 useCallback으로 고정하거나 effect 안으로.
다음 단계 디바운스 실습에서 이 패턴을 다시 씁니다.`,
  },
  {
    id: 'git',
    q: '머지할 때 충돌이 나면 어떻게 해요?',
    plain: `충돌 난 파일을 열어 표시를 지우고 원하는 코드로
정리한 뒤 add, commit 하면 됩니다.`,
    context: `지금 진행 중인 feat 브랜치 → develop 머지 상황이에요.
충돌은 같은 줄을 양쪽에서 바꿔서 납니다.

1) 충돌 파일에서 <<<< ==== >>>> 사이 중 맞는 쪽 선택
2) 표시 제거 후 git add <파일>
3) git commit (머지 커밋 메시지 그대로)
이번엔 develop 쪽 변경을 살리는 게 맞아요.
다음에 배울 rebase에선 흐름이 조금 달라집니다.`,
  },
];

function tabsHtml(active) {
  return PAIRS.map((p, i) =>
    `<button type="button" class="lcs-tab${i === active ? ' is-active' : ''}" data-i="${i}" role="tab" aria-selected="${i === active}">${p.q}</button>`,
  ).join('');
}

function compareHtml(pair) {
  return `
    <article class="lcs__col">
      <p class="lcs__label lcs__label--plain">맥락 없음</p>
      <p class="lcs__q">“${pair.q}”</p>
      <pre class="lcs__a"><code>${escapeHtml(pair.plain)}</code></pre>
    </article>
    <article class="lcs__col lcs__col--context">
      <p class="lcs__label lcs__label--context">맥락 첨부 (지금 배우는 단계·스택)</p>
      <p class="lcs__q">“${pair.q}”</p>
      <pre class="lcs__a"><code>${escapeHtml(pair.context)}</code></pre>
    </article>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export function mount(el) {
  const compare = el.querySelector('.lcs__compare');
  if (!compare) return;
  let active = 0;

  const tabs = document.createElement('div');
  tabs.className = 'lcs-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', '예시 질문 선택');
  tabs.innerHTML = tabsHtml(active);
  compare.parentNode.insertBefore(tabs, compare);

  function render() {
    compare.classList.remove('widget-fallback');
    compare.innerHTML = compareHtml(PAIRS[active]);
    tabs.querySelectorAll('.lcs-tab').forEach((t, i) => {
      t.classList.toggle('is-active', i === active);
      t.setAttribute('aria-selected', String(i === active));
    });
  }

  tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.lcs-tab');
    if (!tab) return;
    active = Number(tab.dataset.i);
    render();
  });

  render();
}
