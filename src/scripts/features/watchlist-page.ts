/** Pagina watchlist, ospitata dalla route home con un parametro Nebula persistente nell'URL. */
import { posterCard } from '../cards';
import type { NebulaContext } from '../context';
import { t } from '../i18n';
import type { Feature } from '../lifecycle';
import { createCatalog } from '../ui/catalog';
import { isWatchlistRoute, WATCHLIST_CHANGED } from '../watchlist';
import { decorateNebulaCard } from './card-actions';
import { hostCatalog, TYPE_FILTERS, typeQuery, SORTS, sortQuery } from './catalog-pages';

export function watchlistPageFeature(ctx: NebulaContext): Feature {
  return {
    name: 'watchlist-page',
    routes: ['home'],
    mount({ path, params }) {
      if (!isWatchlistRoute(path, params)) return;
      // Gli eventi delle view in uscita possono arrivare dopo hashchange: risolviamo
      // il contenitore home reale anziché usare il page hint della view precedente.
      const page = document.getElementById('indexPage');
      if (!page) return;
      const catalog = createCatalog({
        className: 'nebula-watchlist-page',
        title: t('watchlistShort'),
        subtitle: t('watchlistSubtitle'),
        emptyIcon: 'bookmarks',
        emptyText: t('watchlistEmpty'),
        filters: TYPE_FILTERS(false),
        sorts: SORTS(),
        defaultSort: 'added',
        stateKey: 'biaflixNebula:catalog:watchlist',
        load: ({ startIndex, limit, filter, sort }) => ctx.watchlist.list(limit, { startIndex, ...typeQuery(filter, false), ...sortQuery(sort) }),
        card: (item) => {
          const card = posterCard(ctx, item);
          decorateNebulaCard(ctx, card, item);
          return card;
        },
        onError: (err) => ctx.log('watchlist', err),
      });
      const onChange = () => catalog.refresh();
      document.addEventListener(WATCHLIST_CHANGED, onChange);
      const unhost = hostCatalog(page, catalog.root, 'nebula-watchlist-active');
      return () => {
        document.removeEventListener(WATCHLIST_CHANGED, onChange);
        unhost();
        catalog.destroy();
      };
    },
  };
}
