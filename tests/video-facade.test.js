// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { mount } from '../src/widgets/video-facade.js';

describe('90초 영상 facade', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="video-embed" data-video-id="MTSrOoTlZss">
        <button type="button" class="video-facade" aria-label="레바 90초 데모 재생">
          <img src="/assets/video-poster.jpg" width="1280" height="720" alt="">
        </button>
      </div>`;
  });

  it('클릭 전에는 외부 영상 요소를 만들지 않는다', () => {
    mount(document.querySelector('.video-embed'));

    expect(document.querySelector('iframe')).toBeNull();
    expect(document.querySelector('img').getAttribute('src')).toBe('/assets/video-poster.jpg');
  });

  it('클릭할 때만 privacy-enhanced YouTube iframe으로 교체한다', () => {
    const root = document.querySelector('.video-embed');
    mount(root);

    root.querySelector('.video-facade').click();

    const iframe = root.querySelector('iframe');
    expect(iframe.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/MTSrOoTlZss?autoplay=1&rel=0',
    );
    expect(iframe.title).toBe('레바 90초 데모');
    expect(iframe.allow).toBe('autoplay; encrypted-media; picture-in-picture; web-share');
    expect(iframe.allowFullscreen).toBe(true);
    expect(iframe.referrerPolicy).toBe('strict-origin-when-cross-origin');
    expect(root.querySelector('.video-facade')).toBeNull();
  });
});
