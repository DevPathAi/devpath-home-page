const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function mount(root) {
  const button = root?.querySelector('.video-facade');
  const videoId = root?.dataset.videoId?.trim();
  if (!button || !YOUTUBE_VIDEO_ID.test(videoId ?? '')) return;

  button.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
    iframe.title = '레바 90초 데모';
    iframe.width = '1280';
    iframe.height = '720';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    button.replaceWith(iframe);
  }, { once: true });
}
