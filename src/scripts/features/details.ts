/**
 * Pagina dettagli Nebula (#/details?id=…) per film, serie, stagioni, episodi e raccolte.
 *
 * Il controller nativo di jellyfin-web resta il proprietario di dati e azioni (pulsanti, tracce, versioni,
 * menu «…», integrazioni KefinTweaks/JE). Nebula aggiunge una composizione editoriale sopra di esso:
 *
 *   hero cinematografico → stagioni ed episodi → informazioni (+ dettagli tecnici nativi a scomparsa)
 *   → cast e troupe → potrebbe piacerti → scopri e richiedi (Seerr) → sezioni native rimanenti
 *
 * Le sezioni native sostituite vengono solo nascoste (CSS, classe sulla pagina): spegnendo Nebula tornano.
 * L'ordine usa `order` sul wrapper flex nativo (.detailPageWrapperContainer), senza spostare nodi nativi.
 */
import type { NebulaContext } from '../context';
import type { Feature } from '../lifecycle';
import { t } from '../i18n';
import { h, icon } from '../ui/dom';
import { waitFor } from '../ui/wait';
import { buildCast } from '../details/cast';
import { buildEpisodes } from '../details/episodes';
import { buildDetailHero } from '../details/hero';
import { buildInfo } from '../details/info';
import { buildMayLike, groupSeerrSections } from '../details/related';

const SUPPORTED = new Set(['Movie', 'Series', 'Season', 'Episode', 'BoxSet']);

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

/** Blocco inserito nel wrapper nativo con la sua posizione editoriale. */
function place(wrapper: HTMLElement, el: HTMLElement, order: number): HTMLElement {
  el.style.order = String(order);
  el.classList.add('nebula-detail-block');
  wrapper.append(el);
  return el;
}

export function detailsFeature(ctx: NebulaContext): Feature {
  return {
    name: 'details',
    routes: ['details'],
    async mount({ page, signal, params }) {
      const id = params.get('id');
      if (!ctx.flags.detailActions || !page || !id || page.id !== 'itemDetailPage') return;
      const [wrapper, item] = await Promise.all([waitFor<HTMLElement>(page, '.detailPageWrapperContainer', signal), ctx.api.getItemFull(id)]);
      if (!wrapper || signal.aborted || !SUPPORTED.has(item.Type)) return;

      const seriesId = item.Type === 'Series' ? item.Id : item.SeriesId;
      const [series, nextUp] = await Promise.all([
        seriesId && seriesId !== item.Id ? ctx.api.getItemFull(seriesId) : Promise.resolve(item.Type === 'Series' ? item : null),
        seriesId && (item.Type === 'Series' || item.Type === 'Season')
          ? ctx.api.getNextUp(seriesId).then(
              (r) => r.Items[0] ?? null,
              () => null,
            )
          : Promise.resolve(null),
      ]);
      if (signal.aborted) return;

      const cleanups: (() => void)[] = [];
      const run = () =>
        cleanups
          .splice(0)
          .reverse()
          .forEach((fn) => fn());
      const type = item.Type.toLowerCase();
      const collapsible = item.Type !== 'BoxSet';
      page.classList.add('nebula-detail', `nebula-detail--${type}`);
      if (collapsible) page.classList.add('nebula-detail--collapsible');
      cleanups.push(() => {
        page.classList.remove('nebula-detail', `nebula-detail--${type}`, 'nebula-detail--collapsible', 'nebula-collection-page');
        page.removeAttribute('data-nebula-tech');
        page.removeAttribute('data-nebula-filter');
        const primary = page.querySelector('.detailPagePrimaryContent');
        if (primary?.id === 'nebula-tech-panel') primary.removeAttribute('id');
      });

      // 1. Hero (prima del wrapper, a tutta larghezza)
      const seasonNextUp = item.Type === 'Season' && nextUp?.SeasonId !== item.Id ? null : nextUp;
      const hero = buildDetailHero(ctx, item, { page, series, nextUp: seasonNextUp, onCollectionChanged: () => window.location.reload() });
      wrapper.before(hero.root);
      cleanups.push(() => hero.destroy());

      // 2. Stagioni ed episodi
      if (seriesId && item.Type !== 'Movie' && item.Type !== 'BoxSet') {
        const eps = await buildEpisodes(ctx, seriesId, {
          initialSeasonId: item.Type === 'Season' ? item.Id : item.Type === 'Episode' ? item.SeasonId : undefined,
          currentEpisodeId: item.Type === 'Episode' ? item.Id : undefined,
          nextUp,
          signal,
        }).catch((err: unknown) => {
          ctx.log('episodi', err);
          return null;
        });
        if (signal.aborted) {
          eps?.destroy();
          run();
          return;
        }
        if (eps) {
          place(wrapper, eps.root, 1);
          cleanups.push(() => eps.destroy());
        }
      }

      // 3. Informazioni + dettagli tecnici nativi a scomparsa
      const info = place(wrapper, buildInfo(ctx, item, page, { collapsible }), 2);
      cleanups.push(() => info.remove());

      // Raccolte: filtro tipo e avviso di condivisione sopra gli elementi nativi della raccolta.
      if (item.Type === 'BoxSet') {
        page.classList.add('nebula-collection-page');
        info.append(collectionFilter(page), h('p', { class: 'nebula-notice nebula-notice--inline' }, icon('group'), t('sharedNotice')));
      }

      // 4. Cast e troupe (le stagioni ereditano il cast della serie)
      const cast = item.Type === 'BoxSet' ? null : buildCast(ctx, item.Type === 'Season' && series ? { ...item, People: series.People } : item);
      if (cast) {
        place(wrapper, cast, 4);
        cleanups.push(() => cast.remove());
      }

      // 5. Potrebbe piacerti (unica sezione di suggerimenti dalla libreria)
      if (item.Type !== 'BoxSet') {
        void buildMayLike(ctx, item, signal)
          .then((section) => {
            if (!section) return;
            if (signal.aborted) {
              section.remove();
              return;
            }
            place(wrapper, section, 5);
            cleanups.push(() => section.remove());
          })
          .catch((err: unknown) => ctx.log('simili', err));
      }

      // 6. Seerr (JE): sezioni raccolte in un unico contenitore a schede
      const seerrHost = place(wrapper, h('div', { class: 'nebula-root nebula-seerr-host' }), 6);
      cleanups.push(groupSeerrSections(page, seerrHost), () => seerrHost.remove());

      return run;
    },
  };
}
