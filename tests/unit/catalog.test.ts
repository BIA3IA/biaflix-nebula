import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCatalog, type CatalogQuery } from '../../src/scripts/ui/catalog';
import { hostCatalog, setCatalogMode, CATALOG_MODE_CLASS } from '../../src/scripts/features/catalog-pages';
import type { BaseItem, ItemsResult } from '../../src/scripts/jellyfin-api';

const item = (n: number): BaseItem => ({ Id: `id${n}`, Name: `T${n}`, Type: 'Movie' });
const page = (start: number, count: number, total: number): ItemsResult => ({
  Items: Array.from({ length: count }, (_, i) => item(start + i)),
  TotalRecordCount: total,
});
const card = (i: BaseItem) => Object.assign(document.createElement('div'), { className: 'nebula-card', textContent: i.Name });

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
  sessionStorage.clear();
});

describe('catalogo Nebula', () => {
  it('ignora risposte superate e aggiunge pagine con «Carica altri»', async () => {
    const calls: { q: CatalogQuery; resolve: (r: ItemsResult) => void }[] = [];
    const load = vi.fn((q: CatalogQuery) => new Promise<ItemsResult>((resolve) => calls.push({ q, resolve })));
    const c = createCatalog({
      title: 'Film',
      subtitle: '',
      emptyIcon: 'movie',
      emptyText: 'vuoto',
      pageSize: 2,
      filters: [
        { value: 'all', label: 'Tutti' },
        { value: 'played', label: 'Visti' },
      ],
      load,
      card,
    });
    document.body.append(c.root);
    // Cambio filtro prima che arrivi la prima risposta: vince la seconda richiesta.
    c.root.querySelector<HTMLButtonElement>('[data-value="played"]')!.click();
    calls[1]!.resolve(page(0, 2, 5));
    calls[0]!.resolve(page(10, 2, 99));
    await c.ready;
    await vi.waitFor(() => expect(c.root.querySelectorAll('.nebula-card')).toHaveLength(2));
    expect(calls[1]!.q).toMatchObject({ filter: 'played', startIndex: 0 });
    expect(c.root.querySelector('.nebula-catalog__count')?.textContent).toBe('5 titoli');
    const more = c.root.querySelector<HTMLButtonElement>('.nebula-catalog__more')!;
    expect(more.hidden).toBe(false);
    more.click();
    expect(calls[2]!.q).toMatchObject({ startIndex: 2, limit: 2 });
    calls[2]!.resolve(page(2, 2, 5));
    await vi.waitFor(() => expect(c.root.querySelectorAll('.nebula-card')).toHaveLength(4));
    expect([...c.root.querySelectorAll('.nebula-card')].map((e) => e.textContent)).toEqual(['T0', 'T1', 'T2', 'T3']);
    c.destroy();
    expect(c.root.isConnected).toBe(false);
  });

  it('ricorda filtro, ordinamento e quantità per la stessa vista', async () => {
    const load = vi.fn(async (q: CatalogQuery) => page(q.startIndex, q.limit, 10));
    const opts = {
      title: 'Film',
      subtitle: '',
      emptyIcon: 'movie',
      emptyText: '',
      pageSize: 3,
      stateKey: 'k',
      load,
      card,
      filters: [
        { value: 'all', label: 'Tutti' },
        { value: 'played', label: 'Visti' },
      ],
      sorts: [
        { value: 'name', label: 'Nome' },
        { value: 'year', label: 'Anno' },
      ],
    };
    const first = createCatalog(opts);
    await first.ready;
    first.root.querySelector<HTMLButtonElement>('[data-value="played"]')!.click();
    const select = first.root.querySelector('select')!;
    select.value = 'year';
    select.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ filter: 'played', sort: 'year' })));
    first.root.querySelector<HTMLButtonElement>('.nebula-catalog__more')!.click();
    await vi.waitFor(() => expect(first.root.querySelectorAll('.nebula-card')).toHaveLength(6));
    first.destroy();

    load.mockClear();
    const second = createCatalog(opts);
    await second.ready;
    expect(load).toHaveBeenCalledWith({ startIndex: 0, limit: 6, filter: 'played', sort: 'year' });
    expect(second.root.querySelector('select')!.value).toBe('year');
    expect(second.root.querySelector('[data-value="played"]')?.getAttribute('aria-pressed')).toBe('true');
    second.destroy();
  });

  it('segnala l’errore senza lanciare e mostra lo stato', async () => {
    const onError = vi.fn();
    const c = createCatalog({ title: 'x', subtitle: '', emptyIcon: 'movie', emptyText: '', load: () => Promise.reject(new Error('503')), card, onError });
    expect(await c.ready).toBe(false);
    expect(onError).toHaveBeenCalled();
    expect(c.root.querySelector<HTMLElement>('.nebula-catalog__status')!.hidden).toBe(false);
  });
});

describe('classi condivise delle pagine catalogo', () => {
  it('uno smontaggio in ritardo non toglie le classi alla nuova istanza', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const older = Object.assign(document.createElement('section'), { className: 'nebula-catalog nebula-library-page' });
    const newer = Object.assign(document.createElement('section'), { className: 'nebula-catalog nebula-library-page' });
    const unhostOld = hostCatalog(host, older);
    setCatalogMode(true);
    const unhostNew = hostCatalog(host, newer);
    setCatalogMode(true);
    // La vecchia istanza termina dopo che la nuova è già montata.
    unhostOld();
    older.remove();
    setCatalogMode(false);
    expect(host.classList.contains('nebula-catalog-active')).toBe(true);
    expect(document.documentElement.classList.contains(CATALOG_MODE_CLASS)).toBe(true);
    unhostNew();
    newer.remove();
    setCatalogMode(false);
    expect(host.classList.contains('nebula-catalog-active')).toBe(false);
    expect(document.documentElement.classList.contains(CATALOG_MODE_CLASS)).toBe(false);
  });
});
