import { expect, gotoHome, installNebula, sessionFor, test } from './fixtures';

/** Renderer JE reale, eventi sintetici: non servono Sonarr/Radarr né dati di produzione. */
test.beforeEach(async ({ page }) => {
  const s = await sessionFor('viewer');
  await installNebula(page, s);
  await page.route('**/JellyfinEnhanced/arr/calendar?*', async (route) => {
    const date = new Date(new URL(route.request().url()).searchParams.get('start')!);
    date.setHours(18, 30, 0, 0);
    await route.fulfill({
      json: {
        events: [
          {
            id: 'nebula-episode',
            title: 'Le cronache di Nebula — un titolo molto lungo per verificare il layout',
            subtitle: 'S02E04 • Il ritorno',
            type: 'Series',
            source: 'Sonarr',
            releaseType: 'Episode',
            releaseDate: date.toISOString(),
            monitored: true,
            hasFile: false,
          },
          {
            id: 'nebula-movie',
            title: 'Una notte tra le stelle',
            type: 'Movie',
            source: 'Radarr',
            releaseType: 'CinemaRelease',
            releaseDate: date.toISOString(),
            monitored: true,
            hasFile: false,
          },
        ],
      },
    });
  });
  await page.route('**/JellyfinEnhanced/arr/calendar/user-data', (route) => route.fulfill({ json: { userData: [] } }));
  await page.route('**/JellyfinEnhanced/arr/requests?*', (route) => route.fulfill({ json: { requests: [], totalPages: 1 } }));
  await gotoHome(page);
  await page.waitForFunction(() => !!(window as any).JellyfinEnhanced?.calendarPage);
  await page.evaluate(() => {
    const je = (window as any).JellyfinEnhanced;
    // Esercita la pagina dedicata anche se l'istanza locale usa Plugin Pages.
    je.pluginConfig.CalendarPageEnabled = true;
    je.pluginConfig.CalendarUsePluginPages = false;
    je.calendarPage.initialize();
    je.calendarPage.showPage();
    je.calendarPage.setViewMode('agenda');
  });
  await expect(page.locator('.je-calendar-agenda-event')).toHaveCount(2);
});

test('agenda glass: leggibilità, navigazione, filtri e layout senza overflow', async ({ page, isMobile }, info) => {
  const title = page.locator('.je-calendar-title');
  const before = await title.innerText();
  const active = page.locator('.je-calendar-view-btn.active');
  await expect(active).toHaveCSS('background-image', /linear-gradient/);
  await expect(page.locator('.je-calendar-agenda-row')).toHaveCSS('border-radius', '22px');
  for (const button of await page.locator('.je-calendar-header button:visible').all()) {
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  await page.locator('.je-calendar-nav-btn').last().click();
  await expect(title).not.toHaveText(before);
  await page.locator('.je-calendar-nav-today').click();
  await expect(title).toHaveText(before);
  if (isMobile) await page.locator('.je-calendar-sidebar-toggle').click();
  const episode = page.locator('.je-calendar-legend-item').filter({ hasText: /Episode|Episodio/ });
  await episode.click();
  await expect(episode).toHaveClass(/active/);
  await expect(page.locator('.je-calendar-agenda-event')).toHaveCount(1);
  await expect(page.locator('.je-calendar-agenda-title-text')).toContainText('Le cronache');
  await page.locator('.je-calendar-filter-invert').click();
  await expect(page.locator('.je-calendar-agenda-title-text')).toHaveText('Una notte tra le stelle');
  await page.locator('.je-calendar-filter-invert').click();
  await episode.click();
  await expect(page.locator('.je-calendar-agenda-event')).toHaveCount(2);
  if (isMobile) {
    await page.locator('.je-calendar-sidebar-toggle').click();
    await expect(page.locator('.je-calendar-sidebar-toggle')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.je-calendar-sidebar-content')).toHaveCSS('max-height', '0px');
    const sidebar = (await page.locator('.je-calendar-sidebar').boundingBox())!;
    const agenda = (await page.locator('.je-calendar-agenda').boundingBox())!;
    expect(agenda.y - sidebar.y - sidebar.height).toBeLessThanOrEqual(24);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/screenshots/calendar-agenda-${info.project.name}.png`, fullPage: true });
});

test('giorno, settimana, mese e modalità di visualizzazione mantengono eventi e controlli', async ({ page }, info) => {
  for (const mode of ['day', 'week', 'month']) {
    await page.locator(`.je-calendar-view-btn[onclick*="'${mode}'"]`).click();
    await expect(page.locator('.je-calendar-event')).toHaveCount(2);
    await expect(page.locator('.je-calendar-view-btn.active')).toHaveCSS('background-image', /linear-gradient/);
    await page.locator('[data-mode="cards"]').click();
    await expect(page.locator('.je-calendar-card')).toHaveCount(2);
    await page.locator('[data-mode="backdrop"]').click();
    await expect(page.locator('.je-calendar-event')).toHaveCount(2);
    await page.locator('[data-mode="list"]').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.screenshot({ path: `test-results/screenshots/calendar-month-${info.project.name}.png`, fullPage: true });
});

test('stato vuoto, movimento ridotto e focus da tastiera', async ({ page, isMobile }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.je-calendar-agenda-row')).toHaveCSS('transition-duration', '0s');
  if (!isMobile) {
    const today = page.locator('.je-calendar-nav-today');
    await today.focus();
    await expect(today).toBeFocused();
    await expect(today).toHaveCSS('outline-style', 'solid');
  }
  await page.route('**/JellyfinEnhanced/arr/calendar?*', (route) => route.fulfill({ json: { events: [] } }));
  await page.evaluate(() => (window as any).JellyfinEnhanced.calendarPage.refresh());
  await expect(page.locator('.je-calendar-empty')).toBeVisible();
  await expect(page.locator('.je-calendar-empty')).toHaveCSS('border-radius', '22px');
  await page.screenshot({ path: `test-results/screenshots/calendar-empty-${info.project.name}.png`, fullPage: true });
});

test('calendario responsive da 320 a 1920px: nessun taglio o sovrapposizione alla navbar', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-1366', 'Matrice aggiuntiva di larghezze su Chromium desktop');
  for (const width of [320, 600, 768, 900, 1024, 1450, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const mode of ['agenda', 'month']) {
      await page.locator(`.je-calendar-view-btn[onclick*="'${mode}'"]`).click();
      await expect(page.locator(mode === 'agenda' ? '.je-calendar-agenda-event' : '.je-calendar-event')).toHaveCount(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${mode} a ${width}px`).toBe(true);
      const title = (await page.locator('.je-calendar-title').boundingBox())!;
      const navbar = (await page.locator('header.MuiAppBar-root').first().boundingBox())!;
      expect(title.y, `${mode} a ${width}px`).toBeGreaterThanOrEqual(navbar.y + navbar.height);
    }
  }
});
