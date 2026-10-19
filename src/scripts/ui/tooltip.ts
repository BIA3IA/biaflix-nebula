/**
 * Tooltip glass al posto di quelli di sistema (attributo `title`) in tutta la SPA, plugin compresi.
 * Delegazione su pointer/focus: all'ingresso il `title` viene spostato in `data-nebula-tip` (così il
 * browser non mostra il suo riquadro) e, se l'elemento non ha già un nome accessibile, diventa
 * `aria-label`. All'uscita/teardown il `title` originale viene ripristinato. Dashboard esclusa.
 */
import { h } from './dom';

const DELAY_MS = 380;
const TIP_ATTR = 'data-nebula-tip';

/** Testo visibile esclusi i glifi delle icone (ligature Material, elementi aria-hidden). */
function visibleText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('.material-icons, .material-symbols-outlined, .nebula-icon, [aria-hidden="true"]').forEach((n) => n.remove());
  return (clone.textContent ?? '').trim();
}

function accessibleNameMissing(el: Element): boolean {
  return !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !visibleText(el);
}

/** Testo del tooltip per un elemento (anche dopo che il title è stato spostato). */
export function tipText(el: Element): string {
  return (el.getAttribute(TIP_ATTR) ?? el.getAttribute('title') ?? '').trim();
}

export function installTooltips(): () => void {
  const tip = h('div', { class: 'nebula-root nebula-tooltip', role: 'tooltip', id: 'nebula-tooltip', 'aria-hidden': 'true' });
  document.body.append(tip);
  let target: HTMLElement | null = null;
  let timer = 0;
  const touched = new Set<HTMLElement>();

  const adopt = (el: HTMLElement): string => {
    const title = el.getAttribute('title');
    if (title && title.trim()) {
      el.setAttribute(TIP_ATTR, title);
      if (accessibleNameMissing(el)) {
        el.setAttribute('aria-label', title);
        el.setAttribute('data-nebula-tip-label', '');
      }
      el.removeAttribute('title');
      touched.add(el);
    }
    return tipText(el);
  };

  const place = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const below = r.bottom + 8 + t.height < window.innerHeight;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), window.innerWidth - t.width - 8);
    tip.style.left = `${left}px`;
    tip.style.top = `${below ? r.bottom + 8 : r.top - t.height - 8}px`;
    tip.dataset.side = below ? 'bottom' : 'top';
  };

  const hide = () => {
    window.clearTimeout(timer);
    if (target) target.removeAttribute('aria-describedby');
    target = null;
    tip.classList.remove('is-visible');
  };

  const show = (el: HTMLElement, immediate: boolean) => {
    const text = adopt(el);
    if (!text) return;
    window.clearTimeout(timer);
    target = el;
    timer = window.setTimeout(
      () => {
        if (target !== el || !el.isConnected) return;
        tip.textContent = text;
        place(el);
        // Il nome accessibile resta quello dell'elemento: la descrizione serve solo se il testo è diverso.
        if (el.getAttribute('aria-label') !== text) el.setAttribute('aria-describedby', tip.id);
        tip.classList.add('is-visible');
      },
      immediate ? 0 : DELAY_MS,
    );
  };

  const candidate = (e: Event): HTMLElement | null => {
    const el = (e.target as Element | null)?.closest?.<HTMLElement>(`[title], [${TIP_ATTR}]`);
    if (!el || el.closest('.dashboardDocument, .nebula-tooltip, select, option, iframe, video')) return null;
    return el;
  };

  const onOver = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const el = candidate(e);
    if (el && el !== target) show(el, false);
    else if (!el && target) hide();
  };
  const onFocus = (e: FocusEvent) => {
    const el = candidate(e);
    if (el && (e.target as HTMLElement).matches(':focus-visible')) show(el, false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') hide();
  };

  document.addEventListener('pointerover', onOver, { passive: true });
  document.addEventListener('focusin', onFocus);
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', hide, { capture: true, passive: true });

  return () => {
    hide();
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('focusin', onFocus);
    document.removeEventListener('focusout', hide);
    document.removeEventListener('pointerdown', hide, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', hide, true);
    // Ripristina i title originali (Nebula spenta: comportamento nativo).
    for (const el of touched) {
      const text = el.getAttribute(TIP_ATTR);
      if (text && !el.hasAttribute('title')) el.setAttribute('title', text);
      el.removeAttribute(TIP_ATTR);
      if (el.hasAttribute('data-nebula-tip-label')) {
        el.removeAttribute('aria-label');
        el.removeAttribute('data-nebula-tip-label');
      }
    }
    touched.clear();
    tip.remove();
  };
}
