/**
 * Watchlist = UserData.Likes: la stessa fonte usata da Jellyfin Enhanced (sync Seerr),
 * KefinTweaks e Catch Up. Non è un sinonimo dei Preferiti (IsFavorite).
 */
import type { BaseItem, JellyfinApi } from './jellyfin-api';

// Vista Nebula ospitata dalla route home reale: nessuna route sconosciuta al router Jellyfin.
export const WATCHLIST_HREF = '#/home?nebula=watchlist';

export function isWatchlistRoute(path: string, params: URLSearchParams): boolean {
  return path === 'home' && params.get('nebula') === 'watchlist';
}

export const WATCHLIST_CHANGED = 'biaflix-nebula:watchlist-changed';

/** Come JE: per episodi/stagioni la watchlist si applica alla serie. */
export function watchlistTargetId(item: Pick<BaseItem, 'Id' | 'Type' | 'SeriesId'>): string {
  if ((item.Type === 'Episode' || item.Type === 'Season') && item.SeriesId) return item.SeriesId;
  return item.Id;
}

export class WatchlistService {
  private pending = new Map<string, Promise<boolean>>();

  constructor(
    private readonly api: JellyfinApi,
    private readonly events: EventTarget = typeof document !== 'undefined' ? document : new EventTarget(),
  ) {}

  async isListed(itemId: string): Promise<boolean> {
    const item = await this.api.getItem(itemId);
    return item.UserData?.Likes === true;
  }

  /** Imposta lo stato e restituisce quello confermato dal server. */
  set(itemId: string, listed: boolean): Promise<boolean> {
    const inflight = this.pending.get(itemId);
    const run = async () => {
      if (inflight) await inflight.catch(() => undefined);
      const data = await this.api.setLikes(itemId, listed);
      const confirmed = data?.Likes === true;
      this.events.dispatchEvent(new CustomEvent(WATCHLIST_CHANGED, { detail: { itemId, listed: confirmed } }));
      return confirmed;
    };
    const p = run().finally(() => {
      if (this.pending.get(itemId) === p) this.pending.delete(itemId);
    });
    this.pending.set(itemId, p);
    return p;
  }

  list(limit?: number) {
    return this.api.getWatchlist(limit);
  }
}
