import { apiCall, expect, gotoHome, installNebula, navigateTo, sessionFor, test, type Session } from './fixtures';

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
    const btn = page.locator('.nebula-detail-hero .ndh__actions .nebula-watchlist-btn');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => likes(s, id)).toBe(true);
    // Non è un Preferito: le due liste restano distinte.
    const fav = await apiCall<{ UserData?: { IsFavorite?: boolean } }>(s, 'GET', `/Items/${id}?userId=${s.userId}`);
    expect(fav.UserData?.IsFavorite).toBe(false);
    await page.screenshot({ path: `test-results/screenshots/details-${info.project.name}.png` });

    await gotoHome(page);
    await expect(page.locator('.nebula-rail--watchlist .nebula-card', { hasText: 'Neon Halloween' })).toBeVisible();

    await page.goto(`/web/#/details?id=${id}&serverId=${s.serverId}`);
    await page.locator('.nebula-detail-hero .ndh__actions .nebula-watchlist-btn[aria-pressed="true"]').click();
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
    // Ricerca nativa: card native in qualunque configurazione (Film/Serie usano ora il catalogo Nebula).
    await page.goto('/web/#/search?query=Comfort');
    await expect(page.locator('html.nebula-active')).toHaveCount(1, { timeout: 20_000 });
    const card = page.locator('.page:not(.hide) .card[data-type="Movie"]').filter({ visible: true }).first();
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
  test('mobile: hero panoramica nitida, nessun overflow, max 2 CTA visibili', async ({ page, isMobile }, info) => {
    test.skip(!isMobile, 'Solo mobile');
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await gotoHome(page);
    const hero = page.locator('.nebula-hero');
    await expect(hero).toBeVisible();
    const h = await hero.evaluate((el) => el.getBoundingClientRect().height / window.innerHeight);
    expect(h).toBeGreaterThan(0.6);
    expect(h).toBeLessThanOrEqual(0.95);
    // Stessa hero panoramica del desktop, senza locandina verticale né sfocatura.
    const poster = page.locator('.nebula-hero__slide.is-active .nebula-hero__poster');
    await expect(poster).toBeHidden();
    await expect(hero.locator('.is-active .nebula-hero__backdrop')).toHaveCSS('filter', 'none');
    const visibleCtas = await page.locator('.nebula-hero__slide.is-active .nebula-hero__action-host > *:visible').count();
    expect(visibleCtas).toBeLessThanOrEqual(2);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/screenshots/home-${info.project.name}.png` });
  });

  test('reduced motion: nessuna trasformazione al hover delle card', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Hover solo desktop');
    const s = await sessionFor('viewer');
    await installNebula(page, s, { reducedMotion: true });
    // Ricerca nativa: card native (Film/Serie usano il catalogo Nebula).
    await page.goto('/web/#/search?query=Comfort');
    await expect(page.locator('html.nebula-active')).toHaveCount(1, { timeout: 20_000 });
    const card = page.locator('.page:not(.hide) .card[data-type="Movie"]').filter({ visible: true }).first();
    await card.scrollIntoViewIfNeeded();
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

  test('mobile: nessuna barra in basso, header essenziale, drawer glass fluttuante', async ({ page, isMobile }, info) => {
    test.skip(!isMobile, 'Solo mobile');
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await gotoHome(page);
    await expect(page.locator('.nebula-bottomnav')).toHaveCount(0);
    // Header mobile: menu, logo, Trasmetti, ricerca, profilo (SyncPlay nascosto, raggiungibile dal player).
    const bar = page.locator('header.MuiAppBar-root').first();
    await expect(bar.locator('a[href^="#/search"]')).toBeVisible();
    await expect(bar.locator('[aria-controls="app-remote-play-menu"]')).toBeVisible();
    await expect(bar.locator('[aria-controls="app-sync-play-menu"]')).toBeHidden();
    // Navigazione reale verso la libreria Film dal menu laterale.
    await bar.locator('button').first().click();
    const paper = page.locator('.MuiDrawer-paper').first();
    await paper.locator('a[href*="collectionType=movies"]').click();
    await expect(page).toHaveURL(/#\/movies\?topParentId=/);
    await expect(paper).toBeHidden();
    // Drawer: pannello staccato dai bordi e arrotondato.
    await bar.locator('button').first().click();
    await expect(paper).toBeVisible();
    // Attende la fine dello slide-in, poi verifica che il pannello sia staccato dai bordi.
    await expect.poll(async () => (await paper.boundingBox())?.x ?? -1).toBeGreaterThanOrEqual(8);
    expect((await paper.boundingBox())!.y).toBeGreaterThanOrEqual(8);
    expect(parseFloat(await paper.evaluate((el) => getComputedStyle(el).borderTopRightRadius))).toBeGreaterThanOrEqual(16);
    await page.screenshot({ path: `test-results/screenshots/drawer-${info.project.name}.png` });
    // Nel player la barra non compare.
    await page.keyboard.press('Escape');
  });
});

test.describe('Navbar: watchlist e categorie home', () => {
  test('link Watchlist apre la pagina con i titoli salvati sul server', async ({ page, isMobile }, info) => {
    const s = await sessionFor('viewer');
    const id = await movieId(s, 'Comfort Club');
    const wasListed = await likes(s, id);
    try {
      await apiCall(s, 'POST', `/UserItems/${id}/Rating?userId=${s.userId}&likes=true`);
      await installNebula(page, s);
      await gotoHome(page);
      await navigateTo(page, isMobile, 'watchlist');
      const view = page.locator('#indexPage > .nebula-watchlist-page');
      await expect(view.locator('.nebula-card', { hasText: 'Comfort Club' })).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.screenshot({ path: `test-results/screenshots/watchlist-server-${info.project.name}.png` });
      await view.locator('.nebula-card', { hasText: 'Comfort Club' }).locator('a.nebula-card__media').click();
      await expect(page).toHaveURL(/#\/details\?id=/);
      await expect(view).toHaveCount(0);
    } finally {
      if (!wasListed) await apiCall(s, 'DELETE', `/UserItems/${id}/Rating?userId=${s.userId}`);
    }
  });

  test('home standard raggiungibile senza selettore Home/Discover', async ({ page, isMobile }, info) => {
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await gotoHome(page);
    const group = page.getByRole('group', { name: 'Sezioni della home' });
    await expect(group).toHaveCount(0);
    await expect(page.locator('#kefin-home-category-rail')).toBeHidden();
    await page
      .locator('#kefin-home-category-rail .kefin-home-category-item[data-category-id="discovery"] button')
      .evaluate((button: HTMLButtonElement) => button.click());
    await page.goto('/web/#/search');
    await navigateTo(page, isMobile, 'home');
    await expect(page.locator('#kefin-home-category-rail .kefin-home-category-item[data-category-id="none"]')).toHaveClass(/is-active/);
    await expect(page.locator('.nebula-hero')).toBeVisible();
    await expect(group).toHaveCount(0);
    await page.screenshot({
      path: `test-results/screenshots/navbar-categories-${info.project.name}.png`,
      clip: { x: 0, y: 0, width: Math.min(1366, page.viewportSize()!.width), height: 110 },
    });
  });
});
