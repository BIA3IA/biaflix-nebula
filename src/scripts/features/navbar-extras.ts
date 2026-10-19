/** Link Nebula nella navbar Modern, ripristinati quando React ricostruisce la toolbar. */
import type { NebulaContext } from '../context';
import { currentRoute } from '../env';
import { ROUTE_CHANGED } from '../route-events';
import { t } from '../i18n';
import { WATCHLIST_HREF, isWatchlistRoute } from '../watchlist';
import { h, icon } from '../ui/dom';

export function installNavbarExtras(_ctx: NebulaContext): () => void {
  const watchLink = h(
    'a',
    {
      class: 'nebula-root MuiButton-root nebula-nav-watchlist',
      href: WATCHLIST_HREF,
      'aria-label': t('watchlistShort'),
    },
    h('span', { class: 'MuiButton-startIcon' }, icon('bookmarks')),
    t('watchlistShort'),
  );
  // Un link reale occupa spazio nel flex della toolbar: niente logo pseudo-elemento sovrapposto.
  const homeLink = h('a', { class: 'nebula-root nebula-nav-home', href: '#/home', 'aria-label': t('navHome') });
  let toolbarObserver: MutationObserver | null = null;
  let observedToolbar: Element | null = null;
  let observedNavigation: Element | null = null;
  let frame = 0;

  const ensure = () => {
    const toolbar = document.querySelector('header.MuiAppBar-root:not(.dashboard-appBar) > .MuiToolbar-root');
    if (!toolbar) return;
    const favorites = toolbar.querySelector('a[href="#/home?tab=1"]');
    const navigation = favorites?.parentElement ?? null;
    if (observedToolbar !== toolbar || observedNavigation !== navigation) {
      toolbarObserver?.disconnect();
      toolbarObserver = new MutationObserver(ensure);
      toolbarObserver.observe(toolbar, { childList: true });
      if (navigation) toolbarObserver.observe(navigation, { childList: true });
      observedToolbar = toolbar;
      observedNavigation = navigation;
    }
    const menu = toolbar.querySelector(':scope > button.MuiIconButton-root:first-child');
    if (menu && homeLink.previousElementSibling !== menu) menu.after(homeLink);
    else if (!menu && homeLink.isConnected) homeLink.remove();
    if (favorites && watchLink.previousElementSibling !== favorites) favorites.after(watchLink);
    const { path, params } = currentRoute();
    if (isWatchlistRoute(path, params)) watchLink.setAttribute('aria-current', 'page');
    else watchLink.removeAttribute('aria-current');
    // Senza selettore visibile, rientrare in home deve ripristinare la categoria standard.
    // `none` è l'id KefinTweaks della home completa, `discovery` quello di Scopri.
    if (path === 'home' && !isWatchlistRoute(path, params)) {
      document.querySelector<HTMLButtonElement>('#kefin-home-category-rail .kefin-home-category-item[data-category-id="none"]:not(.is-active) button')?.click();
    }
  };

  const onRoute = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(ensure);
  };
  window.addEventListener('hashchange', onRoute);
  window.addEventListener(ROUTE_CHANGED, onRoute);
  document.addEventListener('viewshow', onRoute);
  ensure();
  document.addEventListener('kefinTweaksHomePainted', onRoute);

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('hashchange', onRoute);
    window.removeEventListener(ROUTE_CHANGED, onRoute);
    document.removeEventListener('viewshow', onRoute);
    document.removeEventListener('kefinTweaksHomePainted', onRoute);
    toolbarObserver?.disconnect();
    watchLink.remove();
    homeLink.remove();
  };
}
