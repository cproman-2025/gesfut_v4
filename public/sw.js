const CACHE_NAME = 'gesfut-cache-v1';
const urlsToCache = [
  '/', 
  '/manifest.json',
  // No incluimos los iconos de placehold.co aquí, ya que son externos.
  // El navegador los cacheará de forma normal.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('ServiceWorker: Cache abierto, cacheando app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('ServiceWorker: Falló el cacheo del app shell:', err);
      })
  );
});

self.addEventListener('fetch', (event) => {
  // Solo nos preocupamos por las peticiones GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          // Cache hit - return response
          // console.log('ServiceWorker: Recurso encontrado en caché:', event.request.url);
          return response;
        }

        // console.log('ServiceWorker: Recurso no encontrado en caché, buscando en red:', event.request.url);
        return fetch(event.request).then(
          (networkResponse) => {
            // Comprobar si recibimos una respuesta válida
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && !event.request.url.startsWith('https://placehold.co')) {
              return networkResponse;
            }

            // Clonar la respuesta. Una respuesta es un stream y solo se puede consumir una vez.
            // Necesitamos clonarla para tener dos streams: uno para el navegador y otro para la caché.
            const responseToCache = networkResponse.clone();

            // Si la petición es para placehold.co, o si es para nuestro origen y está en urlsToCache, la cacheamos.
            // No cachearemos todas las peticiones del mismo origen para evitar llenar la caché con cosas innecesarias (como APIs o assets dinámicos de Next.js).
            if (event.request.url.startsWith('https://placehold.co') || (event.request.url.startsWith(self.location.origin) && urlsToCache.includes(new URL(event.request.url).pathname))) {
                caches.open(CACHE_NAME)
                .then((cache) => {
                    // console.log('ServiceWorker: Cacheando nuevo recurso:', event.request.url);
                    cache.put(event.request, responseToCache);
                });
            }
            
            return networkResponse;
          }
        ).catch(() => {
          // Si la red falla y no está en caché, podrías devolver una página offline.
          // Por ahora, simplemente dejamos que el navegador maneje el error.
          // Ejemplo: return caches.match('/offline.html');
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('ServiceWorker: Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
