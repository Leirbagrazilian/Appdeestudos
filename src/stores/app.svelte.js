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
import { migrarLacunas } from '../lib/trilha.js';
import { avaliarTopico, chave as chaveTopico, resumo as resumoTopico, destravar } from '../lib/dominio.js';
import { faseDoDia, maxExtraZero } from '../lib/phases.js';
import { ajustarLeitura } from '../lib/livros.js';
import { aplicarCota, deltaResultado, REGISTRAVEL } from '../lib/tarefas.js';

// Dados guardados como chave única no "kv" do IndexedDB.
const EXTRAS = { adiados: {}, dificeis: {}, lacunas: {}, leitura: {}, cotas: {}, revisoes: {}, cumpridos: {}, vistos: { conquistas: {}, capitulos: {} }, redacoes: {}, dominio: {}, checkpoints: {}, portao: {} };

export const app = $state({
  pronto: false, cfg: structuredClone(seed), done: {}, reviews: {}, errors: {}, exams: {},
  ...structuredClone(EXTRAS), timer: null, dia: today(), toast: null, insignia: null,
  ultimoBackup: null, lembreteAdiado: null, persistente: null, registroAberto: null,
});
export const fases = () => gerarFases(app.cfg);
export const ajustes = () => ({ adiados: app.adiados, dificeis: app.dificeis, exams: app.exams });
export const pf = () => prefs(app.cfg);
const snap = (v) => $state.snapshot(v);

export async function iniciar() {
  const salvo = await db.get('kv', 'config');
  let antes = seed.versaoSeed ?? 1;
  if (salvo) {
    antes = salvo.versaoSeed ?? 1;
    app.cfg = migrarCfg(salvo, seed); // traz conteúdo novo do seed sem perder o que você editou
    if ((app.cfg.versaoSeed ?? 1) !== antes) await db.put('kv', 'config', snap(app.cfg));
  }
  aplicarPrefs(pf());
  app.done = await db.all('done');
  app.reviews = await db.all('reviews');
  app.errors = await db.all('errors');
  app.exams = await db.all('exams');
  for (const k of Object.keys(EXTRAS)) app[k] = (await db.get('kv', k)) ?? structuredClone(EXTRAS[k]);
  if (antes < 3) { app.lacunas = migrarLacunas(app.lacunas, app.cfg.topicos); await salvarKV('lacunas'); } // notas do mapa de lacunas antigo
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
  comemorar();
  avisar(`${b.titulo} concluído`, () => desmarcar(b.id), undefined, REGISTRAVEL.includes(b.cat) ? { rotulo: 'Registrar', fn: () => { app.toast = null; app.registroAberto = { id: b.id }; } } : null);
  checarConquistas();
}

/** Marca/desmarca um bloco. Se tiver assunto, agenda revisões em 1, 7 e 30 dias. */
export async function alternarBloco(b, assunto = '', tarefa = null) {
  if (app.done[b.id]) return desmarcar(b.id);
  // o assunto estudado é o tópico da tarefa (agenda as revisões de 1, 7 e 30 dias com o nome certo)
  await registrar(b, { assunto: assunto || tarefa?.topico || '', topico: tarefa?.topico, vinculoId: tarefa?.vinculoId ?? null, paginasPlan: tarefa?.paginas?.n ?? 0, minLeitura: tarefa?.paginas?.min ?? 0,
    questoesPlan: tarefa?.questoes?.n ?? 0, fontePlan: tarefa?.questoes?.fontes?.find((f) => !f.esgotada)?.site ?? null });
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

/** Guarda a revisão de domingo (3 respostas + o resumo daquele momento). `seg` = segunda-feira da semana revisada. */
export async function salvarRevisao(seg, dados) {
  app.revisoes[seg] = { seg, feita: app.dia, ...dados };
  await salvarKV('revisoes');
  vibrar(pf(), 'ok');
  avisar('Revisão da semana salva', null, dados.foco?.trim() ? `Foco da próxima semana: ${dados.foco.trim()}` : 'Boa semana de estudo.');
  checarConquistas();
}
export async function apagarRevisao(seg) { delete app.revisoes[seg]; await salvarKV('revisoes'); }

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
  const k = chaveTopico(materia, topico);
  if (nota < 3 && app.dominio[k] && resumoTopico(app.dominio[k]).dominado) { delete app.dominio[k]; await salvarKV('dominio'); } // você reabriu o tópico: recomeça o modo domínio
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
/** Resultado do teste de saída do Khan (9º ano), em %. null apaga. */
export async function salvarKhan(pct) {
  app.portao = { ...app.portao, khan: pct == null ? null : { pct: Math.max(0, Math.min(100, Math.round(pct))), data: app.dia } };
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
  const novoReg = { ...atual, topico: d.topico ?? atual.topico, vinculoId: d.vinculoId ?? atual.vinculoId ?? null,
    questoes: d.feitas ? { feitas: d.feitas, acertos: Math.min(d.acertos ?? 0, d.feitas) } : atual.questoes,
    resultado: { feitas: d.feitas ?? 0, acertos: Math.min(d.acertos ?? 0, d.feitas ?? 0), paginas: d.paginas ?? 0, site: d.site ?? null, khan: !!d.khan, errosRegistrados: antigo?.errosRegistrados ?? 0 } };
  app.done[b.id] = novoReg; await db.put('done', b.id, snap(novoReg));
  return { ...delta, veredito: await avaliarDominio(b, d) };
}
/** Fase 0: o resultado do bloco entra no modo domínio do tópico (8 em 10, repetição, travado) e atualiza a nota da Trilha. */
async function avaliarDominio(b, d) {
  const topico = d.topico;
  if (!topico || faseDoDia(fases(), app.dia).id !== 'zero') return null;
  if (!app.cfg.topicos?.[b.materia]?.some((t) => t.nome === topico && t.fase === 0)) return null;
  const k = chaveTopico(b.materia, topico), atual = app.lacunas[b.materia]?.[topico] ?? 0;
  const r = avaliarTopico(app.dominio[k], atual, b.id, { feitas: d.feitas ?? 0, acertos: d.acertos ?? 0, khan: d.khan, data: app.dia });
  app.dominio[k] = r.estado; await salvarKV('dominio');
  if (r.nota !== atual) { app.lacunas[b.materia] ??= {}; app.lacunas[b.materia][topico] = r.nota; await salvarKV('lacunas'); }
  return r.veredito;
}
const AVISO_DOMINIO = {
  dominado: 'Tópico dominado. O próximo já está liberado.',
  repetir: 'Abaixo de 8 em 10: o próximo bloco repete este tópico com exercícios novos.',
  travado: 'Tópico travado depois de 3 tentativas. Peça ajuda (professor, colega ou outro vídeo) e destrave na Trilha.',
  parcial: 'Faça pelo menos 10 exercícios para o tópico ser avaliado (8 em 10).',
};

/** Registro em uma tela: fiz X, acertei Y, onde fiz, páginas lidas e os erros (assunto + tipo) que vão para o caderno. */
export async function registrarResultado(b, d) {
  if (!app.done[b.id]) await registrar(b, { assunto: d.topico ?? '', topico: d.topico, vinculoId: d.vinculoId ?? null });
  const { veredito } = await aplicarResultado(b, d);
  let n = 0;
  for (const e of d.erros ?? []) { await addErro({ materia: b.materia, assunto: e.assunto || d.topico || b.materia, tipo: e.tipo, licao: '' }); n++; }
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
    topico: t.tarefa?.topico ?? r.assunto ?? undefined, vinculoId: r.vinculoId ?? null,
  });
  if (r.feitas || r.paginas) await aplicarResultado(alvo, { feitas: r.feitas, acertos: r.acertos, site: r.site, paginas: r.paginas ?? 0, vinculoId: r.vinculoId, topico: t.tarefa?.topico, minutosLeitura: t.tarefa?.paginas?.min ?? 0 });
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
  const antes = d.cfg.versaoSeed ?? 1;
  app.cfg = migrarCfg(d.cfg, seed); await salvarCfg(); // backup antigo também recebe o conteúdo novo do seed
  if (antes < 3) { app.lacunas = migrarLacunas(app.lacunas, app.cfg.topicos); await salvarKV('lacunas'); }
}
export async function restaurarSeed() {
  const manter = { prefs: app.cfg.prefs, carta: app.cfg.carta, links: app.cfg.links, notaCorte: app.cfg.notaCorte, tema: app.cfg.tema,
    questoesLinks: app.cfg.questoesLinks, biblioteca: app.cfg.biblioteca, cotasGratis: app.cfg.cotasGratis };
  app.cfg = { ...structuredClone(seed), ...manter }; await salvarCfg();
}
