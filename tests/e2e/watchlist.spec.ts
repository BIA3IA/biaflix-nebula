import { apiCall, expect, gotoHome, installNebula, sessionFor, test } from './fixtures';
import type { BaseItem } from '../../src/scripts/jellyfin-api';

const href = '#/home?nebula=watchlist';

test('watchlist pagina: navigazione, sincronizzazione, errori e layout', async ({ page, isMobile }, info) => {
  const session = await sessionFor('viewer');
  const library = await apiCall<{ Items: BaseItem[] }>(
    session,
    'GET',
    `/Items?userId=${session.userId}&recursive=true&includeItemTypes=Movie,Series&limit=2&fields=PrimaryImageAspectRatio`,
  );
  let items = library.Items.map((item) => ({ ...item, UserData: { ...item.UserData, Likes: true } }));
  let failure = false;
  await installNebula(page, session);
  await page.route('**/Items?*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('filters') !== 'Likes') return route.fallback();
    await route.fulfill(failure ? { status: 503, body: 'unavailable' } : { json: { Items: items, TotalRecordCount: items.length } });
  });
  await page.route('**/UserItems/*/Rating?*', async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    const id = new URL(route.request().url()).pathname.split('/').at(-2);
    items = items.filter((item) => item.Id !== id);
    await route.fulfill({ json: { Likes: null } });
  });
  await gotoHome(page);
  const desktopLink = page.locator('header .nebula-nav-watchlist');
  if (!isMobile) {
    await expect(desktopLink).toBeVisible();
    expect(await desktopLink.evaluate((link) => link.previousElementSibling?.getAttribute('href'))).toBe('#/home?tab=1');
  }
  const link = isMobile ? page.locator('.nebula-bottomnav [data-key="watchlist"]') : desktopLink;
  await expect(link).toHaveAttribute('href', href);
  await link.click();
  const view = page.locator('#indexPage > .nebula-watchlist-page');
  await expect(view).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(view.locator('.nebula-card')).toHaveCount(2);
  await expect(link).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.nebula-hero')).toHaveCount(0);
  await expect(page.locator('#homeTab')).toBeHidden();
  await page.reload();
  await expect(view.locator('.nebula-card')).toHaveCount(2);
  await page.screenshot({ path: `test-results/screenshots/watchlist-${info.project.name}.png` });
  for (const width of [320, 390, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 844 });
    const bounds = await view.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize(info.project.use.viewport!);
  await view.locator('a.nebula-card__media').first().click();
  await expect(page).toHaveURL(/#\/details\?/);
  await expect(view).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/#\/home\?nebula=watchlist/);
  await expect(view.locator('.nebula-card')).toHaveCount(2);
  await page.goForward();
  await expect(page).toHaveURL(/#\/details\?/);
  await expect(view).toHaveCount(0);
  await page.goBack();
  await expect(view.locator('.nebula-card')).toHaveCount(2);
  await view.getByRole('button', { name: 'Rimuovi dalla watchlist' }).first().click();
  await expect(view.locator('.nebula-card')).toHaveCount(1);
  await view.getByRole('button', { name: 'Rimuovi dalla watchlist' }).click();
  await expect(view.locator('.nebula-card')).toHaveCount(0);
  await expect(view.getByRole('status')).toContainText('La tua watchlist è vuota');
  failure = true;
  await view.getByRole('button', { name: 'Aggiorna' }).click();
  await expect(view.getByRole('status')).toContainText('Operazione non riuscita');
  failure = false;
  items = library.Items.map((item) => ({ ...item, UserData: { ...item.UserData, Likes: true } }));
  await view.getByRole('button', { name: 'Aggiorna' }).click();
  await expect(view.locator('.nebula-card')).toHaveCount(2);
  await page.goto('/web/#/home');
  await expect(page.locator('.nebula-hero')).toBeVisible();
  await expect(view).toHaveCount(0);
  await expect(page.locator('#homeTab')).toBeVisible();
});

test('watchlist: link diretto e caricamento oltre la prima pagina', async ({ page }) => {
  await installNebula(page, await sessionFor('viewer'));
  const items = Array.from({ length: 61 }, (_, i) => ({
    Id: i.toString(16).padStart(32, '0'),
    Name: `Titolo ${i + 1}`,
    Type: 'Movie',
    UserData: { Likes: true },
  }));
  await page.route('**/Items?*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('filters') !== 'Likes') return route.fallback();
    await route.fulfill({ json: { Items: items.slice(0, Number(url.searchParams.get('limit'))), TotalRecordCount: items.length } });
  });
  await page.goto(`/web/${href}`);
  const view = page.locator('#indexPage > .nebula-watchlist-page');
  await expect(view.locator('.nebula-card')).toHaveCount(60);
  await view.getByRole('button', { name: 'Carica altri titoli' }).click();
  await expect(view.locator('.nebula-card')).toHaveCount(61);
  await expect(view.getByRole('button', { name: 'Carica altri titoli' })).toBeHidden();
  await expect(view.locator('.nebula-chip')).toHaveText('61 titoli');
});
