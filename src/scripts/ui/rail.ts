/** Rail orizzontale: scroll-snap nativo, pulsanti desktop, skeleton di dimensione stabile (niente CLS). */
import { nativeItemsContainer } from '../cards';
import { t } from '../i18n';
import { h, icon, uniqueId } from './dom';

export type RailShape = 'poster' | 'wide' | 'collection';

export interface RailHandle {
  root: HTMLElement;
  track: HTMLElement;
  setItems(cards: HTMLElement[]): void;
  setEmpty(content: HTMLElement | null): void;
}

export function createRail(opts: {
  title: string;
  subtitle?: string;
  shape: RailShape;
  seeAllHref?: string;
  className?: string;
  skeletons?: number;
  action?: HTMLElement;
}): RailHandle {
  const titleId = uniqueId('nebula-rail');
  const track = nativeItemsContainer(`nebula-rail__track nebula-rail__track--${opts.shape}`);
  track.setAttribute('role', 'list');
  for (let i = 0; i < (opts.skeletons ?? 6); i++) {
    track.append(
      h(
        'div',
        { class: `nebula-card nebula-card--${opts.shape} nebula-skeleton`, 'aria-hidden': 'true' },
        h('div', { class: 'nebula-card__media' }),
        h('div', { class: 'nebula-card__text' }),
      ),
    );
  }

  const scrollBy = (dir: 1 | -1) =>
    track.scrollBy({ left: dir * track.clientWidth * 0.85, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const prev = h(
    'button',
    { type: 'button', class: 'nebula-icon-btn nebula-rail__nav', 'aria-label': t('scrollLeft'), 'aria-controls': titleId + '-track' },
    icon('chevron_left'),
  );
  const next = h(
    'button',
    { type: 'button', class: 'nebula-icon-btn nebula-rail__nav', 'aria-label': t('scrollRight'), 'aria-controls': titleId + '-track' },
    icon('chevron_right'),
  );
  prev.addEventListener('click', () => scrollBy(-1));
  next.addEventListener('click', () => scrollBy(1));
  track.id = titleId + '-track';

  const updateNav = () => {
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  };
  track.addEventListener('scroll', updateNav, { passive: true });

  const root = h(
    'section',
    { class: `nebula-root nebula-rail ${opts.className ?? ''}`.trim(), 'aria-labelledby': titleId },
    h(
      'header',
      { class: 'nebula-rail__header' },
      h(
        'div',
        { class: 'nebula-rail__heading' },
        h('h2', { id: titleId, class: 'nebula-rail__title' }, opts.title),
        opts.subtitle ? h('p', { class: 'nebula-rail__subtitle' }, opts.subtitle) : null,
      ),
      h(
        'div',
        { class: 'nebula-rail__actions' },
        opts.action ?? null,
        opts.seeAllHref ? h('a', { class: 'nebula-link', href: opts.seeAllHref }, t('seeAll'), icon('arrow_forward')) : null,
        h('div', { class: 'nebula-rail__navs' }, prev, next),
      ),
    ),
    track,
  );

  return {
    root,
    track,
    setItems(cards) {
      track.replaceChildren(...cards.map((c) => (c.setAttribute('role', 'listitem'), c)));
      root.classList.toggle('is-empty', cards.length === 0);
      requestAnimationFrame(updateNav);
    },
    setEmpty(content) {
      track.replaceChildren();
      root.classList.add('is-empty');
      root.querySelector('.nebula-rail__empty')?.remove();
      if (content) root.append(h('div', { class: 'nebula-rail__empty' }, content));
    },
  };
}
