/**
 * Informazioni secondarie (regia, sceneggiatura, studio, classificazione, stato) e interruttore
 * «Dettagli tecnici, tracce e tag» che mostra/nasconde il contenuto nativo di Jellyfin (Media Info,
 * scelta versione/audio/sottotitoli, tag, link esterni). Nessun metadato viene rimosso: cambia solo
 * la presentazione.
 */
import type { NebulaContext } from '../context';
import { t } from '../i18n';
import type { BaseItem } from '../jellyfin-api';
import { h, icon, uniqueId } from '../ui/dom';

function row(label: string, value: string | null | undefined): HTMLElement | null {
  if (!value) return null;
  return h('div', { class: 'ninfo__row' }, h('dt', {}, label), h('dd', {}, value));
}

export function buildInfo(_ctx: NebulaContext, item: BaseItem, page: HTMLElement, opts: { collapsible: boolean }): HTMLElement {
  const people = item.People ?? [];
  const names = (type: string) =>
    people
      .filter((p) => p.Type === type)
      .slice(0, 3)
      .map((p) => p.Name)
      .join(', ');
  const status = item.Type === 'Series' ? (item.Status === 'Continuing' ? t('statusContinuing') : item.Status === 'Ended' ? t('statusEnded') : null) : null;
  const rows = [
    row(t('director'), names('Director')),
    row(t('writer'), names('Writer')),
    row(
      t('studioLabel'),
      (item.Studios ?? [])
        .map((s) => s.Name)
        .slice(0, 2)
        .join(', '),
    ),
    row(t('ageRating'), item.OfficialRating),
    row(t('statusLabel'), status),
  ].filter((r): r is HTMLElement => r !== null);

  const titleId = uniqueId('ninfo');
  const root = h(
    'section',
    { class: 'nebula-root nebula-info', 'aria-labelledby': titleId },
    h('h2', { class: 'nebula-section__title', id: titleId }, t('information')),
  );
  if (rows.length) root.append(h('dl', { class: 'ninfo__grid' }, rows));

  if (opts.collapsible) {
    const panelId = 'nebula-tech-panel';
    const toggle = h(
      'button',
      { type: 'button', class: 'ninfo__toggle', 'aria-expanded': 'false', 'aria-controls': panelId },
      icon('tune'),
      h('span', {}, t('techDetails')),
      icon('expand_more', 'ninfo__chevron'),
    );
    // Il contenuto nativo resta dov'è: l'id serve solo a collegarlo al pulsante per le tecnologie assistive.
    page.querySelector('.detailPagePrimaryContent')?.setAttribute('id', panelId);
    toggle.addEventListener('click', () => {
      const open = page.getAttribute('data-nebula-tech') !== 'open';
      if (open) page.setAttribute('data-nebula-tech', 'open');
      else page.removeAttribute('data-nebula-tech');
      toggle.setAttribute('aria-expanded', String(open));
    });
    root.append(toggle);
  }
  return root;
}
