import { precacheAndRoute }     from 'workbox-precaching';
import { registerRoute }        from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

// precache your build output
precacheAndRoute(self.__WB_MANIFEST);

// Cache API calls for feed items
registerRoute(
  ({ url }) => url.pathname.startsWith('/items'),
  new StaleWhileRevalidate({ cacheName: 'api-items' })
);

// Cache your HTML shell
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new StaleWhileRevalidate({ cacheName: 'shell' })
);
