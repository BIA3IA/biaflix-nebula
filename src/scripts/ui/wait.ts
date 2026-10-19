/**
 * Attende un elemento osservando SOLO il sottoalbero indicato (la pagina corrente),
 * con timeout e AbortSignal: nessun observer persistente sull'intero documento.
 */
export function waitFor<T extends Element>(root: ParentNode & Node, selector: string, signal: AbortSignal, timeoutMs = 10_000): Promise<T | null> {
  const found = root.querySelector<T>(selector);
  if (found) return Promise.resolve(found);
  return new Promise((resolve) => {
    const finish = (el: T | null) => {
      observer.disconnect();
      window.clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve(el);
    };
    const onAbort = () => finish(null);
    const observer = new MutationObserver(() => {
      const el = root.querySelector<T>(selector);
      if (el) finish(el);
    });
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    signal.addEventListener('abort', onAbort);
    observer.observe(root, { childList: true, subtree: true });
  });
}
