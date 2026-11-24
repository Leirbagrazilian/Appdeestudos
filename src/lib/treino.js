// Treino (SPEC v2 §2): musculação e corrida de manhã, antes de estudar, sem prova como meta. Tudo puro e testável.
// Plano (seed, não editável): cfg.treinoPlano (volume estável por dia da semana + disciplina que alterna). Horários e escolhas (editáveis): cfg.treino.
// Registros do dia (kv 'treinos'): { [dia]: { feito, km, dor, tornozelo, inchaco, minimo } }.
// Semanas editadas por você aos domingos (kv 'treinoSemanas'): { [segunda]: { dias: { wd: km } } }.
import { addDays, diffDays, startOfWeek, weekday } from './dates.js';
import { toMin, toHHMM, janelasValidas } from './semana.js';
import { minimoOracao } from './oracao.js';
import { janelasDoDia, diaLivre, horaCorrida } from './rotina.js';

export const r05 = (x) => Math.round(x * 2) / 2;
const plano = (cfg) => cfg.treinoPlano ?? {};
export const DOR_LIMITE = 3;
const FASE_UNICA = { n: 1, nome: 'Disciplina e evolução' }; // sem prova como meta (a ultra e a maratona saíram)

/** Semana da corrida (0 = a semana do início), contada de segunda a domingo. */
export const semanaCorrida = (cfg, dia) => Math.floor(diffDays(startOfWeek(plano(cfg).inicio), startOfWeek(dia)) / 7);

/** Disciplina de cada dia da semana que começa em `seg` (wd -> tipo). Quinta alterna intervalado, fartlek, ritmo e subida; o resto é
 *  rodagem leve e o longão de domingo. */
export function tiposDaSemana(cfg, seg) {
  const P = plano(cfg), tipos = { ...(P.tipos ?? {}) }, ciclo = P.ciclo ?? ['intervalado', 'fartlek', 'ritmo', 'subida'];
  const n = Math.max(0, semanaCorrida(cfg, seg));
  for (const [wd, t] of Object.entries(tipos)) if (t === 'qualidade') tipos[wd] = ciclo[n % ciclo.length];
  return tipos;
}

/**
 * Plano da semana que começa em `seg`: { fase, semana, km, longao, leve, dias: { wd: km }, tipos, prova, travados } (wd 0 = domingo).
 * O volume é estável: o mesmo `kmDia` toda semana (não sobe sozinho). Só muda se você editar os km no domingo (`editadas`).
 */
export function planoSemanaCorrida(cfg, seg, editadas = {}) {
  const P = plano(cfg);
  if (!P.inicio || addDays(seg, 6) < P.inicio) return null;
  const dias = Object.fromEntries([1, 2, 3, 4, 5, 6, 0].map((wd) => [wd, +P.kmDia?.[wd] || 0]));
  // semana do início (começa no meio): dias antes do início não contam
  for (let i = 0; i < 7; i++) if (addDays(seg, i) < P.inicio) dias[(i + 1) % 7] = 0;
  const ed = editadas[seg]?.dias;
  if (ed) for (const [wd, v] of Object.entries(ed)) if (v != null && v !== '' && Number.isFinite(+v)) dias[+wd] = Math.max(0, +v);
  const total = Object.values(dias).reduce((a, b) => a + b, 0);
  return { fase: FASE_UNICA, semana: semanaCorrida(cfg, seg), km: total, longao: dias[0], leve: false, dias, tipos: tiposDaSemana(cfg, seg), prova: null, travados: [] };
}

const INTENSIDADE = {
  leve: 'Rodagem leve: dá para conversar o tempo todo.',
  'bem leve': 'Bem leve (véspera do longão): solto, dá para conversar.',
  intervalado: 'Intervalado: 10 min leves, 4 a 6 tiros de 400 m fortes com 90 s de trote entre eles, e solta.',
  fartlek: 'Fartlek: 20 min alternando 1 min mais forte e 2 min leves, sem cronometrar rígido.',
  ritmo: 'Ritmo: 15 min num ritmo "confortavelmente forte" (frases curtas) no meio, o resto leve.',
  subida: 'Subida: 6 a 8 subidas curtas de ~30 s fortes, descendo caminhando. O resto leve.',
  longao: 'Longão devagar: dá para conversar. Objetivo é completar.',
  caminhada: 'Só caminhada hoje: o joelho manda.',
};
const FORTES = ['intervalado', 'fartlek', 'ritmo', 'subida', 'longao'];

/** Treino do dia: corrida (ou longão), musculação, fortalecimento e alertas. `ctx` = { treinos, editadas, noiteCurta }. */
export function treinoDoDia(cfg, dia, ctx = {}) {
  const P = plano(cfg), T = cfg.treino ?? {};
  if (!P.inicio || dia < P.inicio) return null;
  const sem = planoSemanaCorrida(cfg, startOfWeek(dia), ctx.editadas ?? {});
  if (!sem) return null;
  const wd = weekday(dia), reg = ctx.treinos?.[dia] ?? {};
  const dor = (reg.dor ?? 0) > DOR_LIMITE || (reg.tornozelo ?? 0) > DOR_LIMITE || !!reg.inchaco;
  let tipo = sem.tipos[wd] ?? 'leve';
  const curta = !!ctx.noiteCurta; // dormiu pouco: corrida leve ou caminhada
  if (curta && FORTES.includes(tipo)) tipo = 'leve';
  if (dor) tipo = 'caminhada';
  const km = dor ? 0 : sem.dias[wd] ?? 0;
  const mus = T.musculacao?.[wd] ?? null;
  const hora = wd === 0 ? T.longao : horaCorrida(cfg, wd);
  // duração estimada (ritmo leve; 10 min de aquecimento só quando não há musculação antes) e se cruza alguma janela de estudo do dia
  const min = km ? Math.round(km * (T.ritmoMinKm ?? 7) + (mus ? 0 : 10)) : T.corridaMin ?? 45;
  const horaOk = typeof hora === 'string' && /^\d{1,2}:\d{2}$/.test(hora);
  const ini = horaOk ? toMin(hora) : null, fim = horaOk ? ini + min : null;
  const temCorrida = km > 0 && tipo !== 'caminhada';
  const janela = horaOk && temCorrida ? janelasValidas(janelasDoDia(cfg, wd)).find((j) => j.ini < fim && j.fim > ini) : null;
  const choque = !janela ? null
    : janela.ini >= ini ? `A corrida termina por volta de ${toHHMM(fim)} e o estudo começa às ${toHHMM(janela.ini)}: saia mais cedo ou encurte o aquecimento.`
    : `A corrida termina por volta de ${toHHMM(fim)} e cai dentro da janela de estudo das ${toHHMM(janela.ini)}: mude o horário da corrida ou da janela.`;
  return {
    dia, wd, tipo, km, longao: wd === 0, hora: mus?.ini ?? hora, horaCorrida: hora, min, choque, prova: null,
    intensidade: INTENSIDADE[tipo] ?? INTENSIDADE.leve,
    tenis: tipo === 'intervalado' ? `${T.tenis?.principal ?? 'X-Step'} (o ${T.tenis?.rapido ?? 'Metaspeed'} só nos tiros)` : T.tenis?.principal ?? 'X-Step',
    dica: 'Descidas íngremes: caminhando.',
    musculacao: mus ? { ...mus, correrAntes: false } : null,
    fortalecimento: (T.fortalecimentoDias ?? []).includes(wd) ? P.fortalecimento : null,
    noiteCurta: curta,
    dor, alerta: dor ? 'Dor acima de 3/10 ou inchaço: hoje é só caminhada. Ajuste o plano de corrida.' : curta ? 'Noite curta: corrida leve (ou caminhada), sem forçar.' : null,
    fase: sem.fase, semanaLeve: false, metaSemana: sem.km,
  };
}

/** O treino do dia conta como feito: corrida/longão feito ou o mínimo (20 min de caminhada). */
export const treinoFeito = (reg) => !!(reg?.feito || reg?.minimo);

/**
 * Avisos das regras da semana (para Hoje e Ajustes). Perna no sábado (véspera do longão) é escolha sua: não bloqueia.
 * Só avisa quando há dor no joelho registrada nos últimos 3 dias (até `dia`) e a musculação de sábado é de inferiores.
 * `treinos` = registros do treino por dia.
 */
export function alertasTreino(cfg, dia, treinos = {}) {
  const P = plano(cfg), T = cfg.treino ?? {}, out = [];
  if (!P.inicio) return out;
  const wd = weekday(dia);
  if (T.musculacao?.[6]?.tipo === 'lower' && (wd === 5 || wd === 6)) {
    const dor = Math.max(0, ...[0, 1, 2, 3].map((i) => +treinos[addDays(dia, -i)]?.dor || 0));
    if (dor > 0) out.push(`Dor no joelho registrada (${dor}/10) e perna no sábado, véspera do longão: avalie reduzir a carga ou pular a perna. A decisão é sua.`);
  }
  return out;
}

/**
 * Sequência única de constância: dias seguidos em que estudo E treino foram feitos.
 * Hoje só entra quando já está completo; se ainda não, a sequência vale até ontem.
 * Antes do início do treino, basta o estudo.
 */
export function sequencia(cfg, { cumpridos = {}, treinos = {}, oracoes = {} }, hoje) {
  const inicio = plano(cfg).inicio, iniOr = cfg.oracaoPlano?.inicio;
  // estudo + treino (mínimo: 20 min de caminhada) + oração (mínimo: manhã e noite)
  const ok = (d) => !!cumpridos[d] && (!inicio || d < inicio || treinoFeito(treinos[d])) && (!iniOr || d < iniOr || minimoOracao(oracoes[d]));
  const livre = (x) => diaLivre(cfg, x) && !cumpridos[x]; // dia livre de estudo (24–25/12, 31/12–01/01) não quebra a sequência nem soma
  let d = ok(hoje) || livre(hoje) ? hoje : addDays(hoje, -1), n = 0, guarda = 0;
  while ((ok(d) || livre(d)) && guarda++ < 4000) { if (!livre(d)) n++; d = addDays(d, -1); }
  return n;
}

/** Km feitos na semana (registros) e a meta. */
export function kmDaSemana(cfg, seg, treinos = {}, editadas = {}) {
  const feitos = Array.from({ length: 7 }, (_, i) => addDays(seg, i)).reduce((a, d) => a + (+treinos[d]?.km || 0), 0);
  return { feitos: Math.round(feitos * 10) / 10, meta: planoSemanaCorrida(cfg, seg, editadas)?.km ?? 0 };
}

/** Texto da revisão de domingo para colar na conversa do plano de corrida. */
export function textoResumoCorrida(cfg, seg, treinos = {}, c = {}, editadas = {}) {
  const p = planoSemanaCorrida(cfg, seg, editadas), k = kmDaSemana(cfg, seg, treinos, editadas);
  const nomes = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const fmt = (x) => String(x).replace('.', ',');
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(seg, i), r = treinos[d] ?? {}, plan = p?.dias?.[(i + 1) % 7] ?? 0;
    const tp = p?.tipos?.[(i + 1) % 7];
    const feito = r.feito ? `${fmt(r.km ?? plan)} km` : r.minimo ? 'caminhada 20 min' : 'não fez';
    const dor = r.dor || r.tornozelo || r.inchaco ? ` (dor joelho ${r.dor ?? 0}, tornozelo ${r.tornozelo ?? 0}${r.inchaco ? ', inchaço' : ''})` : '';
    return `${nomes[i]}: ${feito} de ${fmt(plan)} km${tp ? ` (${tp})` : ''}${dor}`;
  });
  return [
    `Resumo da semana de corrida (${seg.split('-').reverse().join('/')})${p ? ` · semana ${p.semana + 1}` : ''}`,
    `Km: ${fmt(c.km ?? k.feitos)} de ${fmt(k.meta)}`,
    ...dias,
    `Dor no joelho (0–10): ${c.joelho ?? '-'} · tornozelo: ${c.tornozelo ?? '-'}`,
    `Sono: ${c.sono || '-'} · Cansaço (0–10): ${c.cansaco ?? '-'}`,
    `Temperos: ${c.temperos || '-'}`,
  ].join('\n');
}
