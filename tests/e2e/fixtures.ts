import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';
import { DEV_USERS, login } from '../../dev/seed.mjs';

export const BASE = process.env.NEBULA_DEV_URL ?? 'http://127.0.0.1:8097';
const DIST = resolve(import.meta.dirname, '../../dist');
const TYPES: Record<string, string> = { '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.map': 'application/json' };

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
export async function installNebula(page: Page, s: Session, opts: { skin?: boolean; reducedMotion?: boolean } = {}): Promise<void> {
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
    ({ base, s, skin }) => {
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
    { base: BASE, s, skin: opts.skin ?? true },
  );
  if (opts.reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
}

export const KNOWN_CONSOLE_NOISE = [/favicon/i, /serviceworker/i, /Failed to load resource.*(404|401)/i, /ResizeObserver loop/i, /chromecast|cast_sender/i];

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
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
