/**
 * Menu laterale (drawer MUI del layout Modern): unica navigazione su telefono.
 * Il drawer nativo contiene già Home, Preferiti e le librerie (Raccolte, Film, Serie TV…);
 * Nebula aggiunge «Watchlist» subito dopo «Preferiti», con lo stesso markup delle voci native.
 * Il drawer è montato in un portale React in <body> solo quando è aperto: osserviamo i figli
 * diretti di <body> e, a drawer presente, la sua lista.
 */
import { currentRoute } from '../env';
import { ROUTE_CHANGED } from '../route-events';
import { t } from '../i18n';
import { icon } from '../ui/dom';
import { isWatchlistRoute, WATCHLIST_HREF } from '../watchlist';

const FAVORITES = '.MuiDrawer-paper a[href="#/home?tab=1"]';
const ITEM_CLASS = 'nebula-drawer-watchlist';

/** Costruisce la voce clonando la struttura (classi MUI) della voce «Preferiti». */
export function buildWatchlistItem(favorites: HTMLAnchorElement): HTMLElement {
  const source = favorites.closest('li') ?? favorites;
  const item = source.cloneNode(true) as HTMLElement;
  item.classList.add('nebula-root', ITEM_CLASS);
  item.removeAttribute('id');
  const link = item.matches('a') ? (item as HTMLAnchorElement) : item.querySelector('a')!;
  link.setAttribute('href', WATCHLIST_HREF);
  link.classList.remove('Mui-selected', 'Mui-focusVisible');
  link.querySelectorAll('.MuiTouchRipple-root').forEach((r) => r.remove());
  const iconHost = link.querySelector('.MuiListItemIcon-root');
  iconHost?.replaceChildren(icon('bookmarks'));
  const label = link.querySelector('.MuiListItemText-primary');
  if (label) label.textContent = t('watchlistShort');
  return item;
}

function syncSelected(item: HTMLElement): void {
  const { path, params } = currentRoute();
  const active = isWatchlistRoute(path, params);
  const link = item.matches('a') ? item : item.querySelector('a');
  link?.classList.toggle('Mui-selected', active);
  if (active) link?.setAttribute('aria-current', 'page');
  else link?.removeAttribute('aria-current');
}

export function installDrawerExtras(): () => void {
  let listObserver: MutationObserver | null = null;
  let observedList: Element | null = null;

  const ensure = () => {
    const favorites = document.querySelector<HTMLAnchorElement>(FAVORITES);
    if (!favorites) return;
    const anchor = favorites.closest('li') ?? favorites;
    const list = anchor.parentElement;
    if (list && list !== observedList) {
      listObserver?.disconnect();
      listObserver = new MutationObserver(ensure);
      listObserver.observe(list, { childList: true });
      observedList = list;
    }
    let item: HTMLElement | null = list?.querySelector<HTMLElement>(`:scope > .${ITEM_CLASS}`) ?? null;
    // Nessuna chiusura manuale: il drawer di Jellyfin si chiude da solo al cambio di route
    // (la sua onClose è un toggle: un click sul backdrop lo riaprirebbe).
    item ??= buildWatchlistItem(favorites);
    if (item.previousElementSibling !== anchor) anchor.after(item);
    syncSelected(item);
  };

  const bodyObserver = new MutationObserver(ensure);
  bodyObserver.observe(document.body, { childList: true });
  window.addEventListener('hashchange', ensure);
  window.addEventListener(ROUTE_CHANGED, ensure);
  ensure();
  return () => {
    bodyObserver.disconnect();
    listObserver?.disconnect();
    window.removeEventListener('hashchange', ensure);
    window.removeEventListener(ROUTE_CHANGED, ensure);
    document.querySelectorAll(`.${ITEM_CLASS}`).forEach((el) => el.remove());
  };
}
