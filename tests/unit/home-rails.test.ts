import { describe, expect, it } from 'vitest';
import type { NebulaContext } from '../../src/scripts/context';
import { homeRailsFeature } from '../../src/scripts/features/home-rails';
import { DEFAULT_FLAGS } from '../../src/scripts/flags';
import { makeApi } from './helpers';

function fakeCtx(): NebulaContext {
  const { api } = makeApi([() => ({ Items: [], TotalRecordCount: 0 })]);
  return {
    api,
    flags: { ...DEFAULT_FLAGS },
    user: { Id: 'u1', Name: 'u', Policy: { IsAdministrator: false, EnableCollectionManagement: true } },
    serverId: 'srv',
    collections: { list: async () => [] } as unknown as NebulaContext['collections'],
    playlists: {} as NebulaContext['playlists'],
    watchlist: { list: async () => ({ Items: [], TotalRecordCount: 0 }) } as unknown as NebulaContext['watchlist'],
    log: () => undefined,
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('home rails', () => {
  it('sopravvivono al ridisegno nativo del contenitore sezioni (innerHTML)', async () => {
    document.body.innerHTML = '<div class="page" id="indexPage"><div id="homeTab"><div class="sections homeSectionsContainer"></div></div></div>';
    const page = document.getElementById('indexPage')!;
    const controller = new AbortController();
    const cleanup = await homeRailsFeature(fakeCtx()).mount({ path: 'home', params: new URLSearchParams(), page, signal: controller.signal });
    const container = page.querySelector('.homeSectionsContainer')!;
    expect(container.querySelectorAll('.nebula-rail')).toHaveLength(2);

    // homesections.js ricostruisce le sezioni con innerHTML dopo il nostro inserimento.
    container.innerHTML = '<div class="verticalSection section0"></div>';
    await tick();
    expect(container.querySelectorAll('.nebula-rail')).toHaveLength(2);

    // Anche se il contenitore viene sostituito del tutto.
    const fresh = document.createElement('div');
    fresh.className = 'sections homeSectionsContainer';
    container.replaceWith(fresh);
    await tick();
    expect(fresh.querySelectorAll('.nebula-rail')).toHaveLength(2);

    controller.abort();
    if (typeof cleanup === 'function') cleanup();
    expect(page.querySelectorAll('.nebula-rail')).toHaveLength(0);
  });
});
