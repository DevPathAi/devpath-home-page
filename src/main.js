// 페이지 엔트리 (T2). 위젯을 해당 섹션 진입 시 lazy-load 한다(F2 점진적 향상).
// 각 위젯 모듈은 `export function mount(element)` 를 제공한다.
// JS 실패/미로드 시에도 각 마운트의 정적 폴백(.widget-fallback)이 그대로 남는다.

const WIDGET_LOADERS = {
  'mini-diagnostic': () => import('./widgets/mini-diagnostic.js'),
  'lcs-demo': () => import('./widgets/lcs-demo.js'),
  'traction': () => import('./widgets/traction.js'),
  'scrollytelling': () => import('./widgets/scrollytelling.js'),
  'lead-form': () => import('./widgets/lead-form.js'),
};

async function hydrate(el) {
  const name = el.dataset.widget;
  const loader = WIDGET_LOADERS[name];
  if (!loader) return;
  try {
    const mod = await loader();
    if (typeof mod.mount === 'function') {
      el.dataset.hydrated = 'true';
      mod.mount(el);
    }
  } catch (err) {
    // 위젯 로드 실패 → 정적 폴백 유지. 콘솔에만 남긴다.
    console.warn(`[widget:${name}] 로드 실패, 정적 폴백 유지`, err);
  }
}

function initLazyWidgets() {
  const mounts = Array.from(document.querySelectorAll('[data-widget]'));
  if (!mounts.length) return;

  // IntersectionObserver 미지원 시 즉시 하이드레이트(폴백).
  if (!('IntersectionObserver' in window)) {
    mounts.forEach(hydrate);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        hydrate(entry.target);
      }
    }
  }, { rootMargin: '200px 0px' }); // 뷰포트 진입 직전 미리 로드

  mounts.forEach((el) => observer.observe(el));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLazyWidgets, { once: true });
} else {
  initLazyWidgets();
}
