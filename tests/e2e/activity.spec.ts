import { apiCall, expect, gotoHome, installNebula, sessionFor, test } from './fixtures';

/** Plugin e Native Tab reali; configurazione e dati sintetici intercettati solo nel browser. */
test.beforeEach(async ({ page }) => {
  const s = await sessionFor('viewer');
  const { Items: movies } = await apiCall<{ Items: { Id: string }[] }>(s, 'GET', `/Items?userId=${s.userId}&recursive=true&includeItemTypes=Movie&limit=1`);
  const id = movies[0]!.Id;
  const config = {
    ActivityFeedEnabled: true,
    ActivityFeedUseNativeTab: true,
    ActivityFeedUseCustomTabs: false,
    ActivityFeedShowWatched: true,
    ActivityFeedShowFavorited: true,
    ActivityFeedShowReviewed: true,
    ActivityFeedShowActiveStreams: true,
    ActiveStreamsEnabled: true,
  };
  await installNebula(page, s);
  for (const path of ['bootstrap', 'public-config']) {
    await page.route(`**/JellyfinEnhanced/${path}*`, async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      Object.assign(path === 'bootstrap' ? data.PublicConfig : data, config);
      await route.fulfill({ response, json: data });
    });
  }
  // I media sintetici hanno poster e backdrop: usa il backdrop come miniatura JE.
  await page.route(`**/Items/${id}/Images/Thumb*`, async (route) => {
    const url = new URL(route.request().url());
    url.pathname = url.pathname.replace('/Images/Thumb', '/Images/Backdrop/0');
    const response = await route.fetch({ url: url.toString() });
    await route.fulfill({ response });
  });
  const item = { Id: id, Name: 'Una notte tra le stelle', HasPrimaryImage: true };
  const user = { UserId: s.userId, UserName: 'Bia', UserHasPrimaryImage: false };
  await page.route(/\/JellyfinEnhanced\/activity(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        items: [
          {
            ...user,
            Item: {
              ...item,
              HasThumbImage: true,
              SeriesName: 'Le cronache di Nebula — un titolo molto lungo per verificare la leggibilità',
              SeasonNumber: 1,
              EpisodeNumber: 2,
            },
            ActivityType: 'Watched',
            Timestamp: Date.now() - 3600000,
            Progress: 0.32,
            Completed: false,
          },
          { ...user, Item: item, ActivityType: 'Watched', Timestamp: Date.now() - 7200000, Completed: true },
          {
            ...user,
            Item: item,
            ActivityType: 'Reviewed',
            Timestamp: Date.now() - 1800000,
            Rating: 4.5,
            Content: 'Una storia coinvolgente, con una fotografia bellissima e personaggi che rimangono impressi. Da rivedere insieme.',
          },
          { ...user, Item: { Id: id, Name: 'Un preferito senza immagine' }, ActivityType: 'Favorited', Timestamp: Date.now() - 5400000 },
        ],
      },
    }),
  );
  await page.route('**/JellyfinEnhanced/active-streams/sessions*', (route) =>
    route.fulfill({
      json: [
        {
          ...user,
          NowPlayingItem: { ...item, RunTimeTicks: 6000000000, ImageTags: { Primary: 'test' } },
          PlayState: { PositionTicks: 1800000000, IsPaused: false },
        },
      ],
    }),
  );
  await gotoHome(page);
  const marker = page.locator('.jellyfinenhanced.activity');
  await expect(marker).toHaveCount(1);
  const tab = await marker.evaluate((el) => el.closest('.tabContent')!.getAttribute('data-index'));
  await page.evaluate((index) => {
    location.hash = `#/home?tab=${index}`;
  }, tab);
  await expect(page.locator('.je-activity-feed')).toBeVisible();
  await expect(page.locator('.je-activity-row')).toHaveCount(5);
});

test('stream, cronologia e recensioni: schede leggibili e layout responsive', async ({ page }, info) => {
  await expect(page.locator('.je-activity-section')).toHaveCount(3);
  await expect(page.locator('.je-activity-progress-fill').first()).toHaveCSS('background-image', /linear-gradient/);
  await expect(page.locator('.je-activity-rating-star')).toHaveCount(5);
  const rows = page.locator('.je-activity-row');
  const history = rows.nth(1);
  const body = (await history.locator('.je-activity-body').boundingBox())!;
  expect(body.width).toBeGreaterThan(120);
  await expect(history.locator('.je-activity-line')).toHaveCSS('white-space', 'normal');
  const refresh = page.locator('.je-activity-refresh-btn');
  expect((await refresh.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  if (info.project.name === 'chromium-1366') {
    for (const width of [320, 390, 600, 768, 1024, 1366, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px`).toBe(true);
      const panel = (await page.locator('.je-activity-section').nth(1).boundingBox())!;
      for (const row of await rows.all()) {
        const rect = (await row.boundingBox())!;
        expect(rect.x + rect.width).toBeLessThanOrEqual(width);
      }
      expect(panel.width).toBeGreaterThan(200);
    }
    await page.setViewportSize({ width: 1366, height: 768 });
  }
  await expect
    .poll(() =>
      page
        .locator('.je-activity-feed img')
        .evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)),
    )
    .toBe(true);
  await page.screenshot({ path: `test-results/screenshots/activity-populated-${info.project.name}.png`, fullPage: true });
});

test('aggiorna in pagina, stato vuoto ed errori recuperabili', async ({ page }, info) => {
  await page.route(/\/JellyfinEnhanced\/activity(?:\?|$)/, (route) => route.fulfill({ json: { items: [] } }));
  await page.route('**/JellyfinEnhanced/active-streams/sessions*', (route) => route.fulfill({ json: [] }));
  const refresh = page.locator('.je-activity-refresh-btn');
  await refresh.click();
  await expect(page.locator('.je-activity-empty')).toHaveCount(3);
  await expect(page.locator('.je-activity-row')).toHaveCount(0);
  await expect(refresh).toBeEnabled();
  await page.screenshot({ path: `test-results/screenshots/activity-empty-${info.project.name}.png`, fullPage: true });
  await page.route(/\/JellyfinEnhanced\/activity(?:\?|$)/, (route) => route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
  await refresh.click();
  await expect(page.locator('.je-activity-error')).toHaveCount(2);
  await expect(refresh).toBeEnabled();
  await page.route(/\/JellyfinEnhanced\/activity(?:\?|$)/, (route) => route.fulfill({ json: { items: [] } }));
  await refresh.click();
  await expect(page.locator('.je-activity-error')).toHaveCount(0);
  await expect(page.locator('.je-activity-empty')).toHaveCount(3);
});

test('permessi stream, navigazione al titolo e movimento ridotto', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.je-activity-refresh-btn .material-icons')).toHaveCSS('transition-duration', '0s');
  await page.route('**/JellyfinEnhanced/active-streams/sessions*', (route) => route.fulfill({ status: 403, json: {} }));
  await page.locator('.je-activity-refresh-btn').click();
  await expect(page.locator('.je-activity-section')).toHaveCount(2);
  const link = page.locator('.je-activity-item-name').first();
  if (!isMobile) {
    await page.locator('.je-activity-refresh-btn').focus();
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Enter');
  } else await link.click();
  await expect(page).toHaveURL(/details\?id=/);
  await expect(page.locator('.nebula-detail-hero')).toBeVisible();
});
