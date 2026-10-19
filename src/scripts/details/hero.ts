/**
 * Hero cinematografico della pagina dettagli (film, serie, stagione, episodio, raccolta).
 * - Backdrop a tutta larghezza con gradient Nebula; senza Backdrop sul server usa la locandina
 *   ingrandita e sfocata come luce ambientale (mai immagini esterne, mai un rettangolo nero).
 * - Locandina 2:3 nitida e ben dimensionata (16:9 per gli episodi), logo o titolo tipografico.
 * - Metadati essenziali, trama breve espandibile, Riproduci/Riprendi in evidenza.
 * - Azioni secondarie poche e riconoscibili; tutto il resto in «Altre azioni», costruito dai pulsanti
 *   nativi (Jellyfin + KefinTweaks + JE) così nulla viene duplicato o perso.
 */
import { canManageCollections } from '../collections';
import type { NebulaContext } from '../context';
import { detailsPath } from '../env';
import { t } from '../i18n';
import { backdropImage, logoImage, posterImage, srcset, wideImage, type ImageRef } from '../images';
import type { BaseItem } from '../jellyfin-api';
import { h, icon } from '../ui/dom';
import { attachMenu, type MenuItem } from '../ui/menu';
import { watchlistButton } from '../ui/watchlist-button';
import { openAddTo, openManageCollection } from '../features/collection-dialogs';
import { nativeActionItems, triggerNative } from './native';

const TICKS_PER_MINUTE = 600_000_000;

export function formatRuntime(ticks?: number): string | null {
  if (!ticks) return null;
  const min = Math.round(ticks / TICKS_PER_MINUTE);
  if (min < 1) return null;
  return min >= 60 ? t('durationHm', { h: Math.floor(min / 60), m: min % 60 }) : t('durationMin', { n: min });
}

export function yearSpan(item: BaseItem): string | null {
  if (!item.ProductionYear) return null;
  if (item.Type !== 'Series') return String(item.ProductionYear);
  const end = item.EndDate ? new Date(item.EndDate).getFullYear() : null;
  if (item.Status === 'Ended' && end && end !== item.ProductionYear) return `${item.ProductionYear}–${end}`;
  if (item.Status === 'Continuing') return `${item.ProductionYear}–`;
  return String(item.ProductionYear);
}

export function remainingMinutes(item: BaseItem): number | null {
  const pos = item.UserData?.PlaybackPositionTicks;
  if (!pos || !item.RunTimeTicks || pos >= item.RunTimeTicks) return null;
  return Math.max(1, Math.round((item.RunTimeTicks - pos) / TICKS_PER_MINUTE));
}

export function heroMeta(item: BaseItem): string[] {
  const parts: string[] = [];
  const year = yearSpan(item);
  if (year) parts.push(year);
  if (item.Type === 'Series' && item.ChildCount) parts.push(item.ChildCount === 1 ? t('seasonsOne') : t('seasonsCount', { n: item.ChildCount }));
  if (item.Type === 'Season' && item.ChildCount) parts.push(item.ChildCount === 1 ? t('episodesOne') : t('episodesCount', { n: item.ChildCount }));
  if (item.Type === 'Movie' || item.Type === 'Episode') {
    const rt = formatRuntime(item.RunTimeTicks);
    if (rt) parts.push(rt);
  }
  return parts;
}

function img(ctx: NebulaContext, ref: ImageRef, width: number, cls: string, eager = false): HTMLImageElement {
  return h('img', {
    class: cls,
    alt: '',
    decoding: 'async',
    loading: eager ? 'eager' : 'lazy',
    fetchpriority: eager ? 'high' : 'auto',
    sizes: `${width}px`,
    ...srcset(ctx.api, ref, width),
  });
}

export interface HeroOptions {
  page: HTMLElement;
  series?: BaseItem | null;
  nextUp?: BaseItem | null;
  onCollectionChanged?: () => void;
}

export function buildDetailHero(ctx: NebulaContext, item: BaseItem, opts: HeroOptions): { root: HTMLElement; destroy(): void } {
  const { page, series } = opts;
  const isEpisode = item.Type === 'Episode';
  const bdRef = backdropImage(item) ?? (series ? backdropImage(series) : null);
  const posterRef = isEpisode ? wideImage(item) : (posterImage(item) ?? (series ? posterImage(series) : null));
  const logoRef = logoImage(item) ?? (item.Type === 'Season' && series ? logoImage(series) : null);

  // --- Sfondo -------------------------------------------------------------------------
  const vw = Math.min(2560, Math.round(window.innerWidth * (window.devicePixelRatio || 1)));
  let bg: HTMLElement;
  if (bdRef) {
    bg = h('img', {
      class: 'ndh__backdrop',
      alt: '',
      decoding: 'async',
      fetchpriority: 'high',
      src: ctx.api.imageUrl(bdRef.itemId, 'Backdrop', { tag: bdRef.tag, width: vw }),
    });
  } else if (posterRef) {
    // Fallback: locandina ingrandita e sfocata, solo come luce ambientale.
    bg = h('img', {
      class: 'ndh__backdrop ndh__backdrop--ambient',
      alt: '',
      decoding: 'async',
      src: ctx.api.imageUrl(posterRef.itemId, posterRef.type, { tag: posterRef.tag, width: 480 }),
    });
  } else {
    bg = h('div', { class: 'ndh__backdrop ndh__backdrop--empty' });
  }

  // --- Titolo ---------------------------------------------------------------------------
  const titleText = item.Type === 'Season' && series ? `${series.Name} · ${item.Name}` : item.Name;
  const title = h(
    'h1',
    { class: `ndh__title${logoRef && !isEpisode ? ' ndh__title--logo' : ''}` },
    logoRef && !isEpisode
      ? h('img', { class: 'ndh__logo', alt: titleText, src: ctx.api.imageUrl(logoRef.itemId, 'Logo', { tag: logoRef.tag, width: 720 }) })
      : titleText,
  );
  if (logoRef && !isEpisode && item.Type === 'Season') title.append(h('span', { class: 'ndh__subtitle' }, item.Name));

  // Riga superiore: tipo/serie di appartenenza (link reale alla serie).
  const eyebrow = h('p', { class: 'ndh__eyebrow' });
  if ((isEpisode || item.Type === 'Season') && series) {
    eyebrow.append(h('a', { href: `#/${detailsPath(series.Id, ctx.serverId)}`, class: 'ndh__series-link' }, series.Name));
    if (isEpisode && item.IndexNumber != null) {
      eyebrow.append(
        h('span', {}, t('episodeCode', { s: String(item.ParentIndexNumber ?? 1).padStart(2, '0'), e: String(item.IndexNumber).padStart(2, '0') })),
      );
    }
  } else {
    const kind = item.Type === 'Movie' ? t('movies') : item.Type === 'Series' ? t('series') : item.Type === 'BoxSet' ? t('collectionKind') : '';
    if (kind) eyebrow.append(h('span', {}, kind));
    const studio = item.Studios?.[0]?.Name;
    if (studio) eyebrow.append(h('span', {}, studio));
  }

  // Metadati principali
  const meta = h(
    'ul',
    { class: 'ndh__meta', 'aria-label': t('information') },
    heroMeta(item).map((m) => h('li', {}, m)),
  );
  if (item.OfficialRating) meta.append(h('li', {}, h('span', { class: 'ndh__badge', title: t('ageRating') }, item.OfficialRating)));
  if (item.CommunityRating) meta.append(h('li', { class: 'ndh__rating' }, icon('star'), item.CommunityRating.toFixed(1)));
  const genres = (item.Genres?.length ? item.Genres : (series?.Genres ?? [])).slice(0, 3);
  const genreList = genres.length
    ? h(
        'ul',
        { class: 'ndh__genres' },
        genres.map((g) => h('li', { class: 'nebula-chip' }, g)),
      )
    : null;

  // Trama breve espandibile
  const overviewText = item.Overview?.trim();
  let overview: HTMLElement | null = null;
  let readMore: HTMLButtonElement | null = null;
  if (overviewText) {
    overview = h('p', { class: 'ndh__overview', id: `ndh-overview-${item.Id}` }, overviewText);
    readMore = h(
      'button',
      { type: 'button', class: 'ndh__readmore', 'aria-expanded': 'false', 'aria-controls': overview.id, hidden: true },
      t('readMore'),
    ) as HTMLButtonElement;
    readMore.addEventListener('click', () => {
      const open = overview!.classList.toggle('is-expanded');
      readMore!.setAttribute('aria-expanded', String(open));
      readMore!.textContent = open ? t('readLess') : t('readMore');
    });
  }

  // Crediti essenziali (secondari)
  const directors = (item.People ?? []).filter((p) => p.Type === 'Director').slice(0, 2);
  const credits = directors.length
    ? h('p', { class: 'ndh__credits' }, h('span', { class: 'ndh__credits-label' }, t('director')), directors.map((d) => d.Name).join(', '))
    : null;

  // --- Azioni -----------------------------------------------------------------------------
  const resumeItem = item.Type === 'Series' || item.Type === 'Season' ? opts.nextUp : item;
  const resumable = (resumeItem?.UserData?.PlaybackPositionTicks ?? 0) > 0;
  const nextCode =
    opts.nextUp && opts.nextUp.IndexNumber != null
      ? t('episodeCode', { s: String(opts.nextUp.ParentIndexNumber ?? 1).padStart(2, '0'), e: String(opts.nextUp.IndexNumber).padStart(2, '0') })
      : null;
  const play = h(
    'button',
    { type: 'button', class: 'nebula-btn nebula-btn--primary nebula-btn--lg ndh__play' },
    icon('play_arrow'),
    h('span', { class: 'ndh__play-label' }, resumable ? t('resume') : t('play'), nextCode ? h('small', {}, nextCode) : null),
  ) as HTMLButtonElement;
  play.addEventListener('click', () => {
    // Il pulsante nativo applica la logica giusta per tipo (serie → prossimo episodio, ripresa dalla posizione).
    if (!triggerNative(page, 'btnPlay')) triggerNative(page, 'btnReplay');
  });

  const actions = h('div', { class: 'ndh__actions' }, play);
  const hasTrailer = (item.RemoteTrailers?.length ?? 0) > 0 || (item.LocalTrailerCount ?? 0) > 0;
  if (hasTrailer) {
    const trailer = h(
      'button',
      { type: 'button', class: 'nebula-btn nebula-btn--glass' },
      icon('theaters'),
      h('span', { class: 'nebula-btn__label' }, t('trailer')),
    );
    trailer.addEventListener('click', () => triggerNative(page, 'btnPlayTrailer'));
    actions.append(trailer);
  }
  const collectable = ['Movie', 'Series', 'Season', 'Episode'].includes(item.Type);
  if (collectable) actions.append(watchlistButton(ctx, item, 'pill'));

  const more = h(
    'button',
    { type: 'button', class: 'nebula-btn nebula-btn--glass ndh__more', 'aria-label': t('moreActions'), title: t('moreActions') },
    icon('more_horiz'),
    h('span', { class: 'nebula-btn__label' }, t('moreActions')),
  );
  const detachMenu = attachMenu(more, () => {
    const items: MenuItem[] = [];
    if (resumable)
      items.push({ label: t('playFromStart'), icon: 'replay', onSelect: () => triggerNative(page, 'btnReplay') || triggerNative(page, 'btnPlay') });
    if (collectable) items.push({ label: t('addTo'), icon: 'library_add', onSelect: () => void openAddTo(ctx, item) });
    if (item.Type === 'BoxSet' && ctx.flags.collectionManage && canManageCollections(ctx.user)) {
      items.push({ label: t('manageCollection'), icon: 'edit_note', onSelect: () => void openManageCollection(ctx, item, () => opts.onCollectionChanged?.()) });
    }
    return [...items, ...nativeActionItems(page).filter((n) => !(resumable && /dall.inizio|from (the )?(start|beginning)|replay/i.test(n.label)))];
  });
  actions.append(more);

  // Progresso di visione
  let progress: HTMLElement | null = null;
  const left = resumeItem ? remainingMinutes(resumeItem) : null;
  const pct = resumeItem?.UserData?.PlayedPercentage;
  if (left && pct) {
    progress = h(
      'div',
      { class: 'ndh__progress' },
      h(
        'div',
        {
          class: 'nebula-progress',
          role: 'progressbar',
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-valuenow': Math.round(pct),
          'aria-label': t('remainingMin', { n: left }),
        },
        h('span', { class: 'nebula-progress__bar', style: `width:${pct}%` }),
      ),
      h('span', {}, t('remainingMin', { n: left })),
    );
  }

  const poster = posterRef
    ? h('div', { class: `ndh__poster${isEpisode ? ' ndh__poster--wide' : ''}` }, img(ctx, posterRef, isEpisode ? 520 : 300, 'ndh__poster-img', true))
    : null;

  const root = h(
    'section',
    { class: `nebula-root nebula-detail-hero ndh--${item.Type.toLowerCase()}${bdRef ? '' : ' ndh--no-backdrop'}`, 'aria-labelledby': `ndh-title-${item.Id}` },
    h('div', { class: 'ndh__bg', 'aria-hidden': 'true' }, bg, h('div', { class: 'ndh__scrim' })),
    h(
      'div',
      { class: 'ndh__inner' },
      poster,
      h('div', { class: 'ndh__info' }, eyebrow.childElementCount ? eyebrow : null, title, meta, genreList, overview, readMore, credits, actions, progress),
    ),
  );
  title.id = `ndh-title-${item.Id}`;

  // «Leggi tutto» solo se la trama è davvero troncata.
  const checkClamp = () => {
    if (overview && readMore && !overview.classList.contains('is-expanded')) readMore.hidden = overview.scrollHeight <= overview.clientHeight + 2;
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(checkClamp) : null;
  if (overview) ro?.observe(overview);
  requestAnimationFrame(() => {
    checkClamp();
    root.classList.add('is-ready');
  });

  return {
    root,
    destroy() {
      ro?.disconnect();
      detachMenu();
      root.remove();
    },
  };
}
