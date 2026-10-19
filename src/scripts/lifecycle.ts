/**
 * Ciclo di vita delle feature nella SPA Jellyfin.
 * Ogni feature dichiara su quali route è attiva; al cambio pagina (evento `viewshow`, emesso sia
 * dalle pagine React sia dalle view legacy, più `hashchange` di riserva) la feature viene smontata
 * e rimontata in modo idempotente. Tutti i listener sono rimossi allo stop.
 */
import { currentRoute } from './env';

export interface RouteContext {
  path: string;
  params: URLSearchParams;
  /** Elemento .page attivo, se noto. */
  page: HTMLElement | null;
  signal: AbortSignal;
}

export interface Feature {
  name: string;
  /** Route (path senza '#/') su cui montare; '*' = tutte. */
  routes: readonly string[];
  mount(ctx: RouteContext): void | (() => void) | Promise<void | (() => void)>;
}

interface Mounted {
  feature: Feature;
  controller: AbortController;
  cleanup?: () => void;
}

export function activePage(): HTMLElement | null {
  const pages = document.querySelectorAll<HTMLElement>('.page:not(.hide)');
  for (let i = pages.length - 1; i >= 0; i--) {
    const p = pages[i]!;
    if (p.offsetParent !== null || p.getClientRects().length) return p;
  }
  return pages[pages.length - 1] ?? null;
}

export class Lifecycle {
  private mounted: Mounted[] = [];
  private stopFns: (() => void)[] = [];
  private lastKey = '';
  private scheduled = false;
  private pendingPage: HTMLElement | null = null;
  private pendingForce = false;
  private running = false;
  private rafId = 0;

  constructor(
    private readonly features: readonly Feature[],
    private readonly onError: (feature: string, err: unknown) => void = () => undefined,
  ) {}

  start(): void {
    this.running = true;
    const onView = (e: Event) => this.schedule(e.target instanceof HTMLElement ? e.target : null, true);
    const onHash = () => this.schedule(null, false);
    document.addEventListener('viewshow', onView);
    window.addEventListener('hashchange', onHash);
    this.stopFns.push(
      () => document.removeEventListener('viewshow', onView),
      () => window.removeEventListener('hashchange', onHash),
    );
    this.schedule(null, true);
  }

  stop(): void {
    // Un frame già in coda non deve rimontare feature con un contesto ormai dismesso.
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.scheduled = false;
    this.pendingPage = null;
    this.pendingForce = false;
    this.stopFns.splice(0).forEach((fn) => fn());
    this.unmountAll();
    this.lastKey = '';
  }

  /**
   * hashchange e viewshow arrivano spesso nello stesso frame: le richieste si fondono
   * (vince l'ultima pagina nota, force se almeno una lo chiede) invece di scartare la seconda,
   * altrimenti si montano le feature sulla pagina precedente non ancora nascosta.
   */
  private schedule(page: HTMLElement | null, force: boolean): void {
    if (page) this.pendingPage = page;
    this.pendingForce ||= force;
    if (!this.running || this.scheduled) return;
    this.scheduled = true;
    this.rafId = requestAnimationFrame(() => {
      if (!this.running) return;
      const hint = this.pendingPage;
      const forced = this.pendingForce;
      this.scheduled = false;
      this.pendingPage = null;
      this.pendingForce = false;
      this.apply(hint, forced);
    });
  }

  private apply(pageHint: HTMLElement | null, force: boolean): void {
    const route = currentRoute();
    const page = pageHint?.classList.contains('page') ? pageHint : activePage();
    const key = `${route.path}?${route.params.toString()}#${page?.id ?? ''}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    this.unmountAll();
    for (const feature of this.features) {
      if (!feature.routes.includes('*') && !feature.routes.includes(route.path)) continue;
      const controller = new AbortController();
      const entry: Mounted = { feature, controller };
      this.mounted.push(entry);
      try {
        const result = feature.mount({ ...route, page, signal: controller.signal });
        Promise.resolve(result)
          .then((cleanup) => {
            if (typeof cleanup !== 'function') return;
            if (controller.signal.aborted) cleanup();
            else entry.cleanup = cleanup;
          })
          .catch((err) => this.onError(feature.name, err));
      } catch (err) {
        this.onError(feature.name, err);
      }
    }
  }

  private unmountAll(): void {
    for (const m of this.mounted.splice(0)) {
      m.controller.abort();
      try {
        m.cleanup?.();
      } catch (err) {
        this.onError(m.feature.name, err);
      }
    }
  }
}
