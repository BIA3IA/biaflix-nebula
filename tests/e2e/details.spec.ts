/**
 * Pagina dettagli Nebula: funzioni native preservate, nessuna duplicazione, stagioni/episodi, cast, menu.
 * Ambiente reale: KefinTweaks 0.5.1 + Jellyfin Enhanced 12.12 installati in locale (pnpm dev:plugins).
 */
import { apiCall, expect, installNebula, sessionFor, test, type Session } from './fixtures';

async function idOf(s: Session, type: string, name: string): Promise<string> {
  const r = await apiCall<{ Items: { Id: string; Name: string }[] }>(
    s,
    'GET',
    `/Items?userId=${s.userId}&recursive=true&includeItemTypes=${type}&searchTerm=${encodeURIComponent(name)}`,
  );
  return (r.Items.find((i) => i.Name === name) ?? r.Items[0]!).Id;
}

async function openDetails(page: import('@playwright/test').Page, s: Session, id: string): Promise<void> {
  await page.goto(`/web/#/details?id=${id}&serverId=${s.serverId}`);
  await expect(page.locator('.nebula-detail-hero.is-ready')).toBeVisible({ timeout: 20_000 });
}

test.describe('Pagina dettagli Nebula', () => {
  test('serie: un solo hero, un solo Riproduci, nessuna sezione nativa duplicata', async ({ page, consoleErrors }) => {
    const s = await sessionFor('curator');
    await installNebula(page, s);
    await openDetails(page, s, await idOf(s, 'Series', 'Nebula Station'));
    await expect(page.locator('.nebula-detail-hero')).toHaveCount(1);
    await expect(page.locator('.ndh__play')).toHaveCount(1);
    await expect(page.locator('#itemDetailPage:not(.hide) .mainDetailButtons .btnPlay').filter({ visible: true })).toHaveCount(0);
    // Sezioni sostituite: nascoste (stagioni native, episodi KefinTweaks, prossimo, cast, simili nativi).
    for (const sel of [
      '#childrenCollapsible',
      '#listChildrenCollapsible',
      '.nextUpSection',
      '.series-episodes-section',
      '#castCollapsible',
      '#similarCollapsible',
    ]) {
      await expect(page.locator(`#itemDetailPage:not(.hide) ${sel}`).filter({ visible: true }), sel).toHaveCount(0);
    }
    await expect(page.locator('.nebula-episodes')).toHaveCount(1);
    // Breadcrumb KefinTweaks nascosti (navbar essenziale).
    await expect(page.locator('#kefinTweaks-breadcrumbs-wrapper').filter({ visible: true })).toHaveCount(0);
    await expect(page.locator('.nebula-cast')).toHaveCount(1);
    expect(consoleErrors).toEqual([]);
  });

  test('stagioni ed episodi: cambio stagione e Play episodio con il player nativo', async ({ page }) => {
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await openDetails(page, s, await idOf(s, 'Series', 'Nebula Station'));
    const tabs = page.getByRole('tablist', { name: 'Seleziona la stagione' });
    await expect(tabs.getByRole('tab')).toHaveCount(2);
    await tabs.getByRole('tab').nth(1).click();
    await expect(tabs.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.nep')).toHaveCount(2);
    await expect(page.locator('.nep__title').first()).toContainText('Ritorno al modulo');
    // Tastiera: frecce tra le schede.
    await tabs.getByRole('tab').nth(1).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(tabs.getByRole('tab').first()).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.nep')).toHaveCount(3);
    await page
      .locator('.nep')
      .first()
      .getByRole('button', { name: /^Riproduci / })
      .click();
    await expect(page).toHaveURL(/#\/video/, { timeout: 20_000 });
  });

  test('Riproduci dell’hero usa il pulsante nativo (film)', async ({ page }) => {
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await openDetails(page, s, await idOf(s, 'Movie', 'Orbita Viola'));
    await page.locator('.ndh__play').click();
    await expect(page).toHaveURL(/#\/video/, { timeout: 20_000 });
  });

  test('cast: ritratti circolari 1:1, nome e ruolo, «Mostra tutto»', async ({ page }) => {
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await openDetails(page, s, await idOf(s, 'Movie', 'Orbita Viola'));
    const frame = page.locator('.ncast__frame').first();
    await frame.scrollIntoViewIfNeeded();
    const box = (await frame.boundingBox())!;
    expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
    expect(await frame.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe('50%');
    await expect(page.locator('.ncast').first().locator('.ncast__role')).not.toBeEmpty();
    // Persone senza foto: iniziali, non grandi ovali vuoti.
    await expect(page.locator('.ncast__img--empty').first()).toHaveText(/^[A-Z]{1,2}$/);
    const showAll = page.locator('.nebula-cast .nebula-section__header button');
    await expect(showAll).toHaveText(/Mostra tutto \(14\)/);
    await showAll.click();
    await expect(showAll).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.ncast.is-extra').first()).toBeVisible();
  });

  test('«Altre azioni»: azioni native (preferiti, visto, …) senza duplicati, tastiera', async ({ page }) => {
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    const id = await idOf(s, 'Movie', 'Comfort Club');
    await openDetails(page, s, id);
    const more = page.getByRole('button', { name: 'Altre azioni' });
    await more.click();
    const menu = page.getByRole('menu', { name: 'Altre azioni' });
    await expect(menu).toBeVisible();
    const labels = await menu.getByRole('menuitem').or(menu.getByRole('menuitemcheckbox')).allTextContents();
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.join('|')).toMatch(/Aggiungi a…/);
    // Preferito: azione nativa, persistita sul server.
    const fav = menu.getByRole('menuitemcheckbox', { name: /preferit/i });
    await expect(fav).toHaveAttribute('aria-checked', 'false');
    await fav.click();
    await expect
      .poll(async () => (await apiCall<{ UserData: { IsFavorite: boolean } }>(s, 'GET', `/Items/${id}?userId=${s.userId}`)).UserData.IsFavorite)
      .toBe(true);
    await apiCall(s, 'DELETE', `/UserFavoriteItems/${id}?userId=${s.userId}`);
    // Tastiera: apertura con freccia giù, chiusura con Esc e focus di ritorno.
    await more.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menu', { name: 'Altre azioni' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu', { name: 'Altre azioni' })).toHaveCount(0);
    await expect(more).toBeFocused();
  });

  test('dettagli tecnici a scomparsa e fallback senza backdrop', async ({ page }) => {
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await openDetails(page, s, await idOf(s, 'Movie', 'Il Faro Ciano'));
    await expect(page.locator('.ndh--no-backdrop .ndh__backdrop--ambient')).toHaveCount(1);
    const primary = page.locator('#itemDetailPage:not(.hide) .detailPagePrimaryContainer');
    await expect(primary).toBeHidden();
    const toggle = page.getByRole('button', { name: 'Dettagli tecnici, tracce e tag' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(primary).toBeVisible();
    await expect(page.locator('#itemDetailPage:not(.hide) .itemTags')).toBeVisible();
  });

  test('skin disattivata a caldo: la pagina nativa torna intatta', async ({ page }) => {
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await openDetails(page, s, await idOf(s, 'Series', 'Nebula Station'));
    await page.evaluate(() => document.querySelector('link[data-skin="Biaflix Nebula"]')?.remove());
    await expect(page.locator('.nebula-detail-hero')).toHaveCount(0);
    await expect(page.locator('#itemDetailPage.nebula-detail')).toHaveCount(0);
    await expect(page.locator('#itemDetailPage:not(.hide) .mainDetailButtons')).toBeVisible();
  });
});
