import { describe, it, expect } from 'vitest';
import { primeiroSabado, serieCheckpoints, checkpointDoMes, checkpointPendente, portaoZero } from '../src/lib/portao.js';

const cfg = () => ({ checkpoint: { questoes: 10, minutos: 30, baseline: { data: '2026-11-15', acertos: 0 } }, fase0: { portao: { khanMin: 80, checkpointMin: 5, semanasExtras: 2 } }, concursos: [], topicos: { Matemática: [{ nome: 'A', fase: 0, sem: 1 }], Física: [], Química: [] }, materiasInfo: {} });

describe('checkpoint mensal', () => {
  it('primeiro sábado do mês', () => {
    expect(primeiroSabado('2026-12-17')).toBe('2026-12-05');
    expect(primeiroSabado('2027-01-20')).toBe('2027-01-02');
    expect(primeiroSabado('2027-05-09')).toBe('2027-05-01');
  });
  it('o diagnóstico é o marco zero e conta no mês de novembro', () => {
    const s = serieCheckpoints(cfg(), {});
    expect(s).toHaveLength(1); expect(s[0]).toMatchObject({ base: true, acertos: 0 });
    expect(checkpointDoMes(cfg(), {}, '2026-11-28')?.base).toBe(true);
    expect(checkpointPendente(cfg(), {}, '2026-11-28')).toBe(false);
  });
  it('pendente a partir do primeiro sábado, até registrar', () => {
    expect(checkpointPendente(cfg(), {}, '2026-12-04')).toBe(false);
    expect(checkpointPendente(cfg(), {}, '2026-12-05')).toBe(true);
    expect(checkpointPendente(cfg(), {}, '2026-12-30')).toBe(true);
    expect(checkpointPendente(cfg(), { '2026-12-05': { data: '2026-12-05', acertos: 3, feitas: 10 } }, '2026-12-30')).toBe(false);
  });
  it('série ordenada por data', () => {
    const s = serieCheckpoints(cfg(), { '2027-01-02': { data: '2027-01-02', acertos: 6 }, '2026-12-05': { data: '2026-12-05', acertos: 3 } });
    expect(s.map((x) => x.data)).toEqual(['2026-11-15', '2026-12-05', '2027-01-02']);
  });
});

describe('portão da Fase 0', () => {
  const cps = (n) => ({ '2027-01-02': { data: '2027-01-02', acertos: n, feitas: 10 } });
  it('passa com Khan >= 80% e checkpoint melhor que o diagnóstico (e >= mínimo)', () => {
    expect(portaoZero(cfg(), { khan: { pct: 85 } }, cps(6)).ok).toBe(true);
  });
  it('falha sem teste do Khan, com Khan baixo ou checkpoint baixo', () => {
    expect(portaoZero(cfg(), null, cps(6)).ok).toBe(false);
    expect(portaoZero(cfg(), { khan: { pct: 79 } }, cps(6)).ok).toBe(false);
    expect(portaoZero(cfg(), { khan: { pct: 90 } }, cps(4)).ok).toBe(false);
    expect(portaoZero(cfg(), { khan: { pct: 90 } }, {}).ok).toBe(false);
  });
  it('checkpoint igual ao diagnóstico não conta como "melhor"', () => {
    const c = cfg(); c.checkpoint.baseline.acertos = 6; c.fase0.portao.checkpointMin = 0;
    expect(portaoZero(c, { khan: { pct: 90 } }, cps(6)).checkpoint.ok).toBe(false);
    expect(portaoZero(c, { khan: { pct: 90 } }, cps(7)).checkpoint.ok).toBe(true);
  });
  it('lista os tópicos fracos da Fase 0 (não dominados)', () => {
    expect(portaoZero(cfg(), null, {}, { Matemática: {} }).fracos).toEqual([{ materia: 'Matemática', topico: 'A' }]);
    expect(portaoZero(cfg(), null, {}, { Matemática: { A: 3 } }).fracos).toEqual([]);
  });
});
