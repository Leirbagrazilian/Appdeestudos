import seed from '../data/seed.json';
import * as db from '../lib/db.js';
import { today } from '../lib/dates.js';
import { gerarFases } from '../lib/phases.js';
import { agendarRevisoes } from '../lib/spaced.js';
import { verificar } from '../lib/notify.js';

export const app = $state({ pronto: false, cfg: structuredClone(seed), done: {}, reviews: {}, errors: {}, exams: {}, dia: today(), toast: null });
export const fases = () => gerarFases(app.cfg);

export async function iniciar() {
  const salvo = await db.get('kv', 'config');
  if (salvo) app.cfg = salvo;
  app.done = await db.all('done');
  app.reviews = await db.all('reviews');
  app.errors = await db.all('errors');
  app.exams = await db.all('exams');
  verificar(app.cfg, app.reviews, app.dia);
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

const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/** Registra um erro e agenda as revisões de 1, 7 e 30 dias. */
export async function addErro({ materia, assunto, tipo }) {
  const id = novoId(), e = { id, materia, assunto: assunto.trim(), tipo, dia: app.dia };
  app.errors[id] = e; await db.put('errors', id, e);
  for (const r of agendarRevisoes({ origem: `erro:${id}`, assunto: e.assunto, materia, dia: app.dia })) { app.reviews[r.id] = r; await db.put('reviews', r.id, r); }
}
export async function delErro(id) {
  delete app.errors[id]; await db.del('errors', id);
  for (const k of Object.keys(app.reviews)) if (app.reviews[k].origem === `erro:${id}`) { delete app.reviews[k]; await db.del('reviews', k); }
}
export async function addExame(ex) { const id = novoId(); app.exams[id] = { id, ...ex }; await db.put('exams', id, { id, ...ex }); }
export async function delExame(id) { delete app.exams[id]; await db.del('exams', id); }

/** Substitui tudo pelos dados de um backup validado. */
export async function importar(d) {
  for (const s of ['done', 'reviews', 'errors', 'exams']) { for (const k of Object.keys(await db.all(s))) await db.del(s, k); for (const [k, v] of Object.entries(d[s])) await db.put(s, k, v); app[s] = d[s]; }
  app.cfg = d.cfg; await salvarCfg();
}
export async function restaurarSeed() { app.cfg = structuredClone(seed); await salvarCfg(); }
