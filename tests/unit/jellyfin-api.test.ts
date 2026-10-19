import { describe, expect, it } from 'vitest';
import { ApiError, buildQuery } from '../../src/scripts/jellyfin-api';
import { makeApi } from './helpers';

describe('buildQuery', () => {
  it('omette valori vuoti e unisce gli array con virgole', () => {
    expect(buildQuery({ a: 1, b: undefined, c: null, ids: ['x', 'y'], empty: [] })).toBe('?a=1&ids=x%2Cy');
    expect(buildQuery({})).toBe('');
  });
});

describe('JellyfinApi', () => {
  it('usa il token della sessione utente nell’header Authorization, mai in query', async () => {
    const { api, calls } = makeApi([() => ({ Items: [], TotalRecordCount: 0 })]);
    await api.getItems({ recursive: true });
    expect(calls[0]!.headers.Authorization).toBe('MediaBrowser Token="tok"');
    expect(calls[0]!.url.searchParams.has('api_key')).toBe(false);
    expect(calls[0]!.url.searchParams.get('userId')).toBe('u1');
  });

  it('crea raccolte con le firme 12.2 (query name/ids)', async () => {
    const { api, calls } = makeApi([(c) => (c.url.pathname === '/Collections' ? { Id: 'c1' } : undefined)]);
    await api.createCollection('Serata Halloween', ['m1', 's1']);
    const c = calls[0]!;
    expect(c.method).toBe('POST');
    expect(c.url.searchParams.get('name')).toBe('Serata Halloween');
    expect(c.url.searchParams.get('ids')).toBe('m1,s1');
  });

  it('crea playlist con il body JSON raccomandato (query obsolete)', async () => {
    const { api, calls } = makeApi([() => ({ Id: 'p1' })]);
    await api.createPlaylist('Maratona', ['e1'], false);
    expect(calls[0]!.url.search).toBe('');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ Name: 'Maratona', Ids: ['e1'], UserId: 'u1', MediaType: 'Video', IsPublic: false });
  });

  it('watchlist = Likes: POST likes=true per aggiungere, DELETE per rimuovere', async () => {
    const { api, calls } = makeApi([() => ({ Likes: true })]);
    await api.setLikes('i1', true);
    await api.setLikes('i1', false);
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.url.pathname).toBe('/UserItems/i1/Rating');
    expect(calls[0]!.url.searchParams.get('likes')).toBe('true');
    expect(calls[1]!.method).toBe('DELETE');
  });

  it('condivide le GET identiche in corso (de-dupe)', async () => {
    const { api, calls } = makeApi([() => ({ Id: 'i1', Name: 'x', Type: 'Movie' })]);
    await Promise.all([api.getItem('i1'), api.getItem('i1')]);
    expect(calls).toHaveLength(1);
  });

  it('rifiuta di eliminare item che non siano raccolte o playlist', async () => {
    const { api, calls } = makeApi();
    await expect(api.deleteContainer({ Id: 'm1', Type: 'Movie' })).rejects.toThrow(/rifiutata/);
    expect(calls).toHaveLength(0);
    await api.deleteContainer({ Id: 'c1', Type: 'BoxSet' });
    expect(calls[0]!.method).toBe('DELETE');
  });

  it('solleva ApiError con stato e flag forbidden', async () => {
    const { api } = makeApi([() => new Response('no', { status: 403 })]);
    const err = await api.addToCollection('c1', ['m1']).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).isForbidden).toBe(true);
  });

  it('costruisce URL immagine con tag e larghezza', () => {
    const { api } = makeApi();
    expect(api.imageUrl('i1', 'Backdrop', { tag: 't', width: 1280 })).toBe('http://jf.test/Items/i1/Images/Backdrop/0?tag=t&fillWidth=1280&quality=90');
  });
});
