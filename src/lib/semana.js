// Planner semanal v2: distribui as horas de cada matéria nas janelas de estudo, com sessões de 50 min e pausas de 10.
// Tudo é função pura: (configuração, fases, segunda-feira, resultados de simulados) -> semana de blocos com horário.
import { addDays, diffDays, startOfWeek } from './dates.js';
import { faseDoDia } from './phases.js';
import { janelasDoDia, diaLivre } from './rotina.js';

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

/** Minutos líquidos de cada matéria na semana que começa em `segunda`: meta líquida (55 h) × % da matéria na fase. */
export function orcamentoSemana(cfg, faseId, segunda, ctx = {}) {
  const hf = cfg.horasFase?.[faseId] ?? cfg.horasFase?.ano1 ?? {};
  const liquida = cfg.rotina?.metaLiquida ?? 55;
  // a rampa vale nas primeiras semanas do planner, depois da semana diagnóstica (que tem blocos escritos à mão)
  const diag = Object.keys(cfg.diagnostico?.dias ?? {}).sort();
  const primeira = diag.length ? addDays(startOfWeek(diag.at(-1)), 7) : startOfWeek(cfg.perfil.inicioPlano);
  const semIdx = Math.floor(diffDays(primeira, segunda) / 7);
  const r = cfg.rotina?.rampa;
  const rampa = r?.ativa && semIdx >= 0 && semIdx < (r.semanas ?? 2) ? (r.fator ?? 0.75) : 1;
  // o resgate de sábado e as 2 h de domingo (revisão leve + planejamento) saem antes: os % valem para o resto
  const dom = cfg.rotina?.domingo, domMin = dom ? Math.max(0, toMin(dom.fim) - toMin(dom.ini)) : 0;
  const fixo = (cfg.rotina?.resgateSabadoMin ?? 0) + domMin;
  const total = Math.max(0, liquida * 60 - fixo) * rampa;
  const min = {};
  for (const c of [...POOL, 'red', 'provas']) min[c] = Math.round((total * (hf[c] ?? 0)) / 100);
  // sábados de junho a agosto (Ano 2 e Ano 3): 1 prova antiga por semana (EFOMM em jun–jul, Escola Naval em agosto)
  const mesSab = +addDays(segunda, 5).slice(5, 7);
  if ((faseId === 'ano2' || faseId === 'ano3') && mesSab >= 6 && mesSab <= 8) min.provas = Math.max(min.provas, cfg.rotina?.provaSabadoMin ?? 240);

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

/** Partes das outras janelas do dia que ficam fora da janela especial `esp` (prova ou domingo): nada é perdido nem sobreposto. */
function foraDe(lista, esp) {
  const out = [];
  for (const j of lista) {
    if (j === esp || (j.ini === esp.ini && j.fim === esp.fim && j.tipo === esp.tipo)) continue;
    if (j.ini < esp.ini) out.push({ ...j, fim: Math.min(j.fim, esp.ini) });
    if (j.fim > esp.fim) out.push({ ...j, ini: Math.max(j.ini, esp.fim) });
  }
  return out.filter((j) => j.fim > j.ini);
}

/** Tira das janelas os intervalos reservados (ex.: terço, Ângelus), partindo a janela quando precisa. */
export function recortar(lista, reservas = []) {
  let out = lista.map((j) => ({ ...j }));
  for (const r of reservas) {
    out = out.flatMap((j) => (r.fim <= j.ini || r.ini >= j.fim ? [j] : [{ ...j, fim: r.ini }, { ...j, ini: r.fim }].filter((x) => x.fim > x.ini)));
  }
  return out;
}

/** Como `repartir`, mas cada posição tem um teto; o que passa do teto vai para as outras, na mesma proporção dos pesos. */
export function repartirComTeto(pesos, tetos, total) {
  const res = pesos.map(() => 0);
  let livre = pesos.map((_, i) => i).filter((i) => tetos[i] > 0 && pesos[i] > 0), resto = total;
  while (resto > 0 && livre.length) {
    const alvo = repartir(Object.fromEntries(livre.map((i) => [i, pesos[i]])), resto);
    let sobra = 0, mexeu = 0;
    for (const i of livre) { const add = Math.min(alvo[i], tetos[i] - res[i]); res[i] += add; mexeu += add; sobra += alvo[i] - add; }
    resto = sobra; livre = livre.filter((i) => res[i] < tetos[i]);
    if (!mexeu) break;
  }
  return res;
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
  // oração: esse tempo sai das janelas de estudo (a janela da prova de sábado não é partida); `ctx.reservas` pode ser função da segunda-feira
  const reservas = (typeof ctx.reservas === 'function' ? ctx.reservas(segunda) : ctx.reservas) ?? {};
  // janela curta de verdade (30 a 49 min, ex.: segunda depois da corrida) é marcada antes do recorte: sobras do recorte não viram bloco curto
  const marcar = (l) => l.map((j) => ({ ...j, curta: j.fim - j.ini >= 30 && j.fim - j.ini < s }));
  const corta = (l, r) => l.flatMap((j) => (j.tipo === 'prova' && min.provas > 0 ? [j] : recortar([j], r))); // prova cronometrada não é partida
  const janelas = (wd) => corta(marcar(janelasValidas(janelasDoDia(cfg, wd))), reservas[wd]);
  const livre = dias.map((d) => diaLivre(cfg, d.dia)); // 24–25/12 e 31/12–01/01: sem estudo
  const bloco = (cat, ini, dur, sessoes = 1) => ({ cat, ini, fim: ini + dur, min: sessoes ? sessoes * s : dur, bruto: dur, sessoes });
  const excedente = { prova: 0, red: 0 };
  const sessoesDe = (j) => slotsDaJanela(j.fim - j.ini, s, p);
  const janelasLivres = []; // janelas de estudo em ordem cronológica

  // Sábado: prova antiga cronometrada + correção; o que sobrar da janela vira estudo normal.
  const sab = livre[5] ? null : janelas(6).find((j) => j.tipo === 'prova') ?? janelas(6)[0];
  if (sab) {
    const dur = sab.fim - sab.ini, P = min.provas;
    const reserva = P > 0 ? Math.min(60, Math.floor(dur / 3 / 10) * 10) : 0; // a correção sempre tem lugar na janela
    const prova = Math.min(300, r10((P * 5) / 7), dur - reserva);
    const cor = Math.max(0, Math.min(120, r10(P) - prova, dur - prova));
    excedente.prova = Math.max(0, P - prova - cor);
    if (prova > 0) dias[5].blocos.push(bloco('prova', sab.ini, prova, 0));
    if (cor > 0) dias[5].blocos.push(bloco('corr', sab.ini + prova, cor, 0));
    const ini = sab.ini + prova + cor + (prova + cor > 0 ? p : 0); // 10 min de pausa depois da correção
    if (sab.fim - ini >= s) janelasLivres.push({ i: 5, ini, fim: sab.fim });
    for (const j of foraDe(janelas(6), sab)) janelasLivres.push({ i: 5, ini: j.ini, fim: j.fim, curta: j.curta });
  }
  // Domingo: 2 h de revisão leve; o planejamento da semana fica no fim. (A redação semanal vai para um dia útil.)
  const dom = livre[6] ? null : janelas(0).find((j) => j.tipo === 'domingo') ?? janelas(0).at(-1);
  if (dom) {
    const dur = dom.fim - dom.ini, plano = Math.min(30, dur);
    if (plano > 0) dias[6].blocos.push(bloco('plan', dom.fim - plano, plano, 0));
    const rev = dom.fim - plano - (plano > 0 ? p : 0) - dom.ini;
    if (rev >= 20) dias[6].blocos.push(bloco('revl', dom.ini, rev, 0));
    for (const j of foraDe(janelas(0), dom)) janelasLivres.push({ i: 6, ini: j.ini, fim: j.fim, curta: j.curta });
  }
  // Segunda a sexta.
  // segunda a sexta: o tipo não importa, então janelas que se sobrepõem viram uma só
  for (let i = 0; i < 5; i++) if (!livre[i]) for (const j of corta(marcar(janelasValidas(janelasDoDia(cfg, i + 1).map((x) => ({ ...x, tipo: undefined })))), reservas[i + 1])) janelasLivres.push({ i, ini: j.ini, fim: j.fim, curta: j.curta });
  janelasLivres.sort((a, b) => a.i - b.i || a.ini - b.ini);
  // Resgate do sábado (2 h contínuas): tópicos da semana que não foram "matados"; sem pendência, prova antiga ou questões.
  const resgMin = Math.round(Number(cfg.rotina?.resgateSabadoMin ?? 0));
  if (resgMin > 0) {
    const k = janelasLivres.findIndex((j) => j.i === 5 && j.fim - j.ini >= resgMin);
    if (k >= 0) {
      const j = janelasLivres[k];
      dias[5].blocos.push({ cat: 'resg', ini: j.ini, fim: j.ini + resgMin, min: resgMin, bruto: resgMin, sessoes: 0 });
      j.ini += resgMin + p;
      if (sessoesDe(j) < 1) janelasLivres.splice(k, 1);
    }
  }
  // Redação (1 por semana, a partir do Ano 1): um bloco inteiro num dia útil
  const nRed = Math.round(min.red / s);
  if (nRed >= 1) {
    const di = Math.min(4, Math.max(0, (Number(cfg.rotina?.diaRedacao) || 3) - 1));
    const cand = janelasLivres.map((j, k) => ({ j, k })).filter((x) => x.j.i === di && !x.j.curta).sort((a, b) => sessoesDe(b.j) - sessoesDe(a.j))[0];
    let feitas = 0;
    if (cand && sessoesDe(cand.j) >= 1) {
      const take = Math.min(nRed, sessoesDe(cand.j)), dur = brutoDeSlots(take, s, p);
      dias[di].blocos.push(bloco('red', cand.j.ini, dur, take));
      cand.j.ini += dur + p; feitas = take;
      if (sessoesDe(cand.j) < 1) janelasLivres.splice(cand.k, 1);
    }
    excedente.red = (nRed - feitas) * s;
  }
  // janela curta (30 a 49 min, ex.: segunda 6h30–7h10 depois da corrida): uma sessão curta de Matemática, descontada do orçamento
  for (let k = janelasLivres.length - 1; k >= 0; k--) {
    const j = janelasLivres[k], dur = j.fim - j.ini;
    if (j.curta && dur >= 30 && dur < s) {
      dias[j.i].blocos.push({ cat: 'mat', ini: j.ini, fim: j.fim, min: dur, bruto: dur, sessoes: 1, curta: true });
      min.mat = Math.max(0, min.mat - dur); janelasLivres.splice(k, 1);
    }
  }

  // Orçamento em sessões inteiras, limitado pela capacidade das janelas.
  const demanda = {};
  for (const c of POOL) demanda[c] = min[c] / s;
  if (excedente.prova >= 25) demanda.prova = excedente.prova / s;
  if (excedente.red >= 25) demanda.red = excedente.red / s;
  const D = Object.values(demanda).reduce((a, b) => a + b, 0);
  const nJan = janelasLivres.map((j) => sessoesDe(j));
  // teto de cada janela: com `rotina.metaDia` (horas líquidas por dia da semana), o dia não passa da meta dele (descontados os blocos especiais)
  let teto = nJan;
  const metaDia = cfg.rotina?.metaDia;
  if (metaDia) {
    teto = nJan.map(() => 0);
    for (let i = 0; i < 7; i++) {
      const ks = janelasLivres.map((j, k) => (j.i === i ? k : -1)).filter((k) => k >= 0);
      if (!ks.length) continue;
      const especial = dias[i].blocos.reduce((a, b) => a + b.min, 0);
      const allow = Math.max(0, Math.round((Number(metaDia[(i + 1) % 7] ?? 0) * 60 - especial) / s));
      const caps = ks.map((k) => nJan[k]);
      const r = repartirComTeto(caps, caps, Math.min(allow, caps.reduce((a, b) => a + b, 0)));
      ks.forEach((k, n) => { teto[k] = r[n]; });
    }
  }
  const cap = teto.reduce((a, b) => a + b, 0);
  const alvo = Math.min(Math.round(D), cap);
  const aloc = repartir(demanda, alvo);
  // Se sobrar capacidade, as janelas são reduzidas de forma proporcional (os dias não ficam vazios no fim da semana).
  const peso = Math.max(1, Number(cfg.rotina?.pesoFimDeSemana) || 1);
  const uso = repartirComTeto(janelasLivres.map((j, k) => teto[k] * (j.i >= 5 ? peso : 1)), teto, alvo);

  const ordem = [...POOL, 'prova', 'red'];
  const rest = { ...aloc }, cred = Object.fromEntries(ordem.map((c) => [c, 0]));
  let ultimaCat = null, ultimoDia = -1;
  const fimUso = janelasLivres.map((j) => j.ini), colocado = Object.fromEntries(POOL.map((c) => [c, 0]));
  janelasLivres.forEach((j, k) => {
    let rem = Math.min(uso[k], teto[k]), ponteiro = j.ini;
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
      if (c in colocado) colocado[c] += take * s;
      ponteiro += dur + p; rem -= take; ultimaCat = c; ultimoDia = j.i;
    }
    fimUso[k] = ponteiro;
  });
  // Sobras de janela cheia (20 a 49 min): sessão curta da matéria que mais está devendo, até a meta do dia
  if (metaDia) {
    janelasLivres.forEach((j, k) => {
      if (uso[k] < teto[k] || uso[k] < nJan[k] || j.curta) return;
      const sobra = j.fim - fimUso[k], dia = dias[j.i];
      const feitoDia = dia.blocos.reduce((a, b) => a + b.min, 0), falta = Number(metaDia[(j.i + 1) % 7] ?? 0) * 60 - feitoDia;
      const dur = Math.min(sobra, s - 1, Math.floor(falta));
      if (dur < 20) return;
      const c = POOL.filter((x) => min[x] > 0).sort((a, b) => (min[b] - colocado[b]) - (min[a] - colocado[a]))[0];
      if (!c) return;
      dia.blocos.push({ cat: c, ini: fimUso[k], fim: fimUso[k] + dur, min: dur, bruto: dur, sessoes: 1, sobra: true });
      colocado[c] += dur;
    });
  }
  for (const d of dias) d.blocos.sort((a, b) => a.ini - b.ini);
  return dias;
}
