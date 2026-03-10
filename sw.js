const CACHE_NAME = 'link-stack-v2';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  const reqUrl = new URL(event.request.url);
  if (reqUrl.pathname.endsWith('/share-target') && event.request.method === 'POST') {
    event.respondWith((async () => {
      const formData = await event.request.formData();
      const title = String(formData.get('title') || '');
      const text = String(formData.get('text') || '');
      const url = String(formData.get('url') || '');
      const redirectUrl = new URL('./', self.location.href);
      if (title) redirectUrl.searchParams.set('title', title);
      if (text) redirectUrl.searchParams.set('text', text);
      if (url) redirectUrl.searchParams.set('url', url);
      return Response.redirect(redirectUrl.toString(), 303);
    })());
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request);
    })
  );
});
