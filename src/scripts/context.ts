import type { CollectionsService } from './collections';
import type { NebulaFlags } from './flags';
import type { JellyfinApi, UserDto } from './jellyfin-api';
import type { PlaylistService } from './playlist';
import type { WatchlistService } from './watchlist';

/** Dipendenze condivise dalle feature (iniettate, quindi sostituibili nei test). */
export interface NebulaContext {
  api: JellyfinApi;
  flags: NebulaFlags;
  user: UserDto;
  serverId: string;
  collections: CollectionsService;
  playlists: PlaylistService;
  watchlist: WatchlistService;
  log(...args: unknown[]): void;
}
