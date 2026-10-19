/**
 * Elementi Nebula nella navbar (layout Modern):
 * - pulsante «La mia watchlist» (segnalibro): apre un pannello glass con i titoli in watchlist
 *   (UserData.Likes). Jellyfin non ha una route per la watchlist, quindi non se ne inventa una;
 * React può ridisegnare la toolbar: un observer limitato ai figli della toolbar reinserisce gli elementi.
 */
import { posterCard, nativeItemsContainer } from '../cards';
import type { NebulaContext } from '../context';
import { currentRoute } from '../env';
import { t } from '../i18n';
import { WATCHLIST_CHANGED } from '../watchlist';
import { openDialog } from '../ui/dialog';
import { h, icon } from '../ui/dom';
import { decorateNebulaCard } from './card-actions';

export async function openWatchlistPanel(ctx: NebulaContext): Promise<void> {
  const dlg = openDialog({ title: t('watchlist'), className: 'nebula-dialog--wide nebula-dialog--watchlist' });
  const status = h('p', { class: 'nebula-picker__status', role: 'status' }, t('loading'));
  const grid = nativeItemsContainer('nebula-watchlist-grid');
  dlg.body.append(status, grid);
  // Aprire un titolo chiude il pannello (la navigazione resta quella nativa).
  grid.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a.nebula-card__media')) dlg.close();
  });
  const render = async () => {
    try {
      const r = await ctx.watchlist.list(200);
      grid.replaceChildren(
        ...r.Items.map((item) => {
          const card = posterCard(ctx, item);
          decorateNebulaCard(ctx, card, item);
          return card;
        }),
      );
      status.textContent = r.Items.length ? '' : t('watchlistEmpty');
    } catch (err) {
      ctx.log('watchlist', err);
      status.textContent = t('errorGeneric');
    }
  };
  const onChange = () => void render();
  document.addEventListener(WATCHLIST_CHANGED, onChange);
  const observer = new MutationObserver(() => {
    if (!dlg.root.isConnected) {
      document.removeEventListener(WATCHLIST_CHANGED, onChange);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });
  await render();
}

export function installNavbarExtras(ctx: NebulaContext): () => void {
  const watchBtn = h(
    'button',
    { type: 'button', class: 'nebula-root nebula-nav-watchlist', 'aria-label': t('watchlist'), title: t('watchlist') },
    icon('bookmarks'),
  );
  watchBtn.addEventListener('click', () => void openWatchlistPanel(ctx));
  let toolbarObserver: MutationObserver | null = null;
  let observedToolbar: Element | null = null;

  const ensure = () => {
    const toolbar = document.querySelector('header.MuiAppBar-root:not(.dashboard-appBar) > .MuiToolbar-root');
    if (!toolbar) return;
    if (observedToolbar !== toolbar) {
      toolbarObserver?.disconnect();
      toolbarObserver = new MutationObserver(() => ensure());
      toolbarObserver.observe(toolbar, { childList: true });
      observedToolbar = toolbar;
    }
    // Pulsante watchlist: nel box azioni, prima della ricerca.
    const actions = toolbar.children[toolbar.children.length - 2];
    if (actions && watchBtn.parentElement !== actions) {
      const search = actions.querySelector(':scope > a[href^="#/search"]');
      actions.insertBefore(watchBtn, search);
    }
    // Senza selettore visibile, rientrare in home deve ripristinare la categoria standard.
    // `none` è l'id KefinTweaks della home completa, `discovery` quello di Scopri.
    if (currentRoute().path === 'home') {
      document.querySelector<HTMLButtonElement>('#kefin-home-category-rail .kefin-home-category-item[data-category-id="none"]:not(.is-active) button')?.click();
    }
  };

  const onRoute = () => requestAnimationFrame(ensure);
  window.addEventListener('hashchange', onRoute);
  document.addEventListener('viewshow', onRoute);
  ensure();
  document.addEventListener('kefinTweaksHomePainted', onRoute);

  return () => {
    window.removeEventListener('hashchange', onRoute);
    document.removeEventListener('viewshow', onRoute);
    document.removeEventListener('kefinTweaksHomePainted', onRoute);
    toolbarObserver?.disconnect();
    watchBtn.remove();
  };
}
