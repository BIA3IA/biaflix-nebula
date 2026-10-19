/**
 * Cinematic Hero della homepage.
 * Fonti, in ordine: raccolta curata dalla proprietaria (nome configurabile, badge «In evidenza");
 * altrimenti titoli in corso con backdrop; altrimenti ultimi aggiunti con backdrop.
 * Solo contenuti realmente presenti in libreria. Default: hero statico; con più slide solo
 * navigazione manuale, autoplay opzionale con stop su hover/focus/tab nascosta.
 */
import { nativeItemsContainer, itemDataAttrs } from '../cards';
import type { NebulaContext } from '../context';
import type { Feature } from '../lifecycle';
import { t } from '../i18n';
import { backdropImage, logoImage, posterImage, srcset } from '../images';
import type { BaseItem } from '../jellyfin-api';
import { h, icon, prefersReducedMotion } from '../ui/dom';
import { watchlistButton } from '../ui/watchlist-button';
import { waitFor } from '../ui/wait';
import { isWatchlistRoute } from '../watchlist';

const MAX_SLIDES = 5;
const TICKS_PER_MINUTE = 600_000_000;

const HERO_QUERY = {
  recursive: true,
  includeItemTypes: ['Movie', 'Series'],
  imageTypes: 'Backdrop',
  enableImageTypes: ['Primary', 'Backdrop', 'Logo'],
  imageTypeLimit: 1,
  limit: MAX_SLIDES,
} as const;

export async function pickHeroItems(ctx: NebulaContext): Promise<{ items: BaseItem[]; curated: boolean }> {
  const { Items: collections } = await ctx.api.getCollections();
  const curated = collections.find((c) => c.Name.trim().toLowerCase() === ctx.flags.heroCollectionName.trim().toLowerCase());
  if (curated) {
    const r = await ctx.api.getChildren(curated.Id, { ...HERO_QUERY, sortBy: 'SortName' });
    if (r.Items.length) return { items: r.Items, curated: true };
  }
  const resume = await ctx.api.getItems({ ...HERO_QUERY, filters: 'IsResumable', sortBy: 'DatePlayed', sortOrder: 'Descending', includeItemTypes: ['Movie'] });
  const latest = await ctx.api.getItems({ ...HERO_QUERY, sortBy: 'DateCreated', sortOrder: 'Descending' });
  const seen = new Set<string>();
  const items = [...resume.Items, ...latest.Items].filter((i) => !seen.has(i.Id) && seen.add(i.Id) && backdropImage(i)).slice(0, MAX_SLIDES);
  return { items, curated: false };
}

function metaLine(item: BaseItem): string[] {
  const parts: string[] = [];
  if (item.ProductionYear) parts.push(String(item.ProductionYear));
  if (item.Type === 'Movie' && item.RunTimeTicks) {
    const min = Math.round(item.RunTimeTicks / TICKS_PER_MINUTE);
    parts.push(min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);
  }
  if (item.Type === 'Series') parts.push(t('series'));
  if (item.OfficialRating) parts.push(item.OfficialRating);
  if (item.Genres?.length) parts.push(item.Genres.slice(0, 3).join(', '));
  return parts;
}

function slide(ctx: NebulaContext, item: BaseItem, curated: boolean, index: number): HTMLElement {
  const bd = backdropImage(item);
  const logo = logoImage(item);
  const resumable = (item.UserData?.PlaybackPositionTicks ?? 0) > 0;
  const width = Math.min(2560, Math.round(window.innerWidth * (window.devicePixelRatio || 1)));
  const bg = bd
    ? h('img', {
        class: 'nebula-hero__backdrop',
        src: ctx.api.imageUrl(bd.itemId, 'Backdrop', { tag: bd.tag, width }),
        alt: '',
        decoding: 'async',
        fetchpriority: index === 0 ? 'high' : 'low',
        loading: index === 0 ? 'eager' : 'lazy',
      })
    : h(
        'div',
        { class: 'nebula-hero__backdrop nebula-hero__backdrop--fallback' },
        posterImage(item)
          ? h('img', { class: 'nebula-hero__accent', src: ctx.api.imageUrl(item.Id, 'Primary', { tag: item.ImageTags?.Primary, width: 400 }), alt: '' })
          : null,
      );

  const title = logo
    ? h(
        'h2',
        { class: 'nebula-hero__title nebula-hero__title--logo' },
        h('img', { class: 'nebula-hero__logo', src: ctx.api.imageUrl(logo.itemId, 'Logo', { tag: logo.tag, width: 640 }), alt: item.Name }),
      )
    : h('h2', { class: 'nebula-hero__title' }, item.Name);

  // Pulsanti dentro un emby-itemscontainer: Riproduci/Riprendi usano il playbackManager nativo.
  const actions = nativeItemsContainer('nebula-hero__actions');
  const host = h('div', { class: 'nebula-hero__action-host', ...itemDataAttrs(item, ctx.serverId) });
  const play = h(
    'button',
    { type: 'button', class: 'nebula-btn nebula-btn--primary nebula-btn--lg itemAction', 'data-action': resumable ? 'resume' : 'play' },
    icon('play_arrow'),
    resumable ? t('resume') : t('play'),
  );
  const details = h(
    'a',
    { class: 'nebula-btn nebula-btn--glass nebula-btn--lg itemAction', 'data-action': 'link', href: `#/details?id=${item.Id}&serverId=${ctx.serverId}` },
    icon('info'),
    t('details'),
  );
  const wl = watchlistButton(ctx, item, 'lg');
  host.append(play, details, wl);
  actions.append(host);

  // Su mobile la composizione usa la locandina nitida (2:3 si adatta allo schermo verticale);
  // il backdrop diventa uno sfondo ambientale. Nascosta via CSS su desktop.
  const posterRef = posterImage(item);
  const poster = posterRef
    ? h('img', {
        class: 'nebula-hero__poster',
        alt: '',
        'aria-hidden': 'true',
        loading: index === 0 ? 'eager' : 'lazy',
        decoding: 'async',
        sizes: '260px',
        ...srcset(ctx.api, posterRef, 260),
      })
    : null;

  return h(
    'article',
    { class: 'nebula-hero__slide', 'data-index': index, 'aria-roledescription': 'slide', 'aria-label': `${index + 1}: ${item.Name}` },
    bg,
    h('div', { class: 'nebula-hero__scrim', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'nebula-hero__content' },
      poster,
      curated ? h('span', { class: 'nebula-chip nebula-chip--featured' }, icon('auto_awesome'), t('featured')) : null,
      title,
      h(
        'p',
        { class: 'nebula-hero__meta' },
        metaLine(item).map((p) => h('span', {}, p)),
      ),
      item.Overview ? h('p', { class: 'nebula-hero__overview' }, item.Overview) : null,
      actions,
    ),
  );
}

export function buildHero(ctx: NebulaContext, items: BaseItem[], curated: boolean): { root: HTMLElement; destroy(): void } {
  const slides = items.map((item, i) => slide(ctx, item, curated, i));
  const track = h('div', { class: 'nebula-hero__track', 'aria-live': ctx.flags.heroAutoplay ? 'off' : 'polite' }, slides);
  const root = h('section', { class: 'nebula-root nebula-hero', 'aria-roledescription': 'carousel', 'aria-label': t('featured') }, track);
  let current = 0;
  let timer: number | undefined;
  let paused = !ctx.flags.heroAutoplay || prefersReducedMotion();

  const show = (index: number) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((s, i) => {
      s.classList.toggle('is-active', i === current);
      s.toggleAttribute('inert', i !== current);
      s.setAttribute('aria-hidden', String(i !== current));
    });
    dots.forEach((d, i) => d.setAttribute('aria-current', String(i === current)));
  };

  const dots: HTMLButtonElement[] = [];
  if (slides.length > 1) {
    const prev = h('button', { type: 'button', class: 'nebula-icon-btn nebula-hero__nav', 'aria-label': t('previous') }, icon('chevron_left'));
    const next = h('button', { type: 'button', class: 'nebula-icon-btn nebula-hero__nav', 'aria-label': t('next') }, icon('chevron_right'));
    prev.addEventListener('click', () => show(current - 1));
    next.addEventListener('click', () => show(current + 1));
    const dotWrap = h('div', { class: 'nebula-hero__dots' });
    slides.forEach((_, i) => {
      const d = h('button', { type: 'button', class: 'nebula-hero__dot', 'aria-label': t('slide', { n: i + 1 }) }) as HTMLButtonElement;
      d.addEventListener('click', () => show(i));
      dots.push(d);
      dotWrap.append(d);
    });
    root.append(h('div', { class: 'nebula-hero__controls' }, prev, dotWrap, next));
  }

  const stop = () => window.clearInterval(timer);
  const startAuto = () => {
    stop();
    if (paused || slides.length < 2 || document.hidden) return;
    timer = window.setInterval(() => show(current + 1), ctx.flags.heroIntervalMs);
  };
  const hold = () => stop();
  const release = () => startAuto();
  const onVisibility = () => (document.hidden ? stop() : startAuto());
  root.addEventListener('pointerenter', hold);
  root.addEventListener('pointerleave', release);
  root.addEventListener('focusin', hold);
  root.addEventListener('focusout', release);
  document.addEventListener('visibilitychange', onVisibility);

  // Swipe orizzontale su touch per cambiare slide (i tap sui pulsanti restano click normali).
  let touchStart: { x: number; y: number } | null = null;
  root.addEventListener('pointerdown', (e) => {
    touchStart = e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY } : null;
  });
  root.addEventListener('pointerup', (e) => {
    if (!touchStart || slides.length < 2) return;
    const dx = e.clientX - touchStart.x;
    const dy = e.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
  });

  show(0);
  startAuto();
  return {
    root,
    destroy() {
      stop();
      paused = true;
      document.removeEventListener('visibilitychange', onVisibility);
      root.remove();
    },
  };
}

export function heroFeature(ctx: NebulaContext): Feature {
  return {
    name: 'hero',
    routes: ['home'],
    async mount({ page, signal, params }) {
      if (isWatchlistRoute('home', params)) return;
      if (!ctx.flags.hero || !page) return;
      if (params.get('tab') && params.get('tab') !== '0') return;
      const tab = await waitFor<HTMLElement>(page, '#homeTab', signal);
      if (!tab || signal.aborted) return;
      tab.querySelector(':scope > .nebula-hero')?.remove();
      const { items, curated } = await pickHeroItems(ctx);
      if (signal.aborted || !items.length) return;
      const hero = buildHero(ctx, items, curated);
      // La home nativa/KefinTweaks può ricostruire i figli del tab dopo il mount.
      // Conserva la stessa hero (slide e listener) e osserva solo tab e suo contenitore.
      let observedTab: HTMLElement | null = null;
      const observer = new MutationObserver(() => attach());
      const attach = () => {
        if (signal.aborted) return;
        const target = page.querySelector<HTMLElement>('#homeTab');
        if (!target) return;
        if (observedTab !== target) {
          observer.disconnect();
          observer.observe(target.parentElement ?? page, { childList: true });
          observer.observe(target, { childList: true });
          observedTab = target;
        }
        if (target.firstElementChild !== hero.root) target.prepend(hero.root);
      };
      attach();
      page.classList.add('nebula-has-hero');
      return () => {
        observer.disconnect();
        hero.destroy();
        page.classList.remove('nebula-has-hero');
      };
    },
  };
}
