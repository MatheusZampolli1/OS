// Guarda o app e as bibliotecas para abrir sem internet na obra.
// Pedidos ao servidor de contas (supabase.co) nunca passam pelo cache: são dados pessoais.
var CACHE = 'ta-orcado-v17';
var ARQUIVOS = [
  './',
  './index.html',
  './conta.js',
  './manifest.webmanifest',
  './icone-192.png',
  './icone-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARQUIVOS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = e.request.url;
  var nosso = url.indexOf(self.registration.scope) === 0 || ARQUIVOS.indexOf(url) >= 0;
  if (!nosso) return;
  // rede primeiro (para receber atualizações), cópia guardada quando estiver sem internet
  e.respondWith(fetch(e.request).then(function (r) {
    if (r.ok) { var copia = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copia); }); }
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
