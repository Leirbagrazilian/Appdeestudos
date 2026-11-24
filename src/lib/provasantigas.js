// Provas antigas (SPEC v2 seção 8, a partir de junho): fazer cronometrada → destrinchar a resolução → refazer 1 semana depois
// e de novo antes da prova → onde foi lento, treinar mais do mesmo tipo. Tudo puro.
import { addDays, diffDays } from './dates.js';

export const PASSOS_PROVA = [
  { id: 'cronometrada', titulo: 'Fazer a prova cronometrada', detalhe: 'No tempo real da prova, sem consultar.' },
  { id: 'destrinchar', titulo: 'Copiar a resposta e destrinchar a resolução', detalhe: 'Questão por questão: o que errei e por quê. Erros vão para o caderno, com a causa.' },
  { id: 'refazer', titulo: 'Refazer 1 semana depois e de novo antes da prova', detalhe: 'O app agenda os dois como revisão.' },
  { id: 'lento', titulo: 'Onde foi lento, treinar mais do mesmo tipo', detalhe: 'Anote o tipo de questão em que o tempo estourou.' },
];
/** A partir de junho (do ano da prova) entram provas antigas aos sábados. */
export const provasAntigasLiberadas = (dia) => +dia.slice(5, 7) >= 6 && +dia.slice(5, 7) <= 8;

/**
 * Revisões do refazer: 1 semana depois e outra antes da prova (3 dias antes da próxima prova real; sem prova ou perto demais, 14 dias depois).
 * Devolve registros no formato de `spaced.js` (aparecem na lista de revisões da Hoje).
 */
export function agendarRefazer({ origem, nome, dia, provaData = null, lento = '' }) {
  const a = addDays(dia, 7);
  let b = provaData ? addDays(provaData, -3) : addDays(dia, 14);
  if (diffDays(a, b) < 3) b = addDays(a, 7);
  const txt = (x) => `Refazer prova: ${nome}${lento.trim() ? ` · treinar: ${lento.trim()}` : ''}${x}`;
  return [
    { id: `${origem}#p1`, origem, assunto: txt(' (1 semana depois)'), materia: 'Prova antiga', intervalo: 7, due: a, feita: false, passo: 1 },
    { id: `${origem}#p2`, origem, assunto: txt(' (antes da prova)'), materia: 'Prova antiga', intervalo: Math.max(1, diffDays(dia, b)), due: b, feita: false, passo: 2 },
  ];
}
