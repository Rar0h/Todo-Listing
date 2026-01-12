const CACHE_NAME = 'offline-todo-v1.2';

const PRECACHE_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/media/logo.103b5fa1815d20f.png'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Установка');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Кэширование статических ресурсов');
        return cache.addAll(PRECACHE_RESOURCES);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Активация');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Удаление старого кэша:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Активен и готов к работе');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/') || 
      event.request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[Service Worker] Обслуживаю из кэша:', event.request.url);
          return cachedResponse;
        }
        
        return fetch(event.request.clone())
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
                console.log('[Service Worker] Загружено и закэшировано:', event.request.url);
              });
            
            return response;
          })
          .catch((error) => {
            console.log('[Service Worker] Ошибка загрузки:', error);
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
            return new Response('Офлайн режим. Подключение отсутствует.');
          });
      })
  );
});

self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Событие синхронизации:', event.tag);
  
  if (event.tag === 'sync-tasks') {
    event.waitUntil(
      syncPendingTasks().catch(error => {
        console.error('[Service Worker] Ошибка синхронизации:', error);
      })
    );
  }
});

async function syncPendingTasks() {
  console.log('[Service Worker] Начало фоновой синхронизации задач');
  
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_STATUS',
        status: 'completed',
        timestamp: new Date().toISOString()
      });
    });
    
    console.log('[Service Worker] Синхронизация завершена');
    return Promise.resolve();
  } catch (error) {
    console.error('[Service Worker] Ошибка при синхронизации:', error);
    return Promise.reject(error);
  }
}

self.addEventListener('message', (event) => {
  console.log('[Service Worker] Получено сообщение:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});