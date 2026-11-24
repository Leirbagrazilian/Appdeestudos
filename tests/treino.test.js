import { describe, it, expect } from 'vitest';
import seed from '../src/data/seed.json';
import { planoSemanaCorrida, treinoDoDia, alertasTreino, sequencia, kmDaSemana, textoResumoCorrida, tiposDaSemana } from '../src/lib/treino.js';
import { addDays } from '../src/lib/dates.js';
import { legado } from './_legado.js';

const cfg = () => legado(structuredClone(seed));
const soma = (d) => Object.values(d).reduce((a, b) => a + b, 0);

describe('treino (SPEC v2): sem prova como meta, volume estável', () => {
  it('o seed não tem mais ultra, maratona, fases nem metas de prova', () => {
    expect(seed.treinoPlano.provas).toBeUndefined(); expect(seed.treinoPlano.fases).toBeUndefined(); expect(seed.treinoPlano.meta).toBeUndefined();
    expect(JSON.stringify(seed.treinoPlano)).not.toMatch(/maratona|100 km|ultra/i);
  });
  it('o volume semanal é o mesmo em todas as semanas (não sobe sozinho)', () => {
    const kms = new Set(); for (let d = '2026-11-23'; d <= '2027-11-15'; d = addDays(d, 7)) { const s = planoSemanaCorrida(cfg(), d); kms.add(s.km); expect(soma(s.dias)).toBeCloseTo(s.km, 5); }
    expect([...kms]).toHaveLength(1);
  });
  it('a disciplina alterna na quinta (intervalado, fartlek, ritmo, subida); domingo é longão; resto é rodagem leve', () => {
    const qui = []; for (let i = 0; i < 8; i++) qui.push(tiposDaSemana(cfg(), addDays('2026-11-23', 7 * i))[4]);
    expect(qui.slice(0, 4).sort()).toEqual(['fartlek', 'intervalado', 'ritmo', 'subida']);
    expect(qui.slice(4)).toEqual(qui.slice(0, 4));
    const t = tiposDaSemana(cfg(), '2026-11-23'); expect(t[0]).toBe('longao'); expect(t[1]).toBe('leve'); expect(t[3]).toBe('leve');
  });
  it('semana do início: dias antes de 20/11 não contam', () => {
    const s = planoSemanaCorrida(cfg(), '2026-11-16'); expect(s.dias[1]).toBe(0); expect(s.dias[5]).toBeGreaterThan(0);
  });
  it('horários: musculação 5h30 seg/qui (superiores) e ter/sáb (inferiores); corridas nos horários da tabela', () => {
    const c = cfg(), d = (x) => treinoDoDia(c, x, {});
    expect(d('2026-11-23').musculacao).toMatchObject({ tipo: 'upper', ini: '05:30' }); expect(d('2026-11-24').musculacao.tipo).toBe('lower');
    expect(d('2026-11-26').musculacao.tipo).toBe('upper'); expect(d('2026-11-28').musculacao.tipo).toBe('lower');
    expect(d('2026-11-25').musculacao).toBeNull(); expect(d('2026-11-27').musculacao).toBeNull();
    expect(d('2026-11-25').horaCorrida).toBe('05:30'); expect(d('2026-11-27').horaCorrida).toBe('05:30'); expect(d('2026-11-29').horaCorrida).toBe('06:00');
    for (const x of ['2026-11-23', '2026-11-24', '2026-11-26', '2026-11-28']) expect(d(x).choque).toBeNull(); // corrida curta termina até 7h
  });
  it('corrida curta de segunda termina até 6h50', () => {
    const t = treinoDoDia(cfg(), '2026-11-23', {}), [h, m] = t.horaCorrida.split(':').map(Number);
    expect(h * 60 + m + t.min).toBeLessThanOrEqual(6 * 60 + 52);
  });
  it('antes do início não há treino', () => expect(treinoDoDia(cfg(), '2026-11-10', {})).toBeNull());
  it('dor > 3/10 ou inchaço vira caminhada com alerta; noite curta tira a corrida forte', () => {
    const c = cfg(), r = treinoDoDia(c, '2026-11-26', { treinos: { '2026-11-26': { dor: 5 } } });
    expect(r.tipo).toBe('caminhada'); expect(r.km).toBe(0); expect(r.alerta).toMatch(/Dor acima de 3/);
    expect(treinoDoDia(c, '2026-11-26', { noiteCurta: true }).tipo).toBe('leve');
  });
  it('perna no sábado não bloqueia; só avisa com dor no joelho registrada', () => {
    const c = cfg();
    expect(alertasTreino(c, '2026-11-28', {})).toEqual([]);
    expect(alertasTreino(c, '2026-11-26', { '2026-11-26': { dor: 0 } })).toEqual([]);
    expect(alertasTreino(c, '2026-11-28', { '2026-11-27': { dor: 2 } })[0]).toMatch(/Dor no joelho registrada \(2\/10\).*decisão é sua/);
    expect(alertasTreino(c, '2026-11-24', { '2026-11-24': { dor: 2 } })).toEqual([]); // fora de sex/sáb
    expect(treinoDoDia(c, '2026-11-28', {}).musculacao.tipo).toBe('lower'); // continua no plano
  });
  it('sem avisos de missa, jiu-jitsu nem fisio', () => {
    expect(JSON.stringify(alertasTreino(cfg(), '2026-11-28', { '2026-11-28': { dor: 2 } }))).not.toMatch(/missa|jiu|fisio/i);
  });
  it('sequência única: o dia conta com estudo E treino (o mínimo de 20 min vale)', () => {
    const cumpridos = { '2026-11-17': true, '2026-11-18': true, '2026-11-19': true };
    const treinos = { '2026-11-17': { feito: true }, '2026-11-18': { minimo: true }, '2026-11-19': {} };
    const oracoes = Object.fromEntries(['2026-11-17', '2026-11-18', '2026-11-19'].map((d) => [d, { manha: true, noite: true }]));
    expect(sequencia(cfg(), { cumpridos, treinos, oracoes }, '2026-11-19')).toBe(2);
    treinos['2026-11-19'].feito = true;
    expect(sequencia(cfg(), { cumpridos, treinos, oracoes }, '2026-11-19')).toBe(3);
  });
  it('km da semana: soma o registrado e mostra a meta fixa', () => {
    const meta = planoSemanaCorrida(cfg(), '2026-11-23').km;
    expect(kmDaSemana(cfg(), '2026-11-23', { '2026-11-24': { km: 3.2 }, '2026-11-25': { km: 2 } })).toEqual({ feitos: 5.2, meta });
  });
  it('km editados no domingo valem', () => {
    expect(planoSemanaCorrida(cfg(), '2026-11-23', { '2026-11-23': { dias: { 1: 5 } } }).dias[1]).toBe(5);
  });
  it('texto do resumo de domingo', () => {
    const tr = { '2026-11-24': { feito: true, km: 3.2 }, '2026-11-26': { dor: 4 }, '2026-11-27': { minimo: true } };
    const t = textoResumoCorrida(cfg(), '2026-11-23', tr, { joelho: 4, sono: '7 h', cansaco: 5, temperos: 'ok' });
    expect(t).toMatch(/semana 2/); expect(t).toMatch(/Ter: 3,2 km de 4 km/); expect(t).toMatch(/Qui: não fez de 4 km/); expect(t).toMatch(/Sex: caminhada 20 min/);
    expect(t).toMatch(/Sono: 7 h · Cansaço \(0–10\): 5/);
  });
});
