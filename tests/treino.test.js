import { describe, it, expect } from 'vitest';
import seed from '../src/data/seed.json';
import { planoSemanaCorrida, treinoDoDia, dividir, alertasTreino, sequencia, faseCorrida, kmDaSemana } from '../src/lib/treino.js';
import { gerarFases } from '../src/lib/phases.js';
import { planoSemana } from '../src/lib/semana.js';
import { migrarCfg } from '../src/lib/migracao.js';
import { addDays } from '../src/lib/dates.js';

import { legado } from './_legado.js';
const cfg = () => legado(structuredClone(seed));
const soma = (d) => Object.values(d).reduce((a, b) => a + b, 0);

describe('treino de corrida: plano', () => {
  it('fases da corrida nas datas do SPEC', () => {
    expect(faseCorrida(cfg(), '2026-11-17').n).toBe(1);
    expect(faseCorrida(cfg(), '2027-01-11').n).toBe(2);
    expect(faseCorrida(cfg(), '2027-10-07').n).toBe(4);
    expect(faseCorrida(cfg(), '2027-11-25').n).toBe(5);
    expect(faseCorrida(cfg(), '2026-11-16')).toBe(null);
  });
  it('semana 1 é a semana modelo (3/2/4/2/2 + longão 5); a segunda 16/11 fica de fora: começa na terça', () => {
    const s = planoSemanaCorrida(cfg(), '2026-11-16');
    expect(s.dias).toEqual({ 0: 5, 1: 0, 2: 3, 3: 2, 4: 4, 5: 2, 6: 2 });
    expect(s.km).toBe(18);
  });
  it('fase 1: km e longão do seed; resto em 2:3:2:4:2:2 arredondado a 0,5', () => {
    const kms = [20, 22, 25, 20, 27, 30, 33, 26], lg = [5, 6, 7, 5, 8, 9, 10, 8];
    for (let i = 1; i < 8; i++) {
      const s = planoSemanaCorrida(cfg(), addDays('2026-11-16', 7 * i));
      expect(s.km).toBe(kms[i]); expect(s.dias[0]).toBe(lg[i]);
      for (const v of Object.values(s.dias)) expect(v * 2).toBe(Math.round(v * 2));
      expect(soma(s.dias)).toBe(kms[i]);
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
  it('terça 17/11: corrida às 5h30, 3 km + strides, X-Step e Metaspeed só nos strides; lower às 15h com a corrida antes', () => {
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
    const oracoes = Object.fromEntries(['2026-11-17', '2026-11-18', '2026-11-19'].map((d) => [d, { manha: true, noite: true }]));
    expect(sequencia(cfg(), { cumpridos, treinos, oracoes }, '2026-11-19')).toBe(2); // hoje ainda sem treino: vale até ontem
    treinos['2026-11-19'].feito = true;
    expect(sequencia(cfg(), { cumpridos, treinos, oracoes }, '2026-11-19')).toBe(3);
    expect(sequencia(cfg(), { cumpridos: { '2026-11-18': true, '2026-11-19': true }, treinos, oracoes }, '2026-11-19')).toBe(2);
  });
  it('km da semana: soma o registrado e mostra a meta', () => {
    expect(kmDaSemana(cfg(), '2026-11-16', { '2026-11-17': { km: 3.2 }, '2026-11-18': { km: 2 } })).toEqual({ feitos: 5.2, meta: 18 });
  });
});

describe('treino e planner', () => {
  it('segunda: o estudo começa às 6h30, depois da corrida das 5h30', () => {
    const c = cfg(); const dias = planoSemana(c, gerarFases(c), '2026-11-23');
    expect(dias[0].blocos[0]).toMatchObject({ ini: 390, sessoes: 2 });
    expect(dias[0].blocos.some((b) => b.curta)).toBe(false);
  });
  it('nenhum bloco de estudo começa antes das 6h30 nem cruza a corrida de 5h30 a 6h15', () => {
    const c = cfg(); const dias = planoSemana(c, gerarFases(c), '2026-11-23');
    for (const d of dias) for (const b of d.blocos) expect(b.ini >= 390 || b.fim <= 330).toBe(true);
  });
  it('a semana fica perto de 55 h líquidas (sem as orações)', () => {
    const c = cfg(); const dias = planoSemana(c, gerarFases(c), '2026-11-23');
    const t = dias.flatMap((d) => d.blocos).filter((b) => b.sessoes).reduce((a, b) => a + b.min, 0);
    expect(t).toBeGreaterThanOrEqual(52 * 60); expect(t).toBeLessThanOrEqual(58 * 60);
  });
  it('migração v9 -> v12: janelas passam a ser calculadas, meta padrão vira 56 h, aulas e treino novos entram e o plano de treino continua', () => {
    const v = cfg(); v.versaoSeed = 9; delete v.treinoPlano; delete v.treino;
    v.rotina.janelas = { 1: [{ ini: '06:00', fim: '07:00' }, { ini: '12:30', fim: '18:30' }, { ini: '20:00', fim: '21:00' }] };
    v.rotina.metaLiquida = 43; v.rotina.metaNominal = 43;
    const m = migrarCfg(v, seed);
    expect(m.rotina.janelas).toBeUndefined(); expect(m.rotina.metaLiquida).toBe(56); expect(m.rotina.metaNominal).toBeUndefined();
    expect(m.treinoPlano.inicio).toBe('2026-11-20'); expect(m.treino.corrida).toBe('05:30'); expect(m.treino.corridaSab).toBe('07:00');
  });
});

import { textoResumoCorrida } from '../src/lib/treino.js';
describe('revisão de domingo: resumo da corrida', () => {
  it('texto para colar: km, dias, dor, sono, cansaço e temperos', () => {
    const tr = { '2026-11-17': { feito: true, km: 3.2 }, '2026-11-19': { dor: 4 }, '2026-11-20': { minimo: true } };
    const t = textoResumoCorrida(legado(structuredClone(seed)), '2026-11-16', tr, { joelho: 4, sono: '7 h', cansaco: 5, temperos: 'ok' });
    expect(t).toMatch(/Fase 1 Retomada diária, semana 1/);
    expect(t).toMatch(/Km: 3,2 de 18/);
    expect(t).toMatch(/Ter: 3,2 km de 3 km/);
    expect(t).toMatch(/Qui: não fez de 4 km \(dor joelho 4/);
    expect(t).toMatch(/Sex: caminhada 20 min/);
    expect(t).toMatch(/Sono: 7 h · Cansaço \(0–10\): 5/);
    expect(t).toMatch(/Temperos: ok/);
  });
});

describe('revisão da 7a: provas, polimento e choques', () => {
  it('semana da maratona: dias curtos antes, 42,2 km na quinta, descanso depois, sem longão', () => {
    const s = planoSemanaCorrida(cfg(), '2027-10-04');
    expect(s.dias[4]).toBe(42.2); expect(s.dias[5]).toBe(0); expect(s.dias[6]).toBe(0); expect(s.dias[0]).toBe(0);
    expect(s.dias[1]).toBeLessThanOrEqual(4); expect(s.dias[3]).toBeLessThanOrEqual(2);
    expect(treinoDoDia(cfg(), '2027-10-07')).toMatchObject({ tipo: 'prova', km: 42.2 });
    expect(treinoDoDia(cfg(), '2027-10-10')).toMatchObject({ tipo: 'descanso', km: 0 });
  });
  it('semana dos 100 km: prova na quinta 25/11/2027 e nada de longão no domingo', () => {
    expect(treinoDoDia(cfg(), '2027-11-25')).toMatchObject({ tipo: 'prova', km: 100 });
    expect(treinoDoDia(cfg(), '2027-11-28').km).toBe(0);
  });
  it('polimento (fase 5) só desce', () => {
    const kms = []; for (let d = '2027-10-11'; d <= '2027-11-15'; d = addDays(d, 7)) kms.push(planoSemanaCorrida(cfg(), d).km);
    for (let i = 1; i < kms.length; i++) expect(kms[i]).toBeLessThanOrEqual(kms[i - 1]);
  });
  it('a soma dos dias fecha com a meta em todas as semanas sem prova', () => {
    for (let d = '2026-11-23'; d <= '2027-09-27'; d = addDays(d, 7)) { const s = planoSemanaCorrida(cfg(), d); expect(soma(s.dias), d).toBeCloseTo(s.km, 5); }
  });
  it('jiu-jitsu no domingo gera aviso', () => {
    const c = cfg(); c.rotina.aulas.push({ dia: 0, inicio: '10:00', fim: '11:00', nome: 'Jiu-jitsu' });
    expect(alertasTreino(c, '2026-11-17').some((x) => /domingo/.test(x))).toBe(true);
  });
  it('corrida longa que invade a janela de estudo vira aviso; a da semana 1 não', () => {
    expect(treinoDoDia(cfg(), '2026-11-19').choque).toBe(null); // 4 km: ~38 min, termina 6h08, estudo 6h30
    expect(treinoDoDia(cfg(), '2027-07-01').choque).toMatch(/estudo começa/); // quinta da construção: 10+ km
  });
});

describe('revisão do treino: choque real, prova travada, polimento e musculação', () => {
  const dias = (c, wd, js) => { c.rotina.janelas = { ...(c.rotina.janelas ?? {}), [wd]: js }; return c; }; // janelas à mão valem no lugar das calculadas
  it('choque: janela que começou antes da corrida e ainda está aberta é detectada', () => {
    const c = dias(cfg(), 4, [{ ini: '05:00', fim: '06:00' }, { ini: '12:30', fim: '18:30' }]);
    const t = treinoDoDia(c, '2026-11-19'); // 4 km: 5h30 a ~6h08
    expect(t.choque).toMatch(/06:08/); expect(t.choque).toMatch(/05:00/);
  });
  it('choque: janela que termina antes da corrida ou começa depois do fim não avisa; horas inválidas são ignoradas', () => {
    const c = dias(cfg(), 4, [{ ini: '04:00', fim: '05:30' }, { ini: '06:08', fim: '07:00' }, { ini: '', fim: '06:00' }, { ini: '05:40', fim: 'xx' }]);
    expect(treinoDoDia(c, '2026-11-19').choque).toBe(null);
    const d = cfg(); d.treino.corrida = '';
    expect(treinoDoDia(d, '2026-11-19').choque).toBe(null);
  });
  it('sem choque em dia sem corrida: caminhada (dor), descanso pós-prova e km 0', () => {
    const j = [{ ini: '05:00', fim: '07:00' }];
    const c = dias(cfg(), 4, j);
    expect(treinoDoDia(c, '2026-11-19').choque).toMatch(/05:00/);
    expect(treinoDoDia(c, '2026-11-19', { treinos: { '2026-11-19': { dor: 5 } } }).choque).toBe(null);
    expect(treinoDoDia(c, '2026-11-19', { editadas: { '2026-11-16': { dias: { 4: 0 } } } }).choque).toBe(null);
    expect(treinoDoDia(dias(cfg(), 5, j), '2027-10-08')).toMatchObject({ tipo: 'descanso', choque: null });
  });
  it('semana de prova: edições não sobrescrevem a prova nem os dias depois; antes da prova valem', () => {
    const ed = { '2027-10-04': { dias: { 1: 3, 4: 10, 5: 8, 6: 8, 0: 20 } } };
    const s = planoSemanaCorrida(cfg(), '2027-10-04', ed);
    expect(s.dias).toMatchObject({ 1: 3, 4: 42.2, 5: 0, 6: 0, 0: 0 });
    expect(s.travados).toEqual([4, 5, 6, 0]);
    expect(planoSemanaCorrida(cfg(), '2027-01-25').travados).toEqual([]);
    expect(treinoDoDia(cfg(), '2027-10-07', { editadas: ed })).toMatchObject({ tipo: 'prova', km: 42.2 });
  });
  it('polimento não tem semana leve; a 4ª semana da fase 2 continua leve', () => {
    for (let d = '2027-10-11'; d <= '2027-11-22'; d = addDays(d, 7)) expect(planoSemanaCorrida(cfg(), d).leve, d).toBe(false);
    expect(planoSemanaCorrida(cfg(), '2027-02-01').leve).toBe(true);
  });
  it('musculação some nos 2 dias antes da prova, no dia e depois dela na semana, com dica', () => {
    const c = cfg(); for (const wd of [0, 1, 2, 3, 4, 5, 6]) c.treino.musculacao[wd] = { ini: '15:00', tipo: wd === 2 ? 'lower' : 'upper' };
    expect(treinoDoDia(c, '2027-10-04').musculacao).not.toBe(null); // segunda: 3 dias antes
    for (const d of ['2027-10-05', '2027-10-06', '2027-10-07', '2027-10-08', '2027-10-10']) {
      const t = treinoDoDia(c, d);
      expect(t.musculacao, d).toBe(null); expect(t.dica, d).toMatch(/Sem musculação: semana de prova/);
    }
    const t = treinoDoDia(c, '2027-10-11'); // semana seguinte
    expect(t.musculacao).not.toBe(null); expect(t.dica).not.toMatch(/Sem musculação/);
    expect(treinoDoDia(cfg(), '2027-10-06').dica).not.toMatch(/Sem musculação/); // quarta sem musculação no padrão
  });
});
