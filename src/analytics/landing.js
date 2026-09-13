import { buildJourneyHandoffUrl, generateOpaqueJourneyId, getOrCreateJourneyId } from './journey-id.js';

const APP_ORIGIN = 'https://app.leva.ai.kr';
const SAFE_UTM_VALUE = /^[a-z0-9_.-]{1,64}$/;

export function inboundContext(location, referrer) {
  let params = new URLSearchParams();
  try {
    params = new URL(location.href).searchParams;
  } catch (_) {
    // A malformed location cannot block the page; it simply has no UTM context.
  }

  const pick = (key) => {
    const value = (params.get(key) || '').trim().toLowerCase();
    return SAFE_UTM_VALUE.test(value) ? value : null;
  };

  let referrerHost = 'direct';
  try {
    if (referrer) referrerHost = new URL(referrer).hostname || 'direct';
  } catch (_) {
    // Keep the explicit direct fallback instead of recording an unparsed URL.
  }

  const utmSource = pick('utm_source');
  const utmMedium = pick('utm_medium');
  const utmCampaign = pick('utm_campaign');
  return {
    referrer_host: referrerHost,
    ...(utmSource ? { utm_source: utmSource } : {}),
    ...(utmMedium ? { utm_medium: utmMedium } : {}),
    ...(utmCampaign ? { utm_campaign: utmCampaign } : {}),
  };
}

function ctaLocation(link) {
  if (link.closest('.site-header')) return 'header';
  if (link.closest('#mini-diagnostic')) return 'mini_diagnostic';
  if (link.closest('#pricing')) return 'pricing';
  if (link.closest('.final-cta')) return 'final';
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
  location = globalThis.location,
  referrer = globalThis.document?.referrer ?? '',
}) {
  const pageViewId = generateOpaqueJourneyId(crypto);
  let journeyId;
  try {
    journeyId = getOrCreateJourneyId({ storage, crypto });
  } catch (_) {
    // Crypto/storage denial must leave the existing product navigation intact.
  }

  analytics.capture('landing_viewed', {
    page_view_id: pageViewId,
    ...inboundContext(location, referrer),
  });

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
    const locationName = ctaLocation(link);
    if (locationName) {
      analytics.capture('landing_diagnostic_cta_clicked', {
        page_view_id: pageViewId,
        cta_location: locationName,
      });
    }
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
