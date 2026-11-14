import { describe, it, expect } from 'vitest';
import seed from '../src/data/seed.json';
import { gerarFases, maxExtraZero } from '../src/lib/phases.js';
import { planoSemana, repartirComTeto } from '../src/lib/semana.js';
import { addDays } from '../src/lib/dates.js';

const cfg = () => structuredClone(seed);
const sem = (c, seg) => planoSemana(c, gerarFases(c), seg);
const liquido = (dias) => dias.flatMap((d) => d.blocos).filter((b) => b.sessoes).reduce((a, b) => a + b.min, 0);
const semSobreposicao = (dias) => dias.every((d) => d.blocos.every((b, i, l) => i === 0 || l[i - 1].fim <= b.ini));

describe('revisão da etapa 1 (v3): achados do revisor', () => {
  it('sábado das fases com prova mantém a correção (en e enem também)', () => {
    for (const seg of ['2027-06-07', '2027-08-09', '2027-10-25', '2027-11-08']) {
      const sab = sem(cfg(), seg)[5].blocos;
      expect(sab.some((b) => b.cat === 'prova' && !b.sessoes), seg).toBe(true);
      expect(sab.some((b) => b.cat === 'corr'), seg).toBe(true);
    }
  });
  it('prorrogar a Fase 0 tem teto: a Fase 1 nunca some e as fases seguem em ordem', () => {
    const c = cfg();
    for (const extra of [0, 2, 8, 16, 30, 50]) {
      c.perfil.extraZero = extra;
      const f = gerarFases(c);
      for (let i = 1; i < f.length; i++) expect(f[i].inicio, `extra ${extra}`).toBe(addDays(f[i - 1].fim, 1));
      for (const x of f) expect(x.fim >= x.inicio, `extra ${extra} ${x.id}`).toBe(true);
      expect(f[1].fim >= addDays(f[1].inicio, 6), `Fase 1 com 1 semana (extra ${extra})`).toBe(true);
    }
    expect(maxExtraZero(cfg())).toBeGreaterThanOrEqual(8);
  });
  it('peso do fim de semana 0, negativo ou texto vira 1: a semana não perde sessões', () => {
    const base = liquido(sem(cfg(), '2026-11-23'));
    for (const peso of [0, -3, 'abc', null]) {
      const c = cfg(); c.rotina.pesoFimDeSemana = peso;
      expect(liquido(sem(c, '2026-11-23')), String(peso)).toBeGreaterThanOrEqual(base - 50);
    }
  });
  it('janelas de tipos diferentes que se sobrepõem não geram blocos sobrepostos nem perdem horas', () => {
    const c = cfg();
    c.rotina.janelas[0] = [{ ini: '08:00', fim: '14:00' }, { ini: '13:00', fim: '17:00', tipo: 'domingo' }];
    c.rotina.janelas[1] = [{ ini: '08:00', fim: '12:00' }, { ini: '10:00', fim: '14:00', tipo: 'x' }];
    const dias = sem(c, '2026-11-23');
    expect(semSobreposicao(dias)).toBe(true);
    const dom = dias[6].blocos.filter((b) => b.sessoes);
    expect(dom.some((b) => b.ini < 13 * 60)).toBe(true); // a parte 08–13 da janela sem tipo continua sendo estudo
  });
  it('repartirComTeto: pesos 0 e total maior que a capacidade não travam nem passam do teto', () => {
    expect(repartirComTeto([0, 0], [3, 3], 4)).toEqual([0, 0]);
    expect(repartirComTeto([1, 2, 3], [1, 1, 1], 10)).toEqual([1, 1, 1]);
    expect(repartirComTeto([1, 1], [5, 1], 4)).toEqual([3, 1]);
  });
});
