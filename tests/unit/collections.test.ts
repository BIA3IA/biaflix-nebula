import { describe, expect, it } from 'vitest';
import { canManageCollections, collectionTargetId, CollectionsService, COLLECTIONS_CHANGED } from '../../src/scripts/collections';
import { MutationQueue } from '../../src/scripts/mutation-queue';
import { item, makeApi, type Call } from './helpers';

/** Server finto con stato reale delle raccolte, per verificare la logica di verifica post-scrittura. */
function fakeServer(opts: { dropOnAdd?: boolean } = {}) {
  const members = new Map<string, Set<string>>();
  let seq = 0;
  const route = (c: Call) => {
    const p = c.url.pathname;
    const ids = (c.url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
    if (p === '/Collections' && c.method === 'POST') {
      const id = `c${++seq}`;
      members.set(id, new Set(ids));
      return { Id: id };
    }
    const m = /^\/Collections\/(\w+)\/Items$/.exec(p);
    if (m) {
      const set = members.get(m[1]!)!;
      if (c.method === 'POST' && !opts.dropOnAdd) ids.forEach((i) => set.add(i));
      if (c.method === 'DELETE') ids.forEach((i) => set.delete(i));
      return new Response('', { status: 204 });
    }
    if (p === '/Items' && c.url.searchParams.get('includeItemTypes') === 'BoxSet') {
      return { Items: [...members.keys()].map((id) => item({ Id: id, Type: 'BoxSet' })), TotalRecordCount: members.size };
    }
    const parent = c.url.searchParams.get('parentId');
    if (p === '/Items' && parent) {
      const list = [...(members.get(parent) ?? [])].map((id) => item({ Id: id }));
      return { Items: list, TotalRecordCount: list.length };
    }
    return undefined;
  };
  return { members, route };
}

describe('permessi e target', () => {
  it('richiede admin o EnableCollectionManagement', () => {
    expect(canManageCollections({ Policy: { IsAdministrator: true } })).toBe(true);
    expect(canManageCollections({ Policy: { IsAdministrator: false, EnableCollectionManagement: true } })).toBe(true);
    expect(canManageCollections({ Policy: { IsAdministrator: false } })).toBe(false);
    expect(canManageCollections(null)).toBe(false);
  });

  it('da un episodio si aggiunge la serie', () => {
    expect(collectionTargetId({ Id: 'e1', Type: 'Episode', SeriesId: 's1' })).toBe('s1');
    expect(collectionTargetId({ Id: 'm1', Type: 'Movie' })).toBe('m1');
  });
});

describe('CollectionsService', () => {
  it('crea una raccolta mista 2 film + 2 serie e verifica sul server', async () => {
    const server = fakeServer();
    const { api } = makeApi([server.route]);
    const events = new EventTarget();
    const changed: string[] = [];
    events.addEventListener(COLLECTIONS_CHANGED, (e) => changed.push((e as CustomEvent).detail.collectionId));
    const svc = new CollectionsService(api, () => 0, events);
    const res = await svc.create('  Serata Halloween ', ['m1', 'm2', 's1', 's2', 'm1']);
    expect(res.unconfirmed).toEqual([]);
    expect([...server.members.get(res.collectionId)!]).toEqual(['m1', 'm2', 's1', 's2']);
    expect(changed).toEqual([res.collectionId]);
  });

  it('segnala gli id non confermati invece di dichiarare successo', async () => {
    const server = fakeServer({ dropOnAdd: true });
    const { api } = makeApi([server.route]);
    const svc = new CollectionsService(api, () => 0, new EventTarget());
    const { collectionId } = await svc.create('X', ['m1']);
    const res = await svc.add(collectionId, ['m9']);
    expect(res.unconfirmed).toEqual(['m9']);
  });

  it('rimozione: verifica che il titolo non sia più presente', async () => {
    const server = fakeServer();
    const { api } = makeApi([server.route]);
    const svc = new CollectionsService(api, () => 0, new EventTarget());
    const { collectionId } = await svc.create('X', ['m1', 's1']);
    const res = await svc.remove(collectionId, ['s1']);
    expect(res.unconfirmed).toEqual([]);
    expect(server.members.get(collectionId)!.has('s1')).toBe(false);
  });

  it('containing() trova le raccolte che includono un titolo', async () => {
    const server = fakeServer();
    const { api } = makeApi([server.route]);
    const svc = new CollectionsService(api, () => 0, new EventTarget());
    const a = await svc.create('A', ['m1']);
    await svc.create('B', ['m2']);
    expect([...(await svc.containing('m1'))]).toEqual([a.collectionId]);
  });

  it('la cache scade dopo 60s', async () => {
    const server = fakeServer();
    const { api, calls } = makeApi([server.route]);
    let now = 0;
    const svc = new CollectionsService(api, () => now, new EventTarget());
    await svc.list();
    const before = calls.length;
    await svc.list();
    expect(calls.length).toBe(before);
    now = 61_000;
    await svc.list();
    expect(calls.length).toBeGreaterThan(before);
  });
});

describe('MutationQueue', () => {
  it('serializza le mutazioni sulla stessa chiave anche se una fallisce', async () => {
    const q = new MutationQueue();
    const log: string[] = [];
    const slow =
      (name: string, ms: number, fail = false) =>
      () =>
        new Promise<void>((resolve, reject) =>
          setTimeout(() => {
            log.push(name);
            if (fail) reject(new Error(name));
            else resolve();
          }, ms),
        );
    const a = q.run('c1', slow('a', 30, true));
    const b = q.run('c1', slow('b', 1));
    const other = q.run('c2', slow('x', 5));
    await Promise.allSettled([a, b, other]);
    expect(log).toEqual(['x', 'a', 'b']);
    await expect(a).rejects.toThrow('a');
  });
});
