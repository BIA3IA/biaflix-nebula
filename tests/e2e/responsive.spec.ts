/**
 * Matrice responsive delle pagine dettagli (brief §10): film, film senza backdrop, serie, stagione, episodio
 * a 320/390/600/768/1024/1366/1920 px. Per ogni combinazione: nessuno scroll orizzontale del documento,
 * navbar utilizzabile, screenshot in test-results/screenshots/details/<SHOT_TAG>/.
 * SHOT_TAG=before|after (default after). Solo i progetti desktop (la larghezza è impostata dal test).
 */
import { apiCall, expect, installNebula, sessionFor, test, type Session } from './fixtures';

const WIDTHS = [320, 390, 600, 768, 1024, 1366, 1920];
const TAG = process.env.SHOT_TAG ?? 'after';
/** NEBULA_AUDIT_ONLY=1: registra i problemi senza fallire (screenshot «prima» della versione precedente). */
const AUDIT_ONLY = process.env.NEBULA_AUDIT_ONLY === '1';

interface Target {
  key: string;
  find: (s: Session) => Promise<string>;
}

async function byName(s: Session, type: string, name: string): Promise<string> {
  const r = await apiCall<{ Items: { Id: string; Name: string }[] }>(
    s,
    'GET',
    `/Items?userId=${s.userId}&recursive=true&includeItemTypes=${type}&searchTerm=${encodeURIComponent(name)}`,
  );
  const hit = r.Items.find((i) => i.Name === name) ?? r.Items[0];
  if (!hit) throw new Error(`${type} ${name} non trovato`);
  return hit.Id;
}

const TARGETS: Target[] = [
  { key: 'movie', find: (s) => byName(s, 'Movie', 'Orbita Viola') },
  { key: 'movie-nobackdrop', find: (s) => byName(s, 'Movie', 'Il Faro Ciano') },
  { key: 'series', find: (s) => byName(s, 'Series', 'Nebula Station') },
  {
    key: 'season',
    find: async (s) => {
      const id = await byName(s, 'Series', 'Nebula Station');
      const r = await apiCall<{ Items: { Id: string }[] }>(s, 'GET', `/Shows/${id}/Seasons?userId=${s.userId}`);
      return r.Items[0]!.Id;
    },
  },
  {
    key: 'episode',
    find: async (s) => {
      const id = await byName(s, 'Series', 'Nebula Station');
      const r = await apiCall<{ Items: { Id: string }[] }>(s, 'GET', `/Shows/${id}/Episodes?userId=${s.userId}&limit=1`);
      return r.Items[0]!.Id;
    },
  },
];

/** Elementi che sporgono oltre il viewport fuori da contenitori scrollabili/clippati: i veri colpevoli. */
function overflowCulprits(): string[] {
  const vw = document.documentElement.clientWidth;
  const out: string[] = [];
  const clipped = (el: Element) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      // Contenitori che ritagliano/scorrono e discendenti di elementi fixed non allargano il documento.
      if (cs.overflowX !== 'visible' || cs.position === 'fixed') return true;
    }
    return false;
  };
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= vw + 1) continue;
    if (getComputedStyle(el).position === 'fixed' || clipped(el)) continue;
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '';
    out.push(`${el.tagName.toLowerCase()}${id}${cls} right=${Math.round(r.right)}`);
  }
  return out.slice(0, 8);
}

test.describe('Dettagli responsive', () => {
  test.skip(({ isMobile }) => isMobile, 'Le larghezze sono impostate dal test');
  test.describe.configure({ mode: 'serial' });

  for (const target of TARGETS) {
    test(`${target.key}: nessuno scroll orizzontale a ${WIDTHS.join('/')}`, async ({ page, consoleErrors }, info) => {
      test.setTimeout(180_000); // 7 larghezze con screenshot a pagina intera
      const s = await sessionFor('curator');
      const id = await target.find(s);
      await installNebula(page, s);
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto(`/web/#/details?id=${id}&serverId=${s.serverId}`);
      await expect(page.locator('html.nebula-active')).toHaveCount(1, { timeout: 20_000 });
      await expect(page.locator('#itemDetailPage:not(.hide)')).toBeVisible();
      const failures: string[] = [];
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: width < 700 ? 860 : 900 });
        // Attende che il layout si stabilizzi (immagini lazy, sezioni asincrone dei plugin).
        // Condizione concreta (non networkidle: JE fa polling periodico): immagini caricate e font pronti.
        await page
          .waitForFunction(
            () =>
              document.fonts.status === 'loaded' &&
              Array.from(document.images).every((i) => {
                const r = i.getBoundingClientRect();
                return i.complete || r.bottom < 0 || r.top > innerHeight || r.width === 0;
              }),
            undefined,
            { timeout: 10_000 },
          )
          .catch(() => undefined);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 1) failures.push(`${width}px: +${overflow}px ← ${(await page.evaluate(overflowCulprits)).join(' | ')}`);
        await page.screenshot({ path: `test-results/screenshots/details/${TAG}/${target.key}-${width}-${info.project.name}.png`, fullPage: true });
      }
      if (AUDIT_ONLY) {
        console.log(`[audit ${target.key}] ${failures.length ? failures.join(' || ') : 'nessun overflow'}`);
        return;
      }
      expect(failures, failures.join('\n')).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  }
});

test.describe('Navbar responsive', () => {
  test.skip(({ isMobile }) => isMobile, 'Le larghezze sono impostate dal test');

  test(`nessuna sovrapposizione o taglio a ${WIDTHS.join('/')}, drawer da tastiera sotto 900px`, async ({ page }, info) => {
    const s = await sessionFor('curator');
    await installNebula(page, s);
    await page.goto('/web/#/home');
    await expect(page.locator('html.nebula-active')).toHaveCount(1, { timeout: 20_000 });
    const problems: string[] = [];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const report = await page.evaluate(() => {
        const bar = document.querySelector('header.MuiAppBar-root > .MuiToolbar-root')!;
        const barRect = bar.getBoundingClientRect();
        // Elementi interattivi visibili della barra (link, pulsanti, avatar), incluse le aggiunte dei plugin.
        const els = Array.from(bar.querySelectorAll<HTMLElement>('a, button')).filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden]');
        });
        const out: string[] = [];
        const name = (el: HTMLElement) => (el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 30);
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (r.left < barRect.left - 1 || r.right > barRect.right + 1) out.push(`fuori barra: ${name(el)}`);
        }
        for (let i = 0; i < els.length; i++)
          for (let j = i + 1; j < els.length; j++) {
            if (els[i]!.contains(els[j]!) || els[j]!.contains(els[i]!)) continue;
            const a = els[i]!.getBoundingClientRect();
            const b = els[j]!.getBoundingClientRect();
            const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (ox > 2 && oy > 2) out.push(`sovrapposti: ${name(els[i]!)} ↔ ${name(els[j]!)}`);
          }
        return out;
      });
      if (report.length) problems.push(`${width}px: ${report.join('; ')}`);
      await page.screenshot({
        path: `test-results/screenshots/details/${TAG}/navbar-${width}-${info.project.name}.png`,
        clip: { x: 0, y: 0, width, height: 110 },
      });
    }
    expect(problems, problems.join('\n')).toEqual([]);

    // Drawer glass (unico, nativo MUI) da tastiera e touch sotto i 900px.
    await page.setViewportSize({ width: 390, height: 800 });
    const menuBtn = page.locator('header.MuiAppBar-root .MuiToolbar-root > button').first();
    await menuBtn.focus();
    await page.keyboard.press('Enter');
    const paper = page.locator('.MuiDrawer-paper').filter({ visible: true }).first();
    await expect(paper).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(paper).toBeHidden();
    await expect(page.locator('[data-kefin-desktop-hamburger]').filter({ visible: true })).toHaveCount(0);
  });
});
