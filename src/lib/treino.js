// Treino de corrida (SPEC v3 §13): blocos fixos fora das janelas de estudo. Tudo puro e testável.
// Plano (seed, não editável): cfg.treinoPlano. Horários e escolhas (editáveis): cfg.treino.
// Registros do dia (kv 'treinos'): { [dia]: { feito, km, dor, tornozelo, inchaco, minimo } }.
// Semanas editadas por você aos domingos (kv 'treinoSemanas'): { [segunda]: { dias: { wd: km } } }.
import { addDays, diffDays, startOfWeek, weekday } from './dates.js';

export const r05 = (x) => Math.round(x * 2) / 2;
const plano = (cfg) => cfg.treinoPlano ?? {};
export const DOR_LIMITE = 3;

/** Fase da corrida em `dia` (ou null antes do início / depois da prova final). */
export const faseCorrida = (cfg, dia) => (plano(cfg).fases ?? []).find((f) => dia >= f.inicio && dia <= f.fim) ?? null;

/** Semana da corrida (0 = a semana do início), contada de segunda a domingo. */
export const semanaCorrida = (cfg, dia) => Math.floor(diffDays(startOfWeek(plano(cfg).inicio), startOfWeek(dia)) / 7);

/** Divide `total` km nos dias seg..sáb na proporção 2:3:2:4:2:2, arredondando a 0,5 km. */
export function dividir(total, proporcao = [2, 3, 2, 4, 2, 2]) {
  const soma = proporcao.reduce((a, b) => a + b, 0);
  return Object.fromEntries(proporcao.map((p, i) => [i + 1, Math.max(0, r05((total * p) / soma))]));
}

/** Meta da semana nas fases 2 a 5: sobe do início ao fim da fase, com 1 semana leve (80%) a cada 4. */
function metaSemanal(f, seg) {
  const n = Math.max(1, Math.ceil((diffDays(startOfWeek(f.inicio), startOfWeek(f.fim)) + 1) / 7));
  const i = Math.max(0, Math.floor(diffDays(startOfWeek(f.inicio), seg) / 7));
  const base = f.kmIni + ((f.kmFim - f.kmIni) * Math.min(i, n - 1)) / Math.max(1, n - 1);
  return r05(i % 4 === 3 ? base * 0.8 : base);
}

/**
 * Plano da semana que começa em `seg`: { fase, semana, km, longao, leve, dias: { wd: km } } (wd 0 = domingo).
 * Fase 1 vem do seed (semana 1 = semana modelo; as demais = (km − longão) em 2:3:2:4:2:2).
 * Fases 2 a 5: só a meta; os km diários são os que você editou no domingo (senão, uma sugestão na mesma proporção).
 */
export function planoSemanaCorrida(cfg, seg, editadas = {}) {
  const P = plano(cfg), f = faseCorrida(cfg, addDays(seg, 6)) ?? faseCorrida(cfg, seg);
  if (!f) return null;
  const semana = semanaCorrida(cfg, seg);
  let km, longao, dias;
  if (f.n === 1) {
    km = P.fase1.km[semana] ?? P.fase1.km.at(-1); longao = P.fase1.longao[semana] ?? P.fase1.longao.at(-1);
    dias = semana === 0 ? { ...Object.fromEntries(Object.entries(P.semana1).map(([k, v]) => [+k, v])) } : dividir(km - longao, P.proporcao);
  } else {
    km = metaSemanal(f, seg); longao = r05(km * 0.3);
    dias = dividir(km - longao, P.proporcao);
  }
  dias[0] = longao;
  const ed = editadas[seg]?.dias;
  if (ed) for (const [wd, v] of Object.entries(ed)) if (v != null && v !== '') dias[+wd] = Math.max(0, +v);
  const leve = f.n === 1 ? semana === 3 || semana === 7 : diffDays(startOfWeek(f.inicio), seg) / 7 % 4 === 3;
  return { fase: f, semana, km, longao: dias[0], leve, dias };
}

const INTENSIDADE = {
  leve: 'Leve: dá para conversar o tempo todo.',
  'bem leve': 'Bem leve: solto, dá para conversar.',
  strides: 'Leve (dá para conversar) + 6 strides de ~20 s no fim.',
  qualidade: '1 km confortavelmente forte no meio (ou 4–5 subidas curtas). O resto leve.',
  longao: 'Longão devagar: dá para conversar. Objetivo é completar.',
  caminhada: 'Só caminhada hoje: o joelho manda.',
};

/** Treino do dia: corrida (ou longão), musculação, fortalecimento e alertas. `ctx` = { treinos, editadas }. */
export function treinoDoDia(cfg, dia, ctx = {}) {
  const P = plano(cfg), T = cfg.treino ?? {};
  if (!P.inicio || dia < P.inicio) return null;
  const sem = planoSemanaCorrida(cfg, startOfWeek(dia), ctx.editadas ?? {});
  if (!sem) return null;
  const wd = weekday(dia), reg = ctx.treinos?.[dia] ?? {};
  const dor = (reg.dor ?? 0) > DOR_LIMITE || (reg.tornozelo ?? 0) > DOR_LIMITE || !!reg.inchaco;
  let tipo = P.tipos?.[wd] ?? 'leve';
  if (dor) tipo = 'caminhada';
  const km = dor ? 0 : sem.dias[wd] ?? 0;
  const mus = T.musculacao?.[wd] ?? null;
  return {
    dia, wd, tipo, km, longao: wd === 0, hora: wd === 0 ? T.longao : T.corrida, min: wd === 0 ? null : T.corridaMin,
    intensidade: INTENSIDADE[tipo] ?? INTENSIDADE.leve,
    tenis: tipo === 'strides' ? `${T.tenis?.principal ?? 'X-Step'} (o ${T.tenis?.rapido ?? 'Metaspeed'} só nos strides)` : T.tenis?.principal ?? 'X-Step',
    dica: 'Descidas íngremes: caminhando.',
    musculacao: mus ? { ...mus, antesCorrer: mus.tipo === 'lower' && wd === 2 } : null,
    fortalecimento: (T.fortalecimentoDias ?? []).includes(wd) ? P.fortalecimento : null,
    dor, alerta: dor ? 'Dor acima de 3/10 ou inchaço: hoje é só caminhada. Ajuste o plano de corrida.' : null,
    fase: sem.fase, semanaLeve: sem.leve, metaSemana: sem.km,
  };
}

/** O treino do dia conta como feito: corrida/longão feito ou o mínimo (20 min de caminhada). */
export const treinoFeito = (reg) => !!(reg?.feito || reg?.minimo);

/**
 * Avisos das regras da semana (para Hoje e Ajustes):
 * lower nunca na véspera do longão; jiu-jitsu só em dia de corrida leve e nunca na véspera do longão;
 * liberação do fisio/ortopedista antes da Fase 2.
 */
export function alertasTreino(cfg, dia) {
  const P = plano(cfg), T = cfg.treino ?? {}, out = [];
  if (!P.inicio) return out;
  const vespera = 6; // longão no domingo -> véspera é sábado
  for (const [wd, m] of Object.entries(T.musculacao ?? {})) if (+wd === vespera && m.tipo === 'lower') out.push('Lower no sábado é véspera do longão: mude para outro dia.');
  for (const a of cfg.rotina?.aulas ?? []) {
    if (!/jiu/i.test(a.nome ?? '')) continue;
    if (a.dia === vespera) out.push('Jiu-jitsu no sábado é véspera do longão: evite.');
    else if (P.tipos?.[a.dia] === 'qualidade') out.push('Jiu-jitsu no dia do treino forte: troque o dia do jiu-jitsu ou deixe a corrida leve.');
  }
  const f2 = (P.fases ?? []).find((f) => f.n === 2);
  if (f2 && !T.liberadoFisio && dia >= addDays(f2.inicio, -14) && dia < f2.inicio) out.push('Antes da Fase 2 da corrida: pegue a liberação do fisio/ortopedista (marque em Ajustes).');
  return out;
}

/**
 * Sequência única de constância: dias seguidos em que estudo E treino foram feitos.
 * Hoje só entra quando já está completo; se ainda não, a sequência vale até ontem.
 * Antes do início do treino, basta o estudo.
 */
export function sequencia(cfg, { cumpridos = {}, treinos = {} }, hoje) {
  const inicio = plano(cfg).inicio;
  const ok = (d) => !!cumpridos[d] && (!inicio || d < inicio || treinoFeito(treinos[d]));
  let d = ok(hoje) ? hoje : addDays(hoje, -1), n = 0;
  while (ok(d) && n < 4000) { n++; d = addDays(d, -1); }
  return n;
}

/** Km feitos na semana (registros) e a meta. */
export function kmDaSemana(cfg, seg, treinos = {}, editadas = {}) {
  const feitos = Array.from({ length: 7 }, (_, i) => addDays(seg, i)).reduce((a, d) => a + (+treinos[d]?.km || 0), 0);
  return { feitos: r05(feitos), meta: planoSemanaCorrida(cfg, seg, editadas)?.km ?? 0 };
}
