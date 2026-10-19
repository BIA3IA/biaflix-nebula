/**
 * Scelta multipla di titoli della libreria per raccolte e playlist.
 * Si apre già con la libreria (ultimi aggiunti) in una griglia di locandine: si sfoglia o si cerca
 * (dal primo carattere) e si tocca la locandina per includerla. Filtro per tipo, «Carica altri»,
 * riepilogo dei selezionati con rimozione rapida. Ogni locandina è una checkbox reale (tastiera,
 * screen reader), resa invisibile sopra l'immagine.
 */
import type { NebulaContext } from '../context';
import { t } from '../i18n';
import { posterImage, srcset } from '../images';
import type { BaseItem } from '../jellyfin-api';
import { debounce, h, icon, uniqueId } from './dom';

export interface TitlePicker {
  root: HTMLElement;
  selected(): BaseItem[];
  onChange(cb: () => void): void;
}

export interface TitlePickerOptions {
  preselected?: BaseItem[];
  exclude?: Set<string>;
  /** Le playlist possono contenere anche singoli episodi. */
  includeEpisodes?: boolean;
}

const PAGE = 40;

function typeLabel(item: BaseItem): string {
  if (item.Type === 'Series') return t('series');
  if (item.Type === 'Episode') return item.SeriesName ?? t('episodes');
  return t('movies');
}

export function createTitlePicker(ctx: NebulaContext, opts: TitlePickerOptions = {}): TitlePicker {
  const chosen = new Map<string, BaseItem>((opts.preselected ?? []).map((i) => [i.Id, i]));
  const listeners: (() => void)[] = [];
  let filter = 'all';
  let loaded = 0;
  let total = 0;
  let requestSeq = 0;

  const inputId = uniqueId('nebula-picker-input');
  const input = h('input', { id: inputId, type: 'search', class: 'nebula-input', placeholder: t('pickerSearch'), autocomplete: 'off', autofocus: true });
  const status = h('p', { class: 'nebula-picker__status', role: 'status', 'aria-live': 'polite' });
  const results = h('ul', { class: 'nebula-picker__results', 'aria-label': t('results') });
  const more = h('button', { type: 'button', class: 'nebula-btn nebula-btn--glass nebula-btn--sm nebula-picker__more', hidden: true }, t('loadMore'));
  const summary = h('div', { class: 'nebula-picker__summary' });
  const filters = h('div', { class: 'nebula-segmented', role: 'group', 'aria-label': t('typeFilter') });

  const options: [string, string][] = [
    ['all', t('all')],
    ['Movie', t('movies')],
    ['Series', t('series')],
  ];
  if (opts.includeEpisodes) options.push(['Episode', t('episodes')]);
  for (const [value, label] of options) {
    const b = h('button', { type: 'button', class: 'nebula-segmented__btn', 'aria-pressed': String(value === filter) }, label);
    b.addEventListener('click', () => {
      if (filter === value) return;
      filter = value;
      filters.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      void load(true);
    });
    filters.append(b);
  }

  const emit = () => listeners.forEach((cb) => cb());

  const syncTiles = () => {
    results.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-id]').forEach((box) => {
      box.checked = chosen.has(box.dataset.id!);
      box.closest('.nebula-picker__row')?.classList.toggle('is-selected', box.checked);
    });
  };

  const renderSummary = () => {
    const clear = h('button', { type: 'button', class: 'nebula-link-btn' }, t('clearSelection'));
    clear.hidden = chosen.size === 0;
    clear.addEventListener('click', () => {
      chosen.clear();
      renderSummary();
      syncTiles();
      emit();
    });
    summary.replaceChildren(
      h('span', { class: 'nebula-picker__count' }, t('selected', { n: chosen.size })),
      ...[...chosen.values()].map((item) => {
        const remove = h(
          'button',
          { type: 'button', class: 'nebula-chip nebula-chip--removable', 'aria-label': `${t('remove')} ${item.Name}` },
          item.Name,
          icon('close'),
        );
        remove.addEventListener('click', () => {
          chosen.delete(item.Id);
          renderSummary();
          syncTiles();
          emit();
        });
        return remove;
      }),
      clear,
    );
  };

  const tile = (item: BaseItem): HTMLElement => {
    const id = uniqueId('nebula-pick');
    const box = h('input', { id, type: 'checkbox', class: 'nebula-picker__check', 'data-id': item.Id, checked: chosen.has(item.Id) });
    box.addEventListener('change', () => {
      if (box.checked) chosen.set(item.Id, item);
      else chosen.delete(item.Id);
      box.closest('.nebula-picker__row')?.classList.toggle('is-selected', box.checked);
      renderSummary();
      emit();
    });
    const ref = posterImage(item);
    const thumb = ref
      ? h('img', { class: 'nebula-picker__thumb', alt: '', loading: 'lazy', decoding: 'async', sizes: '120px', ...srcset(ctx.api, ref, 120) })
      : h('span', { class: 'nebula-picker__thumb nebula-picker__thumb--empty' }, icon(item.Type === 'Series' ? 'live_tv' : 'movie'));
    const meta = [item.ProductionYear, typeLabel(item)].filter(Boolean).join(' · ');
    return h(
      'li',
      { class: `nebula-picker__row${box.checked ? ' is-selected' : ''}` },
      h(
        'label',
        { for: id, class: 'nebula-picker__label' },
        box,
        h('span', { class: 'nebula-picker__poster' }, thumb, h('span', { class: 'nebula-picker__tick', 'aria-hidden': 'true' }, icon('check'))),
        h('span', { class: 'nebula-picker__name', title: item.Name }, item.Name),
        h('span', { class: 'nebula-picker__meta' }, meta),
      ),
    );
  };

  const load = async (reset: boolean): Promise<void> => {
    const seq = ++requestSeq;
    const term = input.value.trim();
    if (reset) {
      loaded = 0;
      status.textContent = t('loading');
    }
    more.disabled = true;
    try {
      const r = await ctx.api.getItems({
        recursive: true,
        // «Tutti» = film e serie: gli episodi (centinaia) solo nella loro scheda.
        includeItemTypes: filter === 'all' ? ['Movie', 'Series'] : [filter],
        searchTerm: term || undefined,
        sortBy: term ? 'SortName' : 'DateCreated,SortName',
        sortOrder: term ? 'Ascending' : 'Descending',
        startIndex: loaded,
        limit: PAGE,
        enableImageTypes: ['Primary'],
        imageTypeLimit: 1,
      });
      if (seq !== requestSeq) return;
      const visible = r.Items.filter((i) => !opts.exclude?.has(i.Id));
      if (reset) results.replaceChildren(...visible.map(tile));
      else results.append(...visible.map(tile));
      loaded += r.Items.length;
      total = r.TotalRecordCount;
      status.textContent = results.childElementCount ? '' : t('noResults');
      more.hidden = loaded >= total;
    } catch (err) {
      if (seq !== requestSeq) return;
      status.textContent = t('errorGeneric');
      ctx.log('ricerca titoli', err);
    } finally {
      if (seq === requestSeq) more.disabled = false;
    }
  };

  input.addEventListener(
    'input',
    debounce(() => void load(true), 250),
  );
  more.addEventListener('click', () => void load(false));

  renderSummary();
  void load(true);
  const root = h(
    'div',
    { class: 'nebula-picker' },
    h('label', { for: inputId, class: 'nebula-label' }, t('searchTitles')),
    h('p', { class: 'nebula-field__hint' }, t('pickerHint')),
    h('div', { class: 'nebula-picker__bar' }, h('div', { class: 'nebula-input-wrap' }, icon('search'), input), filters),
    summary,
    status,
    results,
    more,
  );

  return {
    root,
    selected: () => [...chosen.values()],
    onChange: (cb) => listeners.push(cb),
  };
}
