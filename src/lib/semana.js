// Planner semanal v2: distribui as horas de cada matéria nas janelas de estudo, com sessões de 50 min e pausas de 10.
// Tudo é função pura: (configuração, fases, segunda-feira, resultados de simulados) -> semana de blocos com horário.
import { addDays, diffDays, startOfWeek } from './dates.js';
import { faseDoDia } from './phases.js';

export const toMin = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
const horaOk = (s) => typeof s === 'string' && /^\d{1,2}:\d{2}$/.test(s) && toMin(s) <= 1440;
/** Janelas utilizáveis: ignora hora vazia ou inválida e fim <= início; junta as que se sobrepõem (do mesmo tipo). */
export function janelasValidas(lista) {
  const v = (lista ?? []).filter((j) => horaOk(j?.ini) && horaOk(j?.fim) && toMin(j.fim) > toMin(j.ini))
    .map((j) => ({ ini: toMin(j.ini), fim: toMin(j.fim), tipo: j.tipo })).sort((a, b) => a.ini - b.ini);
  const out = [];
  for (const j of v) {
    const u = out.at(-1);
    if (u && j.ini <= u.fim && (u.tipo ?? '') === (j.tipo ?? '')) u.fim = Math.max(u.fim, j.fim); else out.push({ ...j });
  }
  return out;
}
export const toHHMM = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const r10 = (x) => Math.round(x / 10) * 10;

// Matérias que entram no sorteio das janelas de segunda a sexta (a ordem desempata).
export const POOL = ['mat', 'fis', 'por', 'ing', 'qui', 'hg'];
const FOCO = (cfg) => ({ s: cfg.foco?.sessaoMin ?? 50, p: cfg.foco?.pausaMin ?? 10 });

/** Quantas sessões de foco cabem numa janela de `dur` minutos (pausa entre elas, nenhuma no fim). */
export const slotsDaJanela = (dur, s = 50, p = 10) => Math.max(0, Math.floor((dur + p) / (s + p)));
/** Duração (min) de k sessões seguidas com as pausas entre elas. */
export const brutoDeSlots = (k, s = 50, p = 10) => k * s + (k - 1) * p;

/** Distribui `total` unidades inteiras proporcionalmente a `pesos` (maior resto). */
export function repartir(pesos, total) {
  const soma = Object.values(pesos).reduce((a, b) => a + b, 0);
  const res = {}, resto = [];
  let usado = 0;
  for (const [k, v] of Object.entries(pesos)) {
    const x = soma ? (v / soma) * total : 0;
    res[k] = Math.floor(x); usado += res[k]; resto.push([k, x - res[k]]);
  }
  resto.sort((a, b) => b[1] - a[1]);
  for (let i = 0; usado < total && i < resto.length; i++, usado++) res[resto[i][0]]++;
  return res;
}

/** Minutos líquidos de cada matéria na semana que começa em `segunda`. */
export function orcamentoSemana(cfg, faseId, segunda, ctx = {}) {
  const hf = cfg.horasFase?.[faseId] ?? cfg.horasFase?.base ?? {};
  const nominal = cfg.rotina?.metaNominal ?? 50, liquida = cfg.rotina?.metaLiquida ?? 43;
  // a rampa vale nas primeiras semanas do planner, depois da semana diagnóstica (que tem blocos escritos à mão)
  const diag = Object.keys(cfg.diagnostico?.dias ?? {}).sort();
  const primeira = diag.length ? addDays(startOfWeek(diag.at(-1)), 7) : startOfWeek(cfg.perfil.inicioPlano);
  const semIdx = Math.floor(diffDays(primeira, segunda) / 7);
  const r = cfg.rotina?.rampa;
  const rampa = r?.ativa && semIdx >= 0 && semIdx < (r.semanas ?? 2) ? (r.fator ?? 0.75) : 1;
  const f = (liquida / nominal) * rampa * 60;
  const min = {};
  for (const c of [...POOL, 'red', 'provas']) min[c] = Math.round((hf[c] ?? 0) * f);

  const nome = (c) => cfg.categorias?.[c]?.materia;
  const exs = Object.values(ctx.exams ?? {}).filter((e) => e.data < segunda).sort((a, b) => b.data.localeCompare(a.data));
  const nota = (e, c) => e.notas?.[nome(c)];

  // Inglês com 75% ou mais no último simulado em que apareceu: só manutenção (1h); o resto vai para Matemática.
  const eIng = exs.find((e) => nota(e, 'ing') != null);
  if (eIng && nota(eIng, 'ing') >= 75 && min.ing > 60) { min.mat += min.ing - 60; min.ing = 60; }

  // Matéria abaixo de 50% no último simulado (da semana anterior): +2h, tiradas da mais forte.
  const ult = exs[0];
  if (ult && diffDays(ult.data, segunda) <= 7) {
    const dentro = [...POOL, 'red'].filter((c) => nota(ult, c) != null);
    const fracas = dentro.filter((c) => nota(ult, c) < 50).sort((a, b) => nota(ult, a) - nota(ult, b));
    for (const c of fracas) {
      // a mais forte do simulado; sem nota (ou sem horas sobrando), a que tiver mais horas
      const doadora = POOL.filter((x) => !fracas.includes(x) && min[x] >= 120)
        .sort((a, b) => (nota(ult, b) ?? -1) - (nota(ult, a) ?? -1) || min[b] - min[a])[0];
      if (!doadora) continue;
      min[doadora] -= 120; min[c] += 120;
    }
  }
  return min;
}

/** Divide `n` sessões em blocos de 2 (ou 3 no fim), 1 só quando a janela tem uma única sessão. */
const proximoTamanho = (rem) => (rem === 3 ? 3 : rem >= 2 ? 2 : 1);

/**
 * Monta a semana: [{ dia, wd, blocos: [{ cat, ini, fim, min, bruto, sessoes }] }], de segunda a domingo.
 * `min` = minutos líquidos de foco; `bruto` = tempo no relógio (com as pausas entre as sessões do bloco).
 */
export function planoSemana(cfg, fases, segunda, ctx = {}) {
  const { s, p } = FOCO(cfg);
  const fase = faseDoDia(fases, addDays(segunda, 3));
  const min = orcamentoSemana(cfg, fase.id, segunda, ctx);
  const dias = Array.from({ length: 7 }, (_, i) => ({ dia: addDays(segunda, i), wd: (i + 1) % 7, blocos: [] }));
  const janelas = (wd) => janelasValidas(cfg.rotina?.janelas?.[wd]);
  const bloco = (cat, ini, dur, sessoes = 1) => ({ cat, ini, fim: ini + dur, min: sessoes ? sessoes * s : dur, bruto: dur, sessoes });
  const excedente = { prova: 0, red: 0 };
  const janelasLivres = []; // janelas de estudo em ordem cronológica

  // Sábado: prova antiga cronometrada + correção; o que sobrar da janela vira estudo normal.
  const sab = janelas(6).find((j) => j.tipo === 'prova') ?? janelas(6)[0];
  if (sab) {
    const dur = sab.fim - sab.ini, P = min.provas;
    const prova = Math.min(300, r10((P * 5) / 7), dur);
    const cor = Math.max(0, Math.min(120, r10(P) - prova, dur - prova));
    excedente.prova = Math.max(0, P - prova - cor);
    if (prova > 0) dias[5].blocos.push(bloco('prova', sab.ini, prova, 0));
    if (cor > 0) dias[5].blocos.push(bloco('corr', sab.ini + prova, cor, 0));
    const ini = sab.ini + prova + cor + (prova + cor > 0 ? p : 0); // 10 min de pausa depois da correção
    if (sab.fim - ini >= s) janelasLivres.push({ i: 5, ini, fim: sab.fim });
    for (const j of janelas(6)) if (j !== sab && (j.fim <= sab.ini || j.ini >= sab.fim)) janelasLivres.push({ i: 5, ini: j.ini, fim: j.fim });
  }
  // Domingo: redação + planejamento da semana (o que passar da janela vira estudo na semana).
  const dom = janelas(0).find((j) => j.tipo === 'domingo') ?? janelas(0)[0];
  if (dom) {
    const dur = dom.fim - dom.ini, plano = Math.min(30, dur);
    const red = Math.max(0, Math.min(r10(min.red), dur - plano));
    excedente.red = Math.max(0, min.red - red);
    if (red > 0) dias[6].blocos.push(bloco('red', dom.ini, red, 0));
    if (plano > 0) dias[6].blocos.push(bloco('plan', dom.fim - plano, plano, 0));
    for (const j of janelas(0)) if (j !== dom && (j.fim <= dom.ini || j.ini >= dom.fim)) janelasLivres.push({ i: 6, ini: j.ini, fim: j.fim });
  }
  // Segunda a sexta.
  for (let i = 0; i < 5; i++) for (const j of janelas(i + 1)) janelasLivres.push({ i, ini: j.ini, fim: j.fim });
  janelasLivres.sort((a, b) => a.i - b.i || a.ini - b.ini);

  // Orçamento em sessões inteiras, limitado pela capacidade das janelas.
  const demanda = {};
  for (const c of POOL) demanda[c] = min[c] / s;
  if (excedente.prova >= 25) demanda.prova = excedente.prova / s;
  if (excedente.red >= 25) demanda.red = excedente.red / s;
  const cap = janelasLivres.reduce((a, j) => a + slotsDaJanela(j.fim - j.ini, s, p), 0);
  const D = Object.values(demanda).reduce((a, b) => a + b, 0);
  const alvo = Math.min(Math.round(D), cap);
  const aloc = repartir(demanda, alvo);
  // Se sobrar capacidade, as janelas são reduzidas de forma proporcional (os dias não ficam vazios no fim da semana).
  const nJan = janelasLivres.map((j) => slotsDaJanela(j.fim - j.ini, s, p));
  const uso = repartir(Object.fromEntries(nJan.map((n, k) => [k, n])), alvo);

  const ordem = [...POOL, 'prova', 'red'];
  const rest = { ...aloc }, cred = Object.fromEntries(ordem.map((c) => [c, 0]));
  let ultimaCat = null, ultimoDia = -1;
  janelasLivres.forEach((j, k) => {
    let rem = Math.min(uso[k], nJan[k]), ponteiro = j.ini;
    while (rem > 0) {
      const ativos = ordem.filter((c) => (rest[c] ?? 0) > 0);
      if (!ativos.length) return;
      const tam = proximoTamanho(rem), soma = ativos.reduce((a, c) => a + aloc[c], 0);
      for (const c of ativos) cred[c] += aloc[c] * tam;
      let cand = [...ativos].sort((a, b) => cred[b] - cred[a] || ordem.indexOf(a) - ordem.indexOf(b));
      if (j.i === ultimoDia && cand.length > 1 && cand[0] === ultimaCat) cand = [cand[1], cand[0], ...cand.slice(2)];
      const c = cand[0], take = Math.min(tam, rest[c]);
      cred[c] -= soma * tam; rest[c] -= take;
      const dur = brutoDeSlots(take, s, p);
      dias[j.i].blocos.push(bloco(c, ponteiro, dur, take));
      ponteiro += dur + p; rem -= take; ultimaCat = c; ultimoDia = j.i;
    }
  });
  for (const d of dias) d.blocos.sort((a, b) => a.ini - b.ini);
  return dias;
}
