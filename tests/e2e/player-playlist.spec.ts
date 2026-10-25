import { apiCall, expect, installNebula, sessionFor, test } from './fixtures';

test('player: nessuna barra flottante residua e header OSD in cima al video', async ({ page }, info) => {
  const s = await sessionFor('viewer');
  const movie = (await apiCall<{ Items: { Id: string }[] }>(s, 'GET', `/Items?userId=${s.userId}&recursive=true&includeItemTypes=Movie&limit=1`)).Items[0]!;
  await installNebula(page, s);
  await page.goto(`/web/#/details?id=${movie.Id}&serverId=${s.serverId}`);
  await page.locator('.ndh__play').first().click();
  await expect(page).toHaveURL(/#\/video/, { timeout: 20_000 });
  const header = page.locator('.skinBody > .skinHeader.osdHeader');
  await expect(header).toBeAttached();
  // L'AppBar vuota del layout Modern non deve disegnare la barra glass né spingere giù l'OSD.
  await expect(page.locator('header.MuiAppBar-root:not(.dashboard-appBar)')).toBeHidden();
  await expect.poll(async () => (await header.boundingBox())?.y ?? -1).toBeLessThanOrEqual(1);
  await page.mouse.move(400, 300);
  await page.screenshot({ path: `test-results/screenshots/player-osd-${info.project.name}.png` });
});

test('playlist: elenco verticale leggibile nonostante le griglie episodi dei plugin', async ({ page, isMobile }, info) => {
  const s = await sessionFor('viewer');
  const episodes = (await apiCall<{ Items: { Id: string }[] }>(s, 'GET', `/Items?userId=${s.userId}&recursive=true&includeItemTypes=Episode&limit=8`)).Items;
  const { Id } = await apiCall<{ Id: string }>(s, 'POST', '/Playlists', {
    Name: 'zzE2E playlist',
    Ids: episodes.map((e) => e.Id),
    UserId: s.userId,
    MediaType: 'Video',
  });
  try {
    await installNebula(page, s);
    await page.goto(`/web/#/details?id=${Id}&serverId=${s.serverId}`);
    const rows = page.locator('#listChildrenCollapsible .listItem');
    await expect(rows).toHaveCount(episodes.length);
    // Telefono: layout mobile di Jellyfin; desktop: larghezze da finestra/tablet in su.
    for (const width of isMobile ? [320, 390] : [1024, 1366, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const geometry = await rows.evaluateAll((els) =>
        els.map((el) => ({ x: Math.round(el.getBoundingClientRect().x), text: el.querySelector('.listItemBodyText')?.getBoundingClientRect().width ?? 0 })),
      );
      expect(new Set(geometry.map((g) => g.x)).size, 'una sola colonna').toBe(1);
      for (const g of geometry) expect(g.text, 'titolo leggibile').toBeGreaterThan(80);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.screenshot({ path: `test-results/screenshots/playlist-${info.project.name}.png` });
  } finally {
    await apiCall(s, 'DELETE', `/Items/${Id}`);
  }
});

test('playlist esistente: «Aggiungi titoli» dalla sua pagina, salvato sul server', async ({ page }, info) => {
  const s = await sessionFor('viewer');
  const episodes = (await apiCall<{ Items: { Id: string }[] }>(s, 'GET', `/Items?userId=${s.userId}&recursive=true&includeItemTypes=Episode&limit=2`)).Items;
  const { Id } = await apiCall<{ Id: string }>(s, 'POST', '/Playlists', {
    Name: 'zzE2E add',
    Ids: episodes.map((e) => e.Id),
    UserId: s.userId,
    MediaType: 'Video',
  });
  try {
    await installNebula(page, s);
    await page.goto(`/web/#/details?id=${Id}&serverId=${s.serverId}`);
    await expect(page.locator('#listChildrenCollapsible .listItem')).toHaveCount(2);
    await page.locator('#itemDetailPage:not(.hide) .nebula-playlist-add').click();
    const dialog = page.getByRole('dialog', { name: /Aggiungi titoli/ });
    await expect(dialog).toBeVisible();
    const add = dialog.getByRole('button', { name: 'Aggiungi titoli', exact: true });
    await expect(add).toBeDisabled();
    await dialog.getByRole('button', { name: 'Film', exact: true }).click();
    await dialog.locator('.nebula-picker__label').first().click();
    await expect(add).toBeEnabled();
    await page.screenshot({ path: `test-results/screenshots/playlist-add-${info.project.name}.png` });
    await add.click();
    await expect
      .poll(async () => (await apiCall<{ TotalRecordCount: number }>(s, 'GET', `/Playlists/${Id}/Items?userId=${s.userId}`)).TotalRecordCount)
      .toBe(3);
    await expect(page.locator('#listChildrenCollapsible .listItem')).toHaveCount(3);
  } finally {
    await apiCall(s, 'DELETE', `/Items/${Id}`);
  }
});
