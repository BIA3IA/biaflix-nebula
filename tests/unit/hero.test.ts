import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NebulaContext } from '../../src/scripts/context';
import { heroFeature, pickHeroItems } from '../../src/scripts/features/hero';
import { DEFAULT_FLAGS } from '../../src/scripts/flags';
import { item } from './helpers';

const featured = [
  item({ Id: 'a', Name: 'Primo titolo', Type: 'Movie', BackdropImageTags: ['backdrop'], UserData: { Likes: false } }),
  item({ Id: 'b', Name: 'Secondo titolo', Type: 'Series', BackdropImageTags: ['backdrop'], UserData: { Likes: false } }),
];

function context(): NebulaContext {
  return {
    flags: { ...DEFAULT_FLAGS },
    serverId: 'srv',
    api: {
      getCollections: vi.fn(async () => ({ Items: [item({ Id: 'featured', Name: '  IN EVIDENZA  ', Type: 'BoxSet' })] })),
      getChildren: vi.fn(async () => ({ Items: featured })),
      getItems: vi.fn(),
      imageUrl: () => 'https://example.test/backdrop.jpg',
    },
  } as unknown as NebulaContext;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('hero della home', () => {
  it('usa la raccolta curata, anche con nome in maiuscolo e spazi, senza ricorrere agli ultimi aggiunti', async () => {
    const ctx = context();
    expect(await pickHeroItems(ctx)).toEqual({ items: featured, curated: true });
    expect(ctx.api.getItems).not.toHaveBeenCalled();
  });

  it('ripristina la stessa hero e la slide selezionata quando Jellyfin ricostruisce il tab', async () => {
    document.body.innerHTML = '<div class="page" id="indexPage"><div id="homeTab"><div class="sections"></div></div></div>';
    const page = document.getElementById('indexPage')!;
    const controller = new AbortController();
    const cleanup = await heroFeature(context()).mount({ path: 'home', params: new URLSearchParams(), page, signal: controller.signal });
    const hero = page.querySelector<HTMLElement>('.nebula-hero')!;
    hero.querySelectorAll<HTMLButtonElement>('.nebula-hero__dot')[1]!.click();
    page.querySelector('#homeTab')!.replaceWith(Object.assign(document.createElement('div'), { id: 'homeTab' }));
    await vi.waitFor(() => expect(page.querySelector('#homeTab > :first-child')).toBe(hero));
    expect(hero.querySelector('.is-active')?.getAttribute('data-index')).toBe('1');
    expect(page.querySelectorAll('.nebula-hero')).toHaveLength(1);
    controller.abort();
    if (typeof cleanup === 'function') cleanup();
    page.querySelector('#homeTab')!.append(document.createElement('div'));
    await Promise.resolve();
    expect(page.querySelector('.nebula-hero')).toBeNull();
    expect(page.classList.contains('nebula-has-hero')).toBe(false);
  });
});
