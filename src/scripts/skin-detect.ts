/**
 * Rileva se la skin Nebula è quella attiva in KefinTweaks Skin Manager (v0.5.x).
 * Lo Skin Manager non emette eventi: inserisce/rimuove <link data-kefin-skin="true" data-skin="…">
 * in <head>. Osserviamo solo i figli diretti di <head> (e <body> per il fallback dopo #reactRoot),
 * mai l'intero albero DOM.
 */

export function isSkinLinkPresent(skinName: string, root: ParentNode = document): boolean {
  const links = root.querySelectorAll<HTMLLinkElement>('link[data-kefin-skin="true"]');
  for (const link of links) {
    if (link.getAttribute('data-skin') === skinName) return true;
  }
  return false;
}

/** Il CSS Nebula dichiara --biaflix-nebula: 1 su :root; utile se la skin è caricata da un'altra via. */
export function isNebulaCssApplied(): boolean {
  return getComputedStyle(document.documentElement).getPropertyValue('--biaflix-nebula').trim() === '1';
}

export function watchSkin(skinName: string, onChange: (active: boolean) => void): () => void {
  let last: boolean | null = null;
  const check = () => {
    const active = isSkinLinkPresent(skinName);
    if (active !== last) {
      last = active;
      onChange(active);
    }
  };
  const observer = new MutationObserver(check);
  // Anche il cambio di data-skin su un <link> esistente (subtree limitato a <head>, solo quell'attributo).
  observer.observe(document.head, { childList: true, subtree: true, attributeFilter: ['data-skin'] });
  if (document.body) observer.observe(document.body, { childList: true });
  check();
  return () => observer.disconnect();
}
