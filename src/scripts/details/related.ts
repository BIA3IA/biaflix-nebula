/**
 * Suggerimenti senza ripetizioni.
 * - «Potrebbe piacerti»: unica sezione dalla libreria (API /Similar), al posto di «Altri simili» nativo.
 *   Deduplicata, niente card senza immagine, 12 titoli visibili e «Mostra altri».
 * - «Scopri e richiedi»: le sezioni Seerr di Jellyfin Enhanced (Recommended / Similar) sono funzioni
 *   diverse (titoli NON in libreria, richiedibili): restano di JE, raccolte in un'unica sezione con schede,
 *   con le card duplicate tra le due schede nascoste.
 */
import { nativeItemsContainer, posterCard } from '../cards';
import type { NebulaContext } from '../context';
import { t } from '../i18n';
import { posterImage } from '../images';
import type { BaseItem } from '../jellyfin-api';
import { decorateNebulaCard } from '../features/card-actions';
import { h, uniqueId } from '../ui/dom';

const VISIBLE = 12;

export async function buildMayLike(ctx: NebulaContext, item: BaseItem, signal: AbortSignal): Promise<HTMLElement | null> {
  const r = await ctx.api.getSimilar(item.SeriesId ?? item.Id, 30);
  if (signal.aborted) return null;
  const seen = new Set<string>([item.Id, item.SeriesId ?? '']);
  const items = r.Items.filter((i) => {
    if (seen.has(i.Id) || !posterImage(i)) return false;
    seen.add(i.Id);
    return true;
  }).slice(0, 24);
  if (!items.length) return null;

  const titleId = uniqueId('nmay');
  const track = nativeItemsContainer('nmay__track');
  track.setAttribute('role', 'list');
  items.forEach((it, i) => {
    const card = posterCard(ctx, it);
    decorateNebulaCard(ctx, card, it);
    card.setAttribute('role', 'listitem');
    if (i >= VISIBLE) card.classList.add('is-extra');
    track.append(card);
  });
  const root = h(
    'section',
    { class: 'nebula-root nebula-maylike', 'aria-labelledby': titleId },
    h(
      'header',
      { class: 'nebula-section__header' },
      h('div', {}, h('h2', { class: 'nebula-section__title', id: titleId }, t('mayLike')), h('p', { class: 'nebula-section__subtitle' }, t('mayLikeSubtitle'))),
    ),
    track,
  );
  if (items.length > VISIBLE) {
    const more = h('button', { type: 'button', class: 'nebula-btn nebula-btn--glass nebula-btn--sm', 'aria-expanded': 'false' }, t('showMore'));
    more.addEventListener('click', () => {
      const open = root.classList.toggle('is-expanded');
      more.setAttribute('aria-expanded', String(open));
      more.textContent = open ? t('showFewer') : t('showMore');
    });
    root.querySelector('.nebula-section__header')!.append(more);
  }
  return root;
}

/** Raggruppa le sezioni Seerr di JE (inserite in modo asincrono) in un unico contenitore a schede. */
export function groupSeerrSections(page: HTMLElement, host: HTMLElement): () => void {
  const titleId = uniqueId('nseerr');
  const tabs = h('div', { class: 'nep__tabs nseerr__tabs', role: 'tablist', 'aria-label': t('seerrTitle') });
  const body = h('div', { class: 'nseerr__body' });
  const group = h(
    'section',
    { class: 'nebula-root nebula-seerr', 'aria-labelledby': titleId, hidden: true },
    h(
      'header',
      { class: 'nebula-section__header' },
      h(
        'div',
        {},
        h('h2', { class: 'nebula-section__title', id: titleId }, t('seerrTitle')),
        h('p', { class: 'nebula-section__subtitle' }, t('seerrSubtitle')),
      ),
      tabs,
    ),
    body,
  );
  host.append(group);
  const moved: { el: HTMLElement; parent: Node; next: Node | null }[] = [];

  const select = (el: HTMLElement) => {
    moved.forEach((m) => (m.el.hidden = m.el !== el));
    tabs.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-selected', String(moved[i]?.el === el)));
  };

  const dedupe = () => {
    const seen = new Set<string>();
    for (const m of moved) {
      m.el.querySelectorAll<HTMLElement>('.card').forEach((card) => {
        const key = card.getAttribute('data-tmdb-id') || card.getAttribute('data-id') || card.querySelector('.cardText-first')?.textContent?.trim() || '';
        if (!key) return;
        card.classList.toggle('nseerr-duplicate', seen.has(key));
        seen.add(key);
      });
    }
  };

  const adopt = () => {
    for (const section of Array.from(page.querySelectorAll<HTMLElement>('.jellyseerr-details-section'))) {
      if (body.contains(section)) continue;
      moved.push({ el: section, parent: section.parentNode!, next: section.nextSibling });
      const label = section.querySelector('.sectionTitle')?.textContent?.trim() || t('seerrTitle');
      const tab = h('button', { type: 'button', role: 'tab', class: 'nep__tab' }, label);
      tab.addEventListener('click', () => select(section));
      tabs.append(tab);
      body.append(section);
    }
    group.hidden = moved.length === 0;
    tabs.hidden = moved.length < 2;
    if (moved.length && !tabs.querySelector('[aria-selected="true"]')) select(moved[0]!.el);
    dedupe();
  };

  // JE aggiunge le sezioni dopo il caricamento: osserviamo solo la pagina dettagli corrente.
  const mo = new MutationObserver(() => adopt());
  mo.observe(page, { childList: true, subtree: true });
  adopt();
  return () => {
    mo.disconnect();
    // Le sezioni JE tornano dove erano (Nebula spenta: nessuna perdita).
    for (const m of moved) {
      m.el.hidden = false;
      m.parent.insertBefore(m.el, m.next && m.next.parentNode === m.parent ? m.next : null);
    }
    group.remove();
  };
}
