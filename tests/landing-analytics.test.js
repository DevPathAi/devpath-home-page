// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { inboundContext, instrumentLandingJourney } from '../src/analytics/landing.js';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

const deterministicCrypto = {
  getRandomValues(bytes) {
    bytes.fill(7);
    return bytes;
  },
};

describe('Landing instrumentation-only hook', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main>
        <section class="hero">
          <a id="cta" href="https://app.leva.ai.kr/">진단 시작</a>
        </section>
      </main>`;
  });

  it('records render/click and decorates the existing navigation synchronously', () => {
    const analytics = { capture: vi.fn() };
    const storage = new MemoryStorage();
    const stop = instrumentLandingJourney({
      root: document,
      analytics,
      storage,
      crypto: deterministicCrypto,
    });
    const link = document.querySelector('#cta');
    link.addEventListener('click', (event) => event.preventDefault());

    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(analytics.capture).toHaveBeenNthCalledWith(1, 'landing_viewed', {
      page_view_id: expect.any(String),
      referrer_host: 'direct',
    });
    expect(analytics.capture).toHaveBeenNthCalledWith(
      2,
      'landing_diagnostic_cta_clicked',
      { page_view_id: expect.any(String), cta_location: 'hero' },
    );
    expect(link.href).toMatch(/^https:\/\/app\.leva\.ai\.kr\/?\?journeyId=/);
    stop();
  });

  it('records only the referrer host when no UTM exists', () => {
    expect(inboundContext(
      new URL('https://leva.ai.kr/'),
      'https://search.example.com/results?q=private',
    )).toEqual({ referrer_host: 'search.example.com' });
  });

  it('normalizes allowlisted UTM values and omits unsafe values', () => {
    expect(inboundContext(
      new URL('https://leva.ai.kr/?utm_source=OKKY&utm_medium=Post&utm_campaign=Launch%20Now'),
      '',
    )).toEqual({
      referrer_host: 'direct',
      utm_source: 'okky',
      utm_medium: 'post',
    });
  });

  it('falls back to direct when the referrer cannot be parsed', () => {
    expect(inboundContext(
      new URL('https://leva.ai.kr/?utm_campaign=202609-2GI'),
      'not a URL',
    )).toEqual({
      referrer_host: 'direct',
      utm_campaign: '202609-2gi',
    });
  });

  it('never awaits or depends on analytics delivery before handoff', () => {
    const analytics = { capture: vi.fn(() => new Promise(() => {})) };
    const stop = instrumentLandingJourney({
      root: document,
      analytics,
      storage: new MemoryStorage(),
      crypto: deterministicCrypto,
    });
    const link = document.querySelector('#cta');
    link.addEventListener('click', (event) => event.preventDefault());

    link.click();

    expect(link.href).toContain('journeyId=');
    stop();
  });

  it('decorates all handoffs and classifies every diagnostic CTA location', () => {
    document.body.innerHTML = `
      <header class="site-header"><a href="https://app.leva.ai.kr/">header</a></header>
      <section class="hero"><a href="https://app.leva.ai.kr/">hero</a></section>
      <aside id="mini-diagnostic"><a href="https://app.leva.ai.kr/">mini</a></aside>
      <section id="pricing"><a href="https://app.leva.ai.kr/">pricing</a></section>
      <section class="final-cta"><a href="https://app.leva.ai.kr/">final</a></section>
      <section id="lead"><a href="https://app.leva.ai.kr/">lead</a></section>`;
    const analytics = { capture: vi.fn() };
    const stop = instrumentLandingJourney({
      root: document,
      analytics,
      storage: new MemoryStorage(),
      crypto: deterministicCrypto,
    });

    for (const link of document.querySelectorAll('a')) {
      link.addEventListener('click', (event) => event.preventDefault());
      link.click();
    }

    expect([...document.querySelectorAll('a')].every((link) =>
      link.href.includes('journeyId='))).toBe(true);
    expect(analytics.capture.mock.calls.slice(1).map(([, props]) =>
      props.cta_location)).toEqual([
      'header', 'hero', 'mini_diagnostic', 'pricing', 'final',
    ]);
    stop();
  });

  it('handles the mini-diagnostic result CTA inserted after initialization', () => {
    document.body.innerHTML = '<aside id="mini-diagnostic"></aside>';
    const analytics = { capture: vi.fn() };
    const stop = instrumentLandingJourney({
      root: document,
      analytics,
      storage: new MemoryStorage(),
      crypto: deterministicCrypto,
    });
    document.querySelector('#mini-diagnostic').innerHTML =
      '<a href="https://app.leva.ai.kr/">dynamic result</a>';
    const link = document.querySelector('a');
    link.addEventListener('click', (event) => event.preventDefault());

    link.click();

    expect(link.href).toContain('journeyId=');
    expect(analytics.capture).toHaveBeenLastCalledWith(
      'landing_diagnostic_cta_clicked',
      { page_view_id: expect.any(String), cta_location: 'mini_diagnostic' },
    );
    stop();
  });
});
