import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';
import { DEV_USERS, login } from '../../dev/seed.mjs';

export const BASE = process.env.NEBULA_DEV_URL ?? 'http://127.0.0.1:8097';
/** NEBULA_DIST permette di servire una build diversa (es. la versione in produzione per gli screenshot «prima»). */
const DIST = process.env.NEBULA_DIST ?? resolve(import.meta.dirname, '../../dist');
const TYPES: Record<string, string> = { '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.map': 'application/json' };

/** Default: ambiente reale con plugin (pnpm dev:plugins). NEBULA_E2E_MODE=simulated per un Jellyfin senza plugin. */
export const DEFAULT_MODE: 'simulated' | 'kefin' = process.env.NEBULA_E2E_MODE === 'simulated' ? 'simulated' : 'kefin';

export type DevUser = keyof typeof DEV_USERS;

export interface Session {
  token: string;
  userId: string;
  serverId: string;
}

export async function apiCall<T = unknown>(s: Session, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `MediaBrowser Token="${s.token}"`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function sessionFor(user: DevUser): Promise<Session> {
  const s = await login(DEV_USERS[user]);
  const info = await (await fetch(`${BASE}/System/Info/Public`)).json();
  return { token: s.token, userId: s.userId, serverId: info.Id };
}

/** Serve dist/ come farebbe il CDN e simula lo Skin Manager KefinTweaks che carica la skin. */
/**
 * mode 'simulated' (default): inserisce il <link data-kefin-skin> come farebbe lo Skin Manager.
 * mode 'kefin': ambiente reale con KefinTweaks 0.5.1 + JE installati in locale (pnpm dev:plugins);
 *   la skin è caricata dallo Skin Manager vero e nebula.js dallo snippet JS Injector.
 */
export async function installNebula(
  page: Page,
  s: Session,
  opts: { skin?: boolean; reducedMotion?: boolean; mode?: 'simulated' | 'kefin' } = {},
): Promise<void> {
  await page.route('**/__nebula/**', async (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/__nebula\//, '');
    try {
      const body = await readFile(resolve(DIST, rel));
      await route.fulfill({ body, contentType: TYPES[extname(rel)] ?? 'application/octet-stream' });
    } catch {
      await route.fulfill({ status: 404 });
    }
  });
  await page.addInitScript(
    ({ base, s, skin, mode }) => {
      localStorage.setItem(
        'jellyfin_credentials',
        JSON.stringify({
          Servers: [
            {
              ManualAddress: base,
              LocalAddress: base,
              Id: s.serverId,
              UserId: s.userId,
              AccessToken: s.token,
              DateLastAccessed: Date.now(),
              LastConnectionMode: 2,
            },
          ],
        }),
      );
      localStorage.setItem('layout', 'modern');
      if (mode === 'kefin') {
        if (skin) localStorage.setItem('kefinTweaks_selectedSkin', 'Biaflix Nebula');
        return;
      }
      (window as unknown as { BiaflixNebulaConfig: unknown }).BiaflixNebulaConfig = { activation: 'skin', debug: true };
      document.addEventListener('DOMContentLoaded', () => {
        if (skin) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = `${base}/__nebula/nebula.css`;
          link.setAttribute('data-kefin-skin', 'true');
          link.setAttribute('data-skin', 'Biaflix Nebula');
          document.head.append(link);
        }
        const script = document.createElement('script');
        script.src = `${base}/__nebula/nebula.js`;
        document.head.append(script);
      });
    },
    { base: BASE, s, skin: opts.skin ?? true, mode: opts.mode ?? DEFAULT_MODE },
  );
  if (opts.reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
}

export const KNOWN_CONSOLE_NOISE = [/favicon/i, /serviceworker/i, /Failed to load resource.*(404|401)/i, /ResizeObserver loop/i, /chromecast|cast_sender/i];

/**
 * Errori di codice terzo (vedi docs/QA.md), filtrati in modo mirato:
 * KefinTweaks 0.5.1 seriesEpisodes.js:760 legge `seasonsData.Items` su una risposta non definita (riprodotto anche a Nebula spenta).
 * jellyfin-web 12.2 emby-scrollbuttons.js:167: `this.scrollHandler()` in un requestAnimationFrame dopo
 * l'aggancio; se il view manager nativo rimuove la pagina (figlio di .skinBody) nello stesso frame, il
 * detachedCallback azzera l'handler. Intermittente, scatenato dalle navigazioni istantanee dei test.
 */
export const PREEXISTING_PAGE_ERRORS = [
  /seasonsData is undefined/,
  /Cannot read properties of undefined \(reading 'Items'\)/,
  /\bscrollHandler is not a function/,
];

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => {
      if (!PREEXISTING_PAGE_ERRORS.some((r) => r.test(e.message))) errors.push(`pageerror: ${e.message}`);
    });
    page.on('console', (m) => {
      if (m.type() === 'error' && !KNOWN_CONSOLE_NOISE.some((r) => r.test(m.text()))) errors.push(m.text());
    });
    await use(errors);
  },
});

export { expect };

export async function gotoHome(page: Page): Promise<void> {
  await page.goto('/web/#/home');
  await expect(page.locator('html.nebula-active')).toHaveCount(1, { timeout: 20_000 });
}

export async function cleanupCollections(s: Session, prefix: string): Promise<void> {
  const r = await apiCall<{ Items: { Id: string; Name: string }[] }>(s, 'GET', `/Items?userId=${s.userId}&recursive=true&includeItemTypes=BoxSet`);
  for (const c of r.Items.filter((i) => i.Name.startsWith(prefix))) await apiCall(s, 'DELETE', `/Items/${c.Id}`);
}

/**
 * Navigazione principale: su desktop la navbar, su telefono il menu laterale (nessuna barra in basso).
 * Attende la chiusura del drawer, così il passo successivo non interagisce con il backdrop.
 */
export async function navigateTo(page: Page, isMobile: boolean | undefined, target: 'watchlist' | 'home'): Promise<void> {
  if (!isMobile) {
    await page
      .locator(target === 'watchlist' ? '.nebula-nav-watchlist' : 'header.MuiAppBar-root a[href="#/"]')
      .first()
      .click();
    return;
  }
  await page.locator('header.MuiAppBar-root button.MuiIconButton-root').first().click();
  const drawer = page.locator('.MuiDrawer-paper');
  await expect(drawer).toBeVisible();
  await drawer.locator(target === 'watchlist' ? '.nebula-drawer-watchlist a' : 'a[href="#/home"]').click();
  await expect(drawer).toBeHidden();
}
