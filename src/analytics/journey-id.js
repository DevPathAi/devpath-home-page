export const JOURNEY_QUERY_PARAMETER = 'journeyId';
export const JOURNEY_STORAGE_KEY = 'leva.analytics.journey.v1';
export const ANALYTICS_SESSION_STORAGE_KEY = 'leva.analytics.session.v1';

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function encodeBase64Url(bytes) {
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const hasB = index + 1 < bytes.length;
    const hasC = index + 2 < bytes.length;
    const b = hasB ? bytes[index + 1] : 0;
    const c = hasC ? bytes[index + 2] : 0;
    result += BASE64URL_ALPHABET[a >> 2];
    result += BASE64URL_ALPHABET[((a & 3) << 4) | (b >> 4)];
    if (hasB) result += BASE64URL_ALPHABET[((b & 15) << 2) | (c >> 6)];
    if (hasC) result += BASE64URL_ALPHABET[c & 63];
  }
  return result;
}

export function generateOpaqueJourneyId(crypto = globalThis.crypto) {
  if (!crypto || typeof crypto.getRandomValues !== 'function') {
    throw new Error('A cryptographically secure random source is required');
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

export function isValidJourneyId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{22}$/.test(value);
}

export function getOrCreateOpaqueId({ storage, key, crypto = globalThis.crypto }) {
  const stored = storage.getItem(key);
  if (isValidJourneyId(stored)) return stored;
  if (stored !== null) storage.removeItem(key);
  const created = generateOpaqueJourneyId(crypto);
  storage.setItem(key, created);
  return created;
}

export function getOrCreateJourneyId({ storage, crypto = globalThis.crypto }) {
  return getOrCreateOpaqueId({ storage, key: JOURNEY_STORAGE_KEY, crypto });
}

export function buildJourneyHandoffUrl(target, journeyId) {
  if (!isValidJourneyId(journeyId)) throw new TypeError('Invalid journeyId');
  const url = new URL(target);
  url.searchParams.delete(JOURNEY_QUERY_PARAMETER);
  url.searchParams.append(JOURNEY_QUERY_PARAMETER, journeyId);
  return url.toString();
}

export function captureJourneyIdFromUrl(currentUrl, { storage, replaceUrl }) {
  const url = new URL(currentUrl);
  const incomingValues = url.searchParams.getAll(JOURNEY_QUERY_PARAMETER);
  if (incomingValues.length === 0) {
    const stored = storage.getItem(JOURNEY_STORAGE_KEY);
    return isValidJourneyId(stored) ? stored : null;
  }

  // Cleanup precedes validation/storage so invalid values never remain visible.
  url.searchParams.delete(JOURNEY_QUERY_PARAMETER);
  replaceUrl(url.toString());

  if (incomingValues.length !== 1 || !isValidJourneyId(incomingValues[0])) {
    return null;
  }
  const incoming = incomingValues[0];
  const stored = storage.getItem(JOURNEY_STORAGE_KEY);
  if (stored !== null && isValidJourneyId(stored) && stored !== incoming) {
    return null;
  }
  if (stored !== null && !isValidJourneyId(stored)) {
    storage.removeItem(JOURNEY_STORAGE_KEY);
  }
  storage.setItem(JOURNEY_STORAGE_KEY, incoming);
  return incoming;
}
