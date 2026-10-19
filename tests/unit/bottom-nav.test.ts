import { describe, expect, it } from 'vitest';
import { buildEntries, libraryHref } from '../../src/scripts/features/bottom-nav';

describe('barra in basso', () => {
  it('usa le route reali di Jellyfin 12 per le librerie', () => {
    expect(libraryHref({ Id: 'abc', Name: 'Serie', Type: 'CollectionFolder', CollectionType: 'tvshows' })).toBe('#/tv?topParentId=abc&collectionType=tvshows');
    expect(libraryHref({ Id: 'm', Name: 'Film', Type: 'CollectionFolder', CollectionType: 'movies' })).toBe('#/movies?topParentId=m&collectionType=movies');
  });

  it('mostra solo destinazioni esistenti, massimo 4 (la ricerca è nella barra in alto)', () => {
    const none = buildEntries([]);
    expect(none.map((e) => e.key)).toEqual(['home']);
    const all = buildEntries([
      { Id: 'm', Name: 'Film', Type: 'CollectionFolder', CollectionType: 'movies' },
      { Id: 't', Name: 'Serie', Type: 'CollectionFolder', CollectionType: 'tvshows' },
      { Id: 'b', Name: 'Raccolte', Type: 'CollectionFolder', CollectionType: 'boxsets' },
      { Id: 'p', Name: 'Playlist', Type: 'CollectionFolder', CollectionType: 'playlists' },
    ]);
    expect(all.map((e) => e.key)).toEqual(['home', 'movies', 'shows', 'collections']);
    const home = all[0]!;
    expect(home.match('home', new URLSearchParams())).toBe(true);
    expect(home.match('home', new URLSearchParams('tab=1'))).toBe(false);
  });
});
