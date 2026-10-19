/**
 * Servizio playlist (Playlist API Jellyfin 12.2): liste ordinate, personali o pubbliche.
 * Nota verificata su 12.2: aggiungere una Serie inserisce tutti i suoi episodi.
 */
import { ApiError, type BaseItem, type JellyfinApi } from './jellyfin-api';
import { MutationQueue } from './mutation-queue';

export const PLAYLISTS_CHANGED = 'biaflix-nebula:playlists-changed';

export class PlaylistService {
  private queue = new MutationQueue();

  constructor(
    private readonly api: JellyfinApi,
    private readonly events: EventTarget = typeof document !== 'undefined' ? document : new EventTarget(),
  ) {}

  private notify(playlistId: string): void {
    this.events.dispatchEvent(new CustomEvent(PLAYLISTS_CHANGED, { detail: { playlistId } }));
  }

  /** Playlist su cui l'utente corrente può scrivere (stesso criterio dell'editor nativo). */
  async editable(): Promise<BaseItem[]> {
    const { Items } = await this.api.getPlaylists();
    const checks = await Promise.all(
      Items.map(async (p) => {
        try {
          const perm = await this.api.request<{ CanEdit: boolean }>(
            'GET',
            `/Playlists/${encodeURIComponent(p.Id)}/Users/${encodeURIComponent(this.api.userId)}`,
          );
          return perm.CanEdit ? p : null;
        } catch (err) {
          if (err instanceof ApiError && (err.status === 404 || err.isForbidden)) return null;
          throw err;
        }
      }),
    );
    return checks.filter((p): p is BaseItem => p !== null);
  }

  async create(name: string, ids: readonly string[], isPublic: boolean): Promise<string> {
    const clean = name.trim();
    if (!clean) throw new Error('Nome playlist obbligatorio');
    const { Id } = await this.api.createPlaylist(clean, [...new Set(ids)], isPublic);
    this.notify(Id);
    return Id;
  }

  add(playlistId: string, ids: readonly string[]): Promise<void> {
    return this.queue.run(playlistId, async () => {
      await this.api.addToPlaylist(playlistId, ids);
      this.notify(playlistId);
    });
  }

  /** Rimuove per PlaylistItemId (entry), così i duplicati restano gestiti come in Jellyfin. */
  remove(playlistId: string, entryIds: readonly string[]): Promise<void> {
    return this.queue.run(playlistId, async () => {
      await this.api.removeFromPlaylist(playlistId, entryIds);
      this.notify(playlistId);
    });
  }

  move(playlistId: string, entryId: string, newIndex: number): Promise<void> {
    return this.queue.run(playlistId, async () => {
      await this.api.movePlaylistItem(playlistId, entryId, Math.max(0, newIndex));
      this.notify(playlistId);
    });
  }
}
