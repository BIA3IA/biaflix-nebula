/**
 * Hub «Raccolte» sulle route reali di Jellyfin #/boxsets e #/playlists (layout Modern).
 * Griglia editoriale 16:9 con collage, filtro Tutte / Raccolte / Playlist, «+ Nuova raccolta».
 * La griglia nativa viene nascosta SOLO dopo che l'hub è stato reso con successo, e resta
 * raggiungibile con «Vista classica» (fallback senza perdita di funzionalità).
 */
import { collectionCard, nativeItemsContainer } from '../cards';
import { canManageCollections, COLLECTIONS_CHANGED } from '../collections';
import type { NebulaContext } from '../context';
import type { Feature } from '../lifecycle';
import { t } from '../i18n';
import { PLAYLISTS_CHANGED } from '../playlist';
import { h, icon } from '../ui/dom';
import { openCreateCollection, openCreatePlaylist } from './collection-dialogs';

type HubFilter = 'all' | 'collection' | 'playlist';

export function collectionsHubFeature(ctx: NebulaContext): Feature {
  return {
    name: 'collections-hub',
    routes: ['boxsets', 'playlists'],
    async mount({ page, signal, path }) {
      if (!ctx.flags.collectionsHub || !page || !['boxsetsPage', 'playlistsPage'].includes(page.id)) return;
      let filter: HubFilter = path === 'playlists' ? 'playlist' : 'all';

      const grid = nativeItemsContainer('nebula-hub__grid');
      const status = h('p', { class: 'nebula-picker__status', role: 'status', 'aria-live': 'polite' }, t('loading'));
      const segmented = h('div', { class: 'nebula-segmented', role: 'group', 'aria-label': t('collections') });
      const options: [HubFilter, string][] = [
        ['all', t('all')],
        ['collection', t('collections')],
        ['playlist', t('playlists')],
      ];
      for (const [value, label] of options) {
        const b = h('button', { type: 'button', class: 'nebula-segmented__btn', 'aria-pressed': String(value === filter) }, label);
        b.addEventListener('click', () => {
          filter = value;
          segmented.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          applyFilter();
        });
        segmented.append(b);
      }

      const actions = h('div', { class: 'nebula-hub__actions' });
      if (canManageCollections(ctx.user)) {
        const nc = h('button', { type: 'button', class: 'nebula-btn nebula-btn--primary' }, icon('add'), t('newCollection'));
        nc.addEventListener('click', () => openCreateCollection(ctx));
        actions.append(nc);
      }
      const np = h('button', { type: 'button', class: 'nebula-btn nebula-btn--glass' }, icon('playlist_add'), t('newPlaylist'));
      np.addEventListener('click', () => openCreatePlaylist(ctx));
      const classic = h('button', { type: 'button', class: 'nebula-btn nebula-btn--ghost', 'aria-pressed': 'false' }, icon('view_module'), t('classicView'));
      classic.addEventListener('click', () => {
        const on = page.classList.toggle('nebula-hub-classic');
        document.documentElement.classList.toggle('nebula-hub-mode', !on);
        classic.setAttribute('aria-pressed', String(on));
      });
      actions.append(np, classic);

      const hub = h(
        'section',
        { class: 'nebula-root nebula-hub', 'aria-labelledby': 'nebula-hub-title' },
        h(
          'header',
          { class: 'nebula-hub__header' },
          h(
            'div',
            {},
            h('h1', { id: 'nebula-hub-title', class: 'nebula-hub__title' }, t('collections')),
            h('p', { class: 'nebula-hub__subtitle' }, t('collectionsSubtitle')),
          ),
          actions,
        ),
        h('div', { class: 'nebula-hub__toolbar' }, segmented, h('p', { class: 'nebula-notice nebula-notice--inline' }, icon('group'), t('sharedNotice'))),
        status,
        grid,
      );

      const applyFilter = () => {
        grid.querySelectorAll<HTMLElement>('.nebula-card').forEach((c) => {
          const kind = c.classList.contains('nebula-card--playlist') ? 'playlist' : 'collection';
          c.hidden = filter !== 'all' && filter !== kind;
        });
      };

      const render = async () => {
        const [collections, playlists] = await Promise.all([ctx.collections.list(), ctx.api.getPlaylists()]);
        const playlistCards = await Promise.all(
          playlists.Items.map(async (p) => {
            const items = await ctx.api.getPlaylistItems(p.Id).catch(() => ({ Items: [], TotalRecordCount: 0 }));
            return collectionCard(ctx, p, items.TotalRecordCount, items.Items.slice(0, 4), 'playlist');
          }),
        );
        if (signal.aborted) return;
        grid.replaceChildren(...collections.map((c) => collectionCard(ctx, c.item, c.count, c.preview)), ...playlistCards);
        status.textContent = grid.children.length ? '' : t('emptyCollection');
        applyFilter();
        page.classList.add('nebula-hub-active');
        if (!page.classList.contains('nebula-hub-classic')) document.documentElement.classList.add('nebula-hub-mode');
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
        page.classList.remove('nebula-hub-active', 'nebula-hub-classic');
        document.documentElement.classList.remove('nebula-hub-mode');
      };
    },
  };
}
