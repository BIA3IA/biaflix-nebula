/** Classi di stato su <html> usate dal CSS: Nebula attiva, layout, route corrente. */
import { isModernLayout } from '../env';
import type { Feature } from '../lifecycle';

export const ACTIVE_CLASS = 'nebula-active';

export function applyShell(): () => void {
  const root = document.documentElement;
  root.classList.add(ACTIVE_CLASS, isModernLayout() ? 'nebula-layout-modern' : 'nebula-layout-legacy');
  return () => {
    root.classList.remove(ACTIVE_CLASS, 'nebula-layout-modern', 'nebula-layout-legacy');
    root.removeAttribute('data-nebula-route');
  };
}

export const routeMarker: Feature = {
  name: 'route-marker',
  routes: ['*'],
  mount({ path }) {
    document.documentElement.setAttribute('data-nebula-route', path);
  },
};
