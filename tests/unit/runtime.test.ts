import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { episodeCode, itemDataAttrs, minutesLeft, progressPercent } from '../../src/scripts/cards';
import { currentRoute } from '../../src/scripts/env';
import { DEFAULT_FLAGS, LOCAL_KILL_SWITCH_KEY, resolveFlags } from '../../src/scripts/flags';
import { setLocale, t } from '../../src/scripts/i18n';
import { Lifecycle } from '../../src/scripts/lifecycle';
import { isSkinLinkPresent, watchSkin } from '../../src/scripts/skin-detect';
import { confirmDialog } from '../../src/scripts/ui/dialog';
import { watchlistTargetId } from '../../src/scripts/watchlist';
import { item } from './helpers';

beforeEach(() => {
  localStorage.clear();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  window.location.hash = '';
});

afterEach(() => vi.useRealTimers());

describe('flags', () => {
  it('applica solo chiavi note con il tipo corretto', () => {
    const f = resolveFlags({ hero: false, heroAutoplay: 'yes', unknown: 1, activation: 'boh' });
    expect(f.hero).toBe(false);
    expect(f.heroAutoplay).toBe(DEFAULT_FLAGS.heroAutoplay);
    expect(f.activation).toBe('skin');
    expect('unknown' in f).toBe(false);
  });

  it('limita l’intervallo hero a 8–12s', () => {
    expect(resolveFlags({ heroIntervalMs: 1000 }).heroIntervalMs).toBe(8000);
    expect(resolveFlags({ heroIntervalMs: 60000 }).heroIntervalMs).toBe(12000);
  });

  it('kill switch locale per browser', () => {
    localStorage.setItem(LOCAL_KILL_SWITCH_KEY, '1');
    expect(resolveFlags({}).enabled).toBe(false);
  });
});

describe('i18n', () => {
  it('italiano primario con interpolazione, inglese predisposto', () => {
    expect(setLocale('auto', 'it-IT')).toBe('it');
    expect(t('addedTo', { name: 'Fantasy' })).toBe('Aggiunto a «Fantasy»');
    setLocale('en');
    expect(t('addedTo', { name: 'Fantasy' })).toBe('Added to “Fantasy”');
    setLocale('it');
  });
});

describe('cards helpers', () => {
  it('progress e minuti rimanenti solo se affidabili', () => {
    const i = item({ Id: 'm', RunTimeTicks: 60 * 600_000_000, UserData: { PlayedPercentage: 25, PlaybackPositionTicks: 15 * 600_000_000 } });
    expect(progressPercent(i)).toBe(25);
    expect(minutesLeft(i)).toBe(45);
    expect(progressPercent(item({ Id: 'x', UserData: { PlayedPercentage: 100 } }))).toBeNull();
    expect(minutesLeft(item({ Id: 'y' }))).toBeNull();
  });

  it('codice episodio SxxExx', () => {
    expect(episodeCode(item({ Id: 'e', Type: 'Episode', ParentIndexNumber: 2, IndexNumber: 7 }))).toBe('S02E07');
    expect(episodeCode(item({ Id: 'm' }))).toBeNull();
  });

  it('attributi data-* compatibili con shortcuts nativi (resume con positionticks)', () => {
    const attrs = itemDataAttrs(item({ Id: 'm', UserData: { PlaybackPositionTicks: 42 } }), 'srv');
    expect(attrs).toMatchObject({
      'data-id': 'm',
      'data-serverid': 'srv',
      'data-type': 'Movie',
      'data-mediatype': 'Video',
      'data-positionticks': '42',
      'data-isfolder': 'false',
    });
    expect(itemDataAttrs(item({ Id: 's', Type: 'Series' }), 'srv')['data-isfolder']).toBe('true');
  });

  it('watchlist su episodio = serie', () => {
    expect(watchlistTargetId({ Id: 'e', Type: 'Episode', SeriesId: 's' })).toBe('s');
  });
});

describe('route', () => {
  it('interpreta hash Jellyfin (#/ e #!/)', () => {
    window.location.hash = '#/details?id=abc&serverId=s';
    expect(currentRoute().path).toBe('details');
    expect(currentRoute().params.get('id')).toBe('abc');
    window.location.hash = '#!/home.html';
    expect(currentRoute().path).toBe('home');
  });
});

describe('skin detection', () => {
  it('riconosce il link dello Skin Manager KefinTweaks per nome', async () => {
    expect(isSkinLinkPresent('Biaflix Nebula')).toBe(false);
    const states: boolean[] = [];
    const stop = watchSkin('Biaflix Nebula', (a) => states.push(a));
    const link = document.createElement('link');
    link.setAttribute('data-kefin-skin', 'true');
    link.setAttribute('data-skin', 'Biaflix Nebula');
    document.head.append(link);
    await new Promise((r) => setTimeout(r, 0));
    link.remove();
    await new Promise((r) => setTimeout(r, 0));
    stop();
    expect(states).toEqual([false, true, false]);
  });

  it('ignora altre skin', () => {
    document.head.innerHTML = '<link data-kefin-skin="true" data-skin="ElegantFin">';
    expect(isSkinLinkPresent('Biaflix Nebula')).toBe(false);
  });
});

describe('Lifecycle', () => {
  it('monta solo sulle route dichiarate e smonta al cambio pagina', async () => {
    const log: string[] = [];
    const lc = new Lifecycle([
      {
        name: 'home',
        routes: ['home'],
        mount: () => {
          log.push('mount-home');
          return () => log.push('unmount-home');
        },
      },
      { name: 'all', routes: ['*'], mount: ({ path }) => void log.push(`all:${path}`) },
    ]);
    window.location.hash = '#/home';
    lc.start();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    window.location.hash = '#/details?id=1';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    lc.stop();
    expect(log).toEqual(['mount-home', 'all:home', 'unmount-home', 'all:details']);
  });

  it('hashchange + viewshow nello stesso frame: monta sulla pagina del viewshow', async () => {
    // La pagina precedente è ancora visibile e ultima nel DOM durante la transizione.
    document.body.innerHTML = '<div class="page" id="indexPage"></div><div class="page" id="itemDetailPage"></div>';
    const seen: (string | undefined)[] = [];
    const lc = new Lifecycle([{ name: 'p', routes: ['home'], mount: ({ page }) => void seen.push(page?.id) }]);
    window.location.hash = '#/details?id=1';
    lc.start();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    window.location.hash = '#/home';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    document.getElementById('indexPage')!.dispatchEvent(new CustomEvent('viewshow', { bubbles: true }));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    lc.stop();
    expect(seen).toEqual(['indexPage']);
  });

  it('isola gli errori di una feature', async () => {
    const errors: string[] = [];
    const ok = vi.fn();
    const lc = new Lifecycle(
      [
        {
          name: 'bad',
          routes: ['*'],
          mount: () => {
            throw new Error('boom');
          },
        },
        { name: 'good', routes: ['*'], mount: ok },
      ],
      (name) => errors.push(name),
    );
    lc.start();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    lc.stop();
    expect(errors).toEqual(['bad']);
    expect(ok).toHaveBeenCalledOnce();
  });
});

describe('dialog accessibile', () => {
  it('ESC chiude e risolve false; il dialog ha role e aria-modal', async () => {
    const p = confirmDialog('Titolo', 'Messaggio', 'OK');
    const dlg = document.querySelector('[role="dialog"]')!;
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.getAttribute('aria-labelledby')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(p).resolves.toBe(false);
  });

  it('conferma risolve true', async () => {
    const p = confirmDialog('Titolo', 'Messaggio', 'Elimina', true);
    const ok = [...document.querySelectorAll<HTMLButtonElement>('.nebula-dialog button')].find((b) => b.textContent === 'Elimina')!;
    ok.click();
    await expect(p).resolves.toBe(true);
  });
});

describe('regressioni dalla revisione', () => {
  it('stop() annulla un frame già in coda: nessun montaggio con contesto dismesso', async () => {
    const mount = vi.fn();
    const lc = new Lifecycle([{ name: 'x', routes: ['*'], mount }]);
    lc.start();
    lc.stop();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(mount).not.toHaveBeenCalled();
  });

  it('ESC chiude solo il dialog in cima alla pila', async () => {
    const outer = confirmDialog('Esterno', 'm', 'OK');
    let outerDone = false;
    void outer.then(() => (outerDone = true));
    const inner = confirmDialog('Interno', 'm', 'OK');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(inner).resolves.toBe(false);
    await new Promise((r) => setTimeout(r, 250));
    expect(outerDone).toBe(false);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(outer).resolves.toBe(false);
  });

  it('conferma distruttiva: focus iniziale su Annulla', async () => {
    const p = confirmDialog('Elimina', 'm', 'Elimina', true);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(document.activeElement?.textContent).toBe('Annulla');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await p;
  });
});
