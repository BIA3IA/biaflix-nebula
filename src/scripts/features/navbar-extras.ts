/**
 * Elementi Nebula nella navbar (layout Modern):
 * - pulsante «La mia watchlist» (segnalibro): apre un pannello glass con i titoli in watchlist
 *   (UserData.Likes). Jellyfin non ha una route per la watchlist, quindi non se ne inventa una;
 * - categorie della home KefinTweaks (Home / Scopri) come controllo segmentato nella barra, solo in home.
 *   È un comando remoto dei pulsanti di KefinTweaks (che restano la logica), nascosti dal CSS.
 * React può ridisegnare la toolbar: un observer limitato ai figli della toolbar reinserisce gli elementi.
 */
import { posterCard, nativeItemsContainer } from '../cards';
import type { NebulaContext } from '../context';
import { currentRoute } from '../env';
import { t } from '../i18n';
import { WATCHLIST_CHANGED } from '../watchlist';
import { openDialog } from '../ui/dialog';
import { h, icon } from '../ui/dom';
import { decorateNebulaCard } from './card-actions';

export async function openWatchlistPanel(ctx: NebulaContext): Promise<void> {
  const dlg = openDialog({ title: t('watchlist'), className: 'nebula-dialog--wide nebula-dialog--watchlist' });
  const status = h('p', { class: 'nebula-picker__status', role: 'status' }, t('loading'));
  const grid = nativeItemsContainer('nebula-watchlist-grid');
  dlg.body.append(status, grid);
  // Aprire un titolo chiude il pannello (la navigazione resta quella nativa).
  grid.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a.nebula-card__media')) dlg.close();
  });
  const render = async () => {
    try {
      const r = await ctx.watchlist.list(200);
      grid.replaceChildren(
        ...r.Items.map((item) => {
          const card = posterCard(ctx, item);
          decorateNebulaCard(ctx, card, item);
          return card;
        }),
      );
      status.textContent = r.Items.length ? '' : t('watchlistEmpty');
    } catch (err) {
      ctx.log('watchlist', err);
      status.textContent = t('errorGeneric');
    }
  };
  const onChange = () => void render();
  document.addEventListener(WATCHLIST_CHANGED, onChange);
  const observer = new MutationObserver(() => {
    if (!dlg.root.isConnected) {
      document.removeEventListener(WATCHLIST_CHANGED, onChange);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });
  await render();
}

function categoryControl(): HTMLElement | null {
  const items = Array.from(document.querySelectorAll<HTMLElement>('#kefin-home-category-rail .kefin-home-category-item'));
  if (items.length < 2) return null;
  const group = h('div', { class: 'nebula-root nebula-navcats', role: 'group', 'aria-label': t('homeCategories') });
  for (const item of items) {
    const src = item.querySelector<HTMLButtonElement>('button');
    if (!src) continue;
    const label = (src.getAttribute('title') || src.getAttribute('data-nebula-tip') || src.getAttribute('aria-label') || item.textContent || '').trim();
    const glyph = src.querySelector('.material-icons')?.cloneNode(true) as HTMLElement | undefined;
    glyph?.classList.add('nebula-icon');
    const b = h(
      'button',
      {
        type: 'button',
        class: 'nebula-navcats__btn',
        'aria-pressed': String(item.classList.contains('is-active')),
        'data-category-id': item.getAttribute('data-category-id') ?? '',
      },
      glyph ?? null,
      h('span', { class: 'nebula-navcats__label' }, label),
    );
    b.setAttribute('aria-label', label);
    b.addEventListener('click', () => src.click());
    group.append(b);
  }
  return group;
}

function syncCategories(group: HTMLElement): void {
  for (const b of Array.from(group.querySelectorAll<HTMLElement>('.nebula-navcats__btn'))) {
    const item = document.querySelector(`#kefin-home-category-rail .kefin-home-category-item[data-category-id="${CSS.escape(b.dataset.categoryId ?? '')}"]`);
    b.setAttribute('aria-pressed', String(!!item?.classList.contains('is-active')));
  }
}

export function installNavbarExtras(ctx: NebulaContext): () => void {
  const watchBtn = h(
    'button',
    { type: 'button', class: 'nebula-root nebula-nav-watchlist', 'aria-label': t('watchlist'), title: t('watchlist') },
    icon('bookmarks'),
  );
  watchBtn.addEventListener('click', () => void openWatchlistPanel(ctx));
  let cats: HTMLElement | null = null;
  let toolbarObserver: MutationObserver | null = null;
  let railObserver: MutationObserver | null = null;
  let observedToolbar: Element | null = null;

  const ensure = () => {
    const toolbar = document.querySelector('header.MuiAppBar-root:not(.dashboard-appBar) > .MuiToolbar-root');
    if (!toolbar) return;
    if (observedToolbar !== toolbar) {
      toolbarObserver?.disconnect();
      toolbarObserver = new MutationObserver(() => ensure());
      toolbarObserver.observe(toolbar, { childList: true });
      observedToolbar = toolbar;
    }
    // Pulsante watchlist: nel box azioni, prima della ricerca.
    const actions = toolbar.children[toolbar.children.length - 2];
    if (actions && watchBtn.parentElement !== actions) {
      const search = actions.querySelector(':scope > a[href^="#/search"]');
      actions.insertBefore(watchBtn, search);
    }
    // Categorie home: subito dopo i link, solo in home.
    const onHome = currentRoute().path === 'home';
    if (onHome && !cats) {
      cats = categoryControl();
      if (cats) document.documentElement.classList.add('nebula-navcats-on');
    }
    if (!onHome && cats) {
      cats.remove();
      cats = null;
      document.documentElement.classList.remove('nebula-navcats-on');
    }
    const stack = toolbar.querySelector(':scope > .MuiStack-root');
    if (cats) {
      // Desktop: subito dopo i link. Mobile (niente link nella barra): prima del box azioni.
      if (stack && cats.previousElementSibling !== stack) stack.after(cats);
      else if (!stack && actions && cats.nextElementSibling !== actions) actions.before(cats);
    }
    // Stato attivo sincronizzato con KefinTweaks (che può cambiare categoria anche da sé).
    const rail = document.querySelector('#kefin-home-category-rail');
    if (cats && rail && !railObserver) {
      railObserver = new MutationObserver(() => cats && syncCategories(cats));
      railObserver.observe(rail, { attributes: true, attributeFilter: ['class'], subtree: true });
    }
    if (!cats) {
      railObserver?.disconnect();
      railObserver = null;
    }
  };

  const onRoute = () => requestAnimationFrame(ensure);
  window.addEventListener('hashchange', onRoute);
  document.addEventListener('viewshow', onRoute);
  ensure();
  // KefinTweaks costruisce la barra categorie dopo la home: un secondo tentativo a home dipinta.
  document.addEventListener('kefinTweaksHomePainted', onRoute);

  return () => {
    window.removeEventListener('hashchange', onRoute);
    document.removeEventListener('viewshow', onRoute);
    document.removeEventListener('kefinTweaksHomePainted', onRoute);
    toolbarObserver?.disconnect();
    railObserver?.disconnect();
    watchBtn.remove();
    cats?.remove();
    document.documentElement.classList.remove('nebula-navcats-on');
  };
}
