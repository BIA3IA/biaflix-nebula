/**
 * Correttivo per Jellyfin Enhanced 12.12: con «Use Icons» disattivato, JE.icon() restituisce '' e
 * JE.t() (plugin.js: `return iconResult || match`) rimette il segnaposto, così i testi mostrano
 * «{{icon:warning}} …» (es. toast «Please select at least one season»).
 *
 * Nebula avvolge JE.t, dopo l'inizializzazione di JE, eliminando solo i token `{{icon:Nome}}` rimasti
 * irrisolti. Con le icone attive JE li ha già sostituiti e nulla cambia. Allo stop la funzione originale
 * viene ripristinata. Da rimuovere quando JE correggerà il difetto a monte.
 */

type Translate = ((key: string, params?: Record<string, unknown>) => unknown) & { __nebulaIconFix?: true };
interface JeGlobal {
  initialized?: boolean;
  t?: Translate;
}

const LEFTOVER_ICON = /\{\{icon:[A-Za-z]+\}\}\s?/g;

export function stripIconTokens(text: string): string {
  return text.replace(LEFTOVER_ICON, '');
}

export function installJeIconTokenFix(win: { JellyfinEnhanced?: JeGlobal } = window as unknown as { JellyfinEnhanced?: JeGlobal }): () => void {
  let original: Translate | null = null;
  let attempts = 0;
  let timer = 0;

  const patch = (): boolean => {
    const je = win.JellyfinEnhanced;
    if (!je?.initialized || typeof je.t !== 'function') return false;
    if (je.t.__nebulaIconFix) return true;
    const base = je.t;
    original = base;
    const wrapped: Translate = function (this: unknown, key, params) {
      const out = base.call(this, key, params);
      return typeof out === 'string' ? stripIconTokens(out) : out;
    };
    wrapped.__nebulaIconFix = true;
    je.t = wrapped;
    return true;
  };

  // JE si inizializza dopo il login: tentativi radi e limitati (max ~60 s), poi a ogni cambio pagina
  // (JE può riassegnare JE.t al cambio utente).
  const tick = () => {
    if (patch() || ++attempts > 30) return;
    timer = window.setTimeout(tick, 2000);
  };
  tick();
  const onView = () => void patch();
  document.addEventListener('viewshow', onView);

  return () => {
    window.clearTimeout(timer);
    document.removeEventListener('viewshow', onView);
    const je = win.JellyfinEnhanced;
    if (je?.t?.__nebulaIconFix && original) je.t = original;
  };
}
