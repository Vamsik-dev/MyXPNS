import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'transactions' }
  | { name: 'reports' }
  | { name: 'settings' }
  | { name: 'add'; type: 'SPENT' | 'RECEIVED' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === 'transactions') return { name: 'transactions' };
  if (path === 'reports') return { name: 'reports' };
  if (path === 'settings') return { name: 'settings' };
  if (path === 'add/spent') return { name: 'add', type: 'SPENT' };
  if (path === 'add/received') return { name: 'add', type: 'RECEIVED' };
  return { name: 'home' };
}

export function hrefFor(route: Route): string {
  return route.name === 'add' ? `#/add/${route.type.toLowerCase()}` : `#/${route.name}`;
}

export function navigate(route: Route, opts: { replace?: boolean } = {}) {
  const href = hrefFor(route);
  if (opts.replace) window.history.replaceState(null, '', href);
  else window.history.pushState(null, '', href);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  window.addEventListener('popstate', cb);
  return () => {
    window.removeEventListener('hashchange', cb);
    window.removeEventListener('popstate', cb);
  };
}

export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash, () => '');
}

export function useRoute(): Route {
  return parseHash(useHash());
}
