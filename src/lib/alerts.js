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
