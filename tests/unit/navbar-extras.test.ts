import { afterEach, expect, it } from 'vitest';
import type { NebulaContext } from '../../src/scripts/context';
import { installNavbarExtras } from '../../src/scripts/features/navbar-extras';

afterEach(() => {
  document.body.innerHTML = '';
});

it('non reinserisce logo e watchlist se la skin viene disattivata con un frame già in coda', async () => {
  document.body.innerHTML =
    '<header class="MuiAppBar-root"><div class="MuiToolbar-root"><button class="MuiIconButton-root"></button><div class="MuiStack-root"><a href="#/home?tab=1">Preferiti</a></div><div><a href="#/search"></a></div><div></div></div></header>';
  const cleanup = installNavbarExtras({} as NebulaContext);
  expect(document.querySelectorAll('.nebula-nav-home')).toHaveLength(1);
  expect(document.querySelector('a[href="#/home?tab=1"]')?.nextElementSibling?.matches('.nebula-nav-watchlist')).toBe(true);
  document.dispatchEvent(new Event('viewshow'));
  cleanup();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  expect(document.querySelectorAll('.nebula-nav-home, .nebula-nav-watchlist')).toHaveLength(0);
});
