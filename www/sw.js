// www/sw.js
import { precacheAndRoute } 
  from 'https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-precaching.module.js';
import { registerRoute } 
  from 'https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-routing.module.js';
import { StaleWhileRevalidate } 
  from 'https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-strategies.module.js';

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ url }) => url.pathname.startsWith('/items'),
  new StaleWhileRevalidate({ cacheName: 'api-items' })
);

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new StaleWhileRevalidate({ cacheName: 'shell' })
);
