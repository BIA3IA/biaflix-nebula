/**
 * Menu glass ancorato a un pulsante (pattern WAI-ARIA "menu button").
 * Frecce/Home/End per muoversi, Invio/Spazio per attivare, Esc o click esterno per chiudere;
 * su telefono diventa un foglio dal basso. Le voci sono costruite all'apertura (stato sempre attuale).
 */
import { h, uniqueId } from './dom';

export interface MenuItem {
  label: string;
  /** Icona: nome Material Icons oppure un nodo già pronto (es. icona clonata da un pulsante nativo). */
  icon?: string | Node;
  /** Stato attivo (es. «Preferito»): mostrato con spunta e aria-checked. */
  checked?: boolean;
  disabled?: boolean;
  onSelect(): void;
}

let openMenu: { close(focusButton: boolean): void; button: HTMLElement } | null = null;

export function closeMenus(): void {
  openMenu?.close(false);
}

export function attachMenu(button: HTMLElement, build: () => MenuItem[]): () => void {
  const menuId = uniqueId('nebula-menu');
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', menuId);

  const open = (focusLast = false) => {
    if (openMenu?.button === button) return;
    openMenu?.close(false);
    const items = build();
    const sheet = window.matchMedia('(width < 600px)').matches;
    const menu = h('div', {
      class: `nebula-root nebula-menu${sheet ? ' is-sheet' : ''}`,
      role: 'menu',
      id: menuId,
      'aria-label': button.getAttribute('aria-label') ?? '',
    });
    const backdrop = sheet ? h('div', { class: 'nebula-root nebula-select-backdrop' }) : null;
    const nodes = items.map((item) => {
      const glyph =
        typeof item.icon === 'string'
          ? h('span', { class: 'material-icons nebula-icon', 'aria-hidden': 'true' }, item.icon)
          : item.icon
            ? item.icon
            : h('span', { class: 'nebula-icon' });
      const el = h(
        'button',
        {
          type: 'button',
          class: 'nebula-menu__item',
          role: item.checked === undefined ? 'menuitem' : 'menuitemcheckbox',
          'aria-checked': item.checked === undefined ? null : String(item.checked),
          tabindex: '-1',
          disabled: item.disabled,
        },
        glyph,
        h('span', { class: 'nebula-menu__label' }, item.label),
        item.checked ? h('span', { class: 'material-icons nebula-icon nebula-menu__check', 'aria-hidden': 'true' }, 'check') : null,
      );
      el.addEventListener('click', () => {
        close(true);
        item.onSelect();
      });
      menu.append(el);
      return el;
    });
    const focusable = () => nodes.filter((n) => !n.disabled);
    const focusAt = (i: number) => {
      const list = focusable();
      if (!list.length) return;
      // preventScroll: lo scroll indotto dal focus chiuderebbe il menu (onViewport) su schermi bassi.
      list[(i + list.length) % list.length]!.focus({ preventScroll: true });
    };
    const current = () => focusable().indexOf(document.activeElement as HTMLButtonElement);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') focusAt(current() + 1);
      else if (e.key === 'ArrowUp') focusAt(current() - 1);
      else if (e.key === 'Home') focusAt(0);
      else if (e.key === 'End') focusAt(-1);
      else if (e.key === 'Escape') close(true);
      else if (e.key === 'Tab') {
        close(false);
        return;
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    // Esc chiude anche se il focus non è ancora entrato nel menu (tasto premuto subito dopo l'apertura).
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || menu.contains(document.activeElement)) return;
      e.preventDefault();
      e.stopPropagation();
      close(true);
    };
    const onOutside = (e: Event) => {
      const t = e.target as Node;
      if (!menu.contains(t) && !button.contains(t)) close(false);
    };
    // Posizionamento sempre interamente nel viewport, dal lato con più spazio.
    const place = () => {
      const r = button.getBoundingClientRect();
      const margin = 8;
      const below = window.innerHeight - r.bottom - margin - 6;
      const above = r.top - margin - 6;
      const natural = menu.scrollHeight;
      const up = natural > below && above > below;
      const maxH = Math.max(96, Math.min(natural, up ? above : below));
      menu.style.maxHeight = `${maxH}px`;
      const h = Math.min(natural, maxH);
      const left = Math.min(Math.max(margin, r.left), window.innerWidth - menu.offsetWidth - margin);
      menu.style.left = `${left}px`;
      menu.style.top = `${Math.min(Math.max(margin, up ? r.top - h - 6 : r.bottom + 6), window.innerHeight - h - margin)}px`;
    };
    // Lo scroll della pagina riposiziona il menu; si chiude solo se il pulsante esce dallo schermo.
    const onViewport = (e: Event) => {
      if (sheet || (e.type === 'scroll' && menu.contains(e.target as Node))) return;
      const r = button.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) close(false);
      else place();
    };

    function close(focusButton: boolean) {
      if (openMenu?.button !== button) return;
      openMenu = null;
      button.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown', onDocKey, true);
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', onViewport, true);
      menu.classList.remove('is-open');
      // Durante l'animazione di uscita il menu non esiste più per tastiera e lettori di schermo.
      menu.setAttribute('aria-hidden', 'true');
      menu.inert = true;
      backdrop?.remove();
      window.setTimeout(() => menu.remove(), 160);
      if (focusButton) button.focus({ preventScroll: true });
    }

    menu.addEventListener('keydown', onKey);
    backdrop?.addEventListener('click', () => close(true));
    if (backdrop) document.body.append(backdrop);
    document.body.append(menu);
    if (!sheet) place();
    button.setAttribute('aria-expanded', 'true');
    openMenu = { close, button };
    requestAnimationFrame(() => {
      menu.classList.add('is-open');
      focusAt(focusLast ? -1 : 0);
    });
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onDocKey, true);
    window.addEventListener('resize', onViewport);
    window.addEventListener('scroll', onViewport, true);
  };

  const onClick = () => (openMenu?.button === button ? openMenu.close(true) : open());
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      open(e.key === 'ArrowUp');
    }
  };
  button.addEventListener('click', onClick);
  button.addEventListener('keydown', onKeyDown);
  return () => {
    if (openMenu?.button === button) openMenu.close(false);
    button.removeEventListener('click', onClick);
    button.removeEventListener('keydown', onKeyDown);
  };
}
