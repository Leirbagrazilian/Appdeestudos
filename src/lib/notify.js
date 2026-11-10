import * as db from './db.js';
import { alertasInscricao } from './alerts.js';
import { vencidas } from './spaced.js';

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
