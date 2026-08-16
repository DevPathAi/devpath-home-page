/**
 * Progressive enhancement for the native <details> mobile navigation.
 * Without JavaScript, summary activation still exposes every secondary link.
 */
export function mountMobileNavigation(root = document) {
  const details = root.querySelector('details.mobile-nav');
  const summary = details?.querySelector('summary.mobile-nav__toggle');
  if (!details || !summary) return () => {};

  const syncState = () => {
    summary.setAttribute('aria-expanded', String(details.open));
    summary.setAttribute('aria-label', details.open ? '메뉴 닫기' : '메뉴 열기');
  };

  const close = ({ restoreFocus = false } = {}) => {
    if (!details.open) return;
    details.open = false;
    syncState();
    if (restoreFocus) summary.focus();
  };

  const onKeyDown = (event) => {
    if (event.key !== 'Escape' || !details.open) return;
    event.preventDefault();
    close({ restoreFocus: true });
  };

  const onPointerDown = (event) => {
    if (details.open && !details.contains(event.target)) close();
  };

  const onClick = (event) => {
    if (event.target.closest('nav a')) close();
  };

  details.addEventListener('toggle', syncState);
  details.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('pointerdown', onPointerDown);
  syncState();

  return () => {
    details.removeEventListener('toggle', syncState);
    details.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKeyDown);
    root.removeEventListener('pointerdown', onPointerDown);
  };
}
