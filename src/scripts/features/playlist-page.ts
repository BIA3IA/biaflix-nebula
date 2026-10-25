/**
 * Pagina dettagli di una playlist (#/details?id=<playlist>): la vista resta quella nativa di Jellyfin
 * (lista riordinabile, Riproduci, Casuale, menu «…»), Nebula aggiunge «Aggiungi titoli» accanto ai
 * pulsanti nativi, solo per chi può modificarla. Jellyfin non offre un modo per aggiungere titoli
 * partendo dalla playlist: si può solo dal titolo («Aggiungi a…»).
 */
import type { NebulaContext } from '../context';
import type { Feature } from '../lifecycle';
import { t } from '../i18n';
import { h, icon } from '../ui/dom';
import { waitFor } from '../ui/wait';
import { openAddToPlaylist } from './collection-dialogs';

export function playlistPageFeature(ctx: NebulaContext): Feature {
  return {
    name: 'playlist-page',
    routes: ['details'],
    async mount({ page, params, signal }) {
      const id = params.get('id');
      if (!page || !id || page.id !== 'itemDetailPage') return;
      const item = await ctx.api.getItem(id);
      if (signal.aborted || item.Type !== 'Playlist' || !(await ctx.playlists.canEdit(id))) return;
      const buttons = await waitFor<HTMLElement>(page, '.mainDetailButtons', signal);
      if (!buttons || signal.aborted) return;
      const add = h(
        'button',
        {
          type: 'button',
          is: 'emby-button',
          class: 'button-flat detailButton nebula-root nebula-playlist-add',
          title: t('addTitles'),
          'aria-label': t('addTitles'),
        },
        h('div', { class: 'detailButton-content' }, icon('playlist_add', 'detailButton-icon')),
      );
      add.addEventListener('click', () => void openAddToPlaylist(ctx, item, () => window.location.reload()));
      // Prima del menu «…» nativo, se presente.
      const more = buttons.querySelector(':scope > .btnMoreCommands');
      if (more) more.before(add);
      else buttons.append(add);
      return () => add.remove();
    },
  };
}
