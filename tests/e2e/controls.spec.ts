import { expect, installNebula, sessionFor, test } from './fixtures';

test.describe('Controlli glass', () => {
  test('select nativa: popup glass al posto del picker, valore scritto sulla select originale', async ({ page }, info) => {
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await page.goto('/web/#/mypreferencesplayback');
    await expect(page.locator('html.nebula-active')).toHaveCount(1, { timeout: 20_000 });
    const select = page
      .locator('.page:not(.hide) select:not([multiple])')
      .filter({ has: page.locator('option:nth-child(2)') })
      .first();
    await select.scrollIntoViewIfNeeded();
    await expect(select).toBeVisible();
    const before = await select.inputValue();
    await select.click();
    const pop = page.getByRole('listbox');
    await expect(pop).toBeVisible();
    await page.screenshot({ path: `test-results/screenshots/controls-select-${info.project.name}.png` });
    const target = pop
      .getByRole('option')
      .filter({ hasNot: page.locator('[aria-selected="true"]') })
      .and(pop.locator('[aria-selected="false"]:not([aria-disabled])'))
      .first();
    const label = (await target.textContent())!.replace('check', '').trim();
    await target.click();
    await expect(pop).toHaveCount(0);
    const after = await select.inputValue();
    expect(after).not.toBe(before);
    expect(await select.evaluate((el: HTMLSelectElement) => el.selectedOptions[0]!.text.trim())).toBe(label);
  });

  test('select da tastiera: Spazio apre, frecce + Invio scelgono, Esc chiude', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Tastiera solo desktop');
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await page.goto('/web/#/mypreferencesplayback');
    await expect(page.locator('html.nebula-active')).toHaveCount(1, { timeout: 20_000 });
    const select = page
      .locator('.page:not(.hide) select:not([multiple])')
      .filter({ has: page.locator('option:nth-child(2)') })
      .first();
    await select.focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(select).toBeFocused();
  });

  test('checkbox e toggle Jellyfin con stile glass, logica invariata', async ({ page }, info) => {
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await page.goto('/web/#/mypreferencesplayback');
    await expect(page.locator('html.nebula-active')).toHaveCount(1, { timeout: 20_000 });
    const label = page.locator('.page:not(.hide) label.emby-checkbox-label').first();
    await label.scrollIntoViewIfNeeded();
    const input = label.locator('input.emby-checkbox');
    const was = await input.isChecked();
    await label.locator('.checkboxOutline').click();
    expect(await input.isChecked()).toBe(!was);
    const bg = await label.locator('.checkboxOutline').evaluate((el) => getComputedStyle(el).backgroundImage);
    if (!was) expect(bg).toContain('gradient');
    await page.screenshot({ path: `test-results/screenshots/controls-checkbox-${info.project.name}.png` });
  });
});

test.describe('Tooltip e controlli KefinTweaks', () => {
  test('tooltip glass al posto di quello di sistema; categorie home nascoste', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Hover solo con puntatore');
    const s = await sessionFor('curator');
    await installNebula(page, s);
    await page.goto('/web/#/home');
    await expect(page.locator('html.nebula-active')).toHaveCount(1, { timeout: 20_000 });
    // Un elemento con title nella navbar o nella home (Jellyfin o plugin).
    // Bersaglio stabile: si marca il primo elemento con title nella navbar (il title verrà spostato).
    const text = await page
      .locator('header.MuiAppBar-root [title]')
      .filter({ visible: true })
      .first()
      .evaluate((el) => {
        el.setAttribute('data-test-tip', '');
        return el.getAttribute('title');
      });
    const target = page.locator('[data-test-tip]');
    await target.hover();
    await expect(page.locator('.nebula-tooltip.is-visible')).toHaveText(text!);
    await expect(target).not.toHaveAttribute('title', /.+/);
    await expect(page.locator('.nebula-navcats')).toHaveCount(0);
    await expect(page.locator('#kefin-home-category-rail')).toBeHidden();
  });
});

test.describe('Jellyfin Enhanced', () => {
  test('nessun segnaposto {{icon:…}} nei testi JE (correttivo per «Use Icons» spento)', async ({ page }) => {
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await page.goto('/web/#/home');
    await page.waitForFunction(
      () => (window as unknown as { JellyfinEnhanced?: { initialized?: boolean } }).JellyfinEnhanced?.initialized === true,
      undefined,
      {
        timeout: 30_000,
      },
    );
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { JellyfinEnhanced: { t(k: string): string } }).JellyfinEnhanced.t('jellyseerr_modal_toast_select_season')),
      )
      .not.toContain('{{icon:');
  });
});

test.describe('Tema unico', () => {
  test('nessun selettore di skin (pulsante Aspetto) e niente Active Streams in navbar', async ({ page }) => {
    const s = await sessionFor('viewer');
    await installNebula(page, s);
    await page.goto('/web/#/home');
    await expect(page.locator('html.nebula-active')).toHaveCount(1, { timeout: 20_000 });
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--biaflix-nebula').trim() === '1');
    await expect(page.locator('[data-kefin-custom-menu-top-right*="toggleAppearancePopover"]').filter({ visible: true })).toHaveCount(0);
    // Navbar essenziale: niente «Active Streams» di JE.
    await expect(page.locator('#je-active-streams').filter({ visible: true })).toHaveCount(0);
  });
});
