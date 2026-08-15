import { describe, expect, it } from 'vitest';

import {
  buildJourneyHandoffUrl,
  captureJourneyIdFromUrl,
  generateOpaqueJourneyId,
  getOrCreateJourneyId,
  isValidJourneyId,
} from '../src/analytics/journey-id.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

const deterministicCrypto = {
  getRandomValues(bytes) {
    bytes.forEach((_, index) => { bytes[index] = index + 1; });
    return bytes;
  },
};

describe('opaque journeyId handoff', () => {
  it('generates a cryptographically sourced opaque identifier', () => {
    const id = generateOpaqueJourneyId(deterministicCrypto);
    expect(id).toBe('AQIDBAUGBwgJCgsMDQ4PEA');
    expect(isValidJourneyId(id)).toBe(true);
    expect(isValidJourneyId('person@example.com')).toBe(false);
    expect(isValidJourneyId('short')).toBe(false);
  });

  it('persists only in journey-scoped storage and reuses a valid value', () => {
    const storage = new MemoryStorage();
    const first = getOrCreateJourneyId({ storage, crypto: deterministicCrypto });
    const second = getOrCreateJourneyId({ storage, crypto: { getRandomValues() { throw new Error('must not regenerate'); } } });

    expect(second).toBe(first);
  });

  it('adds journeyId to the handoff without placing other state in the URL', () => {
    const id = generateOpaqueJourneyId(deterministicCrypto);
    const target = buildJourneyHandoffUrl(
      'https://app.leva.ai.kr/diagnostic?track=backend#start',
      id,
    );

    expect(target).toBe(
      `https://app.leva.ai.kr/diagnostic?track=backend&journeyId=${id}#start`,
    );
    expect(target).not.toMatch(/answer|email|token|prompt|code/i);
  });

  it('replaces a pre-existing handoff value instead of creating duplicates', () => {
    const id = generateOpaqueJourneyId(deterministicCrypto);
    const target = new URL(buildJourneyHandoffUrl(
      'https://app.leva.ai.kr/diagnostic?journeyId=old&journeyId=collision',
      id,
    ));

    expect(target.searchParams.getAll('journeyId')).toEqual([id]);
  });

  it('captures a valid handoff then immediately removes it from the visible URL', () => {
    const storage = new MemoryStorage();
    const id = generateOpaqueJourneyId(deterministicCrypto);
    let replacement;

    const captured = captureJourneyIdFromUrl(
      `https://app.leva.ai.kr/diagnostic?journeyId=${id}&track=backend#start`,
      { storage, replaceUrl: (url) => { replacement = url; } },
    );

    expect(captured).toBe(id);
    expect(replacement).toBe(
      'https://app.leva.ai.kr/diagnostic?track=backend#start',
    );
    expect(storage.getItem('leva.analytics.journey.v1')).toBe(id);
  });

  it('removes an invalid visible journeyId without persisting it', () => {
    const storage = new MemoryStorage();
    let replacement;

    expect(captureJourneyIdFromUrl(
      'https://app.leva.ai.kr/diagnostic?journeyId=person%40example.com',
      { storage, replaceUrl: (url) => { replacement = url; } },
    )).toBeNull();
    expect(replacement).toBe('https://app.leva.ai.kr/diagnostic');
    expect(storage.values.size).toBe(0);
  });

  it('rejects duplicate URL values and removes every visible copy', () => {
    const storage = new MemoryStorage();
    const id = generateOpaqueJourneyId(deterministicCrypto);
    let replacement;

    expect(captureJourneyIdFromUrl(
      `https://app.leva.ai.kr/diagnostic?journeyId=${id}&journeyId=${id}&track=backend`,
      { storage, replaceUrl: (url) => { replacement = url; } },
    )).toBeNull();
    expect(replacement).toBe(
      'https://app.leva.ai.kr/diagnostic?track=backend',
    );
    expect(storage.values.size).toBe(0);
  });

  it('does not replace an established browser journey on collision', () => {
    const storage = new MemoryStorage();
    const established = 'EREREREREREREREREREREQ';
    const incoming = generateOpaqueJourneyId(deterministicCrypto);
    storage.setItem('leva.analytics.journey.v1', established);
    let replacement;

    expect(captureJourneyIdFromUrl(
      `https://app.leva.ai.kr/diagnostic?journeyId=${incoming}#start`,
      { storage, replaceUrl: (url) => { replacement = url; } },
    )).toBeNull();
    expect(replacement).toBe('https://app.leva.ai.kr/diagnostic#start');
    expect(storage.getItem('leva.analytics.journey.v1')).toBe(established);
  });
});
