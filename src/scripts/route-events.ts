/**
 * Evento unico di cambio route per Nebula.
 * Il router React di jellyfin-web 12 naviga con history.pushState/replaceState: niente `hashchange`,
 * niente `popstate` e, se la view resta la stessa (es. home → home?tab=1), nemmeno `viewshow`.
 * Qui avvolgiamo pushState/replaceState (una volta sola) ed emettiamo ROUTE_CHANGED su window,
 * insieme a popstate e hashchange. Allo stop si ripristinano gli originali se nessun altro script li
 * ha avvolti a sua volta; altrimenti il nostro wrapper diventa trasparente.
 */
export const ROUTE_CHANGED = 'biaflix-nebula:routechange';

type HistoryFn = History['pushState'];

export function installRouteEvents(win: Window = window): () => void {
  const history = win.history;
  const originals = { pushState: history.pushState, replaceState: history.replaceState };
  let active = true;
  let lastHref = win.location.href;

  const emit = () => {
    if (!active || win.location.href === lastHref) return;
    lastHref = win.location.href;
    win.dispatchEvent(new Event(ROUTE_CHANGED));
  };

  const wrap = (original: HistoryFn): HistoryFn =>
    function (this: History, ...args: Parameters<HistoryFn>) {
      const result = original.apply(this, args);
      emit();
      return result;
    };
  const wrapped = { pushState: wrap(originals.pushState), replaceState: wrap(originals.replaceState) };
  history.pushState = wrapped.pushState;
  history.replaceState = wrapped.replaceState;
  win.addEventListener('popstate', emit);
  win.addEventListener('hashchange', emit);

  return () => {
    active = false;
    win.removeEventListener('popstate', emit);
    win.removeEventListener('hashchange', emit);
    if (history.pushState === wrapped.pushState) history.pushState = originals.pushState;
    if (history.replaceState === wrapped.replaceState) history.replaceState = originals.replaceState;
  };
}
