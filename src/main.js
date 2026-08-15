// 페이지 엔트리 (T2). 위젯을 해당 섹션 진입 시 lazy-load 한다(F2 점진적 향상).
// 각 위젯 모듈은 `export function mount(element)` 를 제공한다.
// JS 실패/미로드 시에도 각 마운트의 정적 폴백(.widget-fallback)이 그대로 남는다.

import { config } from './config.js';
import {
  JourneyAnalyticsAdapter,
  shouldExcludeAnalyticsTraffic,
} from './analytics/journey-analytics.js';
import {
  ANALYTICS_SESSION_STORAGE_KEY,
  getOrCreateJourneyId,
  getOrCreateOpaqueId,
} from './analytics/journey-id.js';
import { instrumentLandingJourney } from './analytics/landing.js';

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

function initLandingAnalytics() {
  // main.js is shared with /beta. Only the funnel Landing owns these events.
  if (window.location.pathname !== '/') return;
  try {
    const storage = window.sessionStorage;
    const journeyId = getOrCreateJourneyId({ storage });
    const sessionId = getOrCreateOpaqueId({
      storage,
      key: ANALYTICS_SESSION_STORAGE_KEY,
    });
    const analytics = new JourneyAnalyticsAdapter({
      context: {
        environment: config.analyticsEnvironment,
        appVersion: config.appVersion,
        sessionId,
        journeyId,
        now: () => new Date(),
      },
      // Privacy mode has not been approved yet. No SDK is initialized or called.
      optedOut: true,
      excluded: shouldExcludeAnalyticsTraffic({
        environment: config.analyticsEnvironment,
        appVersion: config.appVersion,
        userAgent: window.navigator.userAgent,
      }),
    });
    instrumentLandingJourney({
      root: document,
      analytics,
      storage,
    });
  } catch (_) {
    // Analytics capability cannot make the Landing unavailable.
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initLandingAnalytics();
    initLazyWidgets();
  }, { once: true });
} else {
  initLandingAnalytics();
  initLazyWidgets();
}
