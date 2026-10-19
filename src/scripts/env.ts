/** Accesso al web client Jellyfin già autenticato: sessione, navigazione, layout. */
import type { Session } from './jellyfin-api';

interface ApiClientLike {
  getCurrentUserId(): string | null | undefined;
  accessToken(): string | null | undefined;
  serverAddress(): string | null | undefined;
  serverId?(): string | undefined;
  serverInfo?(): { Id?: string } | undefined;
}

interface JellyfinWindow {
  ApiClient?: ApiClientLike;
  Emby?: { Page?: { show(path: string): unknown; showItem?(id: string, serverId?: string): unknown } };
  Dashboard?: { navigate(url: string): unknown };
}

const w = (): JellyfinWindow => window as unknown as JellyfinWindow;

export function readSession(): Session | null {
  const client = w().ApiClient;
  if (!client) return null;
  const userId = client.getCurrentUserId?.();
  const token = client.accessToken?.();
  const serverUrl = client.serverAddress?.();
  if (!userId || !token || !serverUrl) return null;
  const serverId = client.serverId?.() ?? client.serverInfo?.()?.Id;
  return { userId, token, serverUrl, serverId };
}

/** Attende una sessione autenticata con backoff limitato (niente polling aggressivo). */
export function waitForSession(timeoutMs = 120_000): Promise<Session> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let delay = 150;
    const tick = () => {
      const s = readSession();
      if (s) return resolve(s);
      if (Date.now() - started > timeoutMs) return reject(new Error('Sessione Jellyfin non disponibile'));
      delay = Math.min(delay * 1.5, 2000);
      window.setTimeout(tick, delay);
    };
    tick();
  });
}

/** Naviga con il router reale di Jellyfin (preserva back/forward e deep link). */
export function navigate(path: string): void {
  const clean = path.replace(/^#!?\/?/, '');
  const page = w().Emby?.Page;
  if (page?.show) {
    page.show(clean);
    return;
  }
  window.location.hash = `#/${clean}`;
}

export function detailsPath(itemId: string, serverId?: string): string {
  return `details?id=${encodeURIComponent(itemId)}${serverId ? `&serverId=${encodeURIComponent(serverId)}` : ''}`;
}

/** Il layout Modern (React/MUI) monta una AppBar MUI; il legacy nasconde nulla e usa .skinHeader. */
export function isModernLayout(): boolean {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem('layout');
  } catch {
    stored = null;
  }
  if (stored && ['desktop-legacy', 'mobile-legacy', 'tv'].includes(stored)) return false;
  return !document.documentElement.classList.contains('layout-tv');
}

export function currentRoute(): { path: string; params: URLSearchParams } {
  const hash = window.location.hash.replace(/^#!?/, '');
  const [path = '', query = ''] = hash.split('?');
  return { path: path.replace(/^\//, '').replace(/\.html$/, '') || 'home', params: new URLSearchParams(query) };
}
