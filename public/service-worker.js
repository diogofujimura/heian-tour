// Service Worker "kill-switch" — Heian Tour
// O SW antigo cacheava '/' e '/index.html' e podia servir versões velhas do
// portal para quem já tinha visitado o site. Esta versão remove todos os
// caches antigos e se desregistra, devolvendo o controle 100% à rede.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Apaga todos os caches criados por versões anteriores
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((nome) => caches.delete(nome)));

      // Desregistra este service worker
      await self.registration.unregister();

      // Recarrega as abas controladas para que voltem a usar a rede direto
      const clientsList = await self.clients.matchAll({ type: 'window' });
      clientsList.forEach((client) => {
        try { client.navigate(client.url); } catch (e) { /* ignora */ }
      });
    })()
  );
});
