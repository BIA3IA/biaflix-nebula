/** Pagina watchlist, ospitata dalla route home con un parametro Nebula persistente nell'URL. */
import { nativeItemsContainer, posterCard } from '../cards';
import type { NebulaContext } from '../context';
import { countLabel, t } from '../i18n';
import type { Feature } from '../lifecycle';
import { h, icon } from '../ui/dom';
import { isWatchlistRoute, WATCHLIST_CHANGED } from '../watchlist';
import { decorateNebulaCard } from './card-actions';

export function watchlistPageFeature(ctx: NebulaContext): Feature {
  return {
    name: 'watchlist-page',
    routes: ['home'],
    mount({ path, params, signal }) {
      if (!isWatchlistRoute(path, params)) return;
      // Gli eventi delle view in uscita possono arrivare dopo hashchange: risolviamo
      // il contenitore home reale anziché usare il page hint della view precedente.
      const page = document.getElementById('indexPage');
      if (!page) return;
      let limit = 60;
      let request = 0;
      let disposed = false;
      const count = h('span', { class: 'nebula-chip', hidden: true });
      const refresh = h('button', { type: 'button', class: 'nebula-btn nebula-btn--glass' }, icon('refresh'), t('refresh'));
      const statusText = h('p', {}, t('loading'));
      const status = h('div', { class: 'nebula-watchlist-page__status', role: 'status' }, icon('bookmarks'), statusText);
      const grid = nativeItemsContainer('nebula-watchlist-grid');
      const more = h('button', { type: 'button', class: 'nebula-btn nebula-btn--glass', hidden: true }, t('loadMore'));
      const root = h(
        'section',
        { class: 'nebula-root nebula-watchlist-page', 'aria-labelledby': 'nebula-watchlist-title' },
        h(
          'header',
          { class: 'nebula-watchlist-page__header' },
          h('div', {}, h('h1', { id: 'nebula-watchlist-title' }, t('watchlistShort')), h('p', {}, t('watchlistSubtitle'))),
          h('div', { class: 'nebula-watchlist-page__actions' }, count, refresh),
        ),
        status,
        grid,
        more,
      );
      const render = async () => {
        const id = ++request;
        refresh.disabled = more.disabled = true;
        root.setAttribute('aria-busy', 'true');
        try {
          const result = await ctx.watchlist.list(limit);
          if (disposed || signal.aborted || id !== request) return;
          grid.replaceChildren(
            ...result.Items.map((item) => {
              const card = posterCard(ctx, item);
              decorateNebulaCard(ctx, card, item);
              return card;
            }),
          );
          status.hidden = result.Items.length > 0;
          statusText.textContent = t('watchlistEmpty');
          count.textContent = countLabel(result.TotalRecordCount);
          count.hidden = false;
          more.hidden = result.Items.length >= result.TotalRecordCount;
        } catch (error) {
          if (disposed || signal.aborted || id !== request) return;
          ctx.log('watchlist', error);
          grid.replaceChildren();
          status.hidden = false;
          statusText.textContent = t('errorGeneric');
          count.hidden = more.hidden = true;
        } finally {
          if (!disposed && !signal.aborted && id === request) {
            refresh.disabled = more.disabled = false;
            root.setAttribute('aria-busy', 'false');
          }
        }
      };
      const onChange = () => void render();
      refresh.addEventListener('click', onChange);
      more.addEventListener('click', () => {
        limit += 60;
        void render();
      });
      document.addEventListener(WATCHLIST_CHANGED, onChange);
      const attach = () => {
        if (root.parentElement !== page) page.prepend(root);
      };
      const observer = new MutationObserver(attach);
      observer.observe(page, { childList: true });
      attach();
      page.classList.add('nebula-watchlist-active');
      void render();
      return () => {
        disposed = true;
        observer.disconnect();
        document.removeEventListener(WATCHLIST_CHANGED, onChange);
        root.remove();
        page.classList.remove('nebula-watchlist-active');
      };
    },
  };
}
