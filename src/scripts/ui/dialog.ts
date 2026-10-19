/**
 * Dialog glass accessibile: role=dialog, aria-modal, focus trap, ESC, ripristino focus.
 * Montato fuori dall'albero React (direttamente in <body>) per non interferire con Jellyfin.
 * I dialog aperti formano una pila: tastiera ed ESC agiscono solo sul dialog in cima.
 */
import { t } from '../i18n';
import { h, icon, uniqueId } from './dom';

export interface DialogOptions {
  title: string;
  /** Classe aggiuntiva per varianti (es. 'nebula-dialog--wide'). */
  className?: string;
  onClose?: () => void;
}

export interface DialogHandle {
  root: HTMLElement;
  body: HTMLElement;
  footer: HTMLElement;
  close(): void;
  setBusy(busy: boolean): void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface StackEntry {
  root: HTMLElement;
  panel: HTMLElement;
  close(): void;
}

const stack: StackEntry[] = [];

function onKey(e: KeyboardEvent): void {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === 'Escape') {
    e.stopImmediatePropagation();
    e.preventDefault();
    top.close();
    return;
  }
  if (e.key !== 'Tab') return;
  const items = [...top.panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
  if (!items.length) return;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const inside = top.panel.contains(document.activeElement);
  if (e.shiftKey && (document.activeElement === first || !inside)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
    e.preventDefault();
    first.focus();
  }
}

/** Chiude tutti i dialog aperti (teardown di Nebula). */
export function closeAllDialogs(): void {
  [...stack].reverse().forEach((d) => d.close());
}

export function openDialog(opts: DialogOptions): DialogHandle {
  const titleId = uniqueId('nebula-dialog-title');
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const body = h('div', { class: 'nebula-dialog__body' });
  const footer = h('div', { class: 'nebula-dialog__footer' });
  const closeBtn = h('button', { type: 'button', class: 'nebula-icon-btn nebula-dialog__close', 'aria-label': t('close') }, icon('close'));
  const panel = h(
    'div',
    { class: `nebula-dialog ${opts.className ?? ''}`.trim(), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    h('header', { class: 'nebula-dialog__header' }, h('h2', { id: titleId, class: 'nebula-dialog__title' }, opts.title), closeBtn),
    body,
    footer,
  );
  const root = h('div', { class: 'nebula-root nebula-dialog-backdrop', 'data-state': 'opening' }, panel);

  let closed = false;
  const entry: StackEntry = { root, panel, close: () => close() };
  const close = () => {
    if (closed) return;
    closed = true;
    const idx = stack.indexOf(entry);
    if (idx >= 0) stack.splice(idx, 1);
    if (!stack.length) document.removeEventListener('keydown', onKey, true);
    root.setAttribute('data-state', 'closing');
    const done = () => {
      root.remove();
      // Ripristina il focus solo se nessun altro dialog lo ha preso nel frattempo.
      const active = document.activeElement;
      if (!stack.length && (!active || active === document.body || root.contains(active))) previous?.focus?.();
      opts.onClose?.();
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else window.setTimeout(done, 200);
  };

  closeBtn.addEventListener('click', close);
  root.addEventListener('mousedown', (e) => {
    if (e.target === root) close();
  });
  // Cattura: i tasti non raggiungono le scorciatoie globali (es. JE «/») mentre un dialog è aperto.
  if (!stack.length) document.addEventListener('keydown', onKey, true);
  stack.push(entry);
  document.body.append(root);
  requestAnimationFrame(() => {
    if (closed) return;
    root.setAttribute('data-state', 'open');
    (panel.querySelector<HTMLElement>('[autofocus]') ?? panel.querySelector<HTMLElement>(FOCUSABLE))?.focus();
  });

  return {
    root,
    body,
    footer,
    close,
    setBusy(busy: boolean) {
      panel.toggleAttribute('aria-busy', busy);
      footer.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = busy));
    },
  };
}

export function confirmDialog(title: string, message: string, confirmLabel: string, danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    let result = false;
    const dlg = openDialog({ title, className: 'nebula-dialog--compact', onClose: () => resolve(result) });
    dlg.body.append(h('p', { class: 'nebula-dialog__text' }, message));
    // Azioni distruttive: il focus iniziale va su Annulla, mai sul pulsante pericoloso.
    const cancel = h('button', { type: 'button', class: 'nebula-btn nebula-btn--glass', autofocus: danger }, t('cancel'));
    const ok = h('button', { type: 'button', class: `nebula-btn ${danger ? 'nebula-btn--danger' : 'nebula-btn--primary'}`, autofocus: !danger }, confirmLabel);
    cancel.addEventListener('click', () => dlg.close());
    ok.addEventListener('click', () => {
      result = true;
      dlg.close();
    });
    dlg.footer.append(cancel, ok);
  });
}
