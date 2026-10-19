/**
 * Serializza le mutazioni per chiave (es. id raccolta).
 * Jellyfin scrive collection.xml su disco: mutazioni concorrenti sulla stessa raccolta
 * possono fallire con IOException lato server (osservato su 12.2), quindi non le parallelizziamo mai.
 */
export class MutationQueue {
  private tails = new Map<string, Promise<unknown>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve();
    const next = prev.then(task, task);
    const tail = next.catch(() => undefined);
    this.tails.set(key, tail);
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return next;
  }

  get pending(): number {
    return this.tails.size;
  }
}
