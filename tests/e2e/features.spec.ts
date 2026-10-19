import { apiCall, expect, gotoHome, installNebula, sessionFor, test, type Session } from './fixtures';

async function movieId(s: Session, name: string): Promise<string> {
  const r = await apiCall<{ Items: { Id: string; Name: string }[] }>(
    s,
    'GET',
    `/Items?userId=${s.userId}&recursive=true&includeItemTypes=Movie&searchTerm=${encodeURIComponent(name)}`,
  );
  return r.Items.find((i) => i.Name === name)!.Id;
}

async function likes(s: Session, id: string): Promise<boolean> {
  const r = await apiCall<{ UserData?: { Likes?: boolean } }>(s, 'GET', `/Items/${id}?userId=${s.userId}`);
  return r.UserData?.Likes === true;
}

test.describe.configure({ mode: 'serial' });

test.describe('Watchlist (UserData.Likes)', () => {
  test('aggiungi/rimuovi dalla pagina dettagli, persistente e visibile in home', async ({ page, consoleErrors }, info) => {
    const s = await sessionFor('viewer');
    const id = await movieId(s, 'Neon Halloween');
    if (await likes(s, id)) await apiCall(s, 'DELETE', `/UserItems/${id}/Rating`);

    await installNebula(page, s);
    await page.goto(`/web/#/details?id=${id}&serverId=${s.serverId}`);
    const btn = page.locator('#itemDetailPage:not(.hide) .mainDetailButtons .nebula-watchlist-btn');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => likes(s, id)).toBe(true);
    // Non è un Preferito: le due liste restano distinte.
    const fav = await apiCall<{ UserData?: { IsFavorite?: boolean } }>(s, 'GET', `/Items/${id}?userId=${s.userId}`);
    expect(fav.UserData?.IsFavorite).toBe(false);
    await page.screenshot({ path: `docs/screenshots/details-${info.project.name}.png` });

    await gotoHome(page);
    await expect(page.locator('.nebula-rail--watchlist .nebula-card', { hasText: 'Neon Halloween' })).toBeVisible();

    await page.goto(`/web/#/details?id=${id}&serverId=${s.serverId}`);
    await page.locator('#itemDetailPage:not(.hide) .mainDetailButtons .nebula-watchlist-btn[aria-pressed="true"]').click();
    await expect.poll(() => likes(s, id)).toBe(false);
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('Hero', () => {
  test('Riproduci usa il player nativo di Jellyfin', async ({ page }) => {
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await gotoHome(page);
    await page
      .locator('.nebula-hero__slide.is-active')
      .getByRole('button', { name: /Riproduci|Riprendi/ })
      .click();
    await expect(page).toHaveURL(/#\/video/, { timeout: 20_000 });
    await expect(page.locator('video')).toHaveCount(1);
  });

  test('navigazione manuale e nessun autoplay di default', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Su mobile i controlli prev/next sono nascosti (swipe/dots)');
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await gotoHome(page);
    const active = page.locator('.nebula-hero__slide.is-active');
    const first = await active.getAttribute('data-index');
    await page.getByRole('button', { name: 'Successivo' }).click();
    await expect(active).not.toHaveAttribute('data-index', first ?? '0');
    await expect(page.locator('.nebula-hero__dot[aria-current="true"]')).toHaveCount(1);
  });
});

test.describe('Card native', () => {
  test('quick action raggiungibili da tastiera senza bloccare il click della card', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Su touch si usa il menu contestuale nativo');
    const s = await sessionFor('curator');
    await installNebula(page, s);
    await gotoHome(page);
    const card = page.locator('#homeTab .homeSectionsContainer .card[data-type="Movie"]').first();
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    const actions = card.locator('.nebula-card-actions');
    await expect(actions).toBeVisible();
    await actions.getByRole('button', { name: 'Aggiungi a…' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: /Aggiungi «.+» a…/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Il click sulla card (overlay nativo, lontano dai pulsanti) apre ancora i dettagli.
    const box = (await card.locator('.cardScalable').boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.6);
    await expect(page).toHaveURL(/#\/details\?id=/);
  });
});

test.describe('Layout', () => {
  test('mobile: hero compatto, nessun overflow, max 2 CTA visibili', async ({ page, isMobile }, info) => {
    test.skip(!isMobile, 'Solo mobile');
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await gotoHome(page);
    const hero = page.locator('.nebula-hero');
    await expect(hero).toBeVisible();
    const h = await hero.evaluate((el) => el.getBoundingClientRect().height / window.innerHeight);
    expect(h).toBeGreaterThan(0.45);
    expect(h).toBeLessThan(0.7);
    const visibleCtas = await page.locator('.nebula-hero__slide.is-active .nebula-hero__action-host > *:visible').count();
    expect(visibleCtas).toBeLessThanOrEqual(2);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `docs/screenshots/home-${info.project.name}.png` });
  });

  test('reduced motion: nessuna trasformazione al hover delle card', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Hover solo desktop');
    const s = await sessionFor('viewer');
    await installNebula(page, s, { reducedMotion: true });
    await gotoHome(page);
    const card = page.locator('#homeTab .homeSectionsContainer .card[data-type="Movie"]').first();
    await card.hover();
    const transform = await card.locator('.cardScalable').evaluate((el) => getComputedStyle(el).transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
  });

  test('la dashboard admin non riceve lo stile Nebula', async ({ page }) => {
    const s = await sessionFor('admin');
    await installNebula(page, s);
    await page.goto('/web/#/dashboard');
    await expect(page.locator('body.dashboardDocument')).toHaveCount(1, { timeout: 20_000 });
    const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--jf-palette-primary-main').trim());
    expect(bg.toLowerCase()).not.toBe('#854bff');
  });
});
