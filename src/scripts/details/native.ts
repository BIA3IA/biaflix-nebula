/**
 * Ponte verso il DOM nativo della pagina dettagli di jellyfin-web 12.2 (apps/legacy/controllers/itemDetails).
 * Il controller nativo resta il proprietario di stato e azioni: Nebula ne legge i pulsanti e li attiva
 * per delega, così Play/Riprendi, preferiti, versioni, menu «…» e i pulsanti aggiunti da KefinTweaks e
 * Jellyfin Enhanced funzionano esattamente come prima, senza essere duplicati.
 */
import type { MenuItem } from '../ui/menu';

/** Pulsanti che Nebula mostra già in evidenza: non vanno ripetuti in «Altre azioni». */
const PROMOTED = ['btnPlay', 'btnPlayTrailer'];

export function nativeButtons(page: ParentNode): HTMLElement | null {
  return page.querySelector<HTMLElement>('.mainDetailButtons');
}

export function nativeButton(page: ParentNode, cls: string): HTMLButtonElement | null {
  const b = page.querySelector<HTMLButtonElement>(`.mainDetailButtons .${cls}`);
  return b && !b.classList.contains('hide') ? b : null;
}

/** Attiva il pulsante nativo (anche se nascosto visivamente): la logica resta quella di Jellyfin/plugin. */
export function triggerNative(page: ParentNode, cls: string): boolean {
  const b = nativeButton(page, cls);
  if (!b || b.disabled) return false;
  b.click();
  return true;
}

function labelOf(b: HTMLElement): string {
  // `data-nebula-tip`: il title spostato dal tooltip glass (ui/tooltip.ts).
  return (b.getAttribute('title') || b.getAttribute('data-nebula-tip') || b.getAttribute('aria-label') || b.textContent || '').replace(/\s+/g, ' ').trim();
}

function iconOf(b: HTMLElement): Node | undefined {
  const glyph = b.querySelector('.material-icons, .material-symbols-outlined, .je-msym-outlined, svg');
  if (!glyph) return undefined;
  const clone = glyph.cloneNode(true) as Element;
  clone.classList.add('nebula-icon');
  clone.setAttribute('aria-hidden', 'true');
  return clone;
}

/** Stato on/off dei pulsanti che lo espongono (preferito, visto). */
function checkedOf(b: HTMLElement): boolean | undefined {
  if (b.classList.contains('btnUserRating')) return b.getAttribute('data-isfavorite') === 'true';
  if (b.classList.contains('btnPlaystate')) return b.getAttribute('data-played') === 'true';
  const pressed = b.getAttribute('aria-pressed');
  return pressed === null ? undefined : pressed === 'true';
}

/** Voci del menu «Altre azioni» lette in tempo reale dai pulsanti nativi visibili (Jellyfin + plugin). */
export function nativeActionItems(page: ParentNode): MenuItem[] {
  const container = nativeButtons(page);
  if (!container) return [];
  const items: MenuItem[] = [];
  const seen = new Set<string>();
  for (const b of Array.from(container.querySelectorAll<HTMLElement>(':scope > button, :scope > .detailButton, :scope > [is="emby-button"]'))) {
    if (b.classList.contains('hide') || b.hidden || b.classList.contains('nebula-detail-btn')) continue;
    if (PROMOTED.some((c) => b.classList.contains(c))) continue;
    const label = labelOf(b);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    items.push({ label, icon: iconOf(b), checked: checkedOf(b), disabled: (b as HTMLButtonElement).disabled, onSelect: () => b.click() });
  }
  return items;
}

/** Esegue `fn` quando i pulsanti nativi cambiano (il controller li mostra/nasconde dopo il caricamento). */
export function onNativeButtonsChange(page: ParentNode, fn: () => void): () => void {
  const container = nativeButtons(page);
  if (!container) return () => undefined;
  const mo = new MutationObserver(fn);
  mo.observe(container, { attributes: true, attributeFilter: ['class', 'data-isfavorite', 'data-played'], subtree: true, childList: true });
  return () => mo.disconnect();
}
