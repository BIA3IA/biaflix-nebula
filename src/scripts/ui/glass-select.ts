/**
 * Popup glass per le <select> native (Jellyfin, React/MUI NativeSelect, KefinTweaks, JE).
 *
 * Non sostituisce l'elemento: intercetta l'apertura (mouse, tocco, tastiera) e mostra un listbox
 * glass accessibile. La scelta viene scritta sulla <select> originale con il setter del prototipo
 * (così anche i componenti React registrano il cambio) e notificata con eventi input/change.
 * Restano native: select multiple, con size > 1, disabilitate, nella dashboard, o con data-nebula-native.
 */
import { h, icon, uniqueId } from './dom';

const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;

export function isEnhanceable(el: EventTarget | null): el is HTMLSelectElement {
  if (!(el instanceof HTMLSelectElement)) return false;
  if (el.multiple || el.size > 1 || el.disabled) return false;
  if (el.hasAttribute('data-nebula-native')) return false;
  if (el.closest('.dashboardDocument, [data-nebula-native]')) return false;
  return el.options.length > 0;
}

/** Imposta il valore come farebbe l'utente: compatibile con React (value tracker) e listener nativi. */
export function commitValue(select: HTMLSelectElement, value: string): boolean {
  if (select.value === value) return false;
  if (valueSetter) valueSetter.call(select, value);
  else select.value = value;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

interface OpenPopup {
  select: HTMLSelectElement;
  close(restoreFocus: boolean): void;
}

let current: OpenPopup | null = null;

export function closeGlassSelect(): void {
  current?.close(false);
}

export function openGlassSelect(select: HTMLSelectElement): void {
  if (current?.select === select) return;
  current?.close(false);

  const listId = uniqueId('nebula-select');
  const sheet = window.matchMedia('(width < 600px)').matches;
  const pop = h('div', { class: `nebula-root nebula-select-pop${sheet ? ' is-sheet' : ''}`, role: 'listbox', id: listId, tabindex: '-1' });
  const label = select.labels?.[0]?.textContent?.trim() || select.getAttribute('aria-label') || select.title;
  if (label) pop.setAttribute('aria-label', label);
  const backdrop = sheet ? h('div', { class: 'nebula-root nebula-select-backdrop' }) : null;

  const items: { el: HTMLElement; option: HTMLOptionElement }[] = [];
  let group: HTMLOptGroupElement | null = null;
  for (const option of Array.from(select.options)) {
    if (option.hidden) continue;
    const parent = option.parentElement instanceof HTMLOptGroupElement ? option.parentElement : null;
    if (parent && parent !== group) {
      group = parent;
      pop.append(h('div', { class: 'nebula-select-pop__group', role: 'presentation' }, parent.label));
    }
    const disabled = option.disabled || !!parent?.disabled;
    const el = h(
      'div',
      {
        class: 'nebula-select-pop__option',
        role: 'option',
        id: uniqueId('nebula-opt'),
        'aria-selected': String(option.selected),
        'aria-disabled': disabled ? 'true' : null,
      },
      h('span', {}, option.label || option.text),
      icon('check'),
    );
    pop.append(el);
    items.push({ el, option });
  }

  let active = Math.max(
    0,
    items.findIndex((i) => i.option.selected),
  );

  const setActive = (index: number, scroll = true) => {
    const enabled = items.filter((i) => !i.option.disabled);
    if (!enabled.length) return;
    active = Math.min(Math.max(index, 0), items.length - 1);
    items.forEach((it, i) => it.el.classList.toggle('is-active', i === active));
    const el = items[active]?.el;
    if (el) {
      pop.setAttribute('aria-activedescendant', el.id);
      if (scroll) el.scrollIntoView({ block: 'nearest' });
    }
  };

  const move = (delta: number) => {
    let i = active;
    for (let n = 0; n < items.length; n++) {
      i = (i + delta + items.length) % items.length;
      if (!items[i]!.option.disabled) break;
    }
    setActive(i);
  };

  const choose = (index: number) => {
    const it = items[index];
    if (!it || it.option.disabled) return;
    commitValue(select, it.option.value);
    close(true);
  };

  const place = () => {
    if (sheet) return;
    const r = select.getBoundingClientRect();
    const margin = 8;
    const below = window.innerHeight - r.bottom - margin;
    const above = r.top - margin;
    const wanted = Math.min(pop.scrollHeight, 360);
    const openUp = below < Math.min(wanted, 220) && above > below;
    const maxH = Math.max(140, Math.min(360, openUp ? above : below) - 4);
    pop.style.maxHeight = `${maxH}px`;
    pop.style.minWidth = `${Math.max(180, r.width)}px`;
    const left = Math.min(Math.max(margin, r.left), window.innerWidth - pop.offsetWidth - margin);
    pop.style.left = `${left}px`;
    pop.style.top = openUp ? `${Math.max(margin, r.top - Math.min(pop.scrollHeight, maxH) - 4)}px` : `${r.bottom + 4}px`;
    pop.style.transformOrigin = openUp ? 'bottom center' : 'top center';
  };

  let typed = '';
  let typedTimer = 0;
  const onKey = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        move(1);
        break;
      case 'ArrowUp':
        move(-1);
        break;
      case 'Home':
        setActive(0);
        break;
      case 'End':
        setActive(items.length - 1);
        break;
      case 'Enter':
      case ' ':
        choose(active);
        break;
      case 'Escape':
        close(true);
        break;
      case 'Tab':
        close(false);
        return;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          typed += e.key.toLowerCase();
          window.clearTimeout(typedTimer);
          typedTimer = window.setTimeout(() => (typed = ''), 700);
          const hit = items.findIndex((i) => !i.option.disabled && (i.option.label || i.option.text).toLowerCase().startsWith(typed));
          if (hit >= 0) setActive(hit);
          break;
        }
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const onOutside = (e: Event) => {
    const target = e.target as Node;
    if (pop.contains(target) || target === select) return;
    close(false);
  };
  const onViewport = (e: Event) => {
    if (e.type === 'scroll' && pop.contains(e.target as Node)) return;
    if (sheet) return;
    close(false);
  };

  pop.addEventListener('keydown', onKey);
  pop.addEventListener('click', (e) => {
    const el = (e.target as Element).closest('.nebula-select-pop__option');
    const index = items.findIndex((i) => i.el === el);
    if (index >= 0) choose(index);
  });
  pop.addEventListener('pointermove', (e) => {
    const el = (e.target as Element).closest('.nebula-select-pop__option');
    const index = items.findIndex((i) => i.el === el);
    if (index >= 0 && index !== active) setActive(index, false);
  });
  backdrop?.addEventListener('click', () => close(true));

  function close(restoreFocus: boolean) {
    if (current?.select !== select) return;
    current = null;
    document.removeEventListener('pointerdown', onOutside, true);
    window.removeEventListener('resize', onViewport);
    window.removeEventListener('scroll', onViewport, true);
    select.setAttribute('aria-expanded', 'false');
    pop.classList.remove('is-open');
    pop.setAttribute('aria-hidden', 'true');
    pop.inert = true;
    backdrop?.remove();
    window.setTimeout(() => pop.remove(), 160);
    if (restoreFocus) select.focus({ preventScroll: true });
  }

  current = { select, close };
  select.setAttribute('aria-expanded', 'true');
  select.setAttribute('aria-controls', listId);
  if (backdrop) document.body.append(backdrop);
  document.body.append(pop);
  place();
  setActive(active);
  requestAnimationFrame(() => {
    pop.classList.add('is-open');
    pop.focus({ preventScroll: true });
  });
  document.addEventListener('pointerdown', onOutside, true);
  window.addEventListener('resize', onViewport);
  window.addEventListener('scroll', onViewport, true);
}

/** Delega globale: un solo set di listener per tutte le select della SPA. */
export function installGlassSelect(): () => void {
  // Un tocco che è diventato scroll non deve aprire il popup.
  let touchOrigin: { x: number; y: number } | null = null;
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touchOrigin = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onPointer = (e: MouseEvent | TouchEvent) => {
    if (e instanceof MouseEvent && e.button !== 0) return;
    if (!isEnhanceable(e.target)) return;
    if (typeof TouchEvent !== 'undefined' && e instanceof TouchEvent) {
      const t = e.changedTouches[0];
      if (touchOrigin && t && Math.hypot(t.clientX - touchOrigin.x, t.clientY - touchOrigin.y) > 10) return;
    }
    e.preventDefault(); // niente picker del sistema operativo
    const select = e.target;
    select.focus({ preventScroll: true });
    if (current?.select === select) current.close(false);
    else openGlassSelect(select);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!isEnhanceable(e.target)) return;
    const opens = e.key === ' ' || e.key === 'Enter' || e.key === 'F4' || (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp'));
    if (!opens) return;
    e.preventDefault();
    e.stopPropagation();
    openGlassSelect(e.target);
  };
  document.addEventListener('mousedown', onPointer, true);
  document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
  document.addEventListener('touchend', onPointer, { capture: true, passive: false });
  document.addEventListener('keydown', onKey, true);
  return () => {
    closeGlassSelect();
    document.removeEventListener('mousedown', onPointer, true);
    document.removeEventListener('touchstart', onTouchStart, true);
    document.removeEventListener('touchend', onPointer, true);
    document.removeEventListener('keydown', onKey, true);
  };
}
