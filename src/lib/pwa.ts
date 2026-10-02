/** Registers the service worker in production builds only (dev uses Vite's live reload). */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* The app works without it; it only adds offline shell + install support. */
    });
  });
}
