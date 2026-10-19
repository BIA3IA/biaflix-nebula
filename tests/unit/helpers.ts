import { JellyfinApi, type BaseItem } from '../../src/scripts/jellyfin-api';

export interface Call {
  method: string;
  url: URL;
  headers: Record<string, string>;
  body?: string;
}

export type Route = (call: Call) => unknown;

/** Fetch finto: registra le chiamate e risponde con la prima route che restituisce un valore. */
export function fakeFetch(routes: Route[]) {
  const calls: Call[] = [];
  const impl = async (input: string, init: RequestInit = {}) => {
    const call: Call = {
      method: init.method ?? 'GET',
      url: new URL(input),
      headers: (init.headers ?? {}) as Record<string, string>,
      body: init.body as string | undefined,
    };
    calls.push(call);
    for (const r of routes) {
      const out = r(call);
      if (out instanceof Response) return out;
      if (out !== undefined) return new Response(JSON.stringify(out), { status: 200 });
    }
    return new Response('', { status: 204 });
  };
  return { calls, impl };
}

export function makeApi(routes: Route[] = []) {
  const f = fakeFetch(routes);
  const api = new JellyfinApi({ serverUrl: 'http://jf.test/', userId: 'u1', token: 'tok' }, f.impl);
  return { api, calls: f.calls };
}

export function item(partial: Partial<BaseItem> & Pick<BaseItem, 'Id'>): BaseItem {
  return { Name: partial.Id, Type: 'Movie', ...partial };
}
