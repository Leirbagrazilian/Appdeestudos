import { diffDays } from './dates.js';
export const ALERTAS = [14, 7, 1];
/** Inscrições que fecham em até 14 dias (ou hoje). */
export function alertasInscricao(cfg, dia) {
  const out = [];
  for (const c of cfg.concursos) for (const e of c.eventos) {
    if (e.tipo !== 'inscricao') continue;
    const d = diffDays(dia, e.fim);
    if (d >= 0 && d <= 14) out.push({ concurso: c, evento: e, dias: d, nivel: ALERTAS.find((n) => d <= n && n === Math.min(...ALERTAS.filter((x) => d <= x))) });
  }
  return out.sort((a, b) => a.dias - b.dias);
}
export const ROTULO = { inscricao: 'Inscrições', prova: 'Prova', teste: 'Teste' };
/** Marcos (um ponto por data) de todos os concursos, em ordem. */
export function marcos(cfg) {
  const m = [];
  for (const c of cfg.concursos) for (const e of c.eventos) {
    const nome = e.nome ?? ROTULO[e.tipo];
    if (e.tipo === 'inscricao') { m.push({ c, e, data: e.inicio, rotulo: `${nome}: abre`, glifo: '▶' }); m.push({ c, e, data: e.fim, rotulo: `${nome}: fecham`, glifo: '■' }); }
    else m.push({ c, e, data: e.inicio, rotulo: nome, glifo: '★' });
  }
  return m.sort((a, b) => a.data.localeCompare(b.data));
}

/** Provas de concursos diferentes que se sobrepõem no calendário (ex.: EFOMM e ESA no mesmo fim de semana).
 *  `vence` é o concurso de maior prioridade (menor número). */
export function conflitosProvas(cfg) {
  const provas = [];
  for (const c of cfg.concursos) for (const e of c.eventos) if (e.tipo === 'prova') provas.push({ c, e });
  const out = [], vistos = new Set();
  for (let i = 0; i < provas.length; i++) for (let j = i + 1; j < provas.length; j++) {
    const a = provas[i], b = provas[j];
    if (a.c.id === b.c.id) continue;
    const de = a.e.inicio > b.e.inicio ? a.e.inicio : b.e.inicio, ate = a.e.fim < b.e.fim ? a.e.fim : b.e.fim;
    if (de > ate) continue;
    const chave = [a.c.id, b.c.id].sort().join('x') + de;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const vence = (a.c.prioridade ?? 99) <= (b.c.prioridade ?? 99) ? a.c : b.c;
    out.push({ a: a.c, b: b.c, de, ate, vence, perde: vence === a.c ? b.c : a.c });
  }
  return out.sort((x, y) => x.de.localeCompare(y.de));
}
