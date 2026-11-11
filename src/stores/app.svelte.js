import seed from '../data/seed.json';
import * as db from '../lib/db.js';
import { today } from '../lib/dates.js';
import { gerarFases } from '../lib/phases.js';
import { agendarRevisoes, avaliar } from '../lib/spaced.js';
import { verificar } from '../lib/notify.js';
import { prefs, aplicarPrefs, vibrar } from '../lib/prefs.js';
import { sino } from '../lib/audio.js';
import { conquistas } from '../lib/conquistas.js';
import * as foco from '../lib/foco.js';
import { treinar } from '../lib/erros.js';
import { montar } from '../lib/backup.js';
import { migrarCfg } from '../lib/migracao.js';

// Dados guardados como chave única no "kv" do IndexedDB.
const EXTRAS = { adiados: {}, dificeis: {}, lacunas: {}, cumpridos: {}, vistos: { conquistas: {}, capitulos: {} }, redacoes: {} };

export const app = $state({
  pronto: false, cfg: structuredClone(seed), done: {}, reviews: {}, errors: {}, exams: {},
  ...structuredClone(EXTRAS), timer: null, dia: today(), toast: null, insignia: null,
  ultimoBackup: null, lembreteAdiado: null, persistente: null,
});
export const fases = () => gerarFases(app.cfg);
export const ajustes = () => ({ adiados: app.adiados, dificeis: app.dificeis });
export const pf = () => prefs(app.cfg);
const snap = (v) => $state.snapshot(v);

export async function iniciar() {
  const salvo = await db.get('kv', 'config');
  if (salvo) {
    const antes = salvo.versaoSeed ?? 1;
    app.cfg = migrarCfg(salvo, seed); // traz conteúdo novo do seed sem perder o que você editou
    if ((app.cfg.versaoSeed ?? 1) !== antes) await db.put('kv', 'config', snap(app.cfg));
  }
  aplicarPrefs(pf());
  app.done = await db.all('done');
  app.reviews = await db.all('reviews');
  app.errors = await db.all('errors');
  app.exams = await db.all('exams');
  for (const k of Object.keys(EXTRAS)) app[k] = (await db.get('kv', k)) ?? structuredClone(EXTRAS[k]);
  app.timer = (await db.get('kv', 'timer')) ?? null;
  app.ultimoBackup = (await db.get('kv', 'ultimoBackup')) ?? null;
  app.lembreteAdiado = (await db.get('kv', 'lembreteAdiado')) ?? null;
  protegerDados();
  // Primeira vez com insígnias: as já conquistadas entram como vistas, sem enxurrada de avisos.
  if (!Object.keys(app.vistos.conquistas).length) { for (const c of conquistas(dadosConquistas())) if (c.ok) app.vistos.conquistas[c.id] = true; await salvarKV('vistos'); }
  verificar(app.cfg, app.reviews, app.dia);
  app.pronto = true;
  // atualiza o "hoje" se o app ficar aberto na virada do dia
  document.addEventListener('visibilitychange', () => { if (!document.hidden) app.dia = today(); });
}

export async function salvarCfg() { aplicarPrefs(pf()); await db.put('kv', 'config', snap(app.cfg)); }
export const salvarKV = (k) => db.put('kv', k, snap(app[k]));

let timerToast;
const ELOGIOS = ['Mais um morcego no céu.', 'A cidade está mais segura.', 'Missão cumprida, Gabriel.', 'Constância é o seu superpoder.', 'Assim se constrói uma aprovação.', 'Um passo mais perto da farda.', 'Bom trabalho. Respire e siga.', 'Uma janela a mais acesa na cidade.'];
export function avisar(msg, desfazer, sub) {
  clearTimeout(timerToast);
  app.toast = { msg, desfazer, sub: sub ?? ELOGIOS[Math.floor(Math.random() * ELOGIOS.length)] };
  timerToast = setTimeout(() => (app.toast = null), 5000);
}
function comemorar() { vibrar(pf(), 'ok'); if (pf().sons) sino(); }

// ---------- blocos ----------
async function registrar(b, extra = {}) {
  const reg = { min: b.min, ts: Date.now(), dia: app.dia, materia: b.materia, assunto: '', ...extra };
  reg.assunto = (reg.assunto ?? '').trim();
  app.done[b.id] = reg; await db.put('done', b.id, snap(reg));
  if (reg.assunto) for (const r of agendarRevisoes({ origem: b.id, assunto: reg.assunto, materia: b.materia, dia: app.dia })) {
    app.reviews[r.id] = r; await db.put('reviews', r.id, r);
  }
  comemorar();
  avisar(`${b.titulo} concluído`, () => desmarcar(b.id));
  checarConquistas();
}

/** Marca/desmarca um bloco. Se tiver assunto, agenda revisões em 1, 7 e 30 dias. */
export async function alternarBloco(b, assunto = '') {
  if (app.done[b.id]) return desmarcar(b.id);
  await registrar(b, { assunto });
}

export async function desmarcar(id) {
  delete app.done[id]; await db.del('done', id);
  for (const k of Object.keys(app.reviews)) if (app.reviews[k].origem === id) { delete app.reviews[k]; await db.del('reviews', k); }
  app.toast = null;
}

/** Passa um bloco para outro dia (sem culpa: ele só muda de lugar). */
export async function adiar(b, paraDia) {
  const antes = app.adiados[b.id];
  app.adiados[b.id] = paraDia; await salvarKV('adiados');
  vibrar(pf(), 'toque');
  avisar(`${b.titulo} foi para amanhã`, async () => {
    if (antes) app.adiados[b.id] = antes; else delete app.adiados[b.id];
    await salvarKV('adiados'); app.toast = null;
  }, 'Remarcar também é seguir o plano.');
}

export async function diaDificil(dia, ligar) {
  if (ligar) app.dificeis[dia] = true; else delete app.dificeis[dia];
  await salvarKV('dificeis');
  vibrar(pf(), 'toque');
}

export async function marcarCumprido(dia) {
  if (app.cumpridos[dia]) return;
  app.cumpridos[dia] = true; await salvarKV('cumpridos');
  checarConquistas();
}

// ---------- revisões ----------
export async function avaliarRevisao(r, nota) {
  const antes = Object.fromEntries(Object.entries(app.reviews).filter(([, x]) => x.origem === r.origem).map(([k, v]) => [k, snap(v)]));
  const { mudadas, novas } = avaliar(Object.values(snap(app.reviews)), snap(r), nota, app.dia);
  for (const x of [...mudadas, ...novas]) { app.reviews[x.id] = x; await db.put('reviews', x.id, x); }
  comemorar();
  const sub = { facil: 'Fácil: as próximas revisões ficaram mais espaçadas.', dificil: 'Difícil: entra uma revisão extra em 2 dias.' }[nota];
  avisar(`Revisão de ${r.assunto} concluída`, async () => {
    for (const x of novas) { delete app.reviews[x.id]; await db.del('reviews', x.id); }
    for (const [k, v] of Object.entries(antes)) { app.reviews[k] = v; await db.put('reviews', k, v); }
    app.toast = null;
  }, sub);
  checarConquistas();
}
export async function alternarRevisao(r) {
  if (!r.feita) return avaliarRevisao(r, 'ok');
  const nova = { ...snap(r), feita: false, feitaEm: null, nota: null };
  app.reviews[r.id] = nova; await db.put('reviews', r.id, nova);
}

// ---------- caderno de erros, simulados, lacunas ----------
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/** Registra um erro (lição e foto opcionais) e agenda as revisões de 1, 7 e 30 dias. */
export async function addErro({ materia, assunto, tipo, licao = '', foto = null }) {
  const id = novoId(), e = { id, materia, assunto: assunto.trim(), tipo, licao: licao.trim(), dia: app.dia, foto, status: 'novo' };
  app.errors[id] = e; await db.put('errors', id, e);
  for (const r of agendarRevisoes({ origem: `erro:${id}`, assunto: e.assunto, materia, dia: app.dia })) { app.reviews[r.id] = r; await db.put('reviews', r.id, r); }
  comemorar();
  checarConquistas();
}
export async function delErro(id) {
  delete app.errors[id]; await db.del('errors', id);
  for (const k of Object.keys(app.reviews)) if (app.reviews[k].origem === `erro:${id}`) { delete app.reviews[k]; await db.del('reviews', k); }
}
export async function atualizarErro(id, campos) {
  const e = { ...snap(app.errors[id]), ...campos };
  app.errors[id] = e; await db.put('errors', id, e);
}
/** Uma tentativa no treino de erros. Devolve o erro atualizado. */
export async function treinarErro(id, acertou) {
  const antes = snap(app.errors[id]);
  const e = treinar(antes, acertou, app.dia);
  app.errors[id] = e; await db.put('errors', id, e);
  vibrar(pf(), acertou ? 'ok' : 'toque');
  if (e.status === 'dominado' && antes.status !== 'dominado') { if (pf().sons) sino(); avisar(`${e.assunto}: dominado`, null, 'Dois acertos seguidos. Esse vilão foi preso.'); }
  checarConquistas();
  return e;
}

// ---------- redação ----------
export async function addRedacao(r) { const id = novoId(); app.redacoes[id] = { id, ...r }; await salvarKV('redacoes'); comemorar(); }
export async function delRedacao(id) { delete app.redacoes[id]; await salvarKV('redacoes'); }

// ---------- proteção dos dados e backup ----------
/** Pede ao navegador para não apagar os dados do app na limpeza automática. */
export async function protegerDados() {
  try {
    if (!navigator.storage?.persist) { app.persistente = false; return; }
    app.persistente = (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch { app.persistente = false; }
}
/** Gera o backup e abre o compartilhar do sistema (Drive, WhatsApp…); sem compartilhar, baixa o arquivo. */
export async function fazerBackup() {
  const nome = `estuda-gabriel-backup-${app.dia}.json`;
  const texto = montar(app);
  const arquivo = typeof File !== 'undefined' ? new File([texto], nome, { type: 'application/json' }) : null;
  try {
    if (arquivo && navigator.canShare?.({ files: [arquivo] })) await navigator.share({ files: [arquivo], title: 'Backup do Estuda Gabriel' });
    else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
      a.download = nome; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
  } catch (e) { if (e?.name === 'AbortError') return false; throw e; }
  app.ultimoBackup = app.dia; await db.put('kv', 'ultimoBackup', app.dia);
  avisar('Backup feito', null, 'Guarde o arquivo no Drive ou mande para você mesmo.');
  return true;
}
export async function adiarLembreteBackup() { app.lembreteAdiado = app.dia; await db.put('kv', 'lembreteAdiado', app.dia); }

export async function addExame(ex) { const id = novoId(); app.exams[id] = { id, ...ex }; await db.put('exams', id, { id, ...ex }); comemorar(); checarConquistas(); }
export async function delExame(id) { delete app.exams[id]; await db.del('exams', id); }

export async function setLacuna(materia, topico, nota) {
  app.lacunas[materia] ??= {};
  app.lacunas[materia][topico] = nota;
  await salvarKV('lacunas');
  vibrar(pf(), 'toque');
}

// ---------- cronômetro de foco ----------
const salvarTimer = () => db.put('kv', 'timer', app.timer ? snap(app.timer) : null);
export async function iniciarFoco(b) {
  app.timer = foco.iniciar(b, app.cfg.foco, Date.now());
  await salvarTimer(); vibrar(pf(), 'toque');
}
export async function atualizarTimer(mudar) { app.timer = mudar(snap(app.timer)); await salvarTimer(); }
export const encerrarSessao = () => atualizarTimer((t) => foco.encerrarSessao(t, Date.now()));
export const proximaSessao = () => atualizarTimer((t) => foco.proximaSessao(t, Date.now()));
export async function cancelarFoco() { app.timer = null; await salvarTimer(); }
/** Conclui o bloco com os minutos reais, as questões e o assunto registrados. */
export async function concluirFoco(b) {
  const t = snap(app.timer); if (!t) return;
  const r = t.registro;
  app.timer = null; await salvarTimer();
  await registrar(b ?? t, {
    min: Math.max(1, foco.minutosFoco(t, Date.now())), sessoes: t.sessoes, assunto: r.assunto,
    questoes: r.feitas ? { feitas: r.feitas, acertos: Math.min(r.acertos, r.feitas) } : undefined, sozinho: r.sozinho,
  });
}

// ---------- insígnias e capítulos ----------
const dadosConquistas = () => ({ done: app.done, reviews: app.reviews, errors: app.errors, exams: app.exams, cumpridos: app.cumpridos });
let timerInsignia;
export async function checarConquistas() {
  const novas = conquistas(dadosConquistas()).filter((c) => c.ok && !app.vistos.conquistas[c.id]);
  if (!novas.length) return;
  for (const c of novas) app.vistos.conquistas[c.id] = true;
  await salvarKV('vistos');
  clearTimeout(timerInsignia);
  app.insignia = novas.length === 1 ? novas[0] : { nome: `${novas.length} insígnias novas`, desc: novas.map((c) => c.nome).join(' · ') };
  timerInsignia = setTimeout(() => (app.insignia = null), 5000);
}
export const listaConquistas = () => conquistas(dadosConquistas());
export async function verCapitulo(id) { app.vistos.capitulos[id] = true; await salvarKV('vistos'); }

// ---------- backup ----------
/** Substitui tudo pelos dados de um backup validado. */
export async function importar(d) {
  for (const s of ['done', 'reviews', 'errors', 'exams']) { for (const k of Object.keys(await db.all(s))) await db.del(s, k); for (const [k, v] of Object.entries(d[s])) await db.put(s, k, v); app[s] = d[s]; }
  for (const k of Object.keys(EXTRAS)) { app[k] = d.extras?.[k] ?? structuredClone(EXTRAS[k]); await salvarKV(k); }
  app.cfg = migrarCfg(d.cfg, seed); await salvarCfg(); // backup antigo também recebe o conteúdo novo do seed
}
export async function restaurarSeed() {
  const manter = { prefs: app.cfg.prefs, carta: app.cfg.carta, links: app.cfg.links, notaCorte: app.cfg.notaCorte, tema: app.cfg.tema };
  app.cfg = { ...structuredClone(seed), ...manter }; await salvarCfg();
}
