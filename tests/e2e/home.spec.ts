import { expect, gotoHome, installNebula, sessionFor, test } from './fixtures';

test.describe('Homepage Nebula', () => {
  test('hero, navbar glass e rail senza errori JS', async ({ page, consoleErrors }, info) => {
    const s = await sessionFor('curator');
    await installNebula(page, s);
    await gotoHome(page);

    const hero = page.locator('.nebula-hero');
    await expect(hero).toBeVisible();
    await expect(hero.locator('.nebula-hero__slide.is-active .nebula-hero__title')).toBeVisible();
    await expect(hero.locator('.nebula-hero__slide.is-active [data-action="play"], .nebula-hero__slide.is-active [data-action="resume"]')).toBeVisible();

    const bar = page.locator('header.MuiAppBar-root').first();
    await expect(bar).toBeVisible();
    const radius = await bar.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    expect(parseFloat(radius)).toBeGreaterThanOrEqual(20);

    await expect(page.locator('.nebula-rail--collections')).toBeVisible();
    await expect(page.locator('.nebula-rail--watchlist')).toBeVisible();

    // Un solo hero, nessun doppio hamburger introdotto da Nebula.
    await expect(page.locator('.nebula-hero')).toHaveCount(1);
    await page.screenshot({ path: `test-results/screenshots/home-${info.project.name}.png`, fullPage: false });
    expect(consoleErrors).toEqual([]);
  });

  test('nessun overflow orizzontale della pagina', async ({ page }) => {
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await gotoHome(page);
    await expect(page.locator('.nebula-hero')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('senza skin attiva Nebula JS resta spento', async ({ page }) => {
    const s = await sessionFor('viewer');
    await installNebula(page, s, { skin: false });
    await page.goto('/web/#/home');
    await page.waitForFunction(() => (window as unknown as { BiaflixNebula?: unknown }).BiaflixNebula !== undefined);
    await expect(page.locator('#homeTab .homeSectionsContainer .card').filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
    expect(await page.evaluate(() => (window as unknown as { BiaflixNebula: { state: string } }).BiaflixNebula.state)).toBe('idle');
    await expect(page.locator('html.nebula-active')).toHaveCount(0);
    await expect(page.locator('.nebula-hero')).toHaveCount(0);
  });

  test('cambio skin a runtime: smonta tutto e ripristina', async ({ page }) => {
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await gotoHome(page);
    await expect(page.locator('.nebula-hero')).toBeVisible();
    await page.evaluate(() => document.querySelector('link[data-skin="Biaflix Nebula"]')?.remove());
    await expect(page.locator('html.nebula-active')).toHaveCount(0);
    await expect(page.locator('.nebula-root')).toHaveCount(0);
  });
});
