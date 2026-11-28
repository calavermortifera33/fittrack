// Service worker de FitTrack: guarda una copia de la app en el móvil
// para que abra rápido y funcione aunque no haya internet.
// Cuando cambies index.html, sube este número (v1 -> v2) para que los móviles
// descarguen la versión nueva.
const VERSION = 'fittrack-v48';

const ARCHIVOS_APP = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

// Librerías externas que también guardamos para usar sin conexión.
const LIBRERIAS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install', evento => {
  evento.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(ARCHIVOS_APP);
    // Las librerías externas se guardan "como vengan" (si fallan, no pasa nada).
    await Promise.all(LIBRERIAS.map(url =>
      fetch(url, { mode: 'no-cors' }).then(r => cache.put(url, r)).catch(() => {})
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', evento => {
  // Borra las copias de versiones antiguas.
  evento.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter(n => n !== VERSION).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', evento => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;
  const url = new URL(peticion.url);

  // Open Food Facts: siempre a internet (datos frescos), nunca de la copia.
  if (url.hostname.endsWith('openfoodfacts.org')) return;

  // La página principal: primero internet (para tener la última versión);
  // si no hay conexión, usamos la copia guardada.
  if (peticion.mode === 'navigate') {
    evento.respondWith(
      fetch(peticion)
        .then(r => { const copia = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', copia)); return r; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Resto (iconos, librerías, Tesseract…): primero la copia; si no está, internet y la guardamos.
  evento.respondWith(
    caches.match(peticion).then(guardada => guardada || fetch(peticion).then(r => {
      if (r && (r.ok || r.type === 'opaque')) {
        const copia = r.clone();
        caches.open(VERSION).then(c => c.put(peticion, copia));
      }
      return r;
    }))
  );
});
