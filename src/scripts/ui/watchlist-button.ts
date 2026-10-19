/**
 * Pulsante watchlist (UserData.Likes). Un solo listener globale sincronizza tutti i pulsanti
 * dello stesso titolo (hero, card, dettagli) quando lo stato cambia.
 */
import type { NebulaContext } from '../context';
import { t } from '../i18n';
import type { BaseItem } from '../jellyfin-api';
import { WATCHLIST_CHANGED, watchlistTargetId } from '../watchlist';
import { h, icon } from './dom';
import { toast } from './toast';

function render(btn: HTMLElement, listed: boolean | null): void {
  const known = listed === true;
  btn.replaceChildren(icon(known ? 'bookmark_added' : 'bookmark_add'));
  btn.setAttribute('aria-pressed', String(known));
  const label = known ? t('watchlistRemove') : t('watchlistAdd');
  btn.setAttribute('aria-label', label);
  btn.title = label;
  btn.toggleAttribute('data-unknown', listed === null);
}

export function installWatchlistSync(): () => void {
  const onChange = (e: Event) => {
    const { itemId, listed } = (e as CustomEvent<{ itemId: string; listed: boolean }>).detail;
    document.querySelectorAll<HTMLElement>(`.nebula-watchlist-btn[data-target-id="${CSS.escape(itemId)}"]`).forEach((b) => render(b, listed));
  };
  document.addEventListener(WATCHLIST_CHANGED, onChange);
  return () => document.removeEventListener(WATCHLIST_CHANGED, onChange);
}

/**
 * @param knownState stato già noto (es. UserData.Likes dell'item); null = da caricare.
 */
export function watchlistButton(
  ctx: NebulaContext,
  item: Pick<BaseItem, 'Id' | 'Type' | 'SeriesId' | 'UserData'>,
  variant: 'lg' | 'sm' | 'detail' = 'lg',
): HTMLButtonElement {
  const targetId = watchlistTargetId(item);
  const initial = targetId === item.Id && item.UserData ? item.UserData.Likes === true : null;
  const cls =
    variant === 'detail'
      ? 'detailButton emby-button nebula-detail-btn nebula-watchlist-btn'
      : `nebula-icon-btn ${variant === 'lg' ? 'nebula-icon-btn--lg' : ''} nebula-watchlist-btn`;
  const btn = h('button', { type: 'button', class: cls, 'data-target-id': targetId }) as HTMLButtonElement;
  render(btn, initial);
  if (initial === null) {
    void ctx.watchlist.isListed(targetId).then(
      (v) => render(btn, v),
      () => undefined,
    );
  }
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const next = btn.getAttribute('aria-pressed') !== 'true';
    btn.disabled = true;
    try {
      const confirmed = await ctx.watchlist.set(targetId, next);
      toast(confirmed ? t('watchlistAdded') : t('watchlistRemoved'));
    } catch (err) {
      ctx.log('watchlist', err);
      toast(t('errorGeneric'), 'error');
    } finally {
      btn.disabled = false;
    }
  });
  return btn;
}
