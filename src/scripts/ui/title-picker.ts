/**
 * Ricerca multi-selezione di film e serie della libreria (API /Items?searchTerm).
 * Accessibile: lista con checkbox reali, filtro tipo, riepilogo dei selezionati.
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

type TypeFilter = 'all' | 'Movie' | 'Series';

export function createTitlePicker(ctx: NebulaContext, opts: { preselected?: BaseItem[]; exclude?: Set<string> } = {}): TitlePicker {
  const chosen = new Map<string, BaseItem>((opts.preselected ?? []).map((i) => [i.Id, i]));
  const listeners: (() => void)[] = [];
  let filter: TypeFilter = 'all';
  let lastResults: BaseItem[] = [];
  let requestSeq = 0;

  const inputId = uniqueId('nebula-picker-input');
  const input = h('input', { id: inputId, type: 'search', class: 'nebula-input', placeholder: t('searchPlaceholder'), autocomplete: 'off', autofocus: true });
  const status = h('p', { class: 'nebula-picker__status', role: 'status', 'aria-live': 'polite' });
  const results = h('ul', { class: 'nebula-picker__results', 'aria-label': t('results') });
  const summary = h('div', { class: 'nebula-picker__summary' });
  const filters = h('div', { class: 'nebula-segmented', role: 'group', 'aria-label': t('typeFilter') });

  for (const [value, label] of [
    ['all', t('all')],
    ['Movie', t('movies')],
    ['Series', t('series')],
  ] as const) {
    const b = h('button', { type: 'button', class: 'nebula-segmented__btn', 'aria-pressed': String(value === filter) }, label);
    b.addEventListener('click', () => {
      filter = value;
      filters.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      renderResults();
    });
    filters.append(b);
  }

  const emit = () => listeners.forEach((cb) => cb());

  const renderSummary = () => {
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
          renderResults();
          emit();
        });
        return remove;
      }),
    );
  };

  const renderResults = () => {
    const visible = lastResults.filter((i) => (filter === 'all' || i.Type === filter) && !opts.exclude?.has(i.Id));
    results.replaceChildren(
      ...visible.map((item) => {
        const id = uniqueId('nebula-pick');
        const box = h('input', { id, type: 'checkbox', class: 'nebula-check', checked: chosen.has(item.Id) });
        box.addEventListener('change', () => {
          if (box.checked) chosen.set(item.Id, item);
          else chosen.delete(item.Id);
          renderSummary();
          emit();
        });
        const ref = posterImage(item);
        const thumb = ref
          ? h('img', { class: 'nebula-picker__thumb', alt: '', loading: 'lazy', ...srcset(ctx.api, ref, 48) })
          : h('span', { class: 'nebula-picker__thumb nebula-picker__thumb--empty' }, icon('movie'));
        return h(
          'li',
          { class: 'nebula-picker__row' },
          h(
            'label',
            { for: id, class: 'nebula-picker__label' },
            box,
            thumb,
            h('span', { class: 'nebula-picker__name' }, item.Name),
            h('span', { class: 'nebula-picker__meta' }, [item.ProductionYear, item.Type === 'Series' ? t('series') : t('movies')].filter(Boolean).join(' · ')),
          ),
        );
      }),
    );
    if (input.value.trim().length >= 2 && status.textContent !== t('loading')) status.textContent = visible.length ? '' : t('noResults');
  };

  const search = debounce(async () => {
    const term = input.value.trim();
    const seq = ++requestSeq;
    if (term.length < 2) {
      lastResults = [];
      status.textContent = '';
      renderResults();
      return;
    }
    status.textContent = t('loading');
    try {
      const r = await ctx.api.searchTitles(term);
      if (seq !== requestSeq) return;
      lastResults = r.Items;
      status.textContent = '';
      renderResults();
    } catch (err) {
      if (seq !== requestSeq) return;
      status.textContent = t('errorGeneric');
      ctx.log('ricerca titoli', err);
    }
  }, 250);
  input.addEventListener('input', search);

  renderSummary();
  const root = h(
    'div',
    { class: 'nebula-picker' },
    h('label', { for: inputId, class: 'nebula-label' }, t('searchTitles')),
    h('div', { class: 'nebula-picker__bar' }, h('div', { class: 'nebula-input-wrap' }, icon('search'), input), filters),
    status,
    results,
    summary,
  );

  return {
    root,
    selected: () => [...chosen.values()],
    onChange: (cb) => listeners.push(cb),
  };
}
