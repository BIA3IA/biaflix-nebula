/** Toast glass con regione live per screen reader. */
import { h, icon } from './dom';

let region: HTMLElement | null = null;

function ensureRegion(): HTMLElement {
  if (region?.isConnected) return region;
  region = h('div', { class: 'nebula-root nebula-toasts', role: 'status', 'aria-live': 'polite' });
  document.body.append(region);
  return region;
}

export function toast(message: string, kind: 'success' | 'error' | 'info' = 'success', ms = 3200): void {
  const glyph = kind === 'success' ? 'check_circle' : kind === 'error' ? 'error' : 'info';
  const el = h('div', { class: `nebula-toast nebula-toast--${kind}` }, icon(glyph), h('span', {}, message));
  ensureRegion().append(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  window.setTimeout(() => {
    el.classList.remove('is-visible');
    window.setTimeout(() => el.remove(), 300);
  }, ms);
}

export function removeToasts(): void {
  region?.remove();
  region = null;
}
