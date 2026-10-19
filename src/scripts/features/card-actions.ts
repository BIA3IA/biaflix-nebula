/**
 * Quick action sulle card: watchlist + «Aggiungi a…».
 * - Card native/KefinTweaks: inserite al primo hover/focus (delegazione, nessun MutationObserver),
 *   solo su dispositivi con hover reale; su touch resta il menu contestuale nativo (⋮).
 * - Card Nebula: decorate alla creazione, quindi disponibili anche al tocco.
 * Il click principale della card non viene mai bloccato.
 */
import type { NebulaContext } from '../context';
import { t } from '../i18n';
import type { BaseItem, ItemType } from '../jellyfin-api';
import { h, icon } from '../ui/dom';
import { watchlistButton } from '../ui/watchlist-button';
import { openAddTo } from './collection-dialogs';

const ACTIONABLE: ReadonlySet<string> = new Set<ItemType>(['Movie', 'Series', 'Episode', 'Season']);
const NATIVE_CARD = '.card[data-id][data-type]';

export function cardActions(ctx: NebulaContext, ref: Pick<BaseItem, 'Id' | 'Type' | 'SeriesId' | 'UserData'>): HTMLElement {
  const add = h('button', { type: 'button', class: 'nebula-icon-btn nebula-addto-btn', 'aria-label': t('addTo'), title: t('addTo') }, icon('library_add'));
  add.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    add.disabled = true;
    try {
      await openAddTo(ctx, await ctx.api.getItem(ref.Id));
    } finally {
      add.disabled = false;
    }
  });
  const wrap = h('div', { class: 'nebula-root nebula-card-actions' }, watchlistButton(ctx, ref, 'sm'), add);
  // Evita che il click sui pulsanti attivi la navigazione della card nativa (shortcuts.onClick).
  wrap.addEventListener('click', (e) => e.stopPropagation());
  return wrap;
}

export function decorateNebulaCard(ctx: NebulaContext, card: HTMLElement, item: BaseItem): void {
  if (!ctx.flags.cardActions || !ACTIONABLE.has(item.Type)) return;
  card.querySelector('.nebula-card__media')?.append(cardActions(ctx, item));
}

function enhanceNative(ctx: NebulaContext, card: HTMLElement): void {
  if (card.classList.contains('nebula-card') || card.classList.contains('jellyseerr-card')) return;
  if (card.querySelector(':scope .nebula-card-actions')) return;
  const type = card.getAttribute('data-type') ?? '';
  const id = card.getAttribute('data-id');
  if (!id || !ACTIONABLE.has(type)) return;
  const host = card.querySelector<HTMLElement>('.cardOverlayContainer') ?? card.querySelector<HTMLElement>('.cardScalable');
  if (!host) return;
  host.append(cardActions(ctx, { Id: id, Type: type, SeriesId: card.getAttribute('data-seriesid') ?? undefined }));
}

export function installNativeCardActions(ctx: NebulaContext): () => void {
  if (!ctx.flags.cardActions) return () => undefined;
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  const onIntent = (e: Event) => {
    if (e.type === 'pointerover' && !canHover.matches) return;
    const card = (e.target as Element | null)?.closest?.<HTMLElement>(NATIVE_CARD);
    if (card && !card.closest('.dashboardDocument, .formDialog, .nebula-dialog')) enhanceNative(ctx, card);
  };
  document.addEventListener('pointerover', onIntent, { passive: true });
  document.addEventListener('focusin', onIntent);
  return () => {
    document.removeEventListener('pointerover', onIntent);
    document.removeEventListener('focusin', onIntent);
    document.querySelectorAll('.card .nebula-card-actions').forEach((el) => el.remove());
  };
}
