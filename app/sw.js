// Guarda o app e as bibliotecas para abrir sem internet na obra.
// Pedidos ao servidor de contas (supabase.co) nunca passam pelo cache: são dados pessoais.
var CACHE = 'ta-orcado-v20';
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
  // os arquivos do app são obrigatórios; as bibliotecas de fora entram se der (uma falha não derruba o modo sem internet)
  var locais = ARQUIVOS.filter(function (u) { return u.indexOf('https://') !== 0; });
  var fora = ARQUIVOS.filter(function (u) { return u.indexOf('https://') === 0; });
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(locais).then(function () { return Promise.all(fora.map(function (u) { return c.add(u).catch(function () {}); })); });
  }).then(function () { return self.skipWaiting(); }));
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
  // bibliotecas de fora têm versão fixa no endereço: cópia guardada primeiro (sinal fraco na obra não trava o app)
  if (url.indexOf('https://') === 0 && url.indexOf(self.registration.scope) !== 0) {
    e.respondWith(caches.match(e.request).then(function (r) {
      return r || fetch(e.request).then(function (resp) { if (resp.ok) { var cp = resp.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, cp); }); } return resp; });
    }));
    return;
  }
  // arquivos do app: rede primeiro (para receber atualizações), mas com sinal fraco usa a cópia guardada depois de 3 s
  e.respondWith(new Promise(function (ok) {
    var feito = false, guardada = null;
    function usar(r) { if (!feito && r) { feito = true; ok(r); } }
    caches.match(e.request, { ignoreSearch: true }).then(function (r) { guardada = r; });
    var t = setTimeout(function () { if (guardada) usar(guardada); }, 3000);
    fetch(e.request).then(function (r) {
      clearTimeout(t);
      if (r.ok) { var copia = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copia); }); }
      usar(r);
    }).catch(function () {
      clearTimeout(t);
      caches.match(e.request, { ignoreSearch: true }).then(function (r) { usar(r || Response.error()); });
    });
  }));
});
