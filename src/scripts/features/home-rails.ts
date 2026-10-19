/**
 * Rail Nebula in homepage, senza duplicare sezioni native/KefinTweaks:
 * - «Le mie raccolte»: raccolte (BoxSet) + playlist come card editoriali 16:9 con collage.
 * - «La mia watchlist»: UserData.Likes (KefinTweaks ha la propria rail watchlist disattivata in config).
 * Le rail usano `order` per inserirsi tra le sezioni KefinTweaks (ordinate via flex order).
 */
import { collectionCard, posterCard } from '../cards';
import { canManageCollections, COLLECTIONS_CHANGED } from '../collections';
import type { NebulaContext } from '../context';
import type { Feature } from '../lifecycle';
import { t } from '../i18n';
import { PLAYLISTS_CHANGED } from '../playlist';
import { WATCHLIST_CHANGED } from '../watchlist';
import { h, icon } from '../ui/dom';
import { createRail, type RailHandle } from '../ui/rail';
import { waitFor } from '../ui/wait';
import { decorateNebulaCard } from './card-actions';
import { openCreateCollection } from './collection-dialogs';

/** Dopo «Aggiunti di recente» (KefinTweaks order 11) e prima di generi/scoperte. */
export const COLLECTIONS_ORDER = 15;
/** Stesso slot della rail watchlist KefinTweaks (order 60), che resta disattivata. */
export const WATCHLIST_ORDER = 60;

async function fillCollections(ctx: NebulaContext, rail: RailHandle): Promise<void> {
  const [collections, playlists] = await Promise.all([ctx.collections.list(), ctx.api.getPlaylists()]);
  const playlistCards = await Promise.all(
    playlists.Items.slice(0, 12).map(async (p) => {
      const items = await ctx.api.getPlaylistItems(p.Id).catch(() => ({ Items: [], TotalRecordCount: 0 }));
      return collectionCard(ctx, p, items.TotalRecordCount, items.Items.slice(0, 4), 'playlist');
    }),
  );
  const cards = [...collections.map((c) => collectionCard(ctx, c.item, c.count, c.preview, 'collection')), ...playlistCards];
  if (cards.length) {
    rail.setItems(cards);
    return;
  }
  // Primo utilizzo: invito a creare, solo se l'utente ha il permesso.
  if (canManageCollections(ctx.user)) {
    const cta = h('button', { type: 'button', class: 'nebula-btn nebula-btn--primary' }, icon('add'), t('createFirstCollection'));
    cta.addEventListener('click', () => openCreateCollection(ctx));
    rail.setEmpty(h('div', { class: 'nebula-empty' }, h('p', {}, t('collectionsSubtitle')), cta));
  } else {
    // Nessun contenuto e nessun permesso: la rail viene esclusa (attach() non la reinserisce).
    rail.root.dataset.nebulaDismissed = 'true';
    rail.root.remove();
  }
}

async function fillWatchlist(ctx: NebulaContext, rail: RailHandle): Promise<void> {
  const r = await ctx.watchlist.list(24);
  if (r.Items.length)
    rail.setItems(
      r.Items.map((i) => {
        const card = posterCard(ctx, i);
        decorateNebulaCard(ctx, card, i);
        return card;
      }),
    );
  else rail.setEmpty(h('div', { class: 'nebula-empty' }, icon('bookmark_add'), h('p', {}, t('watchlistEmpty'))));
}

export function homeRailsFeature(ctx: NebulaContext): Feature {
  return {
    name: 'home-rails',
    routes: ['home'],
    async mount({ page, signal, params }) {
      if (!page || (params.get('tab') && params.get('tab') !== '0')) return;
      if (!ctx.flags.homeCollectionsRail && !ctx.flags.homeWatchlistRail) return;
      const container = await waitFor<HTMLElement>(page, '#homeTab .homeSectionsContainer, #homeTab .sections', signal, 15_000);
      if (!container || signal.aborted) return;

      const rails: { rail: RailHandle; fill: () => Promise<void>; events: string[] }[] = [];
      if (ctx.flags.homeCollectionsRail) {
        const newBtn = canManageCollections(ctx.user)
          ? h('button', { type: 'button', class: 'nebula-btn nebula-btn--glass nebula-btn--sm' }, icon('add'), t('newCollection'))
          : undefined;
        newBtn?.addEventListener('click', () => openCreateCollection(ctx));
        const rail = createRail({
          title: t('myCollections'),
          subtitle: t('collectionsSubtitle'),
          shape: 'collection',
          className: 'nebula-rail--collections',
          skeletons: 4,
          action: newBtn,
        });
        rail.root.style.order = String(COLLECTIONS_ORDER);
        rails.push({ rail, fill: () => fillCollections(ctx, rail), events: [COLLECTIONS_CHANGED, PLAYLISTS_CHANGED] });
      }
      if (ctx.flags.homeWatchlistRail) {
        const rail = createRail({ title: t('watchlist'), shape: 'poster', className: 'nebula-rail--watchlist' });
        rail.root.style.order = String(WATCHLIST_ORDER);
        rails.push({ rail, fill: () => fillWatchlist(ctx, rail), events: [WATCHLIST_CHANGED] });
      }

      const homeTab = container.closest<HTMLElement>('#homeTab') ?? page;
      const findTarget = () => page.querySelector<HTMLElement>('#homeTab .homeSectionsContainer, #homeTab .sections');
      let observed: HTMLElement | null = null;
      // Il codice nativo (homesections.js, innerHTML) e KefinTweaks ricostruiscono il contenitore
      // delle sezioni: osserviamo SOLO i figli diretti di #homeTab e del contenitore e reinseriamo.
      const observer = new MutationObserver(() => attach());
      const attach = () => {
        const target = findTarget();
        if (!target) return;
        if (observed !== target) {
          observer.disconnect();
          observer.observe(homeTab, { childList: true });
          observer.observe(target, { childList: true });
          observed = target;
        }
        for (const { rail } of rails) if (!rail.root.dataset.nebulaDismissed && rail.root.parentElement !== target) target.append(rail.root);
      };
      attach();

      const cleanups: (() => void)[] = [];
      for (const r of rails) {
        const refresh = () => r.fill().catch((err) => ctx.log('rail', err));
        void refresh();
        for (const ev of r.events) {
          document.addEventListener(ev, refresh);
          cleanups.push(() => document.removeEventListener(ev, refresh));
        }
      }
      cleanups.push(() => observer.disconnect());

      return () => {
        cleanups.forEach((fn) => fn());
        rails.forEach(({ rail }) => rail.root.remove());
      };
    },
  };
}
