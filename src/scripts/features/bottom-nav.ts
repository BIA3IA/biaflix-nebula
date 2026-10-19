/**
 * Barra di navigazione mobile (glass, fluttuante in basso): max 5 destinazioni reali.
 * Home, Film, Serie TV, Raccolte (solo se la libreria esiste). La ricerca resta nella barra in alto.
 * I link puntano alle route vere di Jellyfin 12 (#/movies?topParentId=…), quindi back/forward,
 * refresh e deep link restano nativi. Visibile solo sotto i 900px (CSS), mai nel player.
 */
import type { NebulaContext } from '../context';
import { currentRoute } from '../env';
import { t } from '../i18n';
import type { BaseItem } from '../jellyfin-api';
import { h, icon } from '../ui/dom';

interface NavEntry {
  key: string;
  label: string;
  glyph: string;
  href: string;
  /** Route Jellyfin che rendono attiva la voce. */
  match: (path: string, params: URLSearchParams) => boolean;
}

type View = BaseItem & { CollectionType?: string };

export function libraryHref(view: View): string {
  const type = view.CollectionType ?? '';
  const route = type === 'tvshows' ? 'tv' : type;
  return `#/${route}?topParentId=${encodeURIComponent(view.Id)}&collectionType=${encodeURIComponent(type)}`;
}

export function buildEntries(views: View[]): NavEntry[] {
  const first = (type: string) => views.find((v) => v.CollectionType === type);
  const movies = first('movies');
  const shows = first('tvshows');
  const boxsets = first('boxsets');
  const entries: NavEntry[] = [
    { key: 'home', label: t('navHome'), glyph: 'home', href: '#/home', match: (p, q) => p === 'home' && (!q.get('tab') || q.get('tab') === '0') },
  ];
  if (movies) entries.push({ key: 'movies', label: t('movies'), glyph: 'movie', href: libraryHref(movies), match: (p) => p === 'movies' });
  if (shows) entries.push({ key: 'shows', label: t('series'), glyph: 'live_tv', href: libraryHref(shows), match: (p) => p === 'tv' });
  if (boxsets)
    entries.push({
      key: 'collections',
      label: t('collections'),
      glyph: 'collections_bookmark',
      href: libraryHref(boxsets),
      match: (p) => p === 'boxsets' || p === 'playlists',
    });
  return entries;
}

export async function installBottomNav(ctx: NebulaContext): Promise<() => void> {
  const views = (await ctx.api.getUserViews().catch(() => ({ Items: [] as View[] }))).Items;
  const entries = buildEntries(views);
  const links = entries.map((e) =>
    h('a', { class: 'nebula-bottomnav__item', href: e.href, 'data-key': e.key }, icon(e.glyph), h('span', { class: 'nebula-bottomnav__label' }, e.label)),
  );
  const nav = h('nav', { class: 'nebula-root nebula-bottomnav', 'aria-label': t('mainNav') }, links);

  const sync = () => {
    const { path, params } = currentRoute();
    entries.forEach((e, i) => {
      if (e.match(path, params)) links[i]!.setAttribute('aria-current', 'page');
      else links[i]!.removeAttribute('aria-current');
    });
  };
  sync();
  document.body.append(nav);
  document.documentElement.classList.add('nebula-has-bottomnav');
  window.addEventListener('hashchange', sync);
  return () => {
    window.removeEventListener('hashchange', sync);
    nav.remove();
    document.documentElement.classList.remove('nebula-has-bottomnav');
  };
}
