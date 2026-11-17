// Treino de corrida (SPEC v3 §13): blocos fixos fora das janelas de estudo. Tudo puro e testável.
// Plano (seed, não editável): cfg.treinoPlano. Horários e escolhas (editáveis): cfg.treino.
// Registros do dia (kv 'treinos'): { [dia]: { feito, km, dor, tornozelo, inchaco, minimo } }.
// Semanas editadas por você aos domingos (kv 'treinoSemanas'): { [segunda]: { dias: { wd: km } } }.
import { addDays, diffDays, startOfWeek, weekday } from './dates.js';
import { toMin, toHHMM, janelasValidas } from './semana.js';
import { minimoOracao } from './oracao.js';

export const r05 = (x) => Math.round(x * 2) / 2;
const plano = (cfg) => cfg.treinoPlano ?? {};
export const DOR_LIMITE = 3;

/** Fase da corrida em `dia` (ou null antes do início / depois da prova final). */
export const faseCorrida = (cfg, dia) => (plano(cfg).fases ?? []).find((f) => dia >= f.inicio && dia <= f.fim) ?? null;

/** Semana da corrida (0 = a semana do início), contada de segunda a domingo. */
export const semanaCorrida = (cfg, dia) => Math.floor(diffDays(startOfWeek(plano(cfg).inicio), startOfWeek(dia)) / 7);

/** Divide `total` km nos dias seg..sáb na proporção 2:3:2:4:2:2, arredondando a 0,5 km. */
export function dividir(total, proporcao = [2, 3, 2, 4, 2, 2]) {
  // em meios-quilômetros, pelo maior resto: a soma dos dias fecha exatamente com o total (arredondado a 0,5)
  const soma = proporcao.reduce((a, b) => a + b, 0), meios = Math.max(0, Math.round(total * 2));
  const ex = proporcao.map((p) => (meios * p) / soma), base = ex.map(Math.floor);
  let resto = meios - base.reduce((a, b) => a + b, 0);
  const ordem = ex.map((x, i) => [x - base[i], i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; resto > 0; k++, resto--) base[ordem[k % ordem.length][1]]++;
  return Object.fromEntries(base.map((m, i) => [i + 1, m / 2]));
}

/** Meta da semana nas fases 2 a 5: sobe do início ao fim da fase, com 1 semana leve (80%) a cada 4. */
function metaSemanal(f, seg) {
  const n = Math.max(1, Math.ceil((diffDays(startOfWeek(f.inicio), startOfWeek(f.fim)) + 1) / 7));
  const i = Math.max(0, Math.floor(diffDays(startOfWeek(f.inicio), seg) / 7));
  const base = f.kmIni + ((f.kmFim - f.kmIni) * Math.min(i, n - 1)) / Math.max(1, n - 1);
  return r05(f.polimento ? base : i % 4 === 3 ? base * 0.8 : base); // no polimento só desce
}

/**
 * Plano da semana que começa em `seg`: { fase, semana, km, longao, leve, dias: { wd: km }, prova, travados } (wd 0 = domingo).
 * `travados`: dias (wd) que não aceitam edição: o dia da prova e os seguintes.
 * Fase 1 vem do seed (semana 1 = semana modelo; as demais = (km − longão) em 2:3:2:4:2:2).
 * Fases 2 a 5: só a meta; os km diários são os que você editou no domingo (senão, uma sugestão na mesma proporção).
 */
export function planoSemanaCorrida(cfg, seg, editadas = {}) {
  const P = plano(cfg), f = faseCorrida(cfg, seg) ?? faseCorrida(cfg, addDays(seg, 6));
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
  // semana de prova (maratona, 100 km): dias antes da prova curtos e leves, a prova no dia, descanso depois (sem longão)
  const prova = (P.provas ?? []).find((p) => p.data >= seg && p.data <= addDays(seg, 6));
  const ordem = [1, 2, 3, 4, 5, 6, 0], antes = prova ? ordem.indexOf(weekday(prova.data)) : 7;
  if (prova) {
    for (const [k, wd] of ordem.entries()) dias[wd] = k < antes ? Math.min(dias[wd], k < antes - 1 ? 4 : 2) : k === antes ? prova.km : 0;
  }
  // semana do início (começa numa terça): dias antes do início não contam
  for (let i = 0; i < 7; i++) if (addDays(seg, i) < P.inicio) dias[(i + 1) % 7] = 0;
  // edições de domingo: só nos dias antes da prova (o dia da prova e os seguintes ficam travados)
  const travados = ordem.slice(antes);
  const ed = editadas[seg]?.dias;
  if (ed) for (const [wd, v] of Object.entries(ed)) if (v != null && v !== '' && Number.isFinite(+v) && !travados.includes(+wd)) dias[+wd] = Math.max(0, +v);
  const leve = f.n === 1 ? semana === 3 || semana === 7 : !f.polimento && diffDays(startOfWeek(f.inicio), seg) / 7 % 4 === 3;
  const total = Object.values(dias).reduce((a, b) => a + b, 0);
  return { fase: f, semana, km: prova || seg < P.inicio ? total : km, longao: dias[0], leve, dias, prova: prova ?? null, travados };
}

const INTENSIDADE = {
  leve: 'Leve: dá para conversar o tempo todo.',
  'bem leve': 'Bem leve: solto, dá para conversar.',
  strides: 'Leve (dá para conversar) + 6 strides de ~20 s no fim.',
  qualidade: '1 km confortavelmente forte no meio (ou 4–5 subidas curtas). O resto leve.',
  prova: 'Dia de prova: ritmo de completar, hidratação e comida testadas antes.',
  descanso: 'Descanso depois da prova: só caminhada leve, se quiser.',
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
  if (sem.prova) tipo = dia === sem.prova.data ? 'prova' : dia > sem.prova.data ? 'descanso' : ['qualidade', 'strides', 'longao'].includes(tipo) ? 'leve' : tipo;
  if (dor) tipo = 'caminhada';
  const km = dor ? 0 : sem.dias[wd] ?? 0;
  // musculação some nos 2 dias antes de uma prova, no dia e no resto da semana dela
  const pertoDeProva = (P.provas ?? []).some((p) => dia >= addDays(p.data, -2) && dia <= addDays(startOfWeek(p.data), 6));
  const musCfg = T.musculacao?.[wd] ?? null, mus = pertoDeProva ? null : musCfg;
  const hora = wd === 0 ? T.longao : T.corrida;
  // duração estimada (ritmo leve + 10 min de aquecimento) e se cruza alguma janela de estudo do dia (sobreposição real)
  const min = km ? Math.round(km * (T.ritmoMinKm ?? 7) + 10) : T.corridaMin ?? 45;
  const horaOk = typeof hora === 'string' && /^\d{1,2}:\d{2}$/.test(hora);
  const ini = horaOk ? toMin(hora) : null, fim = horaOk ? ini + min : null;
  const temCorrida = km > 0 && !['prova', 'descanso', 'caminhada'].includes(tipo);
  const janela = horaOk && temCorrida ? janelasValidas(cfg.rotina?.janelas?.[wd]).find((j) => j.ini < fim && j.fim > ini) : null;
  const choque = !janela ? null
    : janela.ini >= ini ? `A corrida termina por volta de ${toHHMM(fim)} e o estudo começa às ${toHHMM(janela.ini)}: saia mais cedo ou encurte o aquecimento.`
    : `A corrida termina por volta de ${toHHMM(fim)} e cai dentro da janela de estudo das ${toHHMM(janela.ini)}: mude o horário da corrida ou da janela.`;
  return {
    dia, wd, tipo, km, longao: wd === 0 && !sem.prova, hora, min, choque, prova: sem.prova && dia === sem.prova.data ? sem.prova : null,
    intensidade: INTENSIDADE[tipo] ?? INTENSIDADE.leve,
    tenis: tipo === 'strides' ? `${T.tenis?.principal ?? 'X-Step'} (o ${T.tenis?.rapido ?? 'Metaspeed'} só nos strides)` : T.tenis?.principal ?? 'X-Step',
    dica: `${musCfg && !mus ? 'Sem musculação: semana de prova. ' : ''}Descidas íngremes: caminhando.`,
    musculacao: mus ? { ...mus, correrAntes: mus.tipo === 'lower' && wd === 2 } : null,
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
    else if (a.dia === 0) out.push('Jiu-jitsu no domingo é dia de longão: evite.');
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
export function sequencia(cfg, { cumpridos = {}, treinos = {}, oracoes = {} }, hoje) {
  const inicio = plano(cfg).inicio, iniOr = cfg.oracaoPlano?.inicio;
  // estudo + treino (mínimo: 20 min de caminhada) + oração (mínimo: manhã e noite)
  const ok = (d) => !!cumpridos[d] && (!inicio || d < inicio || treinoFeito(treinos[d])) && (!iniOr || d < iniOr || minimoOracao(oracoes[d]));
  let d = ok(hoje) ? hoje : addDays(hoje, -1), n = 0;
  while (ok(d) && n < 4000) { n++; d = addDays(d, -1); }
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
    const feito = r.feito ? `${fmt(r.km ?? plan)} km` : r.minimo ? 'caminhada 20 min' : 'não fez';
    const dor = r.dor || r.tornozelo || r.inchaco ? ` (dor joelho ${r.dor ?? 0}, tornozelo ${r.tornozelo ?? 0}${r.inchaco ? ', inchaço' : ''})` : '';
    return `${nomes[i]}: ${feito} de ${fmt(plan)} km${dor}`;
  });
  return [
    `Resumo da semana de corrida (${seg.split('-').reverse().join('/')})${p ? ` · Fase ${p.fase.n} ${p.fase.nome}, semana ${p.semana + 1}${p.leve ? ' (leve)' : ''}` : ''}`,
    `Km: ${fmt(c.km ?? k.feitos)} de ${fmt(k.meta)}`,
    ...dias,
    `Dor no joelho (0–10): ${c.joelho ?? '-'} · tornozelo: ${c.tornozelo ?? '-'}`,
    `Sono: ${c.sono || '-'} · Cansaço (0–10): ${c.cansaco ?? '-'}`,
    `Temperos: ${c.temperos || '-'}`,
  ].join('\n');
}
