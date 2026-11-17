import { describe, it, expect } from 'vitest';
import seed from '../src/data/seed.json';
import { planoSemanaCorrida, treinoDoDia, dividir, alertasTreino, sequencia, faseCorrida, kmDaSemana } from '../src/lib/treino.js';
import { gerarFases } from '../src/lib/phases.js';
import { planoSemana } from '../src/lib/semana.js';
import { migrarCfg } from '../src/lib/migracao.js';
import { addDays } from '../src/lib/dates.js';

const cfg = () => structuredClone(seed);
const soma = (d) => Object.values(d).reduce((a, b) => a + b, 0);

describe('treino de corrida: plano', () => {
  it('fases da corrida nas datas do SPEC', () => {
    expect(faseCorrida(cfg(), '2026-11-17').n).toBe(1);
    expect(faseCorrida(cfg(), '2027-01-11').n).toBe(2);
    expect(faseCorrida(cfg(), '2027-10-07').n).toBe(4);
    expect(faseCorrida(cfg(), '2027-11-25').n).toBe(5);
    expect(faseCorrida(cfg(), '2026-11-16')).toBe(null);
  });
  it('semana 1 é a semana modelo: 2/3/2/4/2/2 + longão 5 = 20 km', () => {
    const s = planoSemanaCorrida(cfg(), '2026-11-16');
    expect(s.dias).toEqual({ 0: 5, 1: 2, 2: 3, 3: 2, 4: 4, 5: 2, 6: 2 });
    expect(soma(s.dias)).toBe(20);
  });
  it('fase 1: km e longão do seed; resto em 2:3:2:4:2:2 arredondado a 0,5', () => {
    const kms = [20, 22, 25, 20, 27, 30, 33, 26], lg = [5, 6, 7, 5, 8, 9, 10, 8];
    for (let i = 1; i < 8; i++) {
      const s = planoSemanaCorrida(cfg(), addDays('2026-11-16', 7 * i));
      expect(s.km).toBe(kms[i]); expect(s.dias[0]).toBe(lg[i]);
      for (const v of Object.values(s.dias)) expect(v * 2).toBe(Math.round(v * 2));
      expect(Math.abs(soma(s.dias) - kms[i])).toBeLessThanOrEqual(1.5);
    }
    expect(planoSemanaCorrida(cfg(), '2026-12-07').leve).toBe(true); // semana 4 (20 km)
    expect(planoSemanaCorrida(cfg(), '2027-01-04').leve).toBe(true); // semana 8 (26 km)
  });
  it('dividir: 15 km em 2:3:2:4:2:2', () => expect(dividir(15)).toEqual({ 1: 2, 2: 3, 3: 2, 4: 4, 5: 2, 6: 2 }));
  it('fases 2 a 5: só a meta semanal; os km editados no domingo valem', () => {
    const s = planoSemanaCorrida(cfg(), '2027-01-25');
    expect(s.fase.n).toBe(2); expect(s.km).toBeGreaterThanOrEqual(33); expect(s.km).toBeLessThanOrEqual(50);
    const e = planoSemanaCorrida(cfg(), '2027-01-25', { '2027-01-25': { dias: { 1: 7, 0: 14 } } });
    expect(e.dias[1]).toBe(7); expect(e.dias[0]).toBe(14);
  });
});

describe('treino de corrida: dia e regras', () => {
  it('terça 17/11: corrida às 5h30, 3 km + strides, X-Step e Metaspeed só nos strides; lower às 15h antes de correr', () => {
    const t = treinoDoDia(cfg(), '2026-11-17');
    expect(t).toMatchObject({ tipo: 'strides', km: 3, hora: '05:30' });
    expect(t.tenis).toMatch(/Metaspeed/); expect(t.musculacao).toMatchObject({ ini: '15:00', tipo: 'lower' });
  });
  it('antes do início não há treino; domingo é longão às 6h', () => {
    expect(treinoDoDia(cfg(), '2026-11-16')).toBe(null);
    expect(treinoDoDia(cfg(), '2026-11-22')).toMatchObject({ longao: true, km: 5, hora: '06:00' });
  });
  it('regra da dor: joelho > 3/10 ou inchaço vira caminhada com alerta', () => {
    const t = treinoDoDia(cfg(), '2026-11-19', { treinos: { '2026-11-19': { dor: 4 } } });
    expect(t.tipo).toBe('caminhada'); expect(t.km).toBe(0); expect(t.alerta).toMatch(/caminhada/);
    expect(treinoDoDia(cfg(), '2026-11-19', { treinos: { '2026-11-19': { dor: 3 } } }).tipo).toBe('qualidade');
    expect(treinoDoDia(cfg(), '2026-11-19', { treinos: { '2026-11-19': { inchaco: true } } }).tipo).toBe('caminhada');
  });
  it('lower na véspera do longão e jiu-jitsu no dia forte ou no sábado geram aviso; o padrão não', () => {
    expect(alertasTreino(cfg(), '2026-11-17')).toEqual([]);
    const c = cfg(); c.treino.musculacao[6] = { ini: '10:00', tipo: 'lower' };
    c.rotina.aulas.push({ dia: 4, inicio: '19:00', fim: '20:00', nome: 'Jiu-jitsu' });
    const a = alertasTreino(c, '2026-11-17');
    expect(a.some((x) => /Lower no sábado/.test(x))).toBe(true);
    expect(a.some((x) => /treino forte/.test(x))).toBe(true);
  });
  it('liberação do fisio é lembrada nas 2 semanas antes da Fase 2', () => {
    expect(alertasTreino(cfg(), '2027-01-01').some((x) => /fisio/.test(x))).toBe(true);
    const c = cfg(); c.treino.liberadoFisio = true;
    expect(alertasTreino(c, '2027-01-01').some((x) => /fisio/.test(x))).toBe(false);
  });
  it('sequência única: o dia conta com estudo E treino (o mínimo de 20 min de caminhada vale)', () => {
    const cumpridos = { '2026-11-17': true, '2026-11-18': true, '2026-11-19': true };
    const treinos = { '2026-11-17': { feito: true }, '2026-11-18': { minimo: true }, '2026-11-19': {} };
    expect(sequencia(cfg(), { cumpridos, treinos }, '2026-11-19')).toBe(2); // hoje ainda sem treino: vale até ontem
    treinos['2026-11-19'].feito = true;
    expect(sequencia(cfg(), { cumpridos, treinos }, '2026-11-19')).toBe(3);
    expect(sequencia(cfg(), { cumpridos: { '2026-11-18': true, '2026-11-19': true }, treinos }, '2026-11-19')).toBe(2);
  });
  it('km da semana: soma o registrado e mostra a meta', () => {
    expect(kmDaSemana(cfg(), '2026-11-16', { '2026-11-17': { km: 3.2 }, '2026-11-18': { km: 2 } })).toEqual({ feitos: 5, meta: 20 });
  });
});

describe('treino e planner', () => {
  it('segunda: 1º bloco de estudo é uma sessão curta de Matemática 6h30–7h10', () => {
    const c = cfg(); const dias = planoSemana(c, gerarFases(c), '2026-11-23');
    const b = dias[0].blocos[0];
    expect(b).toMatchObject({ cat: 'mat', ini: 390, fim: 430, min: 40, sessoes: 1 });
  });
  it('nenhum bloco de estudo começa antes das 6h30 nem cruza a corrida de 5h30 a 6h15', () => {
    const c = cfg(); const dias = planoSemana(c, gerarFases(c), '2026-11-23');
    for (const d of dias) for (const b of d.blocos) expect(b.ini >= 390 || b.fim <= 330).toBe(true);
  });
  it('a semana continua perto de 43 h líquidas com a sessão curta', () => {
    const c = cfg(); const dias = planoSemana(c, gerarFases(c), '2026-11-23');
    const t = dias.flatMap((d) => d.blocos).filter((b) => b.sessoes).reduce((a, b) => a + b.min, 0);
    expect(t).toBeGreaterThanOrEqual(43 * 60 - 60); expect(t).toBeLessThanOrEqual(43 * 60 + 30);
  });
  it('migração v9 -> v10: segunda sem edição vira 6h30–7h10 e o plano de treino entra', () => {
    const v = cfg(); v.versaoSeed = 9; delete v.treinoPlano; delete v.treino;
    v.rotina.janelas[1] = [{ ini: '06:00', fim: '07:00' }, { ini: '12:30', fim: '18:30' }, { ini: '20:00', fim: '21:00' }];
    const m = migrarCfg(v, seed);
    expect(m.rotina.janelas[1][0]).toEqual({ ini: '06:30', fim: '07:10' });
    expect(m.treinoPlano.inicio).toBe('2026-11-17'); expect(m.treino.corrida).toBe('05:30');
  });
});
