// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { mountMobileNavigation } from '../src/mobile-navigation.js';

describe('모바일 보조 navigation', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <details class="mobile-nav">
        <summary class="mobile-nav__toggle"><span>메뉴</span></summary>
        <nav><a href="#how">작동 방식</a></nav>
      </details>
      <main id="outside" tabindex="-1"></main>`;
  });

  it('native details 상태와 접근성 상태를 동기화한다', () => {
    const stop = mountMobileNavigation(document);
    const details = document.querySelector('details');
    const summary = document.querySelector('summary');

    expect(summary.getAttribute('aria-expanded')).toBe('false');
    expect(summary.getAttribute('aria-label')).toBe('메뉴 열기');
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    expect(summary.getAttribute('aria-expanded')).toBe('true');
    expect(summary.getAttribute('aria-label')).toBe('메뉴 닫기');
    stop();
  });

  it('Escape로 닫고 menu button에 focus를 돌려준다', () => {
    const stop = mountMobileNavigation(document);
    const details = document.querySelector('details');
    const summary = document.querySelector('summary');
    details.open = true;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
    stop();
  });

  it('바깥 pointer와 navigation 선택으로 닫는다', () => {
    const stop = mountMobileNavigation(document);
    const details = document.querySelector('details');
    details.open = true;

    document.querySelector('#outside').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(details.open).toBe(false);

    details.open = true;
    document.querySelector('nav a').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(details.open).toBe(false);
    stop();
  });
});
