import { afterEach, describe, expect, it, vi } from 'vitest';
import { nativeActionItems, triggerNative } from '../../src/scripts/details/native';
import { attachMenu, closeMenus } from '../../src/scripts/ui/menu';

const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

afterEach(() => {
  closeMenus();
  document.body.innerHTML = '';
});

function nativePage(): HTMLElement {
  document.body.innerHTML = `
    <div id="itemDetailPage"><div class="mainDetailButtons">
      <button class="btnPlay detailButton" title="Riproduci"><span class="material-icons play_arrow"></span></button>
      <button class="btnPlayTrailer detailButton hide" title="Trailer"></button>
      <button class="btnPlaystate detailButton" title="Segna come visto" data-played="true"><span class="material-icons check"></span></button>
      <button class="btnUserRating detailButton" title="Preferito" data-isfavorite="false"><span class="material-icons favorite"></span></button>
      <button class="btnDownload detailButton hide" title="Scarica"></button>
      <button class="je-spoiler-blur-btn detailButton" title="Spoiler Guard"></button>
      <button class="kt-sort detailButton" title="Preferito"></button>
      <button class="btnMoreCommands detailButton" title="Altro"><span class="material-icons more_vert"></span></button>
    </div></div>`;
  return document.getElementById('itemDetailPage')!;
}

describe('azioni native della pagina dettagli', () => {
  it('include pulsanti visibili di Jellyfin e plugin, esclude nascosti e già promossi, deduplica per etichetta', () => {
    const items = nativeActionItems(nativePage());
    expect(items.map((i) => i.label)).toEqual(['Segna come visto', 'Preferito', 'Spoiler Guard', 'Altro']);
    expect(items.find((i) => i.label === 'Segna come visto')!.checked).toBe(true);
    expect(items.find((i) => i.label === 'Preferito')!.checked).toBe(false);
  });

  it('attiva per delega il pulsante nativo (logica Jellyfin invariata)', () => {
    const page = nativePage();
    const spy = vi.fn();
    page.querySelector('.btnPlay')!.addEventListener('click', spy);
    expect(triggerNative(page, 'btnPlay')).toBe(true);
    expect(spy).toHaveBeenCalledOnce();
    expect(triggerNative(page, 'btnDownload')).toBe(false); // nascosto dal controller nativo
  });
});

describe('menu glass', () => {
  function setup() {
    document.body.innerHTML = '<button id="b" aria-label="Altre azioni">…</button>';
    const button = document.getElementById('b')!;
    const picked: string[] = [];
    const detach = attachMenu(button, () => [
      { label: 'Uno', onSelect: () => picked.push('uno') },
      { label: 'Due', disabled: true, onSelect: () => picked.push('due') },
      { label: 'Tre', checked: true, onSelect: () => picked.push('tre') },
    ]);
    return { button, picked, detach };
  }

  it('ARIA menu button: aria-expanded, role=menu, menuitemcheckbox con aria-checked', async () => {
    const { button } = setup();
    button.click();
    await frame();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const menu = document.querySelector('[role="menu"]')!;
    expect(menu.getAttribute('aria-label')).toBe('Altre azioni');
    expect(menu.querySelector('[role="menuitemcheckbox"]')!.getAttribute('aria-checked')).toBe('true');
  });

  it('frecce saltano le voci disabilitate, Invio attiva, focus torna al pulsante', async () => {
    const { button, picked } = setup();
    button.click();
    await frame();
    const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
    expect(document.activeElement!.textContent).toContain('Uno');
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement!.textContent).toContain('Tre');
    (document.activeElement as HTMLButtonElement).click();
    expect(picked).toEqual(['tre']);
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('Esc chiude anche prima che il focus entri nel menu; in uscita il menu è aria-hidden', () => {
    const { button } = setup();
    button.click();
    button.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('.nebula-menu')!.getAttribute('aria-hidden')).toBe('true');
  });
});
