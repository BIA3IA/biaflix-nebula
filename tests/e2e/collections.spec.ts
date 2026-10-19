/**
 * Criterio di accettazione §7: raccolta mista 2 film + 2 serie creata dalla UI, mostrata in home,
 * aperta, titolo aggiunto da «Aggiungi a…», titolo rimosso senza toccare il file, persistenza dopo
 * reload e verifica permessi con un secondo utente non admin.
 */
import { apiCall, cleanupCollections, expect, gotoHome, installNebula, sessionFor, test, type Session } from './fixtures';

const PREFIX = 'E2E ';

interface Item {
  Id: string;
  Name: string;
  Type: string;
}

async function libraryItem(s: Session, name: string): Promise<Item> {
  const r = await apiCall<{ Items: Item[] }>(
    s,
    'GET',
    `/Items?userId=${s.userId}&recursive=true&includeItemTypes=Movie,Series&searchTerm=${encodeURIComponent(name)}`,
  );
  const found = r.Items.find((i) => i.Name === name);
  if (!found) throw new Error(`Titolo di test mancante: ${name}`);
  return found;
}

async function children(s: Session, collectionId: string): Promise<string[]> {
  const r = await apiCall<{ Items: Item[] }>(s, 'GET', `/Items?userId=${s.userId}&parentId=${collectionId}&sortBy=SortName`);
  return r.Items.map((i) => `${i.Type}:${i.Name}`);
}

async function findCollection(s: Session, name: string): Promise<Item | undefined> {
  const r = await apiCall<{ Items: Item[] }>(s, 'GET', `/Items?userId=${s.userId}&recursive=true&includeItemTypes=BoxSet`);
  return r.Items.find((c) => c.Name === name);
}

test.describe.configure({ mode: 'serial' });

test.describe('Raccolte miste film + serie', () => {
  test.skip(({ isMobile }) => isMobile, 'Flusso CRUD completo su desktop; mobile coperto dai test di layout');

  let curator: Session;
  let viewer: Session;
  const name = `${PREFIX}Serata Halloween ${Date.now().toString(36)}`;

  test.beforeAll(async () => {
    curator = await sessionFor('curator');
    viewer = await sessionFor('viewer');
    await cleanupCollections(curator, PREFIX);
  });

  test.afterAll(async () => {
    await cleanupCollections(curator, PREFIX);
  });

  test('crea dalla UI una raccolta con 2 film e 2 serie', async ({ page, consoleErrors }, info) => {
    await installNebula(page, curator);
    await gotoHome(page);
    const rail = page.locator('.nebula-rail--collections');
    await rail
      .getByRole('button', { name: /Nuova raccolta|Crea la tua prima raccolta/ })
      .first()
      .click();

    const dialog = page.getByRole('dialog', { name: 'Nuova raccolta' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Nome *').fill(name);
    const search = dialog.getByLabel('Cerca film e serie');
    for (const title of ['Orbita Viola', 'Ultima Proiezione', 'Nebula Station', 'Serata Horror']) {
      await search.fill(title);
      await dialog.locator('.nebula-picker__label', { hasText: title }).locator('input[type="checkbox"]').check();
    }
    await expect(dialog.locator('.nebula-picker__count')).toHaveText('4 selezionati');
    await page.screenshot({ path: `test-results/screenshots/create-collection-${info.project.name}.png` });
    await dialog.getByRole('button', { name: 'Crea raccolta' }).click();

    // Navigazione reale alla pagina dettagli della raccolta creata.
    await expect(page).toHaveURL(/#\/details\?id=/);
    const created = await findCollection(curator, name);
    expect(created).toBeTruthy();
    expect(await children(curator, created!.Id)).toEqual(['Series:Nebula Station', 'Movie:Orbita Viola', 'Series:Serata Horror', 'Movie:Ultima Proiezione']);
    expect(consoleErrors).toEqual([]);
  });

  test('la raccolta appare in homepage e resta dopo il reload', async ({ page }) => {
    await installNebula(page, curator);
    await gotoHome(page);
    const card = page.locator('.nebula-rail--collections .nebula-card--collection', { hasText: name });
    await expect(card).toBeVisible();
    await expect(card).toContainText('4 titoli');
    await page.reload();
    await expect(page.locator('.nebula-rail--collections .nebula-card--collection', { hasText: name })).toBeVisible({ timeout: 20_000 });
    await card.locator('a.nebula-card__media').click();
    await expect(page).toHaveURL(/#\/details\?id=/);
    await expect(page.locator('#itemDetailPage:not(.hide) .nebula-collection-filter')).toBeVisible();
  });

  test('aggiunge un titolo da «Aggiungi a…» nella pagina dettagli', async ({ page }) => {
    const movie = await libraryItem(curator, 'Il Faro Ciano');
    await installNebula(page, curator);
    await page.goto(`/web/#/details?id=${movie.Id}&serverId=${curator.serverId}`);
    // «Aggiungi a…» vive nel menu «Altre azioni» dell'hero.
    await page.getByRole('button', { name: 'Altre azioni' }).click();
    await page.getByRole('menuitem', { name: 'Aggiungi a…' }).click();
    const dialog = page.getByRole('dialog', { name: /Aggiungi «Il Faro Ciano» a…/ });
    const box = dialog.getByRole('checkbox', { name: new RegExp(name) });
    await expect(box).not.toBeChecked();
    await box.check();
    await expect(page.locator('.nebula-toast', { hasText: `Aggiunto a «${name}»` })).toBeVisible();
    const c = await findCollection(curator, name);
    expect(await children(curator, c!.Id)).toContain('Movie:Il Faro Ciano');
  });

  test('rimuove un titolo con conferma, senza toccare il file in libreria', async ({ page }) => {
    const c = (await findCollection(curator, name))!;
    await installNebula(page, curator);
    await page.goto(`/web/#/details?id=${c.Id}&serverId=${curator.serverId}`);
    await page.getByRole('button', { name: 'Altre azioni' }).click();
    await page.getByRole('menuitem', { name: 'Gestisci raccolta' }).click();
    const dialog = page.getByRole('dialog', { name: /Gestisci raccolta/ });
    await dialog.getByRole('button', { name: 'Rimuovi Orbita Viola' }).click();
    const confirm = page.getByRole('dialog', { name: 'Rimuovi' });
    await expect(confirm).toContainText('Il titolo resta nella libreria');
    await confirm.getByRole('button', { name: 'Rimuovi' }).click();
    await expect(page.locator('.nebula-toast', { hasText: 'Rimosso da' })).toBeVisible();
    expect(await children(curator, c.Id)).not.toContain('Movie:Orbita Viola');
    // Il film esiste ancora nella libreria.
    expect((await libraryItem(curator, 'Orbita Viola')).Id).toBeTruthy();
  });

  test('secondo utente non admin: vede la raccolta ma non può modificarla', async ({ page }) => {
    const c = await findCollection(viewer, name);
    expect(c, 'la raccolta è condivisa e visibile allo spettatore').toBeTruthy();
    await installNebula(page, viewer);
    await page.goto(`/web/#/details?id=${c!.Id}&serverId=${viewer.serverId}`);
    await expect(page.locator('#itemDetailPage:not(.hide) .nebula-collection-filter')).toBeVisible();
    await page.getByRole('button', { name: 'Altre azioni' }).click();
    await expect(page.getByRole('menuitem', { name: 'Gestisci raccolta' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    const movie = await libraryItem(viewer, 'Comfort Club');
    await page.goto(`/web/#/details?id=${movie.Id}&serverId=${viewer.serverId}`);
    await page.getByRole('button', { name: 'Altre azioni' }).click();
    await page.getByRole('menuitem', { name: 'Aggiungi a…' }).click();
    const dialog = page.getByRole('dialog', { name: /Aggiungi «Comfort Club» a…/ });
    await expect(dialog).toContainText('Gestione raccolte');
    await expect(dialog.getByRole('checkbox')).toHaveCount(0);
    // Il server rifiuta comunque la mutazione: nessuna finta autorizzazione lato client.
    await expect(apiCall(viewer, 'POST', `/Collections/${c!.Id}/Items?ids=${movie.Id}`)).rejects.toThrow(/403/);
  });

  test('hub raccolte: solo raccolte e la sola azione di creazione', async ({ page }) => {
    await installNebula(page, curator);
    await gotoHome(page);
    await page.locator('header.MuiAppBar-root a[href*="boxsets"]').first().click();
    const hub = page.locator('#boxsetsPage .nebula-hub');
    await expect(hub).toBeVisible();
    await expect(hub.locator('.nebula-card--collection', { hasText: name })).toBeVisible();
    await page.screenshot({ path: `test-results/screenshots/collections-hub-${test.info().project.name}.png` });
    await expect(hub.locator('.nebula-card--playlist')).toHaveCount(0);
    await expect(hub.locator('.nebula-hub__actions button')).toHaveCount(1);
    await expect(hub.getByRole('button', { name: /Vista classica|Classic view/ })).toHaveCount(0);
    await hub.getByRole('button', { name: 'Nuova raccolta', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuova raccolta', exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Annulla', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#boxsetsPage > :not(.nebula-hub)').first()).toBeHidden();
  });
});
