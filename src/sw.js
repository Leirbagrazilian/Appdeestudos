// Service worker próprio (injectManifest): precache do app + aviso "cobrança" com o app fechado (Periodic Background Sync).
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';
import * as db from './lib/db.js';
import { iso } from './lib/dates.js';
import { decidirAviso, feitoDoResumo } from './lib/avisos.js';

// autoUpdate: a versão nova assume sem esperar
self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

const urlHoje = () => new URL('./#/hoje', self.registration.scope).href;

async function cobrar() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const [geral, notificados, done] = await Promise.all([db.get('kv', 'resumoAvisos'), db.get('kv', 'notificados'), db.all('done')]);
  if (!geral?.ativo) return;
  const agora = new Date(), dia = iso(agora);
  const resumo = geral.dias?.[dia];
  const aviso = decidirAviso({ resumo, feito: feitoDoResumo(resumo, done), agora: agora.getHours() * 60 + agora.getMinutes(), notificados: notificados ?? {}, tom: geral.tom });
  if (!aviso) return;
  await db.put('kv', 'notificados', { ...(notificados ?? {}), [aviso.chave]: 1 });
  await self.registration.showNotification(aviso.titulo, { body: aviso.corpo, tag: 'cobranca', icon: 'icon-192.png', data: { url: urlHoje() } });
}

self.addEventListener('periodicsync', (e) => { if (e.tag === 'cobranca') e.waitUntil(cobrar()); });

// Toque na notificação: abre o app na Hoje.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url ?? urlHoje();
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = abertas[0];
    if (c) { try { await c.focus(); if ('navigate' in c) return await c.navigate(url); } catch {} }
    return self.clients.openWindow(url);
  })());
});
