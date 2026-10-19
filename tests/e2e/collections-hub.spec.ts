import { expect, gotoHome, installNebula, sessionFor, test } from './fixtures';

for (const route of ['boxsets', 'playlists']) {
  test(`hub ${route}: solo creazione raccolta e playlist`, async ({ page, isMobile }, info) => {
    await installNebula(page, await sessionFor('curator'));
    await gotoHome(page);
    await page.goto(`/web/#/${route}`);
    const hub = page.locator(`#${route}Page .nebula-hub`);
    await expect(hub).toBeVisible();
    const actions = hub.locator('.nebula-hub__actions');
    await expect(actions.getByRole('button')).toHaveCount(2);
    await expect(hub.getByRole('button', { name: /Vista classica|Classic view/ })).toHaveCount(0);

    for (const title of ['Nuova raccolta', 'Nuova playlist']) {
      await actions.getByRole('button', { name: title, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: title, exact: true });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Annulla', exact: true }).click();
      await expect(dialog).toHaveCount(0);
    }

    if (isMobile) await page.setViewportSize({ width: 320, height: 740 });
    for (const button of await actions.getByRole('button').all()) {
      await expect(button).toBeInViewport();
      const bounds = await button.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
    // Il bordo sinistro deve continuare il viola, senza una copia del ciano a destra.
    const primary = actions.getByRole('button', { name: 'Nuova raccolta', exact: true });
    const height = await primary.evaluate((button) => button.getBoundingClientRect().height);
    const png = await primary.screenshot({ animations: 'disabled' });
    const cyanSeam = await page.evaluate(
      async ({ base64, height }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${base64}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const scale = img.height / height;
        const strip = ctx.getImageData(0, Math.floor(img.height / 2), Math.ceil(3 * scale), 1).data;
        let maxCyan = 0;
        for (let x = 0; x < strip.length; x += 4) maxCyan = Math.max(maxCyan, strip[x + 1]! - strip[x]!);
        return maxCyan;
      },
      { base64: png.toString('base64'), height },
    );
    expect(cyanSeam, 'nessuna striscia ciano nel bordo sinistro viola').toBeLessThan(40);
    await page.screenshot({ path: `test-results/screenshots/${route}-actions-${info.project.name}.png` });
  });
}
