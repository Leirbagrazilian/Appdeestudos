import { addDays, diffDays } from './dates.js';
export const INTERVALOS = [1, 7, 30];
/** Cria as 3 revisões de um assunto estudado em `dia`. */
export function agendarRevisoes({ origem, assunto, materia, dia }) {
  return INTERVALOS.map((n, i) => ({ id: `${origem}#r${n}`, origem, assunto, materia, intervalo: n, due: addDays(dia, n), feita: false, passo: i + 1 }));
}
export const vencidas = (revs, dia) => revs.filter((r) => !r.feita && r.due <= dia).sort((a, b) => a.due.localeCompare(b.due));
/** Revisões que aparecem no checklist do dia: as vencidas e as que já foram feitas hoje. */
export const revisoesDoDia = (revs, dia) =>
  revs.filter((r) => (!r.feita && r.due <= dia) || (r.feita && r.feitaEm === dia)).sort((a, b) => a.due.localeCompare(b.due));

/**
 * Avalia uma revisão (fácil / ok / difícil) e devolve o que muda:
 * - fácil: as próximas revisões do mesmo assunto ficam 50% mais distantes;
 * - difícil: entra uma revisão extra em 2 dias (se não houver outra nos próximos 3 dias).
 */
export function avaliar(revs, r, nota, dia) {
  const atual = { ...r, feita: true, feitaEm: dia, nota };
  const mudadas = [atual], novas = [];
  const proximas = revs.filter((x) => x.origem === r.origem && x.id !== r.id && !x.feita && x.due > dia);
  if (nota === 'facil') {
    for (const x of proximas) mudadas.push({ ...x, due: addDays(x.due, Math.max(1, Math.round(diffDays(dia, x.due) * 0.5))) });
  } else if (nota === 'dificil' && !proximas.some((x) => diffDays(dia, x.due) <= 3)) {
    novas.push({ id: `${r.origem}#x${dia}`, origem: r.origem, assunto: r.assunto, materia: r.materia, intervalo: 2, due: addDays(dia, 2), feita: false, passo: 0, extra: true });
  }
  return { mudadas, novas };
}
