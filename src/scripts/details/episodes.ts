/**
 * Area editoriale unica «Stagioni ed episodi» (serie, stagione, episodio).
 * Sostituisce la sezione «Stagioni» nativa, la lista episodi della stagione, «Prossimo» e la sezione
 * episodi di KefinTweaks (Episodes on Series Page): una sola vista, nessuna ripetizione.
 * - Selettore stagione: pillole scorrevoli (o select glass oltre 8 stagioni).
 * - Episodi in griglia responsive 16:9: numero, titolo, durata, progresso, trama breve, Play/Riprendi.
 * - Play passa per i gestori nativi (emby-itemscontainer), il click sulla card apre l'episodio.
 * - Le trame arrivano dall'API, quindi rispettano Spoiler Guard di Jellyfin Enhanced (applicato dal server).
 */
import { itemDataAttrs, nativeItemsContainer } from '../cards';
import type { NebulaContext } from '../context';
import { detailsPath } from '../env';
import { t } from '../i18n';
import { srcset, wideImage } from '../images';
import type { BaseItem } from '../jellyfin-api';
import { h, icon, prefersReducedMotion, uniqueId } from '../ui/dom';
import { formatRuntime, remainingMinutes } from './hero';

const SEASON_MEMORY = 'biaflixNebula:season:';

function remember(seriesId: string, seasonId: string): void {
  try {
    sessionStorage.setItem(SEASON_MEMORY + seriesId, seasonId);
  } catch {
    /* solo comodità per il browser corrente */
  }
}

function recalled(seriesId: string): string | null {
  try {
    return sessionStorage.getItem(SEASON_MEMORY + seriesId);
  } catch {
    return null;
  }
}

function episodeCard(ctx: NebulaContext, ep: BaseItem, opts: { current: boolean; next: boolean }): HTMLElement {
  const ref = wideImage(ep);
  const thumb = ref
    ? h('img', { class: 'nep__img', alt: '', loading: 'lazy', decoding: 'async', sizes: '(width < 600px) 92vw, 360px', ...srcset(ctx.api, ref, 360, [1, 2]) })
    : h('div', { class: 'nep__img nep__img--empty', 'aria-hidden': 'true' }, icon('movie'));
  const pct = ep.UserData?.PlayedPercentage;
  const left = remainingMinutes(ep);
  const resumable = (ep.UserData?.PlaybackPositionTicks ?? 0) > 0;
  const runtime = formatRuntime(ep.RunTimeTicks);
  const number = ep.IndexNumber != null ? `${ep.IndexNumber}. ` : '';
  const href = `#/${detailsPath(ep.Id, ctx.serverId)}`;

  const playBtn = h(
    'button',
    {
      type: 'button',
      class: 'nep__play itemAction',
      'data-action': resumable ? 'resume' : 'play',
      'aria-label': t('playEpisode', { name: `${number}${ep.Name}` }),
    },
    icon(resumable ? 'play_circle' : 'play_arrow'),
  );

  return h(
    'article',
    {
      class: `nep${opts.current ? ' is-current' : ''}${opts.next ? ' is-next' : ''}${ep.UserData?.Played ? ' is-played' : ''}`,
      ...itemDataAttrs(ep, ctx.serverId),
    },
    h(
      'div',
      { class: 'nep__media' },
      h('a', { class: 'nep__link', href, tabindex: '-1', 'aria-hidden': 'true' }, thumb),
      pct && pct < 100 ? h('div', { class: 'nebula-progress' }, h('span', { class: 'nebula-progress__bar', style: `width:${pct}%` })) : null,
      ep.UserData?.Played ? h('span', { class: 'nep__badge', title: t('watched') }, icon('check')) : null,
      opts.next ? h('span', { class: 'nebula-chip nep__next' }, t('nextUp')) : null,
      playBtn,
    ),
    h(
      'div',
      { class: 'nep__body' },
      h('h3', { class: 'nep__title' }, h('a', { href }, `${number}${ep.Name}`)),
      h('p', { class: 'nep__meta' }, [runtime, left && resumable ? t('remainingMin', { n: left }) : null].filter(Boolean).join(' · ')),
      ep.Overview ? h('p', { class: 'nep__overview' }, ep.Overview) : null,
    ),
  );
}

export interface EpisodesHandle {
  root: HTMLElement;
  destroy(): void;
}

/**
 * @param seriesId serie di riferimento
 * @param initialSeasonId stagione da mostrare (pagina stagione/episodio); altrimenti prossimo episodio o memoria
 * @param currentEpisodeId episodio da evidenziare (pagina episodio)
 */
export async function buildEpisodes(
  ctx: NebulaContext,
  seriesId: string,
  opts: { initialSeasonId?: string; currentEpisodeId?: string; nextUp?: BaseItem | null; signal: AbortSignal },
): Promise<EpisodesHandle | null> {
  const seasons = (await ctx.api.getSeasons(seriesId)).Items;
  if (!seasons.length || opts.signal.aborted) return null;

  const pick = opts.initialSeasonId ?? opts.nextUp?.SeasonId ?? recalled(seriesId) ?? seasons.find((s) => !s.UserData?.Played)?.Id ?? seasons[0]!.Id;
  let selected = seasons.some((s) => s.Id === pick) ? pick : seasons[0]!.Id;

  const titleId = uniqueId('nep-title');
  const grid = nativeItemsContainer('nep__grid');
  grid.setAttribute('role', 'list');
  grid.setAttribute('aria-live', 'polite');
  const status = h('p', { class: 'nep__status', role: 'status' });

  // Selettore stagione
  let selector: HTMLElement;
  const tabs: HTMLButtonElement[] = [];
  if (seasons.length > 8) {
    const sel = h('select', { class: 'nep__select', 'aria-label': t('selectSeason') }) as HTMLSelectElement;
    for (const s of seasons) sel.append(h('option', { value: s.Id, selected: s.Id === selected }, s.Name));
    sel.addEventListener('change', () => void show(sel.value));
    selector = sel;
  } else {
    selector = h('div', { class: 'nep__tabs', role: 'tablist', 'aria-label': t('selectSeason') });
    for (const s of seasons) {
      const tab = h(
        'button',
        {
          type: 'button',
          role: 'tab',
          class: 'nep__tab',
          id: `${titleId}-${s.Id}`,
          'aria-selected': String(s.Id === selected),
          'aria-controls': `${titleId}-panel`,
          tabindex: s.Id === selected ? '0' : '-1',
        },
        s.Name,
        s.ChildCount ? h('span', { class: 'nep__tab-count' }, String(s.ChildCount)) : null,
      ) as HTMLButtonElement;
      tab.addEventListener('click', () => void show(s.Id));
      tabs.push(tab);
      selector.append(tab);
    }
    // Frecce tra le schede (pattern tablist).
    selector.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
      if (i < 0) return;
      const j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
      if (j < 0) return;
      e.preventDefault();
      const tab = tabs[(j + tabs.length) % tabs.length]!;
      tab.focus();
      tab.click();
    });
  }

  let seq = 0;
  async function show(seasonId: string): Promise<void> {
    selected = seasonId;
    remember(seriesId, seasonId);
    const mySeq = ++seq;
    tabs.forEach((tab) => {
      const on = tab.id.endsWith(seasonId);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on) tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
    grid.classList.add('is-loading');
    try {
      const eps = (await ctx.api.getEpisodes(seriesId, seasonId)).Items;
      if (mySeq !== seq || opts.signal.aborted) return;
      grid.replaceChildren(
        ...eps.map((ep) => {
          const card = episodeCard(ctx, ep, { current: ep.Id === opts.currentEpisodeId, next: ep.Id === opts.nextUp?.Id });
          card.setAttribute('role', 'listitem');
          return card;
        }),
      );
      status.textContent = eps.length ? '' : t('noEpisodes');
      grid.setAttribute('aria-labelledby', `${titleId}-${seasonId}`);
    } catch (err) {
      ctx.log('episodi', err);
      status.textContent = t('errorGeneric');
    } finally {
      if (mySeq === seq) grid.classList.remove('is-loading');
    }
  }

  const panel = h('div', { class: 'nep__panel', id: `${titleId}-panel`, role: 'tabpanel' }, status, grid);
  const root = h(
    'section',
    { class: 'nebula-root nebula-episodes', 'aria-labelledby': titleId },
    h('header', { class: 'nep__header' }, h('h2', { class: 'nebula-section__title', id: titleId }, t('seasonsAndEpisodes')), selector),
    panel,
  );
  await show(selected);
  return { root, destroy: () => root.remove() };
}
