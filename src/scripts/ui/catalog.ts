/**
 * Pagina catalogo Nebula: un'unica impaginazione per Film, Serie TV, Preferiti e Watchlist.
 * Intestazione (titolo, sottotitolo, contatore, azioni) → barra filtri/ordinamento → griglia → «Carica altri».
 *
 * - I dati arrivano da `load` (API Jellyfin); le card restano native-actionable.
 * - Risposte fuori ordine vengono ignorate (contatore di richiesta), nulla viene scritto dopo `destroy`.
 * - Filtro, ordinamento, quantità caricata e scroll sono ricordati per scheda (sessionStorage), così
 *   tornando indietro da un dettaglio si ritrova la stessa posizione.
 */
import { countLabel, t } from '../i18n';
import type { BaseItem, ItemsResult } from '../jellyfin-api';
import { h, icon, uniqueId } from './dom';
import { nativeItemsContainer } from '../cards';

export interface CatalogOption {
  value: string;
  label: string;
}

export interface CatalogQuery {
  startIndex: number;
  limit: number;
  filter: string;
  sort: string;
}

export interface CatalogOptions {
  /** Classi aggiuntive sulla radice (es. «nebula-watchlist-page»). */
  className?: string;
  title: string;
  subtitle: string;
  emptyIcon: string;
  emptyText: string;
  filters?: readonly CatalogOption[];
  sorts?: readonly CatalogOption[];
  defaultFilter?: string;
  defaultSort?: string;
  actions?: readonly HTMLElement[];
  pageSize?: number;
  /** Chiave sessionStorage per ricordare lo stato della vista. */
  stateKey?: string;
  load(query: CatalogQuery): Promise<ItemsResult>;
  card(item: BaseItem): HTMLElement;
  onError?(err: unknown): void;
}

export interface CatalogHandle {
  root: HTMLElement;
  /** Ricarica tutto mantenendo la quantità già mostrata. */
  refresh(): void;
  /** Risolta al termine del primo caricamento (true se riuscito). */
  ready: Promise<boolean>;
  destroy(): void;
}

interface SavedState {
  filter?: string;
  sort?: string;
  count?: number;
  scroll?: number;
}

function readState(key: string | undefined): SavedState {
  if (!key) return {};
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? '{}') as SavedState;
  } catch {
    return {};
  }
}

function writeState(key: string | undefined, state: SavedState): void {
  if (!key) return;
  try {
    sessionStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* storage non disponibile: nessuna memoria della posizione */
  }
}

/** Elemento che scorre davvero (Jellyfin a volte fa scorrere la .page invece del documento). */
function scrollHost(el: HTMLElement): HTMLElement {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

export function createCatalog(opts: CatalogOptions): CatalogHandle {
  const pageSize = opts.pageSize ?? 60;
  const saved = readState(opts.stateKey);
  const has = (list: readonly CatalogOption[] | undefined, v: string | undefined) => !!v && !!list?.some((o) => o.value === v);
  let filter = has(opts.filters, saved.filter) ? saved.filter! : (opts.defaultFilter ?? opts.filters?.[0]?.value ?? 'all');
  let sort = has(opts.sorts, saved.sort) ? saved.sort! : (opts.defaultSort ?? opts.sorts?.[0]?.value ?? '');
  let shown = 0;
  let total = 0;
  let request = 0;
  let disposed = false;
  let pendingScroll = saved.scroll ?? 0;
  let wanted = Math.max(pageSize, saved.count ?? 0);

  const titleId = uniqueId('nebula-catalog-title');
  const count = h('span', { class: 'nebula-chip nebula-catalog__count', hidden: true });
  const statusText = h('p', {}, t('loading'));
  const status = h('div', { class: 'nebula-catalog__status', role: 'status' }, icon(opts.emptyIcon), statusText);
  const grid = nativeItemsContainer('nebula-catalog__grid');
  const more = h('button', { type: 'button', class: 'nebula-btn nebula-btn--glass nebula-catalog__more', hidden: true }, t('loadMore'));

  const toolbar = h('div', { class: 'nebula-catalog__toolbar' });
  if (opts.filters && opts.filters.length > 1) {
    const group = h('div', { class: 'nebula-segmented nebula-catalog__filters', role: 'group', 'aria-label': t('filterLabel') });
    for (const o of opts.filters) {
      const b = h('button', { type: 'button', class: 'nebula-segmented__btn', 'data-value': o.value, 'aria-pressed': String(o.value === filter) }, o.label);
      b.addEventListener('click', () => {
        if (filter === o.value) return;
        filter = o.value;
        group.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        wanted = pageSize;
        void render(true);
      });
      group.append(b);
    }
    toolbar.append(group);
  }
  if (opts.sorts && opts.sorts.length > 1) {
    const selectId = uniqueId('nebula-catalog-sort');
    const select = h(
      'select',
      { id: selectId, class: 'nebula-input nebula-catalog__select' },
      opts.sorts.map((o) => h('option', { value: o.value, selected: o.value === sort }, o.label)),
    );
    select.value = sort;
    select.addEventListener('change', () => {
      if (select.value === sort) return;
      sort = select.value;
      wanted = pageSize;
      void render(true);
    });
    toolbar.append(h('label', { class: 'nebula-catalog__sort', for: selectId }, h('span', { class: 'nebula-visually-hidden' }, t('sortLabel')), select));
  }

  const root = h(
    'section',
    { class: `nebula-root nebula-catalog ${opts.className ?? ''}`.trim(), 'aria-labelledby': titleId },
    h(
      'header',
      { class: 'nebula-catalog__header' },
      h(
        'div',
        { class: 'nebula-catalog__heading' },
        h('div', { class: 'nebula-catalog__titlerow' }, h('h1', { id: titleId, class: 'nebula-catalog__title' }, opts.title), count),
        h('p', { class: 'nebula-catalog__subtitle' }, opts.subtitle),
      ),
      opts.actions?.length ? h('div', { class: 'nebula-catalog__actions' }, ...opts.actions) : null,
    ),
    toolbar.childElementCount ? toolbar : null,
    status,
    grid,
    more,
  );

  const persist = () => writeState(opts.stateKey, { filter, sort, count: shown, scroll: pendingScroll });

  const render = async (reset: boolean): Promise<boolean> => {
    const id = ++request;
    const startIndex = reset ? 0 : shown;
    const limit = reset ? wanted : pageSize;
    more.disabled = true;
    root.setAttribute('aria-busy', 'true');
    try {
      const result = await opts.load({ startIndex, limit, filter, sort });
      if (disposed || id !== request) return false;
      const cards = result.Items.map((item) => opts.card(item));
      if (reset) grid.replaceChildren(...cards);
      else grid.append(...cards);
      shown = grid.childElementCount;
      total = result.TotalRecordCount;
      status.hidden = shown > 0;
      statusText.textContent = opts.emptyText;
      count.textContent = countLabel(total);
      count.hidden = false;
      more.hidden = shown >= total;
      persist();
      if (reset && pendingScroll) {
        const target = pendingScroll;
        pendingScroll = 0;
        requestAnimationFrame(() => {
          if (!disposed) scrollHost(root).scrollTop = target;
        });
      }
      return true;
    } catch (err) {
      if (disposed || id !== request) return false;
      opts.onError?.(err);
      if (reset) {
        grid.replaceChildren();
        shown = 0;
        count.hidden = more.hidden = true;
      }
      status.hidden = false;
      statusText.textContent = t('errorGeneric');
      return false;
    } finally {
      if (!disposed && id === request) {
        more.disabled = false;
        root.setAttribute('aria-busy', 'false');
      }
    }
  };

  more.addEventListener('click', () => void render(false));

  const ready = render(true);
  return {
    root,
    ready,
    refresh() {
      wanted = Math.max(pageSize, shown);
      void render(true);
    },
    destroy() {
      if (disposed) return;
      if (root.isConnected) pendingScroll = scrollHost(root).scrollTop;
      persist();
      disposed = true;
      root.remove();
    },
  };
}
