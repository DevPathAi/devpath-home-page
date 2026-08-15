import { buildJourneyHandoffUrl, generateOpaqueJourneyId, getOrCreateJourneyId } from './journey-id.js';

const APP_ORIGIN = 'https://app.leva.ai.kr';

function ctaLocation(link) {
  if (link.closest('.site-header')) return 'header';
  if (link.closest('#mini-diagnostic')) return 'mini_diagnostic';
  if (link.closest('#pricing')) return 'pricing';
  if (link.closest('.hero')) return 'hero';
  return null;
}

function appLink(target) {
  if (!(target instanceof Element)) return null;
  const link = target.closest('a[href]');
  if (!link) return null;
  try {
    return new URL(link.href).origin === APP_ORIGIN ? link : null;
  } catch (_) {
    return null;
  }
}

export function instrumentLandingJourney({
  root,
  analytics,
  storage,
  crypto = globalThis.crypto,
}) {
  const pageViewId = generateOpaqueJourneyId(crypto);
  let journeyId;
  try {
    journeyId = getOrCreateJourneyId({ storage, crypto });
  } catch (_) {
    // Crypto/storage denial must leave the existing product navigation intact.
  }

  analytics.capture('landing_viewed', { page_view_id: pageViewId });

  const onClick = (event) => {
    const link = appLink(event.target);
    if (!link) return;
    if (journeyId) {
      try {
        link.href = buildJourneyHandoffUrl(link.href, journeyId);
      } catch (_) {
        // Preserve the original href when decoration is unavailable.
      }
    }
    const location = ctaLocation(link);
    if (location) {
      analytics.capture('landing_diagnostic_cta_clicked', {
        page_view_id: pageViewId,
        cta_location: location,
      });
    }
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
