import { afterEach, expect, it, vi } from 'vitest';
import { installRouteEvents, ROUTE_CHANGED } from '../../src/scripts/route-events';

let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  stop = undefined;
});

it('emette ROUTE_CHANGED per pushState/replaceState del router React (niente hashchange)', () => {
  const onRoute = vi.fn();
  window.addEventListener(ROUTE_CHANGED, onRoute);
  stop = installRouteEvents();
  history.pushState(null, '', '#/home?nebula=watchlist');
  history.pushState(null, '', '#/home?tab=1');
  history.replaceState(null, '', '#/home?tab=1'); // stesso URL: nessun evento
  expect(onRoute).toHaveBeenCalledTimes(2);
  window.removeEventListener(ROUTE_CHANGED, onRoute);
});

it('ripristina gli originali allo stop e resta trasparente se un altro script li ha avvolti', () => {
  const original = history.pushState;
  stop = installRouteEvents();
  expect(history.pushState).not.toBe(original);
  stop();
  stop = undefined;
  expect(history.pushState).toBe(original);

  const onRoute = vi.fn();
  window.addEventListener(ROUTE_CHANGED, onRoute);
  const off = installRouteEvents();
  const ours = history.pushState;
  const other = function (this: History, ...args: Parameters<History['pushState']>) {
    return ours.apply(this, args);
  };
  history.pushState = other;
  off();
  expect(history.pushState).toBe(other); // non sovrascrive il wrapper altrui
  history.pushState(null, '', '#/details?id=x');
  expect(onRoute).not.toHaveBeenCalled();
  history.pushState = original;
  window.removeEventListener(ROUTE_CHANGED, onRoute);
});
