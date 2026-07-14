// 창업자 스크롤리텔링 (T7). 서사 문단(data-beat)이 스크롤 진입 시 부드럽게 나타난다.
// prefers-reduced-motion 이면 애니메이션 없이 즉시 전부 노출(정적 폴백, T13과 정합).

export function mount(el) {
  const beats = Array.from(el.querySelectorAll('[data-beat]'));
  if (!beats.length) return;

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 애니메이션을 켤 때만 시작 상태(is-beat) 부여 — JS/모션 꺼짐 시 텍스트 그대로 보이게.
  if (reduce || !('IntersectionObserver' in window)) {
    beats.forEach((b) => b.classList.add('is-visible'));
    return;
  }

  beats.forEach((b) => b.classList.add('is-beat'));

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });

  beats.forEach((b) => observer.observe(b));
}
