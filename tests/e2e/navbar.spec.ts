import { expect, gotoHome, installNebula, sessionFor, test } from './fixtures';

test('navbar essenziale: senza Home/Discover né il pulsante Active Streams', async ({ page, isMobile }, info) => {
  const s = await sessionFor('viewer');
  await installNebula(page, s);
  for (const path of ['bootstrap', 'public-config']) {
    await page.route(`**/JellyfinEnhanced/${path}*`, async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      Object.assign(path === 'bootstrap' ? data.PublicConfig : data, { ActiveStreamsEnabled: true, ActiveStreamsAllUsers: true });
      await route.fulfill({ response, json: data });
    });
  }
  await page.route('**/JellyfinEnhanced/active-streams/sessions*', (route) => route.fulfill({ json: [] }));
  await gotoHome(page);
  await expect(page.locator('#je-active-streams')).toHaveCount(1);
  await expect(page.locator('#je-active-streams')).toHaveCSS('display', 'none');
  await expect(page.locator('.nebula-navcats')).toHaveCount(0);
  await expect(page.locator('#kefin-home-category-rail')).toBeHidden();
  await expect(page.locator('[data-je-header-action="je-active-streams"]')).toBeHidden();
  await expect(page.locator('.nebula-hero')).toBeVisible();
  // Anche tornando da una categoria Scopri già selezionata, resta accessibile la home completa.
  const standard = page.locator('#kefin-home-category-rail .kefin-home-category-item[data-category-id="none"]');
  await expect(standard).toHaveClass(/is-active/);
  await page
    .locator('#kefin-home-category-rail .kefin-home-category-item[data-category-id="discovery"] button')
    .evaluate((button: HTMLButtonElement) => button.click());
  await page.evaluate(() => {
    location.hash = '#/home?tab=1';
  });
  await expect(page).toHaveURL(/tab=1/);
  await page.evaluate(() => {
    location.hash = '#/home';
  });
  await expect(standard).toHaveClass(/is-active/);
  await expect(page.locator('.nebula-hero')).toBeVisible();
  const watchlist = page.locator(isMobile ? '.nebula-bottomnav [data-key="watchlist"]' : '.nebula-nav-watchlist');
  await expect(watchlist).toBeVisible();
  await watchlist.click();
  await expect(page.locator('.nebula-watchlist-page')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('.nebula-watchlist-page')).toHaveCount(0);
  await page
    .locator(isMobile ? '.nebula-bottomnav [data-key="home"]' : 'header.MuiAppBar-root a[href="#/"]')
    .first()
    .click();
  await expect(page.locator('.nebula-hero')).toBeVisible();
  await page.screenshot({ path: `test-results/screenshots/navbar-simple-${info.project.name}.png` });
});
