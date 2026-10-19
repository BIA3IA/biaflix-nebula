/**
 * Pagine catalogo Nebula sulle route reali di Jellyfin:
 * - #/movies e #/tv (librerie Film e Serie TV, layout Modern) al posto della griglia e della toolbar MUI;
 * - #/home?tab=1 (Preferiti) al posto delle rail native dei preferiti.
 * Stessa impaginazione di Watchlist e Raccolte (ui/catalog.ts). La vista nativa resta nel DOM e torna
 * visibile se il primo caricamento fallisce o se Nebula viene spenta.
 */
import { posterCard } from '../cards';
import type { NebulaContext } from '../context';
import { t } from '../i18n';
import type { Query } from '../jellyfin-api';
import type { Feature } from '../lifecycle';
import { createCatalog, type CatalogOption } from '../ui/catalog';
import { h, icon } from '../ui/dom';
import { decorateNebulaCard } from './card-actions';

export const CATALOG_MODE_CLASS = 'nebula-catalog-mode';

/**
 * Classe su <html> che nasconde la toolbar nativa della libreria. Un'istanza smontata in ritardo
 * (hashchange e viewshow ravvicinati) non deve toglierla a quella che l'ha appena rimessa:
 * la si rimuove solo se nessuna pagina catalogo/hub resta nel documento.
 */
export function setCatalogMode(on: boolean): void {
  const root = document.documentElement;
  if (on) root.classList.add(CATALOG_MODE_CLASS);
  else if (!document.querySelector('.nebula-library-page, .nebula-hub')) root.classList.remove(CATALOG_MODE_CLASS);
}

/** Funzione (non costante): le etichette dipendono dalla lingua scelta all'avvio. */
export function SORTS(): CatalogOption[] {
  return [
    { value: 'name', label: t('sortName') },
    { value: 'added', label: t('sortAdded') },
    { value: 'year', label: t('sortYear') },
    { value: 'rating', label: t('sortRating') },
    { value: 'random', label: t('sortRandom') },
  ];
}

export function sortQuery(sort: string, series = false): Query {
  switch (sort) {
    case 'added':
      return { sortBy: series ? 'DateLastContentAdded,SortName' : 'DateCreated,SortName', sortOrder: 'Descending' };
    case 'year':
      return { sortBy: 'ProductionYear,PremiereDate,SortName', sortOrder: 'Descending' };
    case 'rating':
      return { sortBy: 'CommunityRating,SortName', sortOrder: 'Descending' };
    case 'random':
      return { sortBy: 'Random' };
    default:
      return { sortBy: 'SortName', sortOrder: 'Ascending' };
  }
}

export function TYPE_FILTERS(withEpisodes: boolean): CatalogOption[] {
  const list = [
    { value: 'all', label: t('all') },
    { value: 'Movie', label: t('movies') },
    { value: 'Series', label: t('series') },
  ];
  if (withEpisodes) list.push({ value: 'Episode', label: t('episodes') });
  return list;
}

export function typeQuery(filter: string, withEpisodes: boolean): Query {
  if (filter === 'Movie' || filter === 'Series' || (withEpisodes && filter === 'Episode')) return { includeItemTypes: [filter] };
  return { includeItemTypes: withEpisodes ? ['Movie', 'Series', 'Episode'] : ['Movie', 'Series'] };
}

const WATCH_FILTERS: Record<string, string> = { unplayed: 'IsUnplayed', resumable: 'IsResumable', played: 'IsPlayed' };

/**
 * Inserisce la pagina catalogo in cima alla pagina ospite e la reinserisce se il renderer nativo
 * ricostruisce i figli (osserva solo i figli diretti dell'ospite).
 */
export function hostCatalog(page: HTMLElement, root: HTMLElement, ...classes: string[]): () => void {
  const attach = () => {
    if (root.parentElement !== page) page.prepend(root);
  };
  const observer = new MutationObserver(attach);
  observer.observe(page, { childList: true });
  attach();
  page.classList.add('nebula-catalog-active', ...classes);
  return () => {
    observer.disconnect();
    // Un'altra istanza può aver già ospitato il proprio catalogo nella stessa pagina.
    if (![...page.children].some((el) => el !== root && el.classList.contains('nebula-catalog'))) {
      page.classList.remove('nebula-catalog-active', ...classes);
    }
  };
}

/** Pulsante Nebula che attiva un pulsante della toolbar nativa della libreria (riproduci tutti, casuale). */
function nativeToolbarAction(testId: string, glyph: string, label: string, primary: boolean): HTMLElement | null {
  const find = () =>
    document
      .querySelector(`header.MuiAppBar-root:not(.dashboard-appBar) > .MuiToolbar-root + .MuiToolbar-root [data-testid="${testId}"]`)
      ?.closest<HTMLButtonElement>('button') ?? null;
  if (!find()) return null;
  const b = h('button', { type: 'button', class: `nebula-btn ${primary ? 'nebula-btn--primary' : 'nebula-btn--glass'}` }, icon(glyph), label);
  b.addEventListener('click', () => find()?.click());
  return b;
}

function card(ctx: NebulaContext) {
  return (item: Parameters<typeof posterCard>[1]) => {
    const c = posterCard(ctx, item);
    decorateNebulaCard(ctx, c, item);
    return c;
  };
}

export function libraryPagesFeature(ctx: NebulaContext): Feature {
  return {
    name: 'library-pages',
    routes: ['movies', 'tv'],
    async mount({ path, params, page, signal }) {
      const parentId = params.get('topParentId');
      if (!ctx.flags.libraryPages || !page || !parentId || !page.classList.contains('libraryPage')) return;
      const series = path === 'tv';
      const filters: CatalogOption[] = [
        { value: 'all', label: t('all') },
        { value: 'unplayed', label: t('filterUnplayed') },
        ...(series ? [] : [{ value: 'resumable', label: t('filterResumable') }]),
        { value: 'played', label: t('filterPlayed') },
      ];
      // La toolbar nativa compare con la pagina: un frame per lasciarla montare a React.
      await new Promise((r) => requestAnimationFrame(r));
      if (signal.aborted) return;
      const actions = [
        nativeToolbarAction('PlayArrowIcon', 'play_arrow', t('playAll'), true),
        nativeToolbarAction('ShuffleIcon', 'shuffle', t('shuffle'), false),
      ].filter((b): b is HTMLElement => b !== null);
      const catalog = createCatalog({
        className: 'nebula-library-page',
        title: series ? t('series') : t('movies'),
        subtitle: series ? t('seriesSubtitle') : t('moviesSubtitle'),
        emptyIcon: series ? 'live_tv' : 'movie',
        emptyText: t('libraryEmpty'),
        filters,
        sorts: SORTS(),
        defaultSort: 'name',
        actions,
        stateKey: `biaflixNebula:catalog:${parentId}`,
        load: ({ startIndex, limit, filter, sort }) =>
          ctx.api.getItems({
            parentId,
            recursive: true,
            includeItemTypes: [series ? 'Series' : 'Movie'],
            startIndex,
            limit,
            filters: WATCH_FILTERS[filter],
            enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
            imageTypeLimit: 1,
            ...sortQuery(sort, series),
          }),
        card: card(ctx),
        onError: (err) => ctx.log('libreria', err),
      });
      // Titolo reale della libreria (es. «Cartoni») al posto di quello generico.
      void ctx.api
        .getItem(parentId)
        .then((lib) => {
          const title = catalog.root.querySelector('.nebula-catalog__title');
          if (title && lib.Name) title.textContent = lib.Name;
        })
        .catch(() => undefined);
      const unhost = hostCatalog(page, catalog.root);
      setCatalogMode(true);
      const teardown = () => {
        unhost();
        catalog.destroy();
        setCatalogMode(false);
      };
      const ok = await catalog.ready;
      if (!ok && !signal.aborted) {
        // Fallback: torna la vista nativa con la sua toolbar.
        teardown();
        return;
      }
      return teardown;
    },
  };
}

export function favoritesPageFeature(ctx: NebulaContext): Feature {
  return {
    name: 'favorites-page',
    routes: ['home'],
    mount({ params }) {
      if (!ctx.flags.libraryPages || params.get('tab') !== '1' || params.get('nebula')) return;
      const page = document.getElementById('indexPage');
      if (!page) return;
      const catalog = createCatalog({
        className: 'nebula-favorites-page',
        title: t('favorites'),
        subtitle: t('favoritesSubtitle'),
        emptyIcon: 'favorite',
        emptyText: t('favoritesEmpty'),
        filters: TYPE_FILTERS(true),
        sorts: SORTS(),
        defaultSort: 'added',
        stateKey: 'biaflixNebula:catalog:favorites',
        load: ({ startIndex, limit, filter, sort }) =>
          ctx.api.getItems({
            recursive: true,
            filters: 'IsFavorite',
            startIndex,
            limit,
            enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
            imageTypeLimit: 1,
            ...typeQuery(filter, true),
            ...sortQuery(sort),
          }),
        card: card(ctx),
        onError: (err) => ctx.log('preferiti', err),
      });
      // Il cuore dei preferiti è gestito dal codice nativo: si aggiorna al rientro sulla pagina.
      const unhost = hostCatalog(page, catalog.root, 'nebula-favorites-active');
      return () => {
        unhost();
        catalog.destroy();
      };
    },
  };
}
