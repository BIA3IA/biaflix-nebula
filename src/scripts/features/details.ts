/**
 * Pagina dettagli (#/details?id=…):
 * - Film/Serie/Episodi: pulsanti «Watchlist» e «Aggiungi a…» accanto ai controlli nativi.
 * - Raccolte (BoxSet): «Gestisci raccolta» (se autorizzati), filtro Film/Serie, avviso di condivisione.
 * I controlli nativi (Riproduci, trailer, versioni, KefinTweaks/JE) restano intatti.
 */
import { canManageCollections } from '../collections';
import type { NebulaContext } from '../context';
import type { Feature } from '../lifecycle';
import { t } from '../i18n';
import type { BaseItem } from '../jellyfin-api';
import { h, icon } from '../ui/dom';
import { waitFor } from '../ui/wait';
import { watchlistButton } from '../ui/watchlist-button';
import { openAddTo, openManageCollection } from './collection-dialogs';

const MEDIA = new Set(['Movie', 'Series', 'Episode', 'Season']);

function detailButton(label: string, glyph: string, onClick: () => void): HTMLButtonElement {
  const b = h(
    'button',
    { type: 'button', class: 'detailButton emby-button nebula-detail-btn', title: label, 'aria-label': label },
    h('div', { class: 'detailButton-content' }, icon(glyph, 'detailButton-icon')),
  );
  b.addEventListener('click', onClick);
  return b as HTMLButtonElement;
}

function collectionFilter(page: HTMLElement): HTMLElement {
  const group = h('div', { class: 'nebula-root nebula-segmented nebula-collection-filter', role: 'group', 'aria-label': t('collections') });
  for (const [value, label] of [
    ['all', t('all')],
    ['Movie', t('movies')],
    ['Series', t('series')],
  ] as const) {
    const b = h('button', { type: 'button', class: 'nebula-segmented__btn', 'aria-pressed': String(value === 'all') }, label);
    b.addEventListener('click', () => {
      if (value === 'all') page.removeAttribute('data-nebula-filter');
      else page.setAttribute('data-nebula-filter', value);
      group.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    group.append(b);
  }
  return group;
}

export function detailsFeature(ctx: NebulaContext): Feature {
  return {
    name: 'details',
    routes: ['details'],
    async mount({ page, signal, params }) {
      const id = params.get('id');
      if (!ctx.flags.detailActions || !page || !id) return;
      const [buttons, item] = await Promise.all([waitFor<HTMLElement>(page, '.mainDetailButtons', signal), ctx.api.getItem(id)]);
      if (!buttons || signal.aborted) return;
      buttons.querySelectorAll('.nebula-detail-btn').forEach((b) => b.remove());
      const added: Element[] = [];

      if (MEDIA.has(item.Type)) {
        const wl = watchlistButton(ctx, item, 'detail');
        const add = detailButton(t('addTo'), 'library_add', () => void openAddTo(ctx, item));
        add.classList.add('nebula-addto-btn');
        buttons.append(wl, add);
        added.push(wl, add);
      }

      if (item.Type === 'BoxSet') {
        page.classList.add('nebula-collection-page');
        const filter = collectionFilter(page);
        const anchor = page.querySelector('#childrenCollapsible') ?? page.querySelector('.detailPagePrimaryContent');
        anchor?.before(filter);
        added.push(filter);
        if (ctx.flags.collectionManage && canManageCollections(ctx.user)) {
          const refresh = () => window.location.reload();
          const manage = detailButton(t('manageCollection'), 'edit_note', () => void openManageCollection(ctx, item as BaseItem, refresh));
          manage.classList.add('nebula-manage-btn');
          buttons.append(manage);
          added.push(manage);
        }
        const notice = h('p', { class: 'nebula-root nebula-notice nebula-notice--inline' }, icon('group'), t('sharedNotice'));
        filter.after(notice);
        added.push(notice);
      }

      return () => {
        added.forEach((el) => el.remove());
        page.classList.remove('nebula-collection-page');
        page.removeAttribute('data-nebula-filter');
      };
    },
  };
}
