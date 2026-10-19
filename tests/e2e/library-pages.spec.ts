import { apiCall, expect, gotoHome, installNebula, sessionFor, test } from './fixtures';

interface View {
  Id: string;
  CollectionType?: string;
}

const SECOND_TOOLBAR = 'header.MuiAppBar-root:not(.dashboard-appBar) > .MuiToolbar-root + .MuiToolbar-root';

test('Film, Serie TV e Preferiti: stessa pagina catalogo di Watchlist e Raccolte', async ({ page }, info) => {
  const s = await sessionFor('viewer');
  const views = (await apiCall<{ Items: View[] }>(s, 'GET', `/UserViews?userId=${s.userId}`)).Items;
  const movies = views.find((v) => v.CollectionType === 'movies')!;
  const shows = views.find((v) => v.CollectionType === 'tvshows')!;
  const favorite = (await apiCall<{ Items: { Id: string }[] }>(s, 'GET', `/Items?userId=${s.userId}&recursive=true&includeItemTypes=Movie&limit=1`)).Items[0]!;
  const wasFavorite = (await apiCall<{ IsFavorite: boolean }>(s, 'GET', `/UserItems/${favorite.Id}/UserData?userId=${s.userId}`)).IsFavorite;
  await apiCall(s, 'POST', `/UserFavoriteItems/${favorite.Id}?userId=${s.userId}`);
  try {
    await installNebula(page, s);
    await gotoHome(page);
    const pages = [
      { hash: `#/movies?topParentId=${movies.Id}&collectionType=movies`, host: '#moviesPage', filters: ['Tutti', 'Da vedere', 'In corso', 'Visti'] },
      { hash: `#/tv?topParentId=${shows.Id}&collectionType=tvshows`, host: '.libraryPage', filters: ['Tutti', 'Da vedere', 'Visti'] },
      { hash: '#/home?tab=1', host: '#indexPage', filters: ['Tutti', 'Film', 'Serie TV', 'Episodi'] },
    ];
    const titleTops: number[] = [];
    for (const p of pages) {
      await page.goto(`/web/${p.hash}`);
      const catalog = page.locator(`${p.host} > .nebula-catalog`);
      await expect(catalog.locator('.nebula-card').first()).toBeVisible();
      // Né il selettore «Film ▾» né i pulsanti MUI: la seconda riga della navbar è nascosta.
      await expect(page.locator(SECOND_TOOLBAR)).toBeHidden();
      await expect(catalog.locator('.nebula-catalog__count')).toHaveText(/\d+ titol/);
      await expect(catalog.getByRole('group', { name: 'Filtra' }).getByRole('button')).toHaveText(p.filters);
      titleTops.push((await catalog.locator('.nebula-catalog__title').boundingBox())!.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/screenshots/catalog-${p.host.replace(/\W/g, '')}-${info.project.name}.png` });
    }
    // Watchlist e Raccolte: stessa intestazione, alla stessa altezza.
    for (const hash of ['#/home?nebula=watchlist', '#/boxsets']) {
      await page.goto(`/web/${hash}`);
      const title = page.locator('.nebula-catalog .nebula-catalog__title');
      await expect(title).toBeVisible();
      titleTops.push((await title.boundingBox())!.y);
    }
    expect(Math.max(...titleTops) - Math.min(...titleTops)).toBeLessThanOrEqual(2);

    // Filtro e ordinamento funzionano e restano dopo un dettaglio + Indietro.
    await page.goto(`/web/${pages[0]!.hash}`);
    const catalog = page.locator('#moviesPage > .nebula-catalog');
    await expect(catalog.locator('.nebula-card').first()).toBeVisible();
    await catalog.locator('select').selectOption('year');
    const years = async () => (await catalog.locator('.nebula-card__meta').allTextContents()).map((y) => Number(y.slice(0, 4)));
    await expect
      .poll(async () => {
        const list = await years();
        return list.length > 1 && list.every((y, i) => i === 0 || list[i - 1]! >= y);
      })
      .toBe(true);
    await catalog.locator('a.nebula-card__media').first().click();
    await expect(page).toHaveURL(/#\/details\?/);
    // Indietro solo a dettagli caricati: il view manager nativo non gestisce un «indietro» istantaneo.
    await expect(page.locator('#itemDetailPage:not(.hide) .nebula-detail-hero')).toBeVisible();
    await page.goBack();
    await expect(catalog.locator('select')).toHaveValue('year');
    await catalog.getByRole('button', { name: 'Visti', exact: true }).click();
    await expect(catalog.getByRole('button', { name: 'Visti', exact: true })).toHaveAttribute('aria-pressed', 'true');

    // Uscendo dalla libreria la toolbar nativa torna dove serve.
    await page.goto('/web/#/home');
    await expect(page.locator('html.nebula-catalog-mode')).toHaveCount(0);
  } finally {
    if (!wasFavorite) await apiCall(s, 'DELETE', `/UserFavoriteItems/${favorite.Id}?userId=${s.userId}`);
  }
});

test('libreria: se il catalogo non si carica resta la vista nativa', async ({ page }) => {
  const s = await sessionFor('viewer');
  const movies = (await apiCall<{ Items: View[] }>(s, 'GET', `/UserViews?userId=${s.userId}`)).Items.find((v) => v.CollectionType === 'movies')!;
  await installNebula(page, s);
  await gotoHome(page);
  // Solo la richiesta del catalogo Nebula (ordinamento esplicito + includeItemTypes singolo) fallisce.
  await page.route('**/Items?*', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('parentId') === movies.Id && url.searchParams.get('fields')?.includes('CanDelete')) return route.fulfill({ status: 503 });
    return route.fallback();
  });
  await page.goto(`/web/#/movies?topParentId=${movies.Id}&collectionType=movies`);
  await expect(page.locator('#moviesPage .card').first()).toBeVisible();
  await expect(page.locator('.nebula-catalog')).toHaveCount(0);
  await expect(page.locator(SECOND_TOOLBAR)).toBeVisible();
});

test('navbar: Watchlist ↔ Preferiti ↔ Home nella stessa view home (router React, niente hashchange)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Su telefono i link sono nel menu laterale (mobile-layout.spec.ts)');
  await installNebula(page, await sessionFor('viewer'));
  await gotoHome(page);
  const header = page.locator('header.MuiAppBar-root');
  for (let i = 0; i < 2; i++) {
    await header.locator('.nebula-nav-watchlist').click();
    await expect(page.locator('#indexPage > .nebula-watchlist-page')).toBeVisible();
    await expect(page.locator('.nebula-favorites-page')).toHaveCount(0);
    await header.locator('a[href="#/home?tab=1"]').click();
    await expect(page.locator('#indexPage > .nebula-favorites-page')).toBeVisible();
    await expect(page.locator('.nebula-watchlist-page')).toHaveCount(0);
  }
  await header.locator('a[href="#/"]').first().click();
  await expect(page.locator('.nebula-hero')).toBeVisible();
  await expect(page.locator('.nebula-catalog')).toHaveCount(0);
});
