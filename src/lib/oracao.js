// Oração (católico, liturgia tradicional, Missal de 1962). Funções puras e testáveis.
// Plano (seed, não editável): cfg.oracaoPlano. Horários (editáveis): cfg.oracao.
// Marcas do dia (kv 'oracoes'): { [dia]: { [itemId]: true } }.
import { addDays, diffDays, weekday } from './dates.js';
import { toMin } from './semana.js';

const P = (cfg) => cfg.oracaoPlano ?? {};
const T = (cfg) => cfg.oracao ?? {};
export const MINIMO = ['manha', 'noite']; // mínimo do dia para a sequência
const mmdd = (d) => d.slice(5);

/** Domingo de Páscoa do ano (algoritmo de Meeus/Butcher). */
export function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
/** Tempo pascal (Regina Caeli no lugar do Ângelus): do Sábado Santo ao sábado depois de Pentecostes. */
export const tempoPascal = (dia) => { const p = pascoa(+dia.slice(0, 4)); return dia >= addDays(p, -1) && dia <= addDays(p, 55); };

/** 1º domingo do Advento do ano: o domingo entre 27/11 e 03/12. */
const advento1 = (ano) => { const d = `${ano}-11-27`; return addDays(d, (7 - weekday(d)) % 7); };

/** Chave do Evangelho do dia no calendário de 1962 (domingos e algumas festas; nas férias, o do domingo anterior). */
export function chaveEvangelho(dia) {
  const ano = +dia.slice(0, 4), md = mmdd(dia);
  const fixas = { '12-25': 'natal', '01-01': 'circuncisao', '01-06': 'epifania' };
  if (fixas[md]) return fixas[md];
  const p = pascoa(ano), dp = diffDays(p, dia);
  if (dp === -46) return 'cinzas';
  if (dp === 39) return 'ascensao';
  if (dp === 60) return 'corpus';
  const dom = addDays(dia, -weekday(dia));
  // Advento e Natal
  const a1 = advento1(ano);
  if (dom >= a1) { const n = diffDays(a1, dom) / 7 + 1; return dom >= `${ano}-12-26` ? 'oitavaNatal' : `advento${Math.min(4, n)}`; }
  if (dom >= `${ano}-01-01` && dom <= `${ano}-01-05`) return 'santoNome';
  // último domingo de outubro: Cristo Rei
  const ultOut = addDays(`${ano}-10-31`, -weekday(`${ano}-10-31`));
  if (dom === ultOut) return 'cristoRei';
  const dd = diffDays(p, dom);
  const temp = { '-63': 'septuagesima', '-56': 'sexagesima', '-49': 'quinquagesima', '-42': 'quaresma1', '-35': 'quaresma2', '-28': 'quaresma3', '-21': 'quaresma4', '-14': 'paixao', '-7': 'ramos', 0: 'pascoa', 7: 'pascoela', 14: 'pascoa2', 21: 'pascoa3', 28: 'pascoa4', 35: 'pascoa5', 42: 'posAscensao', 49: 'pentecostes', 56: 'trindade' };
  if (temp[dd]) return temp[dd];
  if (dd > 56) {
    if (addDays(dom, 7) >= advento1(ano)) return 'pent24'; // último domingo depois de Pentecostes
    return `pent${Math.min(23, (dd - 49) / 7 + 1)}`;
  }
  // depois da Epifania até a Septuagésima
  const ep = `${ano}-01-06`, domEp = addDays(ep, 7 - weekday(ep) || 7);
  if (dom >= domEp && dd < -63) { const n = diffDays(domEp, dom) / 7 + 1; return n === 1 ? 'sagradaFamilia' : `epifania${Math.min(6, n)}`; }
  return 'epifania';
}
export function evangelhoDoDia(cfg, dia) {
  const k = chaveEvangelho(dia), ev = P(cfg).evangelhos ?? {};
  const ref = k.startsWith('pent') && k !== 'pentecostes' ? ev.pent?.[k.slice(4)] : ev[k];
  const quaresma = (() => { const dp = diffDays(pascoa(+dia.slice(0, 4)), dia); return dp > -46 && dp < -7 && weekday(dia) !== 0; })();
  return { chave: k, ref: ref ?? null, link: P(cfg).links?.evangelho, obs: quaresma ? 'Na Quaresma as férias têm Evangelho próprio.' : weekday(dia) !== 0 ? 'Nos dias de semana sem festa repete-se o Evangelho do domingo.' : null };
}
export const santoDoDia = (cfg, dia) => ({ nome: P(cfg).santos?.[mmdd(dia)] ?? null, link: P(cfg).links?.santo });
export const festaDoDia = (cfg, dia) => P(cfg).festas?.[mmdd(dia)] ?? null;

/** Mistérios do terço do dia (gozosos seg/qui, dolorosos ter/sex, gloriosos qua/sáb/dom). */
export function misteriosDoDia(cfg, dia) {
  const tipo = P(cfg).misteriosDoDia?.[weekday(dia)] ?? 'gloriosos';
  return { tipo, lista: P(cfg).misterios?.[tipo] ?? [] };
}

/** Mês de oração (0, 1, 2...) contado de 30 em 30 dias a partir do início. */
export const mesOracao = (cfg, dia) => Math.floor(diffDays(P(cfg).inicio, dia) / (P(cfg).diasMes ?? 30));

/** Itens do nível n. */
export const itensDoNivel = (cfg, n) => P(cfg).niveis?.find((x) => x.n === n)?.itens ?? P(cfg).niveis?.[0]?.itens ?? [];
/** O dia conta para o mês quando todos os itens do nível foram marcados. */
export const diaCompleto = (cfg, marcas, n) => itensDoNivel(cfg, n).every((i) => marcas?.[i]);
export const minimoOracao = (marcas) => MINIMO.every((i) => marcas?.[i]);

/**
 * Nível de oração em `dia`: começa no 1; ao fim de cada mês de 30 dias, sobe se houve pelo menos 27 dias completos
 * (com os itens do nível daquele mês); senão repete o mês. Nunca desce.
 */
export function nivelOracao(cfg, oracoes, dia) {
  const p = P(cfg); if (!p.inicio || dia < p.inicio) return 1;
  const max = p.niveis?.length ?? 4, meses = mesOracao(cfg, dia);
  let n = 1;
  for (let m = 0; m < meses; m++) {
    const ini = addDays(p.inicio, m * (p.diasMes ?? 30));
    let ok = 0;
    for (let i = 0; i < (p.diasMes ?? 30); i++) if (diaCompleto(cfg, oracoes[addDays(ini, i)], n)) ok++;
    if (ok >= (p.diasMeta ?? 27)) n = Math.min(max, n + 1);
  }
  return n;
}
/** Progresso do mês atual: dias completos, meta e dias que ainda faltam. */
export function progressoMes(cfg, oracoes, dia) {
  const p = P(cfg), n = nivelOracao(cfg, oracoes, dia), m = Math.max(0, mesOracao(cfg, dia));
  const ini = addDays(p.inicio, m * (p.diasMes ?? 30));
  let ok = 0; for (let i = 0; i < (p.diasMes ?? 30); i++) { const d = addDays(ini, i); if (d <= dia && diaCompleto(cfg, oracoes[d], n)) ok++; }
  return { nivel: n, nome: p.niveis?.find((x) => x.n === n)?.nome, ok, meta: p.diasMeta ?? 27, de: p.diasMes ?? 30, fim: addDays(ini, (p.diasMes ?? 30) - 1) };
}

/** Provas reais do Calendário (concursos no plano). */
const provasReais = (cfg) => (cfg.concursos ?? []).filter((c) => c.plano !== false)
  .flatMap((c) => (c.eventos ?? []).filter((e) => e.tipo === 'prova').map((e) => ({ data: e.inicio, nome: `${c.sigla ?? c.nome}${e.nome ? ` · ${e.nome}` : ''}` })));
/** Novena a São José de Cupertino nos 9 dias antes de cada prova: { dia: 1..9, prova } ou null. */
export function novenaDoDia(cfg, dia) {
  const p = provasReais(cfg).map((x) => ({ ...x, falta: diffDays(dia, x.data) })).filter((x) => x.falta >= 1 && x.falta <= 9).sort((a, b) => a.falta - b.falta)[0];
  return p ? { dia: 10 - p.falta, prova: p } : null;
}

const txt = (cfg, ...ks) => ks.map((k) => P(cfg).textos?.[k]).filter(Boolean);
const TERCO = ['terco', 'credo', 'paiNosso', 'aveMaria', 'gloria', 'fatima', 'salve'];

/**
 * Itens de oração do dia, em ordem de horário: { id, titulo, hora, min, partes: [{nome, texto, conferir}], extra, conta }.
 * `conta`: entra na regra dos 27/30. ctx = { oracoes, temProva } (temProva: o dia tem prova antiga, simulado ou checkpoint).
 */
export function oracoesDoDia(cfg, dia, ctx = {}) {
  const p = P(cfg); if (!p.inicio || dia < p.inicio) return [];
  const h = T(cfg), d = h.duracoes ?? {}, n = nivelOracao(cfg, ctx.oracoes ?? {}, dia);
  const mis = misteriosDoDia(cfg, dia), outros = ['gozosos', 'dolorosos', 'gloriosos'].filter((x) => x !== mis.tipo);
  const misTxt = (tipo) => ({ nome: `Mistérios ${tipo}`, texto: (p.misterios?.[tipo] ?? []).map((m, i) => `${i + 1}º ${m}`).join('\n') });
  const pascal = tempoPascal(dia), ev = evangelhoDoDia(cfg, dia), santo = santoDoDia(cfg, dia), domingo = weekday(dia) === 0;
  const defs = {
    manha: { titulo: 'Oração da manhã', hora: h.manha, min: d.manha, partes: txt(cfg, 'sinal', 'coracao', 'oferecimento', 'paiNosso', 'aveMaria', 'credo') },
    terco1: { titulo: `Terço · mistérios ${n >= 3 ? mis.tipo : mis.tipo}`, hora: h.terco1, min: d.terco, partes: [misTxt(mis.tipo), ...txt(cfg, ...TERCO)] },
    terco2: { titulo: `2º terço · mistérios ${n >= 3 ? outros[0] : mis.tipo}`, hora: h.terco2, min: d.terco, partes: [misTxt(n >= 3 ? outros[0] : mis.tipo), ...txt(cfg, 'terco')], sub: 'Depois do almoço' },
    terco3: { titulo: `3º terço · mistérios ${outros[1]}`, hora: domingo ? null : h.terco3, min: d.terco, partes: [misTxt(outros[1]), ...txt(cfg, 'terco')], sub: domingo ? 'Depois do longão' : 'Depois da corrida' },
    angelus: { titulo: pascal ? 'Regina Caeli' : 'Ângelus', hora: h.angelus, min: d.angelus, partes: txt(cfg, pascal ? 'reginaCaeli' : 'angelus') },
    evangelho: { titulo: `Evangelho do dia${ev.ref ? ` · ${ev.ref}` : ''}`, hora: null, partes: [{ nome: 'Referência (Missal de 1962, Bíblia Matos Soares)', texto: `${ev.ref ?? 'Ver no Missal'}${ev.obs ? `\n${ev.obs}` : ''}`, conferir: true }], link: ev.link },
    lectio: { titulo: 'Lectio divina', hora: h.lectio, min: d.lectio, partes: txt(cfg, 'lectio') },
    santo: { titulo: `Santo do dia${santo.nome ? ` · ${santo.nome}` : ''}`, hora: null, partes: [{ nome: 'Calendário tradicional', texto: santo.nome ?? 'Férias ou santo não cadastrado: veja no calendário de 1962.', conferir: true }], link: santo.link },
    catecismo: { titulo: 'Catecismo Maior de São Pio X · 3 perguntas', hora: null, partes: [], link: p.links?.catecismo, marcador: true },
    noite: { titulo: 'Oração da noite', hora: h.noite, min: d.noite, partes: txt(cfg, 'exame', 'contricao', 'noite', 'anjo') },
  };
  const lista = itensDoNivel(cfg, n).map((id) => ({ id, conta: true, ...defs[id] }));
  // ligação com o estudo e com as provas (não entram na regra dos 27/30)
  lista.push({ id: 'estudo', conta: false, titulo: 'Antes do 1º bloco de estudo', hora: null, min: d.estudo, partes: txt(cfg, 'vinde', 'tomas'), antesDoEstudo: true });
  if (ctx.temProva) lista.push({ id: 'prova', conta: false, titulo: 'Antes da prova: São José de Cupertino', hora: null, partes: txt(cfg, 'cupertino') });
  const nov = novenaDoDia(cfg, dia);
  if (nov) lista.push({ id: 'novena', conta: false, titulo: `Novena a São José de Cupertino · dia ${nov.dia} de 9`, sub: `Pela prova ${nov.prova.nome} (${nov.prova.data.split('-').reverse().join('/')})`, hora: null, partes: [...txt(cfg, 'cupertino', 'paiNosso', 'aveMaria', 'gloria')] });
  const festa = festaDoDia(cfg, dia);
  if (festa) lista.push({ id: 'festa', conta: false, titulo: `Festa de ${festa}`, hora: null, partes: festa.includes('Cupertino') ? txt(cfg, 'cupertino') : txt(cfg, 'tomas') });
  return lista.map((x) => ({ ...x, partes: x.partes ?? [] }))
    .sort((a, b) => (a.hora ? toMin(a.hora) : 9999) - (b.hora ? toMin(b.hora) : 9999));
}

/** Intervalos de oração que saem das janelas de estudo, por dia da semana (0 = dom): { wd: [{ ini, fim }] em minutos }. */
export function reservasOracao(cfg, nivel) {
  const h = T(cfg), d = h.duracoes ?? {}, itens = itensDoNivel(cfg, nivel), out = {};
  const dur = { manha: d.manha, terco1: d.terco, terco2: d.terco, terco3: d.terco, angelus: d.angelus, lectio: d.lectio, noite: d.noite };
  for (let wd = 0; wd < 7; wd++) {
    out[wd] = itens.filter((id) => h[id] && dur[id] && !(id === 'terco3' && wd === 0)).map((id) => ({ ini: toMin(h[id]), fim: toMin(h[id]) + dur[id] })).filter((x) => Number.isFinite(x.ini));
  }
  return out;
}
