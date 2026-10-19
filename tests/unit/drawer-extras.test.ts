import { afterEach, expect, it, vi } from 'vitest';
import { installDrawerExtras } from '../../src/scripts/features/drawer-extras';

const DRAWER = `<div class="MuiDrawer-root"><div class="MuiBackdrop-root"></div><div class="MuiDrawer-paper"><ul>
  <li class="MuiListItem-root"><a class="MuiListItemButton-root Mui-selected" href="#/home"><div class="MuiListItemIcon-root"><svg></svg></div><div><span class="MuiListItemText-primary">Home</span></div></a></li>
  <li class="MuiListItem-root"><a class="MuiListItemButton-root" href="#/home?tab=1"><div class="MuiListItemIcon-root"><svg></svg></div><div><span class="MuiListItemText-primary">Preferiti</span></div></a></li>
  <li class="MuiListItem-root"><a href="#">KefinTweaks</a></li>
</ul></div></div>`;

let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  stop = undefined;
  document.body.innerHTML = '';
  window.location.hash = '';
});

it('aggiunge «Watchlist» dopo «Preferiti» quando il drawer si apre, una sola volta', async () => {
  stop = installDrawerExtras();
  document.body.insertAdjacentHTML('beforeend', DRAWER);
  await vi.waitFor(() => expect(document.querySelector('.nebula-drawer-watchlist')).not.toBeNull());
  const items = [...document.querySelectorAll('.MuiDrawer-paper ul > li')];
  expect(items[2]!.classList.contains('nebula-drawer-watchlist')).toBe(true);
  const link = items[2]!.querySelector('a')!;
  expect(link.getAttribute('href')).toBe('#/home?nebula=watchlist');
  expect(link.textContent).toContain('Watchlist');
  expect(link.classList.contains('Mui-selected')).toBe(false);
  // React ricostruisce la lista: la voce torna una sola volta.
  const list = document.querySelector('.MuiDrawer-paper ul')!;
  list.append(document.createElement('li'));
  await Promise.resolve();
  expect(document.querySelectorAll('.nebula-drawer-watchlist')).toHaveLength(1);
});

it('evidenzia la voce sulla route watchlist e la rimuove allo stop', async () => {
  window.location.hash = '#/home?nebula=watchlist';
  document.body.insertAdjacentHTML('beforeend', DRAWER);
  stop = installDrawerExtras();
  const link = document.querySelector('.nebula-drawer-watchlist a')!;
  expect(link.classList.contains('Mui-selected')).toBe(true);
  expect(link.getAttribute('aria-current')).toBe('page');
  stop();
  stop = undefined;
  expect(document.querySelector('.nebula-drawer-watchlist')).toBeNull();
});
