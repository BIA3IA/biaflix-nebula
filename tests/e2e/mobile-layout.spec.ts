import { apiCall, expect, gotoHome, installNebula, sessionFor, test } from './fixtures';

// Anche Firefox desktop esercita queste larghezze: gli errori non dipendono dal solo user agent mobile.
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

test('hero in evidenza sopravvive al ridisegno nativo della home', async ({ page }, info) => {
  const s = await sessionFor('viewer');
  await installNebula(page, s);
  const featured = await apiCall<{ Items: { Id: string; Name: string }[] }>(
    s,
    'GET',
    `/Items?userId=${s.userId}&recursive=true&includeItemTypes=Movie,Series&fields=Overview,Genres&imageTypes=Backdrop&limit=2`,
  );
  expect(featured.Items).toHaveLength(2);
  await page.route('**/Items?*', async (route) => {
    const query = new URL(route.request().url()).searchParams;
    if (query.get('includeItemTypes') === 'BoxSet') {
      const response = await route.fetch();
      const data = await response.json();
      data.Items.unshift({ Id: 'nebula-featured-mobile', Name: 'In evidenza', Type: 'BoxSet' });
      await route.fulfill({ response, json: data });
    } else if (query.get('parentId') === 'nebula-featured-mobile') {
      await route.fulfill({ json: { Items: featured.Items, TotalRecordCount: featured.Items.length } });
    } else await route.continue();
  });
  await gotoHome(page);
  const hero = page.locator('.nebula-hero');
  await expect(hero).toBeVisible();
  await expect(hero.locator('.nebula-chip--featured').first()).toHaveText(/In evidenza|Featured/);
  await expect(hero.locator('.nebula-hero__slide')).toHaveCount(2);
  await expect(hero.locator('.is-active .nebula-hero__title')).toHaveAccessibleName(featured.Items[0]!.Name);
  await expect(hero.locator('.is-active .nebula-hero__backdrop')).toHaveCSS('filter', 'none');
  await expect(hero.locator('.is-active .nebula-hero__poster')).toBeHidden();
  await hero.locator('.nebula-hero__dot').nth(1).click();
  // homesections/KefinTweaks possono ricostruire la home dopo il mount Nebula.
  await page.locator('#homeTab').evaluate((tab) => tab.querySelector('.nebula-hero')!.remove());
  await expect(page.locator('#homeTab > .nebula-hero')).toBeVisible();
  await expect(hero.locator('.is-active .nebula-hero__title')).toHaveAccessibleName(featured.Items[1]!.Name);
  await hero.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 280, clientY: 200 });
  await hero.dispatchEvent('pointerup', { pointerType: 'touch', clientX: 100, clientY: 200 });
  await expect(hero.locator('.is-active .nebula-hero__title')).toHaveAccessibleName(featured.Items[0]!.Name);
  await expect(page.locator('#homeTab > :first-child')).toHaveClass(/nebula-hero/);
  await expect
    .poll(() => hero.locator('.is-active .nebula-hero__backdrop').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  for (const viewport of [
    { width: 320, height: 620 },
    { width: 390, height: 844 },
    { width: 768, height: 620 },
  ]) {
    await page.setViewportSize(viewport);
    const badge = (await hero.locator('.is-active .nebula-chip--featured').boundingBox())!;
    const header = (await page.locator('header.MuiAppBar-root').first().boundingBox())!;
    expect(badge.y).toBeGreaterThanOrEqual(header.y + header.height + 12);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `test-results/screenshots/mobile-featured-${info.project.name}.png` });
});

test('menu laterale: unica navigazione mobile, con la Watchlist', async ({ page }, info) => {
  const s = await sessionFor('viewer');
  await installNebula(page, s);
  await gotoHome(page);
  await expect(page.locator('.nebula-bottomnav')).toHaveCount(0);
  await page.locator('header.MuiAppBar-root button.MuiIconButton-root').first().click();
  const drawer = page.locator('.MuiDrawer-paper');
  for (const href of ['#/home', '#/home?tab=1', '#/home?nebula=watchlist']) await expect(drawer.locator(`a[href="${href}"]`)).toBeVisible();
  for (const kind of ['movies', 'tvshows', 'boxsets']) await expect(drawer.locator(`a[href*="collectionType=${kind}"]`)).toBeVisible();
  // «Watchlist» subito dopo «Preferiti».
  expect(await drawer.locator('.nebula-drawer-watchlist').evaluate((li) => li.previousElementSibling?.querySelector('a')?.getAttribute('href'))).toBe(
    '#/home?tab=1',
  );
  await page.screenshot({ path: `test-results/screenshots/mobile-drawer-${info.project.name}.png` });
  await drawer.locator('.nebula-drawer-watchlist a').click();
  await expect(drawer).toBeHidden();
  await expect(page.locator('.nebula-watchlist-page')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('header.MuiAppBar-root button.MuiIconButton-root').first().click();
  await expect(drawer.locator('.nebula-drawer-watchlist a')).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Escape');
  await page.goBack();
  await expect(page.locator('.nebula-watchlist-page')).toHaveCount(0);
});

test('dettagli serie: etichetta Riproduci e codice episodio distanziati', async ({ page }, info) => {
  const s = await sessionFor('viewer');
  const r = await apiCall<{ Items: { Id: string }[] }>(s, 'GET', `/Items?userId=${s.userId}&recursive=true&includeItemTypes=Series&searchTerm=Nebula Station`);
  await installNebula(page, s);
  await page.goto(`/web/#/details?id=${r.Items[0]!.Id}&serverId=${s.serverId}`);
  const label = page.locator('.ndh__play-label');
  await expect(label.locator('small')).toBeVisible();
  for (const width of [320, 360, 390, 430, 600, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const gap = await label.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el.firstChild!);
      return el.querySelector('small')!.getBoundingClientRect().top - range.getBoundingClientRect().bottom;
    });
    expect(gap, `${width}px`).toBeGreaterThanOrEqual(4);
    const play = (await page.locator('.ndh__play').boundingBox())!;
    const code = (await label.locator('small').boundingBox())!;
    expect(code.y + code.height).toBeLessThan(play.y + play.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `test-results/screenshots/mobile-details-${info.project.name}.png`, fullPage: true });
});

test('navbar senza sovrapposizioni con i pulsanti JE attivi e logo Home raggiungibile', async ({ page }, info) => {
  const s = await sessionFor('viewer');
  await installNebula(page, s);
  for (const path of ['bootstrap', 'public-config']) {
    await page.route(`**/JellyfinEnhanced/${path}*`, async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      Object.assign(path === 'bootstrap' ? data.PublicConfig : data, {
        CalendarPageEnabled: true,
        CalendarUseNativeTab: true,
        ActivityFeedEnabled: true,
        ActivityFeedUseNativeTab: true,
        ActiveStreamsEnabled: true,
        ActiveStreamsAllUsers: true,
      });
      await route.fulfill({ response, json: data });
    });
  }
  await page.route('**/JellyfinEnhanced/active-streams/sessions*', (route) => route.fulfill({ json: [] }));
  await gotoHome(page);
  await page.waitForFunction(() => (window as any).JellyfinEnhanced?.initialized === true);
  for (const width of [320, 360, 390, 430, 600, 768, 899]) {
    await page.setViewportSize({ width, height: 844 });
    const logo = page.locator('.nebula-nav-home');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('href', '#/home');
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const toolbar = document.querySelector('header.MuiAppBar-root > .MuiToolbar-root')!;
            const bar = toolbar.getBoundingClientRect();
            const buttons = [...toolbar.querySelectorAll<HTMLElement>('a, button')].filter(
              (el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden',
            );
            const problems: string[] = [];
            for (let i = 0; i < buttons.length; i++) {
              const a = buttons[i]!.getBoundingClientRect();
              if (a.left < bar.left - 1 || a.right > bar.right + 1) problems.push('fuori barra');
              for (const b of buttons.slice(i + 1)) {
                if (buttons[i]!.contains(b) || b.contains(buttons[i]!)) continue;
                const r = b.getBoundingClientRect();
                if (Math.min(a.right, r.right) - Math.max(a.left, r.left) > 2 && Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top) > 2)
                  problems.push('sovrapposizione');
              }
            }
            return problems;
          }),
        { message: `${width}px` },
      )
      .toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.nebula-nav-home').click();
  await expect(page.locator('.nebula-hero')).toBeVisible();
  await page.screenshot({ path: `test-results/screenshots/mobile-navbar-${info.project.name}.png` });
});
