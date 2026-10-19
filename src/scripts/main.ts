/**
 * Biaflix Nebula — entry point dell'add-on JS.
 * Caricato una sola volta (guardia globale) dallo snippet JS Injector; si attiva solo quando
 * la skin "Biaflix Nebula" è selezionata nello Skin Manager KefinTweaks (o con activation:'always').
 * Spegnimento immediato: BiaflixNebula.disable() oppure config `enabled:false` / rimozione dello snippet.
 */
import { CollectionsService } from './collections';
import type { NebulaContext } from './context';
import { isModernLayout, readSession, waitForSession } from './env';
import { LOCAL_KILL_SWITCH_KEY, resolveFlags, type NebulaFlags } from './flags';
import { setLocale } from './i18n';
import { JellyfinApi } from './jellyfin-api';
import { Lifecycle } from './lifecycle';
import { PlaylistService } from './playlist';
import { isSkinLinkPresent, watchSkin } from './skin-detect';
import { WatchlistService } from './watchlist';
import { installBottomNav } from './features/bottom-nav';
import { watchlistPageFeature } from './features/watchlist-page';
import { installNavbarExtras } from './features/navbar-extras';
import { installNativeCardActions } from './features/card-actions';
import { collectionsHubFeature } from './features/collections-hub';
import { detailsFeature } from './features/details';
import { heroFeature } from './features/hero';
import { homeRailsFeature } from './features/home-rails';
import { applyShell, routeMarker } from './features/shell';
import { closeAllDialogs } from './ui/dialog';
import { installGlassSelect } from './ui/glass-select';
import { installTooltips } from './ui/tooltip';
import { installJeIconTokenFix } from './compat/je-icon-tokens';
import { disableScreensaver } from './compat/no-screensaver';
import { removeToasts } from './ui/toast';
import { installWatchlistSync } from './ui/watchlist-button';

declare const __NEBULA_VERSION__: string;

interface NebulaGlobal {
  version: string;
  flags: NebulaFlags;
  readonly state: 'idle' | 'starting' | 'running';
  disable(): void;
  enable(): void;
}

const PREFIX = '[Biaflix Nebula]';

function boot(): void {
  const w = window as unknown as { BiaflixNebula?: NebulaGlobal };
  if (w.BiaflixNebula) return; // reiniezione (SPA, doppio snippet): no-op

  const flags = resolveFlags();
  setLocale(flags.locale);
  let state: NebulaGlobal['state'] = 'idle';
  let generation = 0;
  let teardown: (() => void) | null = null;
  let stopWatching: (() => void) | null = null;

  const log = (...args: unknown[]) => {
    if (flags.debug) console.debug(PREFIX, ...args);
  };

  const stop = () => {
    generation += 1;
    teardown?.();
    teardown = null;
    state = 'idle';
  };

  const start = async () => {
    if (state !== 'idle') return;
    state = 'starting';
    const gen = ++generation;
    try {
      const session = await waitForSession();
      const api = new JellyfinApi(session);
      const user = await api.getCurrentUser();
      if (gen !== generation) return;
      const ctx: NebulaContext = {
        api,
        flags,
        user,
        serverId: session.serverId ?? '',
        collections: new CollectionsService(api),
        playlists: new PlaylistService(api),
        watchlist: new WatchlistService(api),
        log,
      };
      const lifecycle = new Lifecycle(
        [routeMarker, heroFeature(ctx), homeRailsFeature(ctx), detailsFeature(ctx), collectionsHubFeature(ctx), watchlistPageFeature(ctx)],
        (feature, err) => console.warn(PREFIX, `feature "${feature}"`, err),
      );
      const cleanups = [applyShell(), installWatchlistSync(), installNativeCardActions(ctx), installGlassSelect(), installTooltips(), installJeIconTokenFix()];
      lifecycle.start();
      if (flags.disableScreensaver) disableScreensaver(user.Id);
      // Barra in basso solo nel layout Modern (le route di libreria legacy differiscono).
      if (isModernLayout()) {
        cleanups.push(installNavbarExtras(ctx));
        void installBottomNav(ctx).then((cleanup) => {
          if (gen === generation) cleanups.push(cleanup);
          else cleanup();
        });
      }

      // Cambio utente o logout nella stessa SPA: riavvio con la nuova sessione.
      const onView = () => {
        const s = readSession();
        if (!s || s.userId !== user.Id || s.token !== session.token) {
          stop();
          void start();
        }
      };
      document.addEventListener('viewshow', onView);

      teardown = () => {
        document.removeEventListener('viewshow', onView);
        lifecycle.stop();
        cleanups.forEach((fn) => fn());
        closeAllDialogs();
        removeToasts();
        document.querySelectorAll('.nebula-root').forEach((el) => el.remove());
      };
      state = 'running';
      log(`v${__NEBULA_VERSION__} attiva per`, user.Name);
    } catch (err) {
      if (gen !== generation) return;
      state = 'idle';
      // Avvio fallito (rete, sessione scaduta, login tardivo): si ritenta al prossimo cambio pagina.
      const retry = () => {
        if (flags.enabled && (flags.activation === 'always' || isSkinLinkPresent(flags.skinName))) void start();
      };
      document.addEventListener('viewshow', retry, { once: true });
      console.warn(PREFIX, 'avvio non riuscito', err);
    }
  };

  const activate = () => {
    stopWatching?.();
    stopWatching = null;
    if (!flags.enabled) return;
    if (flags.activation === 'always') void start();
    else stopWatching = watchSkin(flags.skinName, (active) => (active ? void start() : stop()));
  };

  w.BiaflixNebula = {
    version: __NEBULA_VERSION__,
    flags,
    get state() {
      return state;
    },
    disable() {
      try {
        localStorage.setItem(LOCAL_KILL_SWITCH_KEY, '1');
      } catch {
        /* storage non disponibile: disattivo solo questa sessione */
      }
      flags.enabled = false;
      stopWatching?.();
      stopWatching = null;
      stop();
    },
    enable() {
      try {
        localStorage.removeItem(LOCAL_KILL_SWITCH_KEY);
      } catch {
        /* ignorato */
      }
      flags.enabled = true;
      activate();
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activate, { once: true });
  else activate();
}

boot();
