/**
 * «Cast e troupe»: ritratti circolari 1:1 (object-fit: cover), nome e ruolo sotto la foto.
 * Scorrimento orizzontale contenuto nel proprio riquadro (mai il documento), placeholder piccoli con
 * iniziali per chi non ha foto, «Mostra tutto» per l'elenco completo in griglia.
 */
import type { NebulaContext } from '../context';
import { detailsPath } from '../env';
import { t } from '../i18n';
import type { BaseItem, PersonInfo } from '../jellyfin-api';
import { h, uniqueId } from '../ui/dom';

const INITIAL = 12;

function roleOf(p: PersonInfo): string {
  if (p.Type === 'Director') return t('director');
  if (p.Type === 'Writer') return t('writer');
  return p.Role ?? '';
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

function personCard(ctx: NebulaContext, p: PersonInfo): HTMLElement {
  const photo = p.PrimaryImageTag
    ? h('img', {
        class: 'ncast__img',
        alt: '',
        loading: 'lazy',
        decoding: 'async',
        src: ctx.api.imageUrl(p.Id, 'Primary', { tag: p.PrimaryImageTag, width: 220 }),
      })
    : h('span', { class: 'ncast__img ncast__img--empty', 'aria-hidden': 'true' }, initials(p.Name));
  const role = roleOf(p);
  return h(
    'li',
    { class: 'ncast' },
    h(
      'a',
      { class: 'ncast__link', href: `#/${detailsPath(p.Id, ctx.serverId)}` },
      h('span', { class: 'ncast__frame' }, photo),
      h('span', { class: 'ncast__name' }, p.Name),
      role ? h('span', { class: 'ncast__role' }, role) : null,
    ),
  );
}

export function buildCast(ctx: NebulaContext, item: BaseItem): HTMLElement | null {
  // Attori e ospiti prima, poi regia e sceneggiatura; niente duplicati della stessa persona/ruolo.
  const order = (p: PersonInfo) => (p.Type === 'Actor' || p.Type === 'GuestStar' ? 0 : p.Type === 'Director' ? 1 : p.Type === 'Writer' ? 2 : 3);
  const seen = new Set<string>();
  const people = (item.People ?? [])
    .filter((p) => ['Actor', 'GuestStar', 'Director', 'Writer'].includes(p.Type ?? ''))
    .filter((p) => {
      const key = `${p.Id}:${p.Type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => order(a) - order(b));
  if (!people.length) return null;

  const titleId = uniqueId('ncast-title');
  const list = h(
    'ul',
    { class: 'ncast__list', 'aria-labelledby': titleId },
    people.map((p, i) => {
      const card = personCard(ctx, p);
      if (i >= INITIAL) card.classList.add('is-extra');
      return card;
    }),
  );
  const root = h(
    'section',
    { class: 'nebula-root nebula-cast', 'aria-labelledby': titleId },
    h('header', { class: 'nebula-section__header' }, h('h2', { class: 'nebula-section__title', id: titleId }, t('castAndCrew'))),
    list,
  );
  if (people.length > INITIAL) {
    const toggle = h(
      'button',
      { type: 'button', class: 'nebula-btn nebula-btn--glass nebula-btn--sm', 'aria-expanded': 'false' },
      t('showAll', { n: people.length }),
    );
    toggle.addEventListener('click', () => {
      const open = root.classList.toggle('is-expanded');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? t('showFewer') : t('showAll', { n: people.length });
    });
    root.querySelector('.nebula-section__header')!.append(toggle);
  }
  return root;
}
