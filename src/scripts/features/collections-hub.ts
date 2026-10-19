/**
 * Pagine «Raccolte» (#/boxsets) e «Playlist» (#/playlists) sulle route reali di Jellyfin (layout Modern).
 * Stessa intestazione delle pagine catalogo (titolo, sottotitolo, contatore, azione) e griglia editoriale
 * 16:9 con collage. Ogni route mostra solo il proprio tipo: la voce «Playlist» della navbar porta alle playlist.
 * La griglia nativa viene nascosta SOLO dopo che l'hub è stato reso con successo;
 * resta disponibile come fallback se il caricamento fallisce.
 */
import { collectionCard, nativeItemsContainer } from '../cards';
import { canManageCollections, COLLECTIONS_CHANGED } from '../collections';
import type { NebulaContext } from '../context';
import type { Feature } from '../lifecycle';
import { t } from '../i18n';
import { PLAYLISTS_CHANGED } from '../playlist';
import { h, icon } from '../ui/dom';
import { openCreateCollection, openCreatePlaylist } from './collection-dialogs';
import { setCatalogMode } from './catalog-pages';

export function collectionsHubFeature(ctx: NebulaContext): Feature {
  return {
    name: 'collections-hub',
    routes: ['boxsets', 'playlists'],
    async mount({ page, signal, path }) {
      if (!ctx.flags.collectionsHub || !page || !['boxsetsPage', 'playlistsPage'].includes(page.id)) return;
      const playlists = path === 'playlists';

      const grid = nativeItemsContainer('nebula-hub__grid');
      const statusText = h('p', {}, t('loading'));
      const status = h('div', { class: 'nebula-catalog__status', role: 'status' }, icon(playlists ? 'playlist_play' : 'collections_bookmark'), statusText);
      const count = h('span', { class: 'nebula-chip nebula-catalog__count', hidden: true });
      const actions = h('div', { class: 'nebula-catalog__actions nebula-hub__actions' });
      if (playlists) {
        const np = h('button', { type: 'button', class: 'nebula-btn nebula-btn--primary' }, icon('playlist_add'), t('newPlaylist'));
        np.addEventListener('click', () => openCreatePlaylist(ctx));
        actions.append(np);
      } else if (canManageCollections(ctx.user)) {
        const nc = h('button', { type: 'button', class: 'nebula-btn nebula-btn--primary' }, icon('add'), t('newCollection'));
        nc.addEventListener('click', () => openCreateCollection(ctx));
        actions.append(nc);
      }

      const hub = h(
        'section',
        { class: 'nebula-root nebula-catalog nebula-hub', 'aria-labelledby': 'nebula-hub-title' },
        h(
          'header',
          { class: 'nebula-catalog__header' },
          h(
            'div',
            { class: 'nebula-catalog__heading' },
            h(
              'div',
              { class: 'nebula-catalog__titlerow' },
              h('h1', { id: 'nebula-hub-title', class: 'nebula-catalog__title' }, playlists ? t('playlists') : t('collections')),
              count,
            ),
            h('p', { class: 'nebula-catalog__subtitle' }, playlists ? t('playlistsSubtitle') : t('collectionsSubtitle')),
          ),
          actions,
        ),
        playlists
          ? null
          : h('div', { class: 'nebula-catalog__toolbar' }, h('p', { class: 'nebula-notice nebula-notice--inline' }, icon('group'), t('sharedNotice'))),
        status,
        grid,
      );

      const render = async () => {
        let cards: HTMLElement[];
        if (playlists) {
          const list = await ctx.api.getPlaylists();
          cards = await Promise.all(
            list.Items.map(async (p) => {
              const items = await ctx.api.getPlaylistItems(p.Id).catch(() => ({ Items: [], TotalRecordCount: 0 }));
              return collectionCard(ctx, p, items.TotalRecordCount, items.Items.slice(0, 4), 'playlist');
            }),
          );
        } else {
          cards = (await ctx.collections.list()).map((c) => collectionCard(ctx, c.item, c.count, c.preview));
        }
        if (signal.aborted) return;
        grid.replaceChildren(...cards);
        status.hidden = cards.length > 0;
        statusText.textContent = playlists ? t('emptyPlaylists') : t('emptyCollections');
        count.textContent = t(playlists ? 'playlistsCount' : 'collectionsCount', { n: cards.length });
        count.hidden = false;
        page.classList.add('nebula-hub-active');
        setCatalogMode(true);
      };

      page.querySelector(':scope > .nebula-hub')?.remove();
      page.prepend(hub);
      try {
        await render();
      } catch (err) {
        ctx.log('hub', err);
        hub.remove();
        return;
      }
      const refresh = () => render().catch((err) => ctx.log('hub', err));
      document.addEventListener(COLLECTIONS_CHANGED, refresh);
      document.addEventListener(PLAYLISTS_CHANGED, refresh);
      return () => {
        document.removeEventListener(COLLECTIONS_CHANGED, refresh);
        document.removeEventListener(PLAYLISTS_CHANGED, refresh);
        hub.remove();
        page.classList.remove('nebula-hub-active');
        setCatalogMode(false);
      };
    },
  };
}
