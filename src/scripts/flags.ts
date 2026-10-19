/**
 * Configurazione e feature flag di Nebula.
 * Fonte: window.BiaflixNebulaConfig (definito nello snippet JS Injector dall'amministratrice),
 * più un interruttore locale per singolo browser (solo comodità, nessun dato persistente).
 */

export interface NebulaFlags {
  /** Interruttore generale: false = Nebula JS non fa nulla. */
  enabled: boolean;
  /**
   * 'skin'   → si attiva solo se lo Skin Manager KefinTweaks ha caricato la skin Nebula (default).
   * 'always' → sempre attivo (sviluppo/test locale).
   */
  activation: 'skin' | 'always';
  /** Nome della skin registrata in KefinTweaks Skin Manager. */
  skinName: string;
  hero: boolean;
  /** Autoplay hero: disattivato di default (preferenza della specifica). */
  heroAutoplay: boolean;
  heroIntervalMs: number;
  /** Nome della raccolta curata che alimenta l'hero, se esiste. */
  heroCollectionName: string;
  homeCollectionsRail: boolean;
  homeWatchlistRail: boolean;
  cardActions: boolean;
  detailActions: boolean;
  collectionsHub: boolean;
  collectionManage: boolean;
  /** Nessuno screensaver di Jellyfin dopo l'inattività (default: disattivato). */
  disableScreensaver: boolean;
  /** Lingua UI: 'auto' segue la lingua del browser. */
  locale: 'auto' | 'it' | 'en';
  debug: boolean;
}

export const DEFAULT_FLAGS: Readonly<NebulaFlags> = Object.freeze({
  enabled: true,
  activation: 'skin',
  skinName: 'Biaflix Nebula',
  hero: true,
  heroAutoplay: false,
  heroIntervalMs: 10000,
  heroCollectionName: 'In evidenza',
  homeCollectionsRail: true,
  homeWatchlistRail: true,
  cardActions: true,
  detailActions: true,
  collectionsHub: true,
  collectionManage: true,
  disableScreensaver: true,
  locale: 'auto',
  debug: false,
});

export const LOCAL_KILL_SWITCH_KEY = 'biaflixNebula:disabled';

function safeLocalGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function resolveFlags(raw: unknown = (window as unknown as { BiaflixNebulaConfig?: unknown }).BiaflixNebulaConfig): NebulaFlags {
  const flags: NebulaFlags = { ...DEFAULT_FLAGS };
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(DEFAULT_FLAGS) as (keyof NebulaFlags)[]) {
      const value = (raw as Record<string, unknown>)[key];
      if (value !== undefined && typeof value === typeof DEFAULT_FLAGS[key]) {
        (flags as unknown as Record<string, unknown>)[key] = value;
      }
    }
  }
  if (flags.activation !== 'skin' && flags.activation !== 'always') flags.activation = 'skin';
  if (!['auto', 'it', 'en'].includes(flags.locale)) flags.locale = 'auto';
  flags.heroIntervalMs = Math.min(Math.max(flags.heroIntervalMs, 8000), 12000);
  if (safeLocalGet(LOCAL_KILL_SWITCH_KEY) === '1') flags.enabled = false;
  return flags;
}
