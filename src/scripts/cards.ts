/**
 * Card Nebula: poster 2:3, landscape 16:9, raccolta editoriale con cover composita.
 * Le card sono "native-actionable": vivono dentro un <div is="emby-itemscontainer"> e portano gli
 * stessi attributi data-* delle card Jellyfin, così click, Riproduci/Riprendi e menu contestuale
 * passano per il codice nativo (playbackManager, itemContextMenu) senza reimplementarlo.
 */
import type { NebulaContext } from './context';
import { countLabel, t } from './i18n';
import { backdropImage, posterImage, srcset, wideImage, type ImageRef } from './images';
import type { BaseItem } from './jellyfin-api';
import { h, icon } from './ui/dom';

const TICKS_PER_MINUTE = 600_000_000;

/** Contenitore che il web client aggancia ai propri handler (shortcuts.on). */
export function nativeItemsContainer(className: string): HTMLElement {
  const wrap = document.createElement('div');
  // Markup statico: nessun dato utente. Il polyfill webcomponents v0 aggiorna gli elementi "is" analizzati.
  wrap.innerHTML = `<div is="emby-itemscontainer" class="itemsContainer ${className}" data-multiselect="false" data-contextmenu="true"></div>`;
  return wrap.firstElementChild as HTMLElement;
}

export function itemDataAttrs(item: BaseItem, serverId: string): Record<string, string> {
  const attrs: Record<string, string> = {
    'data-id': item.Id,
    'data-serverid': item.ServerId ?? serverId,
    'data-type': item.Type,
    'data-isfolder': String(!!item.IsFolder || item.Type === 'Series' || item.Type === 'BoxSet' || item.Type === 'Playlist'),
    'data-mediatype': item.Type === 'Movie' || item.Type === 'Episode' ? 'Video' : 'Unknown',
  };
  if (item.SeriesId) attrs['data-seriesid'] = item.SeriesId;
  const ticks = item.UserData?.PlaybackPositionTicks;
  if (ticks) attrs['data-positionticks'] = String(ticks);
  return attrs;
}

export function progressPercent(item: BaseItem): number | null {
  const pct = item.UserData?.PlayedPercentage;
  if (typeof pct !== 'number' || pct <= 0 || pct >= 100) return null;
  return Math.round(pct * 10) / 10;
}

export function minutesLeft(item: BaseItem): number | null {
  const pos = item.UserData?.PlaybackPositionTicks;
  if (!pos || !item.RunTimeTicks || pos >= item.RunTimeTicks) return null;
  return Math.max(1, Math.round((item.RunTimeTicks - pos) / TICKS_PER_MINUTE));
}

export function episodeCode(item: BaseItem): string | null {
  if (item.Type !== 'Episode' || item.IndexNumber == null) return null;
  const s = String(item.ParentIndexNumber ?? 1).padStart(2, '0');
  const e = String(item.IndexNumber).padStart(2, '0');
  return `S${s}E${e}`;
}

function image(ctx: NebulaContext, ref: ImageRef | null, cssWidth: number, alt = ''): HTMLElement {
  if (!ref) return h('div', { class: 'nebula-card__placeholder', 'aria-hidden': 'true' }, icon('movie'));
  const { src, srcset: set } = srcset(ctx.api, ref, cssWidth);
  const img = h('img', { class: 'nebula-card__img', src, srcset: set, sizes: `${cssWidth}px`, alt, loading: 'lazy', decoding: 'async', draggable: 'false' });
  img.addEventListener('error', () => img.replaceWith(h('div', { class: 'nebula-card__placeholder', 'aria-hidden': 'true' }, icon('broken_image'))), {
    once: true,
  });
  return img;
}

function progress(item: BaseItem): HTMLElement | null {
  const pct = progressPercent(item);
  if (pct === null) return null;
  return h(
    'div',
    {
      class: 'nebula-progress',
      role: 'progressbar',
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-valuenow': Math.round(pct),
      'aria-label': `${Math.round(pct)}%`,
    },
    h('span', { class: 'nebula-progress__bar', style: `width:${pct}%` }),
  );
}

export function posterCard(ctx: NebulaContext, item: BaseItem): HTMLElement {
  const year = item.ProductionYear ? String(item.ProductionYear) : '';
  const kind = item.Type === 'Series' ? t('series') : item.Type === 'Movie' ? t('movies') : '';
  return h(
    'div',
    { class: 'nebula-card nebula-card--poster', ...itemDataAttrs(item, ctx.serverId) },
    h(
      'a',
      { class: 'nebula-card__media itemAction', 'data-action': 'link', href: `#/details?id=${item.Id}&serverId=${ctx.serverId}`, 'aria-label': item.Name },
      image(ctx, posterImage(item), 214),
      progress(item),
      item.UserData?.Played ? h('span', { class: 'nebula-badge nebula-badge--played', title: '✓' }, icon('check')) : null,
    ),
    h(
      'div',
      { class: 'nebula-card__text' },
      h('span', { class: 'nebula-card__title', title: item.Name }, item.Name),
      h('span', { class: 'nebula-card__meta' }, [year, kind].filter(Boolean).join(' · ')),
    ),
  );
}

export function landscapeCard(ctx: NebulaContext, item: BaseItem): HTMLElement {
  const code = episodeCode(item);
  const left = minutesLeft(item);
  const title = item.Type === 'Episode' ? (item.SeriesName ?? item.Name) : item.Name;
  const sub = [code, item.Type === 'Episode' ? item.Name : null, left ? t('minutesLeft', { n: left }) : null].filter(Boolean).join(' · ');
  return h(
    'div',
    { class: 'nebula-card nebula-card--wide', ...itemDataAttrs(item, ctx.serverId) },
    h(
      'a',
      {
        class: 'nebula-card__media itemAction',
        'data-action': 'link',
        href: `#/details?id=${item.Id}&serverId=${ctx.serverId}`,
        'aria-label': `${title} ${sub}`.trim(),
      },
      image(ctx, wideImage(item), 320),
      progress(item),
    ),
    h(
      'div',
      { class: 'nebula-card__text' },
      h('span', { class: 'nebula-card__title', title }, title),
      sub ? h('span', { class: 'nebula-card__meta' }, sub) : null,
    ),
  );
}

/** Cover composita: 1 backdrop o fino a 4 poster dei titoli contenuti. */
export function collageCover(ctx: NebulaContext, preview: readonly BaseItem[]): HTMLElement {
  const posters = preview
    .map((i) => posterImage(i))
    .filter((r): r is ImageRef => r !== null)
    .slice(0, 4);
  if (posters.length >= 2) {
    return h(
      'div',
      { class: `nebula-collage nebula-collage--${posters.length}`, 'aria-hidden': 'true' },
      posters.map((p) => image(ctx, p, 160)),
    );
  }
  const first = preview[0];
  const wide = first ? (backdropImage(first) ?? posterImage(first)) : null;
  return h(
    'div',
    { class: 'nebula-collage nebula-collage--1', 'aria-hidden': 'true' },
    wide ? image(ctx, wide, 420) : h('div', { class: 'nebula-collage__empty' }, icon('collections_bookmark')),
  );
}

export function collectionCard(
  ctx: NebulaContext,
  item: BaseItem,
  count: number,
  preview: readonly BaseItem[],
  kind: 'collection' | 'playlist' = 'collection',
): HTMLElement {
  return h(
    'div',
    { class: `nebula-card nebula-card--collection nebula-card--${kind}`, ...itemDataAttrs(item, ctx.serverId) },
    h(
      'a',
      {
        class: 'nebula-card__media itemAction',
        'data-action': 'link',
        href: `#/details?id=${item.Id}&serverId=${ctx.serverId}`,
        'aria-label': `${item.Name}, ${countLabel(count)}`,
      },
      collageCover(ctx, preview),
      h(
        'div',
        { class: 'nebula-collection__veil' },
        h(
          'span',
          { class: 'nebula-chip nebula-chip--kind' },
          icon(kind === 'collection' ? 'collections_bookmark' : 'playlist_play'),
          kind === 'collection' ? t('collectionKind') : t('playlistKind'),
        ),
        h('span', { class: 'nebula-collection__name' }, item.Name),
        h('span', { class: 'nebula-collection__count' }, countLabel(count)),
      ),
    ),
  );
}
