const CACHE_NAME = 'my-pwa-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/images/icon-192.png',
    '/images/icon-512.png',
    '/images/icon-180.png'
];

// Установка Service Worker и кэширование файлов
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Кэш открыт');
                return cache.addAll(urlsToCache);
            })
    );
});

// Перехват запросов и возврат кэшированных файлов, если нет сети
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Если есть в кэше, возвращаем из кэша
                if (response) {
                    return response;
                }
                
                // Иначе запрашиваем из сети
                return fetch(event.request).then(
                    response => {
                        // Проверяем, валидный ли ответ
                        if(!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Клонируем ответ (он потребляется только один раз)
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    }
                );
            })
    );
});

// Очистка старого кэша при обновлении
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
})

// Регистрация Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(
            function(registration) {
                console.log('Service Worker зарегистрирован успешно:', registration.scope);
            },
            function(err) {
                console.log('Ошибка регистрации Service Worker:', err);
            }
        );
    });
}