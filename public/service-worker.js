const CACHE_NAME = 'heian-tour-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/logo-192.png',
  '/assets/logo-512.png'
];

// Instalação do Service Worker e Caching dos recursos estáticos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Cacheando assets básicos');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia: Network First (Rede Primeiro)
// Prioriza buscar na rede para garantir a versão mais recente.
// Fallback para cache se a internet estiver offline.
self.addEventListener('fetch', (event) => {
  // Ignora chamadas de API internas ou externas e métodos não-GET (POST, PUT, PATCH, DELETE)
  if (event.request.url.includes('/api/') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se a resposta for válida, salva no cache para uso offline posterior
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Se falhar (offline), tenta recuperar do cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Caso não ache no cache e esteja sem internet, retorna erro ou página básica
          return new Response('Sem conexão com a internet.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
          });
        });
      })
  );
});
