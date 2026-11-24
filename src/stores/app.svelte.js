import seed from '../data/seed.json';
import * as db from '../lib/db.js';
import { today, addDays, precisaVirar } from '../lib/dates.js';
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
import { migrarLacunas, migrarDominio, migrarDone } from '../lib/trilha.js';
import { avaliarTopico, chave as chaveTopico, resumo as resumoTopico, destravar } from '../lib/dominio.js';
import { faseDoDia, maxExtraZero } from '../lib/phases.js';
import { reservasDaSemana, proximaPergunta } from '../lib/oracao.js';
import { ajustarLeitura } from '../lib/livros.js';
import { aplicarCota, deltaResultado, REGISTRAVEL } from '../lib/tarefas.js';
import { planoPrazos, dividasAtuais, contarBlocos, temPrazo, chave as chavePrazo } from '../lib/prazos.js';
import { horasEntre, noiteDe, validarNoite, horariosNoite, acordarDe, acordarAmanha } from '../lib/sono.js';
import { blocosAjustados } from '../lib/planner.js';
import { diaLivre, antesDoInicio } from '../lib/rotina.js';
import { resumoDoDia, RESUMO_DIAS } from '../lib/avisos.js';
import { agendarTelas, registrarPeriodico } from '../lib/notify.js';

// Dados guardados como chave única no "kv" do IndexedDB.
const EXTRAS = { adiados: {}, dificeis: {}, lacunas: {}, leitura: {}, cotas: {}, revisoes: {}, cumpridos: {}, vistos: { conquistas: {}, capitulos: {} }, redacoes: {}, dominio: {}, checkpoints: {}, portao: {}, treinos: {}, treinoSemanas: {}, oracoes: {}, catecismo: { base: 1, dias: {}, proxima: 1 }, sono: {}, sonoNoites: {}, presenca: {}, dividas: {} };

export const app = $state({
  pronto: false, cfg: structuredClone(seed), done: {}, reviews: {}, errors: {}, exams: {},
  ...structuredClone(EXTRAS), timer: null, dia: today(), toast: null, insignia: null,
  ultimoBackup: null, lembreteAdiado: null, persistente: null, registroAberto: null,
});
export const fases = () => gerarFases(app.cfg);
export const prazos = () => planoPrazos(app.cfg, fases());
export const ajustes = () => ({ adiados: app.adiados, dificeis: app.dificeis, exams: app.exams, reservas: (seg) => reservasDaSemana(app.cfg, app.oracoes, seg) });
export const pf = () => prefs(app.cfg);
const snap = (v) => $state.snapshot(v);

export async function iniciar() {
  // Tudo que está no aparelho é lido de uma vez, em paralelo (antes era uma leitura depois da outra).
  const chaves = Object.keys(EXTRAS);
  const [salvo, done, reviews, errors, exams, timer, ultimoBackup, lembreteAdiado, ...extras] = await Promise.all([
    db.get('kv', 'config'), db.all('done'), db.all('reviews'), db.all('errors'), db.all('exams'),
    db.get('kv', 'timer'), db.get('kv', 'ultimoBackup'), db.get('kv', 'lembreteAdiado'), ...chaves.map((k) => db.get('kv', k)),
  ]);
  let antes = seed.versaoSeed ?? 1;
  if (salvo) {
    antes = salvo.versaoSeed ?? 1;
    app.cfg = migrarCfg(salvo, seed); // traz conteúdo novo do seed sem perder o que você editou
    if ((app.cfg.versaoSeed ?? 1) !== antes) await db.put('kv', 'config', snap(app.cfg));
  }
  aplicarPrefs(pf());
  Object.assign(app, { done, reviews, errors, exams });
  chaves.forEach((k, i) => { app[k] = extras[i] ?? structuredClone(EXTRAS[k]); });
  if (antes < 12) await migrarEstadosAntigos(); // notas, domínio e blocos dos tópicos antigos passam para os novos (campo `antigos`)
  app.timer = timer ?? null;
  app.ultimoBackup = ultimoBackup ?? null;
  app.lembreteAdiado = lembreteAdiado ?? null;
  protegerDados();
  // Primeira vez com insígnias: as já conquistadas entram como vistas, sem enxurrada de avisos.
  if (!Object.keys(app.vistos.conquistas).length) { for (const c of conquistas(dadosConquistas())) if (c.ok) app.vistos.conquistas[c.id] = true; await salvarKV('vistos'); }
  verificar(app.cfg, app.reviews, app.dia);
  agendarTelas(app.cfg, app.dia, { noites: app.sonoNoites, sono: app.sono });
  await sincronizarDividas();
  gravarResumo();
  if (app.cfg.notificacoes) registrarPeriodico();
  app.pronto = true;
  // atualiza o "hoje" se o app ficar aberto na virada do dia ou for retomado sem visibilitychange
  const voltou = () => { virarDia(); atualizarSW(); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) voltou(); });
  window.addEventListener('pageshow', voltou);
  window.addEventListener('focus', voltou);
  setInterval(virarDia, 30000);
}

/** Se o dia mudou, atualiza `app.dia` e refaz o que depende dele. Idempotente. */
export function virarDia() {
  if (!precisaVirar(app.dia, new Date())) return false;
  app.dia = today();
  verificar(app.cfg, app.reviews, app.dia);
  sincronizarDividas(); agendarResumo(); agendarTelas(app.cfg, app.dia, { noites: app.sonoNoites, sono: app.sono });
  return true;
}
function atualizarSW() { try { navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {}); } catch {} }

/** Notas (lacunas), estado do domínio e blocos feitos: o que era de tópico antigo vale também no tópico novo; o antigo não é apagado. */
async function migrarEstadosAntigos() {
  app.lacunas = migrarLacunas(app.lacunas, app.cfg.topicos); await salvarKV('lacunas');
  app.dominio = migrarDominio(app.dominio, app.cfg.topicos); await salvarKV('dominio');
  const mud = migrarDone(app.done, app.cfg.topicos);
  for (const [id, v] of Object.entries(mud)) { app.done[id] = v; await db.put('done', id, snap(v)); }
}
export async function salvarCfg() { aplicarPrefs(pf()); await db.put('kv', 'config', snap(app.cfg)); agendarResumo(); }
const MEXE_NO_RESUMO = ['adiados', 'dificeis', 'sono', 'sonoNoites'];
export const salvarKV = (k) => { if (MEXE_NO_RESUMO.includes(k)) agendarResumo(); return db.put('kv', k, snap(app[k])); };

// ---------- resumo para os avisos com o app fechado ----------
/** Grava em kv 'resumoAvisos' o plano dos próximos 14 dias (blocos, dormir/acordar, meta): é o que o service worker lê. */
export async function gravarResumo() {
  try {
    const fs = fases(), planos = new Map(), ctx = { noites: app.sonoNoites, sono: app.sono }, dias = {};
    for (let i = 0; i < RESUMO_DIAS; i++) {
      const d = addDays(app.dia, i), livre = diaLivre(app.cfg, d);
      const blocos = livre ? [] : blocosAjustados(app.cfg, fs, d, { ...ajustes(), planos });
      dias[d] = resumoDoDia({ dia: d, blocos, dormir: horariosNoite(app.cfg, d, ctx).dormir, acordar: acordarDe(app.cfg, d, ctx), livre, acordarAmanha: acordarAmanha(app.cfg, d, ctx) });
    }
    await db.put('kv', 'resumoAvisos', { gerado: Date.now(), ativo: !!app.cfg.notificacoes, tom: app.cfg.tom ?? 'sargento', dias });
  } catch {}
}
let timerResumo;
export function agendarResumo() { clearTimeout(timerResumo); timerResumo = setTimeout(gravarResumo, 300); }

let timerToast;
const ELOGIOS = ['Mais um bloco cumprido.', 'A base está mais segura.', 'Missão cumprida, Gabriel.', 'Constância é o seu superpoder.', 'Assim se constrói uma aprovação.', 'Um passo mais perto da farda.', 'Bom trabalho. Respire e siga.', 'Uma luz a mais acesa na base.'];
export function avisar(msg, desfazer, sub, acao = null) {
  clearTimeout(timerToast);
  app.toast = { msg, desfazer, acao, sub: sub ?? ELOGIOS[Math.floor(Math.random() * ELOGIOS.length)] };
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
  agendarResumo();
  comemorar();
  avisar(`${b.titulo} concluído`, () => desmarcar(b.id), undefined, REGISTRAVEL.includes(b.cat) ? { rotulo: 'Registrar', fn: () => { app.toast = null; app.registroAberto = { id: b.id }; } } : null);
  checarConquistas();
}

/** Marca/desmarca um bloco. Se tiver assunto, agenda revisões em 1, 7 e 30 dias. */
export async function alternarBloco(b, assunto = '', tarefa = null) {
  if (app.done[b.id]) return desmarcar(b.id);
  // o assunto estudado é o tópico da tarefa (agenda as revisões de 1, 7 e 30 dias com o nome certo)
  await registrar(b, { assunto: assunto || tarefa?.topico || '', topico: tarefa?.topico, ...(tarefa?.matar != null ? { matar: tarefa.matar } : {}), ...(tarefa?.materia && b.cat === 'resg' ? { materia: tarefa.materia } : {}), vinculoId: tarefa?.vinculoId ?? null, paginasPlan: tarefa?.paginas?.n ?? 0, minLeitura: tarefa?.paginas?.min ?? 0,
    questoesPlan: tarefa?.questoes?.n ?? 0, fontePlan: tarefa?.questoes?.fontes?.find((f) => !f.esgotada)?.site ?? null });
}

export async function desmarcar(id) {
  delete app.done[id]; await db.del('done', id); agendarResumo();
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

/** Guarda a revisão de domingo (3 respostas + o resumo daquele momento). `seg` = segunda-feira da semana revisada. */
export async function salvarRevisao(seg, dados) {
  app.revisoes[seg] = { seg, feita: app.dia, ...dados };
  await salvarKV('revisoes');
  vibrar(pf(), 'ok');
  avisar('Revisão da semana salva', null, dados.foco?.trim() ? `Foco da próxima semana: ${dados.foco.trim()}` : 'Boa semana de estudo.');
  checarConquistas();
}
export async function apagarRevisao(seg) { delete app.revisoes[seg]; await salvarKV('revisoes'); }

// ---------- oração ----------
/** Marca (ou desmarca) um item de oração do dia. O Catecismo avança 3 perguntas no marcador, uma vez por dia. */
export async function marcarOracao(dia, id, feito) {
  const m = { ...(app.oracoes[dia] ?? {}) };
  if (feito) m[id] = true; else delete m[id];
  app.oracoes[dia] = m; await salvarKV('oracoes');
  if (id === 'catecismo') {
    const c = app.catecismo, dias = { ...(c.dias ?? {}) };
    if (feito) dias[dia] = true; else delete dias[dia];
    const base = c.base ?? (c.dias ? 1 : c.proxima ?? 1); // formato antigo: { proxima }
    app.catecismo = { base, dias, proxima: proximaPergunta({ base, dias }) };
    await salvarKV('catecismo');
  }
  if (feito) vibrar(pf(), 'toque');
}
export async function marcadorCatecismo(n) {
  const dias = app.catecismo.dias ?? {}, alvo = Math.max(1, Math.round(n) || 1);
  app.catecismo = { base: alvo - 3 * Object.keys(dias).length, dias, proxima: alvo }; await salvarKV('catecismo');
}

// ---------- treino de corrida ----------
/** Registro do treino do dia (feito, km real, dor no joelho/tornozelo 0–10, inchaço, mínimo de 20 min de caminhada). */
export async function registrarTreino(dia, dados) {
  app.treinos[dia] = { ...(app.treinos[dia] ?? {}), ...dados }; await salvarKV('treinos');
  const r = app.treinos[dia];
  if (dados.feito || dados.minimo) { vibrar(pf(), 'ok'); avisar(dados.minimo ? 'Mínimo do treino feito' : 'Treino feito', null, r.km && !dados.minimo ? `${String(r.km).replace('.', ',')} km. A sequência agradece.` : 'A sequência agradece.'); }
}
/** Km diários da semana (fases 2 a 5), editados no domingo. */
export async function salvarSemanaTreino(seg, dias) { app.treinoSemanas[seg] = { dias }; await salvarKV('treinoSemanas'); }

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
/** Backup do app. modo: 'auto' (compartilhar do sistema; sem ele, baixa o arquivo), 'baixar' ou 'copiar' (texto na área de transferência).
 *  Qualquer falha vira um aviso claro com a saída seguinte (antes o erro sumia e parecia que o botão não fazia nada). */
export async function fazerBackup(modo = 'auto') {
  if (typeof modo !== 'string') modo = 'auto'; // chamado direto de um onclick
  const nome = `estuda-gabriel-backup-${app.dia}.json`;
  let texto;
  try { texto = montar(app); } catch { avisar('Não consegui montar o backup', null, 'Feche e abra o app e tente de novo.'); return false; }
  const kb = Math.max(1, Math.round(texto.length / 1024));
  const baixarArquivo = () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
    a.download = nome; a.rel = 'noopener'; a.style.display = 'none'; document.body.append(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 4000);
  };
  let como;
  try {
    if (modo === 'copiar') {
      if (!navigator.clipboard?.writeText) throw new Error('sem área de transferência');
      await navigator.clipboard.writeText(texto); como = `Copiado (${kb} KB). Cole numa conversa com você mesmo ou num bloco de notas.`;
    } else if (modo === 'baixar') { baixarArquivo(); como = `Arquivo de ${kb} KB baixado. Procure em Downloads.`; }
    else {
      const arquivo = new File([texto], nome, { type: 'application/json' });
      if (navigator.canShare?.({ files: [arquivo] })) { await navigator.share({ files: [arquivo], title: 'Backup do Estuda Gabriel' }); como = 'Enviado pelo compartilhar do sistema. Escolha o Drive ou mande para você mesmo.'; }
      else { baixarArquivo(); como = `Arquivo de ${kb} KB baixado. Procure em Downloads.`; }
    }
  } catch (e) {
    if (e?.name === 'AbortError') return false; // você fechou o compartilhar
    avisar('Não consegui salvar o backup', null, modo === 'copiar' ? 'Tente "Baixar arquivo".' : 'Tente "Copiar backup" e cole numa conversa com você mesmo.');
    return false;
  }
  app.ultimoBackup = app.dia; await db.put('kv', 'ultimoBackup', app.dia);
  avisar('Backup feito', null, como);
  return true;
}
export async function adiarLembreteBackup() { app.lembreteAdiado = app.dia; await db.put('kv', 'lembreteAdiado', app.dia); }

export async function addExame(ex) { const id = novoId(); app.exams[id] = { id, ...ex }; await db.put('exams', id, { id, ...ex }); comemorar(); checarConquistas(); }
export async function delExame(id) { delete app.exams[id]; await db.del('exams', id); }

export async function setLacuna(materia, topico, nota) {
  app.lacunas[materia] ??= {};
  app.lacunas[materia][topico] = nota;
  await salvarKV('lacunas');
  const k = chaveTopico(materia, topico);
  if (nota < 3 && app.dominio[k] && (resumoTopico(app.dominio[k]).dominado || resumoTopico(app.dominio[k]).travado)) { delete app.dominio[k]; await salvarKV('dominio'); } // você reabriu o tópico: recomeça o modo domínio
  vibrar(pf(), 'toque');
}

/** Checkpoint mensal: as mesmas 10 questões de Matemática da EFOMM, cronometradas. Um por data (registrar de novo corrige). */
export async function registrarCheckpoint({ data, acertos, minutos }) {
  const feitas = app.cfg.checkpoint?.questoes ?? 10;
  app.checkpoints[data] = { data, acertos: Math.max(0, Math.min(feitas, Math.round(acertos))), feitas, minutos: minutos ? Math.round(minutos) : null };
  await salvarKV('checkpoints'); comemorar();
  avisar('Checkpoint salvo', null, `${app.checkpoints[data].acertos} de ${feitas} em Matemática.`);
}
export async function apagarCheckpoint(data) { delete app.checkpoints[data]; await salvarKV('checkpoints'); }
/** Resultado do teste de saída da base (9º ano), em %. null apaga. */
export async function salvarTeste(pct) {
  const { khan: _antigo, ...resto } = app.portao ?? {};
  app.portao = { ...resto, teste: pct == null ? null : { pct: Math.max(0, Math.min(100, Math.round(pct))), data: app.dia } };
  await salvarKV('portao');
}
/** O portão não passou: mais 2 semanas de Fase 0, só com os tópicos fracos. */
export async function prorrogarZero() {
  const mais = Math.min(app.cfg.fase0?.portao?.semanasExtras ?? 2, maxExtraZero(app.cfg) - (app.cfg.perfil.extraZero ?? 0));
  if (mais <= 0) { avisar('Limite da prorrogação', null, 'A Fase 1 precisa de pelo menos 1 semana antes de maio.'); return; }
  app.cfg.perfil.extraZero = (app.cfg.perfil.extraZero ?? 0) + mais;
  await salvarCfg();
  avisar('Fase 0 prorrogada', null, `Mais ${mais} semanas, só com os tópicos fracos.`);
}

/** Destrava um tópico do modo domínio (você pediu ajuda ou viu outra explicação): mais 3 tentativas. */
export async function destravarTopico(materia, topico) {
  const k = chaveTopico(materia, topico);
  app.dominio[k] = destravar(app.dominio[k]); await salvarKV('dominio');
  avisar('Tópico destravado', null, `${topico}: mais 3 tentativas.`);
}

// ---------- prazos e dívidas ----------
/** Tópico que passou do prazo e do sábado de resgate sem ser dominado vira dívida: entra no caderno de erros (revisões 1/7/30). */
export async function sincronizarDividas() {
  if (!app.cfg.topicos || antesDoInicio(app.cfg, app.dia)) return;
  const plano = prazos(), st = { lacunas: app.lacunas, feitos: contarBlocos(app.done), dividas: app.dividas };
  let mudou = false;
  for (const d of dividasAtuais(plano, st, app.dia)) {
    const k = chavePrazo(d.materia, d.nome);
    if (app.dividas[k]) continue;
    const id = novoId(), e = { id, materia: d.materia, assunto: d.nome, tipo: 'conteudo', licao: 'Dívida de prazo: não matei este tópico. Refazer a teoria e as questões até 8 de 10.', dia: app.dia, foto: null, status: 'novo' };
    app.errors[id] = e; await db.put('errors', id, e);
    for (const r of agendarRevisoes({ origem: `erro:${id}`, assunto: e.assunto, materia: d.materia, dia: app.dia })) { app.reviews[r.id] = r; await db.put('reviews', r.id, r); }
    app.dividas[k] = { desde: app.dia, erro: id }; mudou = true;
  }
  for (const k of Object.keys(app.dividas)) { // dívida paga (tópico dominado) sai da lista; o erro e as revisões ficam no caderno
    const [m, n] = k.split('|');
    if ((app.lacunas[m]?.[n] ?? 0) >= 3) { delete app.dividas[k]; mudou = true; }
  }
  if (mudou) await salvarKV('dividas');
}
/** Peso do tópico (1 leve, 2 normal, 3 pesado): redistribui os prazos do Ano. */
export async function definirPeso(materia, nome, peso) {
  app.cfg.pesos = { ...(app.cfg.pesos ?? {}) };
  if (peso === 2) delete app.cfg.pesos[chavePrazo(materia, nome)]; else app.cfg.pesos[chavePrazo(materia, nome)] = peso;
  await salvarCfg();
}
/** O portão passou hoje: se foi antes da previsão, o Ano 1 e o Ano 2 se adiantam. */
export async function passarPortao() {
  const prev = app.cfg.perfil.fimZero ?? '2027-01-10';
  if (app.dia >= prev) { avisar('Portão aberto', null, 'No prazo previsto: o plano segue as datas.'); return; }
  app.cfg.perfil.portaoEm = app.dia; await salvarCfg();
  avisar('Portão aberto antes do previsto', null, 'O Ano 1 e o Ano 2 se adiantaram. Bom trabalho.');
}
export async function desfazerPortao() { app.cfg.perfil.portaoEm = null; await salvarCfg(); }

// ---------- sono ----------
/** Manhã: guarda a hora que dormiu e acordou e a qualidade (1 a 5). Menos de 6 h vira Dia mínimo. */
export async function registrarSono(dia, { dormiu, acordou, q }) {
  const horas = horasEntre(dormiu, acordou);
  app.sono[dia] = { dormiu, acordou, q: q ?? null }; await salvarKV('sono');
  if (horas != null && horas < 6) {
    if (!app.dificeis[dia]) await diaDificil(dia, true);
    avisar('Dormiu menos de 6 h', null, 'O dia virou Dia mínimo: 45 min de questões e as revisões. Durma mais cedo hoje.');
  } else if (horas != null && horas < 7) avisar('Noite curta registrada', null, 'Hoje: corrida leve, MATAR HOJE depois do almoço, cochilo de 20 min e dormir 30 min mais cedo.');
  else avisar('Sono registrado', null, horas != null ? `${String(Math.round(horas * 10) / 10).replace('.', ',')} h de sono.` : undefined);
  agendarTelas(app.cfg, app.dia, { noites: app.sonoNoites, sono: app.sono });
}
export async function apagarSono(dia) { delete app.sono[dia]; await salvarKV('sono'); }
/** Planeja a noite de `diaNoite` (horas diferentes do padrão). Quem chama confere com `conferirNoite` e pede confirmação. */
export const conferirNoite = (diaNoite, plano) => validarNoite(app.cfg, diaNoite, plano, { noites: app.sonoNoites, sono: app.sono });
export async function planejarNoite(diaNoite, plano) { app.sonoNoites[diaNoite] = { dormir: plano.dormir, acordar: plano.acordar }; await salvarKV('sonoNoites'); }
export async function limparNoite(diaNoite) { delete app.sonoNoites[diaNoite]; await salvarKV('sonoNoites'); }
export const noiteAtual = (diaNoite) => noiteDe(app.cfg, diaNoite, { noites: app.sonoNoites, sono: app.sono });

// ---------- faculdade ----------
/** "Vou / não vou" de uma aula: não vou libera a janela de estudo. */
export async function definirVou(i, vou) { app.cfg.rotina.aulas[i].vou = vou; await salvarCfg(); }
/** Presença do dia na aula (p = fui, f = faltei); tocar de novo no mesmo valor desmarca. */
export async function registrarPresenca(nome, dia, valor) {
  const atual = { ...(app.presenca[nome] ?? {}) };
  if (!valor || atual[dia] === valor) delete atual[dia]; else atual[dia] = valor;
  app.presenca = { ...app.presenca, [nome]: atual }; await salvarKV('presenca');
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
// ---------- resultado de um bloco de estudo ----------
/** Guarda o resultado (questões, páginas, site, erros) sem duplicar nada se você corrigir depois. */
async function aplicarResultado(b, d) {
  const antigo = app.done[b.id]?.resultado ?? null;
  const delta = deltaResultado(antigo, d);
  if (d.vinculoId && delta.paginas) {
    const v = app.cfg.biblioteca?.vinculos?.find((x) => x.id === d.vinculoId);
    if (v) { app.leitura[v.id] = ajustarLeitura(app.leitura[v.id], v, delta.paginas, d.minutosLeitura ?? 0, app.dia); await salvarKV('leitura'); }
  }
  if (Object.keys(delta.cotas).length) { app.cotas[app.dia] = aplicarCota(app.cotas[app.dia], delta.cotas); await salvarKV('cotas'); }
  const atual = snap(app.done[b.id]) ?? {};
  const novoReg = { ...atual, ...(d.materia && b.cat === 'resg' ? { materia: d.materia } : {}), topico: d.topico ?? atual.topico, vinculoId: d.vinculoId ?? atual.vinculoId ?? null,
    questoes: d.feitas ? { feitas: d.feitas, acertos: Math.min(d.acertos ?? 0, d.feitas) } : atual.questoes,
    resultado: { feitas: d.feitas ?? 0, acertos: Math.min(d.acertos ?? 0, d.feitas ?? 0), paginas: d.paginas ?? 0, site: d.site ?? null, khan: !!d.khan, errosRegistrados: antigo?.errosRegistrados ?? 0 } };
  app.done[b.id] = novoReg; await db.put('done', b.id, snap(novoReg));
  return { ...delta, veredito: await avaliarDominio(b, d) };
}
/** O resultado do bloco entra no modo domínio do tópico (8 em 10, repetição, travado) e atualiza a nota da Trilha.
 *  Vale para Matemática, Física e Química (qualquer fase) e para os tópicos da Fase 0 das outras matérias. */
async function avaliarDominio(b, d) {
  const topico = d.topico, materia = d.materia ?? b.materia;
  const diaBloco = /^\d{4}-\d{2}-\d{2}/.test(b.id) ? b.id.slice(0, 10) : app.dia; // corrigir outro dia vale para a fase e a data do bloco
  if (!topico) return null;
  const t = app.cfg.topicos?.[materia]?.find((x) => x.nome === topico);
  if (!t) return null;
  const pelaFase0 = t.fase === 0 && faseDoDia(fases(), diaBloco).id === 'zero';
  if (!pelaFase0 && !temPrazo(materia)) return null;
  const k = chaveTopico(materia, topico), atual = app.lacunas[materia]?.[topico] ?? 0;
  // MATAR HOJE (último bloco) conta como tentativa; os blocos antes dele só dominam se chegarem a 8 em 10
  const r = avaliarTopico(app.dominio[k], atual, b.id, { feitas: d.feitas ?? 0, acertos: d.acertos ?? 0, khan: d.khan, data: diaBloco, treino: d.matar === false });
  app.dominio[k] = r.estado; await salvarKV('dominio');
  if (r.nota !== atual) { app.lacunas[materia] ??= {}; app.lacunas[materia][topico] = r.nota; await salvarKV('lacunas'); }
  if (r.veredito === 'dominado') await sincronizarDividas();
  return r.veredito;
}
const AVISO_DOMINIO = {
  dominado: 'Tópico dominado. O próximo já está liberado.',
  repetir: 'Abaixo de 8 em 10: o próximo bloco repete este tópico com exercícios novos.',
  travado: 'Tópico travado depois de 3 tentativas. Peça ajuda (professor, colega ou outro vídeo) e destrave na Trilha.',
  parcial: 'Faça pelo menos 10 exercícios para o tópico ser avaliado (8 em 10).',
  treino: 'Ainda abaixo de 8 em 10: o tópico segue nos próximos blocos até o prazo.',
};

/** Registro em uma tela: fiz X, acertei Y, onde fiz, páginas lidas e os erros (assunto + tipo) que vão para o caderno. */
export async function registrarResultado(b, d) {
  if (!app.done[b.id]) await registrar(b, { assunto: d.topico ?? '', topico: d.topico, vinculoId: d.vinculoId ?? null, ...(d.materia && b.cat === 'resg' ? { materia: d.materia } : {}) });
  const { veredito } = await aplicarResultado(b, d);
  let n = 0;
  for (const e of d.erros ?? []) { await addErro({ materia: d.materia ?? b.materia, assunto: e.assunto || d.topico || d.materia || b.materia, tipo: e.tipo, licao: '' }); n++; }
  if (n) {
    const r = snap(app.done[b.id]); r.resultado.errosRegistrados = (r.resultado.errosRegistrados ?? 0) + n;
    app.done[b.id] = r; await db.put('done', b.id, r);
  }
  app.registroAberto = null;
  if (veredito) { avisar(veredito === 'dominado' ? 'Dominado!' : 'Resultado registrado', null, `${AVISO_DOMINIO[veredito]}${n ? ` ${n} ${n === 1 ? 'erro foi' : 'erros foram'} para o caderno.` : ''}`); checarConquistas(); return; }
  avisar('Resultado registrado', null, d.feitas ? `${d.acertos ?? 0} de ${d.feitas} questões${n ? ` · ${n} ${n === 1 ? 'erro foi' : 'erros foram'} para o caderno` : ''}` : 'Páginas e tempo salvos.');
  checarConquistas();
}
export const fecharRegistro = () => { app.registroAberto = null; };

/** Conclui o bloco com os minutos reais, as questões e o assunto registrados. */
export async function concluirFoco(b) {
  const t = snap(app.timer); if (!t) return;
  const r = t.registro;
  app.timer = null; await salvarTimer();
  const alvo = b ?? t;
  await registrar(alvo, {
    min: Math.max(1, foco.minutosFoco(t, Date.now())), sessoes: t.sessoes, assunto: r.assunto,
    questoes: r.feitas ? { feitas: r.feitas, acertos: Math.min(r.acertos, r.feitas) } : undefined, sozinho: r.sozinho,
    topico: t.tarefa?.topico ?? r.assunto ?? undefined, vinculoId: r.vinculoId ?? null, ...(t.tarefa?.matar != null ? { matar: t.tarefa.matar } : {}), ...(t.tarefa?.materia && alvo.cat === 'resg' ? { materia: t.tarefa.materia } : {}),
  });
  if (r.feitas || r.paginas) await aplicarResultado(alvo, { feitas: r.feitas, acertos: r.acertos, site: r.site, paginas: r.paginas ?? 0, vinculoId: r.vinculoId, topico: t.tarefa?.topico, materia: t.tarefa?.materia, matar: t.tarefa?.matar, minutosLeitura: t.tarefa?.paginas?.min ?? 0 });
  // se ficaram erros por registrar, a tela Hoje abre o registro só dos erros
  if ((r.feitas ?? 0) - (r.acertos ?? 0) > 0 && REGISTRAVEL.includes(t.chave?.replace(/\d+$/, ''))) app.registroAberto = { id: alvo.id, soErros: true };
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
  app.insignia = novas.length === 1 ? novas[0] : { nome: `${novas.length} condecorações novas`, desc: novas.map((c) => c.nome).join(' · ') };
  timerInsignia = setTimeout(() => (app.insignia = null), 5000);
}
export const listaConquistas = () => conquistas(dadosConquistas());
export async function verCapitulo(id) { app.vistos.capitulos[id] = true; await salvarKV('vistos'); }

// ---------- backup ----------
/** Substitui tudo pelos dados de um backup validado. */
export async function importar(d) {
  for (const s of ['done', 'reviews', 'errors', 'exams']) { for (const k of Object.keys(await db.all(s))) await db.del(s, k); for (const [k, v] of Object.entries(d[s])) await db.put(s, k, v); app[s] = d[s]; }
  for (const k of Object.keys(EXTRAS)) { app[k] = d.extras?.[k] ?? structuredClone(EXTRAS[k]); await salvarKV(k); }
  const antes = d.cfg.versaoSeed ?? 1;
  app.cfg = migrarCfg(d.cfg, seed); await salvarCfg(); // backup antigo também recebe o conteúdo novo do seed
  if (antes < 12) await migrarEstadosAntigos();
}
export async function restaurarSeed() {
  const manter = { prefs: app.cfg.prefs, carta: app.cfg.carta, links: app.cfg.links, notaCorte: app.cfg.notaCorte, tema: app.cfg.tema, tom: app.cfg.tom,
    questoesLinks: app.cfg.questoesLinks, biblioteca: app.cfg.biblioteca, cotasGratis: app.cfg.cotasGratis };
  app.cfg = { ...structuredClone(seed), ...manter }; await salvarCfg();
}
