/**
 * Client minimale e tipizzato per le API Jellyfin 12.2 usate da Nebula.
 * Usa la sessione dell'utente già autenticato nel web client (token di window.ApiClient):
 * nessuna API key, nessun proxy. Firme verificate sull'OpenAPI del server 12.2.0.
 */

export interface UserPolicy {
  IsAdministrator: boolean;
  EnableCollectionManagement?: boolean;
}

export interface UserDto {
  Id: string;
  Name: string;
  Policy: UserPolicy;
}

export interface UserItemData {
  PlayedPercentage?: number;
  PlaybackPositionTicks?: number;
  UnplayedItemCount?: number;
  IsFavorite?: boolean;
  Likes?: boolean | null;
  Played?: boolean;
}

export type ItemType = 'Movie' | 'Series' | 'Season' | 'Episode' | 'BoxSet' | 'Playlist' | (string & {});

export interface BaseItem {
  Id: string;
  Name: string;
  Type: ItemType;
  ServerId?: string;
  Overview?: string;
  ProductionYear?: number;
  RunTimeTicks?: number;
  OfficialRating?: string;
  CommunityRating?: number;
  Genres?: string[];
  ChildCount?: number;
  SeriesId?: string;
  SeriesName?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  ImageTags?: Partial<Record<'Primary' | 'Thumb' | 'Logo' | 'Banner', string>>;
  BackdropImageTags?: string[];
  ParentBackdropItemId?: string;
  ParentBackdropImageTags?: string[];
  ParentThumbItemId?: string;
  ParentThumbImageTag?: string;
  SeriesPrimaryImageTag?: string;
  PrimaryImageAspectRatio?: number;
  UserData?: UserItemData;
  CanDelete?: boolean;
  /** Presente solo negli elementi restituiti da /Playlists/{id}/Items. */
  PlaylistItemId?: string;
  People?: PersonInfo[];
  Studios?: { Name: string; Id?: string }[];
  Taglines?: string[];
  RemoteTrailers?: { Url?: string; Name?: string }[];
  LocalTrailerCount?: number;
  CriticRating?: number;
  PremiereDate?: string;
  EndDate?: string;
  Status?: string;
  SeasonId?: string;
  SeasonName?: string;
  CollectionType?: string;
  LocationType?: string;
  IsFolder?: boolean;
}

export interface PersonInfo {
  Id: string;
  Name: string;
  Role?: string;
  Type?: 'Actor' | 'Director' | 'Writer' | 'Producer' | 'GuestStar' | 'Composer' | (string & {});
  PrimaryImageTag?: string;
}

export interface ItemsResult<T = BaseItem> {
  Items: T[];
  TotalRecordCount: number;
}

export interface PlaylistUser {
  UserId: string;
  CanEdit: boolean;
}

export interface PlaylistInfo {
  OpenAccess: boolean;
  Shares: PlaylistUser[];
  ItemIds: string[];
}

export type ImageType = 'Primary' | 'Backdrop' | 'Thumb' | 'Logo';

export type Query = Record<string, string | number | boolean | readonly string[] | undefined | null>;

export interface Session {
  serverUrl: string;
  userId: string;
  token: string;
  serverId?: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly body = '',
  ) {
    super(`${method} ${path} → HTTP ${status}`);
    this.name = 'ApiError';
  }

  get isForbidden(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const ITEM_FIELDS = ['PrimaryImageAspectRatio', 'Overview', 'Genres', 'ChildCount', 'CanDelete', 'ProductionYear'] as const;

export function buildQuery(query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
    } else {
      params.set(key, String(value));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export class JellyfinApi {
  /** Richieste GET identiche in corso vengono condivise (de-dupe). */
  private inflight = new Map<string, Promise<unknown>>();

  constructor(
    readonly session: Session,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {}

  get userId(): string {
    return this.session.userId;
  }

  url(path: string, query?: Query): string {
    return this.session.serverUrl.replace(/\/+$/, '') + path + buildQuery(query);
  }

  async request<T>(method: string, path: string, query?: Query, body?: unknown): Promise<T> {
    const url = this.url(path, query);
    const run = async (): Promise<T> => {
      const res = await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `MediaBrowser Token="${this.session.token}"`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new ApiError(res.status, method, path, await res.text().catch(() => ''));
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    };

    if (method !== 'GET') return run();
    const existing = this.inflight.get(url);
    if (existing) return existing as Promise<T>;
    const p = run().finally(() => this.inflight.delete(url));
    this.inflight.set(url, p);
    return p;
  }

  // --- Utente -------------------------------------------------------------

  getCurrentUser(): Promise<UserDto> {
    return this.request('GET', '/Users/Me');
  }

  /** Librerie visibili all'utente (CollectionType: movies, tvshows, boxsets, playlists…). */
  getUserViews(): Promise<ItemsResult<BaseItem & { CollectionType?: string }>> {
    return this.request('GET', '/UserViews', { userId: this.userId });
  }

  // --- Item ---------------------------------------------------------------

  getItems(query: Query): Promise<ItemsResult> {
    return this.request('GET', '/Items', { userId: this.userId, fields: ITEM_FIELDS, ...query });
  }

  getItem(id: string): Promise<BaseItem> {
    return this.request('GET', `/Items/${encodeURIComponent(id)}`, { userId: this.userId, fields: ITEM_FIELDS });
  }

  /** Ricerca titoli della libreria (solo film e serie, per il wizard delle raccolte). */
  searchTitles(term: string, limit = 24): Promise<ItemsResult> {
    return this.getItems({
      searchTerm: term,
      recursive: true,
      includeItemTypes: ['Movie', 'Series'],
      limit,
      sortBy: 'SortName',
      enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
      imageTypeLimit: 1,
    });
  }

  /** Item con i campi necessari alla pagina dettagli Nebula (persone, studi, trailer, date). */
  getItemFull(id: string): Promise<BaseItem> {
    return this.request('GET', `/Items/${encodeURIComponent(id)}`, {
      userId: this.userId,
      fields: [...ITEM_FIELDS, 'People', 'Studios', 'Taglines', 'RemoteTrailers', 'PremiereDate', 'EndDate', 'Status', 'OfficialRating'],
    });
  }

  getSeasons(seriesId: string): Promise<ItemsResult> {
    return this.request('GET', `/Shows/${encodeURIComponent(seriesId)}/Seasons`, { userId: this.userId, fields: ['ChildCount', 'PrimaryImageAspectRatio'] });
  }

  getEpisodes(seriesId: string, seasonId: string): Promise<ItemsResult> {
    return this.request('GET', `/Shows/${encodeURIComponent(seriesId)}/Episodes`, {
      userId: this.userId,
      seasonId,
      fields: ['Overview', 'PrimaryImageAspectRatio'],
      enableUserData: true,
    });
  }

  getNextUp(seriesId: string): Promise<ItemsResult> {
    return this.request('GET', '/Shows/NextUp', { userId: this.userId, seriesId, limit: 1, fields: ['PrimaryImageAspectRatio'] });
  }

  getSimilar(id: string, limit = 24): Promise<ItemsResult> {
    return this.request('GET', `/Items/${encodeURIComponent(id)}/Similar`, {
      userId: this.userId,
      limit,
      fields: ['PrimaryImageAspectRatio', 'ProductionYear'],
    });
  }

  // --- Watchlist (UserData.Likes, stessa fonte di Jellyfin Enhanced / Seerr sync) ---

  setLikes(itemId: string, likes: boolean): Promise<UserItemData> {
    return likes
      ? this.request('POST', `/UserItems/${encodeURIComponent(itemId)}/Rating`, { userId: this.userId, likes: true })
      : this.request('DELETE', `/UserItems/${encodeURIComponent(itemId)}/Rating`, { userId: this.userId });
  }

  getWatchlist(limit = 24): Promise<ItemsResult> {
    return this.getItems({
      recursive: true,
      filters: 'Likes',
      includeItemTypes: ['Movie', 'Series'],
      sortBy: 'DateCreated',
      sortOrder: 'Descending',
      limit,
    });
  }

  // --- Collezioni (BoxSet native) ----------------------------------------

  getCollections(): Promise<ItemsResult> {
    return this.getItems({ recursive: true, includeItemTypes: 'BoxSet', sortBy: 'SortName' });
  }

  getChildren(parentId: string, query: Query = {}): Promise<ItemsResult> {
    return this.getItems({ parentId, sortBy: 'SortName', ...query });
  }

  createCollection(name: string, ids: readonly string[]): Promise<{ Id: string }> {
    return this.request('POST', '/Collections', { name, ids, isLocked: false });
  }

  addToCollection(collectionId: string, ids: readonly string[]): Promise<void> {
    return this.request('POST', `/Collections/${encodeURIComponent(collectionId)}/Items`, { ids });
  }

  removeFromCollection(collectionId: string, ids: readonly string[]): Promise<void> {
    return this.request('DELETE', `/Collections/${encodeURIComponent(collectionId)}/Items`, { ids });
  }

  /** Elimina la sola entità raccolta/playlist (mai i file media): usato solo su BoxSet/Playlist. */
  deleteContainer(item: Pick<BaseItem, 'Id' | 'Type'>): Promise<void> {
    if (item.Type !== 'BoxSet' && item.Type !== 'Playlist') {
      return Promise.reject(new Error(`Eliminazione rifiutata per tipo ${item.Type}`));
    }
    return this.request('DELETE', `/Items/${encodeURIComponent(item.Id)}`);
  }

  // --- Playlist -----------------------------------------------------------

  getPlaylists(): Promise<ItemsResult> {
    return this.getItems({ recursive: true, includeItemTypes: 'Playlist', sortBy: 'SortName' });
  }

  createPlaylist(name: string, ids: readonly string[], isPublic: boolean): Promise<{ Id: string }> {
    return this.request('POST', '/Playlists', undefined, {
      Name: name,
      Ids: ids,
      UserId: this.userId,
      MediaType: 'Video',
      IsPublic: isPublic,
    });
  }

  getPlaylist(id: string): Promise<PlaylistInfo> {
    return this.request('GET', `/Playlists/${encodeURIComponent(id)}`);
  }

  getPlaylistItems(id: string): Promise<ItemsResult> {
    return this.request('GET', `/Playlists/${encodeURIComponent(id)}/Items`, {
      userId: this.userId,
      fields: ITEM_FIELDS,
    });
  }

  addToPlaylist(id: string, ids: readonly string[]): Promise<void> {
    return this.request('POST', `/Playlists/${encodeURIComponent(id)}/Items`, { ids, userId: this.userId });
  }

  removeFromPlaylist(id: string, entryIds: readonly string[]): Promise<void> {
    return this.request('DELETE', `/Playlists/${encodeURIComponent(id)}/Items`, { entryIds });
  }

  movePlaylistItem(id: string, entryId: string, newIndex: number): Promise<void> {
    return this.request('POST', `/Playlists/${encodeURIComponent(id)}/Items/${encodeURIComponent(entryId)}/Move/${newIndex}`);
  }

  // --- Solo amministratori (RequiresElevation su 12.2) -----------------------

  /** POST /Items/{id} richiede il DTO completo: rilegge l'item e cambia solo Overview. */
  async updateOverview(itemId: string, overview: string): Promise<void> {
    const full = await this.request<Record<string, unknown>>('GET', `/Items/${encodeURIComponent(itemId)}`, { userId: this.userId });
    await this.request('POST', `/Items/${encodeURIComponent(itemId)}`, undefined, { ...full, Overview: overview });
  }

  /** Upload cover: il server si aspetta il contenuto in base64 con il Content-Type dell'immagine. */
  async uploadPrimaryImage(itemId: string, base64: string, mimeType: string): Promise<void> {
    const res = await this.fetchImpl(this.url(`/Items/${encodeURIComponent(itemId)}/Images/Primary`), {
      method: 'POST',
      headers: { Authorization: `MediaBrowser Token="${this.session.token}"`, 'Content-Type': mimeType },
      body: base64,
    });
    if (!res.ok) throw new ApiError(res.status, 'POST', `/Items/${itemId}/Images/Primary`, await res.text().catch(() => ''));
  }

  // --- Immagini -------------------------------------------------------------

  imageUrl(itemId: string, type: ImageType, opts: { tag?: string; width?: number; index?: number; quality?: number } = {}): string {
    const idx = type === 'Backdrop' ? `/${opts.index ?? 0}` : '';
    return this.url(`/Items/${encodeURIComponent(itemId)}/Images/${type}${idx}`, {
      tag: opts.tag,
      fillWidth: opts.width,
      quality: opts.quality ?? 90,
    });
  }
}
