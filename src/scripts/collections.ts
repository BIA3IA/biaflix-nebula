/**
 * Servizio raccolte (BoxSet native Jellyfin) con film e serie insieme.
 * - Persistenza solo lato server (nessun localStorage come fonte di verità).
 * - Mutazioni serializzate per raccolta e verificate rileggendo il server.
 * - Le raccolte sono globali in Jellyfin: lo dichiariamo in UI, nessuna finta privacy.
 */
import { ApiError, type BaseItem, type JellyfinApi, type UserDto } from './jellyfin-api';
import { MutationQueue } from './mutation-queue';

export const COLLECTIONS_CHANGED = 'biaflix-nebula:collections-changed';

export interface CollectionSummary {
  item: BaseItem;
  count: number;
  /** Fino a 4 titoli per la cover composita. */
  preview: BaseItem[];
}

export interface MutationResult {
  collectionId: string;
  /** Id che il server non conferma dopo la scrittura. */
  unconfirmed: string[];
}

export function canManageCollections(user: Pick<UserDto, 'Policy'> | null | undefined): boolean {
  return !!user && (user.Policy.IsAdministrator || user.Policy.EnableCollectionManagement === true);
}

/** Da episodi/stagioni si aggiunge la serie: le raccolte Nebula contengono film e serie. */
export function collectionTargetId(item: Pick<BaseItem, 'Id' | 'Type' | 'SeriesId'>): string {
  if ((item.Type === 'Episode' || item.Type === 'Season') && item.SeriesId) return item.SeriesId;
  return item.Id;
}

export function isCollectable(item: Pick<BaseItem, 'Type'>): boolean {
  return item.Type === 'Movie' || item.Type === 'Series' || item.Type === 'Episode' || item.Type === 'Season';
}

const CACHE_TTL_MS = 60_000;

export class CollectionsService {
  private queue = new MutationQueue();
  private listCache: { at: number; value: Promise<CollectionSummary[]> } | null = null;
  private memberCache = new Map<string, { at: number; value: Promise<Set<string>> }>();

  constructor(
    private readonly api: JellyfinApi,
    private readonly now: () => number = () => Date.now(),
    private readonly events: EventTarget = typeof document !== 'undefined' ? document : new EventTarget(),
  ) {}

  invalidate(collectionId?: string): void {
    this.listCache = null;
    if (collectionId) this.memberCache.delete(collectionId);
    else this.memberCache.clear();
  }

  private notify(collectionId: string): void {
    this.invalidate(collectionId);
    this.events.dispatchEvent(new CustomEvent(COLLECTIONS_CHANGED, { detail: { collectionId } }));
  }

  list(): Promise<CollectionSummary[]> {
    if (this.listCache && this.now() - this.listCache.at < CACHE_TTL_MS) return this.listCache.value;
    const value = this.loadList();
    this.listCache = { at: this.now(), value };
    value.catch(() => {
      if (this.listCache?.value === value) this.listCache = null;
    });
    return value;
  }

  private async loadList(): Promise<CollectionSummary[]> {
    const { Items } = await this.api.getCollections();
    return Promise.all(
      Items.map(async (item) => {
        const children = await this.api.getChildren(item.Id, {
          limit: 4,
          sortBy: 'Random',
          includeItemTypes: ['Movie', 'Series'],
          enableImageTypes: ['Primary', 'Backdrop'],
          imageTypeLimit: 1,
        });
        return { item, count: children.TotalRecordCount, preview: children.Items };
      }),
    );
  }

  members(collectionId: string): Promise<Set<string>> {
    const cached = this.memberCache.get(collectionId);
    if (cached && this.now() - cached.at < CACHE_TTL_MS) return cached.value;
    const value = this.api.getChildren(collectionId, { fields: ['ParentId'], enableImages: false }).then((r) => new Set(r.Items.map((i) => i.Id)));
    this.memberCache.set(collectionId, { at: this.now(), value });
    value.catch(() => this.memberCache.delete(collectionId));
    return value;
  }

  /** Raccolte che contengono l'item (per i check nel menu «Aggiungi a…»). */
  async containing(itemId: string): Promise<Set<string>> {
    const all = await this.list();
    const result = new Set<string>();
    await Promise.all(
      all.map(async (c) => {
        if ((await this.members(c.item.Id)).has(itemId)) result.add(c.item.Id);
      }),
    );
    return result;
  }

  private async verify(collectionId: string, expectIn: readonly string[], expectOut: readonly string[] = []): Promise<string[]> {
    this.memberCache.delete(collectionId);
    const members = await this.members(collectionId);
    return [...expectIn.filter((id) => !members.has(id)), ...expectOut.filter((id) => members.has(id))];
  }

  async create(name: string, ids: readonly string[]): Promise<MutationResult> {
    const clean = name.trim();
    if (!clean) throw new Error('Nome raccolta obbligatorio');
    const unique = [...new Set(ids)];
    const { Id } = await this.api.createCollection(clean, unique);
    const unconfirmed = await this.queue.run(Id, () => this.verify(Id, unique));
    this.notify(Id);
    return { collectionId: Id, unconfirmed };
  }

  add(collectionId: string, ids: readonly string[]): Promise<MutationResult> {
    return this.queue.run(collectionId, async () => {
      await this.api.addToCollection(collectionId, ids);
      const unconfirmed = await this.verify(collectionId, ids);
      this.notify(collectionId);
      return { collectionId, unconfirmed };
    });
  }

  remove(collectionId: string, ids: readonly string[]): Promise<MutationResult> {
    return this.queue.run(collectionId, async () => {
      await this.api.removeFromCollection(collectionId, ids);
      const unconfirmed = await this.verify(collectionId, [], ids);
      this.notify(collectionId);
      return { collectionId, unconfirmed };
    });
  }

  delete(collection: Pick<BaseItem, 'Id' | 'Type'>): Promise<void> {
    return this.queue.run(collection.Id, async () => {
      await this.api.deleteContainer(collection);
      this.notify(collection.Id);
    });
  }
}

export function isForbidden(err: unknown): boolean {
  return err instanceof ApiError && err.isForbidden;
}
