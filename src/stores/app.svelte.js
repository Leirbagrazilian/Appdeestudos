import seed from '../data/seed.json';
import * as db from '../lib/db.js';
import { today } from '../lib/dates.js';
import { gerarFases } from '../lib/phases.js';
import { agendarRevisoes } from '../lib/spaced.js';

export const app = $state({ pronto: false, cfg: structuredClone(seed), done: {}, reviews: {}, dia: today(), toast: null });
export const fases = () => gerarFases(app.cfg);

export async function iniciar() {
  const salvo = await db.get('kv', 'config');
  if (salvo) app.cfg = salvo;
  app.done = await db.all('done');
  app.reviews = await db.all('reviews');
  app.pronto = true;
  // atualiza o "hoje" se o app ficar aberto na virada do dia
  document.addEventListener('visibilitychange', () => { if (!document.hidden) app.dia = today(); });
}

export async function salvarCfg() { await db.put('kv', 'config', $state.snapshot(app.cfg)); }

let timer;
function avisar(msg, desfazer) {
  clearTimeout(timer);
  app.toast = { msg, desfazer };
  timer = setTimeout(() => (app.toast = null), 5000);
}

/** Marca/desmarca um bloco. Se tiver assunto, agenda revisões em 1, 7 e 30 dias. */
export async function alternarBloco(b, assunto = '') {
  if (app.done[b.id]) return desmarcar(b.id);
  const reg = { min: b.min, ts: Date.now(), materia: b.materia, assunto: assunto.trim() };
  app.done[b.id] = reg; await db.put('done', b.id, $state.snapshot(reg));
  if (reg.assunto) for (const r of agendarRevisoes({ origem: b.id, assunto: reg.assunto, materia: b.materia, dia: app.dia })) {
    app.reviews[r.id] = r; await db.put('reviews', r.id, r);
  }
  avisar(`${b.titulo} concluído`, () => desmarcar(b.id));
}

export async function desmarcar(id) {
  delete app.done[id]; await db.del('done', id);
  for (const k of Object.keys(app.reviews)) if (app.reviews[k].origem === id) { delete app.reviews[k]; await db.del('reviews', k); }
  app.toast = null;
}

export async function alternarRevisao(r) {
  const nova = { ...$state.snapshot(r), feita: !r.feita, feitaEm: r.feita ? null : app.dia };
  app.reviews[r.id] = nova; await db.put('reviews', r.id, nova);
  if (nova.feita) avisar(`Revisão de ${r.assunto} concluída`, () => alternarRevisao(app.reviews[r.id]));
}
