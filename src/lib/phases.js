import { addDays, diffDays } from './dates.js';

const prova = (c) => c.eventos.filter((e) => e.tipo === 'prova');
export const provaInicio = (c) => prova(c).map((e) => e.inicio).sort()[0];
export const provaFim = (c) => prova(c).map((e) => e.fim).sort().at(-1);

const maior = (l) => [...l].sort().at(-1);

/** Semanas que a Fase 0 ainda pode ser prorrogada (a mudança de data empurra o Ano 1 e o Ano 2; o Ano 3 e a prova não mexem). */
export const maxExtraZero = () => 8;

const D = { ano1Fim: '2027-03-14', ano2Fim: '2027-06-13', ano3Fim: '2027-08-22', itaInicio: '2027-08-30', itaFim: '2027-09-26', discFim: '2027-10-22' };
const PREV_ZERO = '2027-01-10';

/**
 * Gera as fases: zero (até o portão), ano1, ano2, ano3, leve (semana leve da EN), ita, disc, enem.
 * Fase 0 vai até a previsão (perfil.fimZero, 10/01/2027) + as semanas extras; se o portão passa antes (perfil.portaoEm),
 * ela termina nesse dia e o Ano 1 e o Ano 2 se adiantam o mesmo tanto. O Ano 3 continua terminando em 22/08 (a prova não muda).
 */
export function gerarFases(cfg) {
  const p = cfg.perfil;
  const get = (id) => cfg.concursos.find((c) => c.id === id);
  const enem = get('enem');
  const zIni = p.inicioZero ?? '2026-11-16';
  const prev = p.fimZero ?? PREV_ZERO;
  let zFim = addDays(prev, 7 * Math.min(p.extraZero ?? 0, maxExtraZero()));
  if (p.portaoEm && p.portaoEm >= zIni && p.portaoEm < zFim) zFim = p.portaoEm;
  const delta = diffDays(prev, zFim); // negativo = adiantou
  const a3Fim = p.ano3Fim ?? D.ano3Fim;
  // cada ano fica com pelo menos 14 dias, mesmo com muita prorrogação
  const a1Fim = [addDays(p.ano1Fim ?? D.ano1Fim, delta), addDays(a3Fim, -28)].sort()[0];
  const a1FimOk = a1Fim < addDays(zFim, 14) ? addDays(zFim, 14) : a1Fim;
  let a2Fim = [addDays(p.ano2Fim ?? D.ano2Fim, delta), addDays(a3Fim, -14)].sort()[0];
  if (a2Fim < addDays(a1FimOk, 14)) a2Fim = addDays(a1FimOk, 14);
  const itaIni = p.itaInicio ?? D.itaInicio, itaFim = p.itaFim ?? D.itaFim, discFim = p.discFim ?? D.discFim;
  const enemFim = maior([provaFim(enem), addDays(discFim, 1)].filter(Boolean));
  const lista = [
    { id: 'zero', inicio: zIni, fim: zFim },
    { id: 'ano1', inicio: addDays(zFim, 1), fim: a1FimOk },
    { id: 'ano2', inicio: addDays(a1FimOk, 1), fim: a2Fim },
    { id: 'ano3', inicio: addDays(a2Fim, 1), fim: a3Fim },
    { id: 'leve', inicio: addDays(a3Fim, 1), fim: addDays(itaIni, -1) },
    { id: 'ita', inicio: itaIni, fim: itaFim },
    { id: 'disc', inicio: addDays(itaFim, 1), fim: discFim },
    { id: 'enem', inicio: addDays(discFim, 1), fim: enemFim },
  ];
  return lista.map((f) => ({ ...f, ...cfg.fases[f.id] }));
}

export function faseDoDia(fases, dia) {
  return fases.find((f) => dia >= f.inicio && dia <= f.fim) ?? (dia < fases[0].inicio ? fases[0] : fases.at(-1));
}

/** Última semana antes de cada prova: revisão leve. Retorna o concurso ou null. */
export function revisaoLeve(cfg, dia) {
  for (const c of cfg.concursos) for (const e of c.eventos) {
    if (e.tipo !== 'prova') continue;
    const d = diffDays(dia, e.inicio);
    if (d >= 1 && d <= 7) return c;
  }
  return null;
}

export const semanaDaFase = (f, dia) => Math.floor(diffDays(f.inicio, dia) / 7) + 1;
export const totalSemanas = (f) => Math.ceil((diffDays(f.inicio, f.fim) + 1) / 7);

/** Próxima prova (primeira de cada concurso) ainda por vir. */
export function proximaProva(cfg, dia) {
  const lista = [];
  for (const c of cfg.concursos) for (const e of c.eventos)
    if (e.tipo === 'prova' && e.inicio >= dia) lista.push({ concurso: c, evento: e, dias: diffDays(dia, e.inicio) });
  return lista.sort((a, b) => a.dias - b.dias)[0] ?? null;
}
