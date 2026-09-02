/**
 * COMARA - Progressive Web App Service Worker
 * Gestão de Pessoal e Banco de Horas SPTF
 * 
 * Estratégia de Cache:
 * - Shell Estático & Assets: Cache-First com revalidação em segundo plano
 * - Navegação HTML: Network-First com fallback para cache
 * - APIs / Firestore / Auth: BYPASS TOTAL (Network-Only sem cache de dados sensíveis)
 */

const CACHE_NAME = 'comara-pwa-v1.0.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/comara-logo.svg',
  '/comara-logo.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/favicon.png'
];

// Instalação do Service Worker - Pré-cache de assets essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usar individualmente para não falhar se algum asset pontual não existir
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          fetch(url)
            .then((response) => {
              if (response.ok) {
                return cache.put(url, response);
              }
            })
            .catch(() => {
              // Ignora falhas de pre-cache individual
            })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Ativação do Service Worker - Limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições de rede
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. REGRAS DE EXCLUSÃO CRÍTICA (NÃO CACHEAR):
  // Apenas requisições GET
  if (request.method !== 'GET') {
    return;
  }

  // Ignorar extensões do navegador
  if (url.protocol.startsWith('chrome-extension') || url.protocol.startsWith('moz-extension')) {
    return;
  }

  // BYPASS COMPLETO para Firebase Auth, Firestore, Google APIs e Tokens
  const isExcludedApi = 
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('firebase') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/__/auth/');

  if (isExcludedApi) {
    // Network-only para chamadas de banco e autenticação
    return;
  }

  // 2. NAVEGAÇÃO DE PÁGINAS (HTML): Network-First com fallback para cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const indexFallback = await caches.match('/index.html');
          if (indexFallback) {
            return indexFallback;
          }
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>COMARA - Offline</title></head><body style="background:#0F1B33;color:#E2E8F0;font-family:sans-serif;text-align:center;padding:50px;"><h2>Modo Offline</h2><p>O aplicativo está sem conexão no momento. Conecte-se para sincronizar com o Cloud Firestore.</p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // 3. ASSETS ESTÁTICOS LOCAIS (JS, CSS, Imagens, Fontes): Cache-First com atualização em background
  const isStaticAsset = 
    url.origin === self.location.origin && (
      url.pathname.startsWith('/assets/') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.ico') ||
      url.pathname.endsWith('.woff') ||
      url.pathname.endsWith('.woff2') ||
      url.pathname.endsWith('.json')
    );

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Revalida em segundo plano
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse);
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }

        // Se não estava no cache, busca na rede
        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
  }
});
