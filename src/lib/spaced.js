import { addDays } from './dates.js';
export const INTERVALOS = [1, 7, 30];
/** Cria as 3 revisões de um assunto estudado em `dia`. */
export function agendarRevisoes({ origem, assunto, materia, dia }) {
  return INTERVALOS.map((n, i) => ({ id: `${origem}#r${n}`, origem, assunto, materia, intervalo: n, due: addDays(dia, n), feita: false, passo: i + 1 }));
}
export const vencidas = (revs, dia) => revs.filter((r) => !r.feita && r.due <= dia).sort((a, b) => a.due.localeCompare(b.due));
