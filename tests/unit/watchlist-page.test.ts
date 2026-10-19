import { afterEach, expect, it, vi } from 'vitest';
import type { NebulaContext } from '../../src/scripts/context';
import { watchlistPageFeature } from '../../src/scripts/features/watchlist-page';
import type { ItemsResult } from '../../src/scripts/jellyfin-api';
import { WATCHLIST_CHANGED } from '../../src/scripts/watchlist';

let cleanup: void | (() => void);
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = '';
});

function mount(list: (limit?: number) => Promise<ItemsResult>) {
  document.body.innerHTML = '<div class="page" id="indexPage"><div id="homeTab"></div></div>';
  const page = document.getElementById('indexPage')!;
  const controller = new AbortController();
  const ctx = { watchlist: { list }, log: vi.fn() } as unknown as NebulaContext;
  const result = watchlistPageFeature(ctx).mount({ path: 'home', params: new URLSearchParams('nebula=watchlist'), page, signal: controller.signal });
  if (typeof result === 'function') cleanup = result;
  return { page, controller };
}

it('ignora risposte precedenti e non ricrea la pagina dopo lo smontaggio', async () => {
  const pending: ((result: ItemsResult) => void)[] = [];
  const list = vi.fn(() => new Promise<ItemsResult>((resolve) => pending.push(resolve)));
  const { page, controller } = mount(list);
  document.dispatchEvent(new Event(WATCHLIST_CHANGED));
  pending[1]!({ Items: [], TotalRecordCount: 0 });
  await vi.waitFor(() => expect(page.querySelector('.nebula-chip')?.textContent).toBe('0 titoli'));
  pending[0]!({ Items: [], TotalRecordCount: 100 });
  await Promise.resolve();
  expect(page.querySelector('.nebula-chip')?.textContent).toBe('0 titoli');
  document.dispatchEvent(new Event(WATCHLIST_CHANGED));
  controller.abort();
  cleanup?.();
  cleanup = undefined;
  pending[2]!({ Items: [], TotalRecordCount: 99 });
  document.dispatchEvent(new Event(WATCHLIST_CHANGED));
  await Promise.resolve();
  expect(list).toHaveBeenCalledTimes(3);
  expect(page.classList.contains('nebula-watchlist-active')).toBe(false);
  expect(page.querySelector('.nebula-watchlist-page')).toBeNull();
});

it('conserva la pagina se il renderer nativo ricostruisce i figli della home', async () => {
  const { page } = mount(async () => ({ Items: [], TotalRecordCount: 0 }));
  const root = page.querySelector('.nebula-watchlist-page');
  page.replaceChildren(document.createElement('div'));
  await vi.waitFor(() => expect(page.firstElementChild).toBe(root));
  expect(page.querySelectorAll('.nebula-watchlist-page')).toHaveLength(1);
});

it('non monta sulla pagina dettagli durante la transizione di ritorno alla home', () => {
  const list = vi.fn();
  const page = document.createElement('div');
  page.id = 'itemDetailPage';
  const result = watchlistPageFeature({ watchlist: { list } } as unknown as NebulaContext).mount({
    path: 'home',
    params: new URLSearchParams('nebula=watchlist'),
    page,
    signal: new AbortController().signal,
  });
  expect(result).toBeUndefined();
  expect(list).not.toHaveBeenCalled();
  expect(page.children).toHaveLength(0);
});

it('usa la home reale anche quando viewshow indica ancora la pagina dettagli', () => {
  document.body.innerHTML = '<div id="indexPage"></div><div id="itemDetailPage"></div>';
  const list = vi.fn(async () => ({ Items: [], TotalRecordCount: 0 }));
  const result = watchlistPageFeature({ watchlist: { list }, log: vi.fn() } as unknown as NebulaContext).mount({
    path: 'home',
    params: new URLSearchParams('nebula=watchlist'),
    page: document.getElementById('itemDetailPage'),
    signal: new AbortController().signal,
  });
  if (typeof result === 'function') cleanup = result;
  expect(document.querySelector('#indexPage > .nebula-watchlist-page')).not.toBeNull();
  expect(document.querySelector('#itemDetailPage > .nebula-watchlist-page')).toBeNull();
});
