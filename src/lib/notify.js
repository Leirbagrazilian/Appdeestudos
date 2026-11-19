import * as db from './db.js';
import { alertasInscricao } from './alerts.js';
import { vencidas } from './spaced.js';
import { horariosNoite } from './sono.js';

export const suportado = () => typeof Notification !== 'undefined';
export async function pedir() { return suportado() ? Notification.requestPermission() : 'denied'; }

async function mostrar(titulo, corpo, tag) {
  const opts = { body: corpo, tag, icon: 'icon-192.png' };
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) return reg.showNotification(titulo, opts); } catch {}
  new Notification(titulo, opts);
}
/** Roda ao abrir o app: no máximo uma notificação de cada tipo por dia. */
export async function verificar(cfg, reviews, dia) {
  if (!suportado() || Notification.permission !== 'granted' || !cfg.notificacoes) return;
  const feitos = (await db.get('kv', 'notificados')) ?? {};
  const novo = async (k) => { if (feitos[k]) return false; feitos[k] = 1; await db.put('kv', 'notificados', feitos); return true; };
  for (const a of alertasInscricao(cfg, dia)) {
    if (![14, 7, 1, 0].includes(a.dias)) continue;
    if (await novo(`${dia}:${a.concurso.id}`)) await mostrar(`Inscrição ${a.concurso.nome}`, a.dias === 0 ? 'Fecha hoje!' : `Fecha em ${a.dias} dia(s).`, `insc-${a.concurso.id}`);
  }
  const v = vencidas(Object.values(reviews), dia);
  if (v.length && (await novo(`${dia}:rev`))) await mostrar('Revisões de hoje', `${v.length} revisão(ões) esperando no checklist.`, 'rev');
}

// ---------- avisos com o app fechado (Periodic Background Sync, só Chrome/Android com o app instalado) ----------
export const TAG_COBRANCA = 'cobranca';
export const periodicoSuportado = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof ServiceWorkerRegistration !== 'undefined' && 'periodicSync' in ServiceWorkerRegistration.prototype;
/** Pede a permissão e registra o aviso periódico (mínimo de 1 h; o Chrome decide a frequência real). Devolve true se ficou registrado. */
export async function registrarPeriodico() {
  if (!periodicoSuportado()) return false;
  try {
    const p = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (p.state === 'denied') return false;
    const reg = await navigator.serviceWorker.ready;
    await reg.periodicSync.register(TAG_COBRANCA, { minInterval: 3600e3 });
    return true;
  } catch { return false; }
}
export async function cancelarPeriodico() {
  try { const reg = await navigator.serviceWorker?.ready; await reg?.periodicSync?.unregister(TAG_COBRANCA); } catch {}
}

let timerTelas;
/** Telas desligadas (30 min antes de dormir): notificação enquanto o app está aberto (sem backend, não há como avisar com o app fechado). */
export function agendarTelas(cfg, dia, ctx = {}) {
  clearTimeout(timerTelas);
  if (!suportado() || Notification.permission !== 'granted' || !cfg.notificacoes || !cfg.sono) return;
  const h = horariosNoite(cfg, dia, ctx), [hh, mm] = h.telas.split(':').map(Number);
  const alvo = new Date(); alvo.setHours(hh, mm, 0, 0);
  const falta = alvo.getTime() - Date.now();
  if (falta > 0 && falta < 20 * 3600e3) timerTelas = setTimeout(() => mostrar('Telas desligadas', `Dormir às ${h.dormir}. Terço às ${h.terco}.`, 'telas'), falta);
}
