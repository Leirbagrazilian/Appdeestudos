import { describe, it, expect } from 'vitest';
import seed from '../src/data/seed.json';
import { janelasDoDia, fixosDoDia, missasDoDia, horaCorrida, aulasFaculdade } from '../src/lib/rotina.js';
import { planoSemana, toMin } from '../src/lib/semana.js';
import { gerarFases } from '../src/lib/phases.js';
import { blocosDaSemana } from '../src/lib/planner.js';
import { reservasDaSemana, oracoesDoDia, reservasOracao, minimoOracao } from '../src/lib/oracao.js';
import { treinoDoDia, alertasTreino, sequencia } from '../src/lib/treino.js';
import { noiteDe, acordarAmanha, horariosNoite } from '../src/lib/sono.js';
import { migrarCfg } from '../src/lib/migracao.js';
import { resumoDoDia, situacaoDoDia } from '../src/lib/avisos.js';

const cfg = () => structuredClone(seed);
const min = (h, m = 0) => h * 60 + m;
// blocos de missa (trajeto + missa + volta) por dia da semana, em minutos
const MISSA = { 4: [min(18, 40), min(20, 20)], 5: [min(5, 40), min(7, 20)], 6: [min(4, 40), min(6, 20)], 0: [min(11, 40), min(13, 20)] };
const bate = (a, b) => a[0] < b[1] && a[1] > b[0];

describe('Santa Missa na rotina', () => {
  it('seed: 4 missas fixas (tipo missa) com 20 min de trajeto, fora da contagem da faculdade', () => {
    const c = cfg();
    expect(seed.versaoSeed).toBe(15);
    expect(c.rotina.aulas.filter((a) => a.tipo === 'missa').map((a) => [a.dia, a.inicio, a.fim])).toEqual([[5, '05:40', '07:20'], [6, '04:40', '06:20'], [0, '11:40', '13:20'], [4, '18:40', '20:20']]);
    expect(missasDoDia(c, 5)[0]).toMatchObject({ ini: min(5, 40), fim: min(7, 20), trajeto: 20, missa: min(6) });
    expect(aulasFaculdade(c).some((a) => a.tipo === 'missa')).toBe(false);
    expect(missasDoDia(c, 1)).toEqual([]);
  });
  it('janelas de estudo não tocam a missa nos 4 dias (e domingo não colide com almoço)', () => {
    const c = cfg();
    for (const [wd, m] of Object.entries(MISSA)) for (const j of janelasDoDia(c, +wd)) expect(bate([toMin(j.ini), toMin(j.fim)], m), `wd ${wd} ${j.ini}-${j.fim}`).toBe(false);
    expect(janelasDoDia(c, 0)).toEqual([{ ini: '15:00', fim: '17:00', tipo: 'domingo' }]);
    expect(fixosDoDia(c, 0).find((f) => f.nome === 'Refeição')).toMatchObject({ ini: min(13, 20), fim: min(14) });
  });
  it('quinta: musculação 17h, jantar 18h–18h40, missa 18h40–20h20 e nenhum estudo à noite', () => {
    const c = cfg();
    expect(fixosDoDia(c, 4)).toEqual(expect.arrayContaining([{ ini: min(17), fim: min(18), nome: 'Musculação' }, { ini: min(18), fim: min(18, 40), nome: 'Refeição' }, { ini: min(18, 40), fim: min(20, 20), nome: 'Missa quinta' }]));
    expect(janelasDoDia(c, 4)).toEqual([{ ini: '06:30', fim: '12:00' }, { ini: '13:00', fim: '17:00' }]);
    const dias = planoSemana(c, gerarFases(c), '2026-11-23', { reservas: reservasDaSemana(c, {}, '2026-11-23') });
    expect(Math.max(...dias[3].blocos.map((b) => b.fim))).toBeLessThanOrEqual(min(17));
  });
  it('sexta: missa 05:40–07:20, corrida 07:30 e estudo só depois do banho; sábado: corrida 07h e estudo depois dela', () => {
    const c = cfg();
    expect(horaCorrida(c, 5)).toBe('07:30'); expect(horaCorrida(c, 6)).toBe('07:00');
    for (const wd of [1, 2, 3, 4]) expect(horaCorrida(c, wd)).toBe('05:30');
    expect(fixosDoDia(c, 5).find((f) => f.nome === 'Corrida')).toMatchObject({ ini: min(7, 30), fim: min(8, 30) });
    expect(janelasDoDia(c, 5)[0]).toEqual({ ini: '08:30', fim: '12:00' });
    expect(janelasDoDia(c, 6)[0]).toMatchObject({ ini: '08:00', tipo: 'prova' });
    expect(treinoDoDia(c, '2026-11-20').hora).toBe('07:30');
    expect(treinoDoDia(c, '2026-11-26').hora).toBe('05:30'); // quinta
    expect(treinoDoDia(c, '2026-11-20').choque).toBe(null);
  });
  it('corridaPorDia em outra hora: choque com a missa é avisado', () => {
    const c = cfg(); c.treino.corridaPorDia = { 5: '06:00' };
    expect(treinoDoDia(c, '2026-11-20').choque).toMatch(/Santa Missa/);
    expect(alertasTreino(c, '2026-11-20').some((a) => /Santa Missa/.test(a))).toBe(false);
    c.treino.musculacao[4].ini = '18:00';
    expect(alertasTreino(c, '2026-11-20').some((a) => /Musculação de quinta bate com a Santa Missa/.test(a))).toBe(true);
  });
  it('nenhum bloco de estudo (com orações reservadas) sobrepõe a missa, em várias semanas e níveis', () => {
    const c = cfg(), fs = gerarFases(c);
    for (const seg of ['2026-11-16', '2026-11-23', '2027-01-18', '2027-05-10']) {
      const dias = planoSemana(c, fs, seg, { reservas: reservasDaSemana(c, {}, seg) });
      for (const d of dias) for (const b of d.blocos) if (MISSA[d.wd]) expect(bate([b.ini, b.fim], MISSA[d.wd]), `${seg} wd ${d.wd} ${b.cat}`).toBe(false);
    }
    for (const nivel of [1, 2, 3, 4]) {
      const r = reservasOracao(c, nivel);
      // Ângelus de domingo fica dentro da missa: sem reserva separada; terços não ficam dentro da missa
      expect(r[0].some((x) => x.ini === min(12))).toBe(false);
      for (const [wd, m] of Object.entries(MISSA)) for (const x of r[wd]) expect(bate([x.ini, x.fim], m), `nível ${nivel} wd ${wd}`).toBe(false);
    }
  });
});

describe('reservas de oração x fixos', () => {
  it('nenhuma reserva (níveis 1–4, todos os dias) cai em cima de missa, corrida, refeição ou musculação; Ângelus fora da regra das refeições', () => {
    const c = cfg();
    for (const nivel of [1, 2, 3, 4]) {
      const r = reservasOracao(c, nivel);
      for (let wd = 0; wd < 7; wd++) for (const x of r[wd]) for (const f of fixosDoDia(c, wd)) {
        if (f.nome === 'Refeição' && x.fim - x.ini <= 5) continue; // Ângelus (5 min) ao meio-dia
        expect(bate([x.ini, x.fim], [f.ini, f.fim]), `nível ${nivel} wd ${wd} reserva ${x.ini}-${x.fim} x ${f.nome}`).toBe(false);
      }
    }
  });
  it('sexta nível 3: 3º terço vai para depois da corrida; domingo nível 2: 2º terço às 14:00', () => {
    const c = cfg(), r3 = reservasOracao(c, 3), r2 = reservasOracao(c, 2);
    expect(r3[5].some((x) => x.ini === min(8, 30))).toBe(true);
    expect(r2[0].some((x) => x.ini === min(14))).toBe(true);
  });
});

describe('sono com a missa', () => {
  it('sexta à noite 21:30 → 04:30; avisos de acordar: quinta 05:00, sexta 04:30, sábado 05:15', () => {
    const c = cfg();
    expect(noiteDe(c, '2026-11-20')).toMatchObject({ dormir: '21:30', acordar: '04:30', horas: 7, curta: false });
    expect(horariosNoite(c, '2026-11-20')).toMatchObject({ terco: '20:30', oracao: '20:50', telas: '21:00' });
    expect(acordarAmanha(c, '2026-11-26')).toMatchObject({ acordar: '05:00', linha: 'Amanhã (sexta): acordar às 05:00' });
    expect(acordarAmanha(c, '2026-11-20')).toMatchObject({ acordar: '04:30', dormir: '21:30', linha: 'Amanhã (sábado): acordar às 04:30' });
    expect(acordarAmanha(c, '2026-11-21')).toMatchObject({ acordar: '05:15', dormir: '21:00', linha: 'Amanhã (domingo): acordar às 05:15' });
  });
});

describe('Hoje: a missa como item de oração', () => {
  const ids = (c, d) => oracoesDoDia(c, d).map((o) => o.id);
  it('aparece no horário de sair, com o trajeto, como bônus fora da sequência', () => {
    const c = cfg(), o = oracoesDoDia(c, '2026-11-20').find((x) => x.id === 'missa');
    expect(o).toMatchObject({ titulo: 'Santa Missa', hora: '05:40', conta: false, bonus: true });
    expect(o.sub).toBe('Sair 05:40 · missa 06:00 · volta 07:20');
    expect(oracoesDoDia(c, '2026-11-21').find((x) => x.id === 'missa')).toMatchObject({ hora: '04:40' });
    expect(ids(c, '2026-11-22')).toContain('missa'); expect(ids(c, '2026-11-26')).toContain('missa');
    expect(ids(c, '2026-11-24')).not.toContain('missa'); // terça
    expect(oracoesDoDia(c, '2026-11-19')).toEqual([]); // antes do início
  });
  it('oração da manhã: sexta 05:10; sábado logo ao acordar (04:30), antes da missa', () => {
    const c = cfg(), h = (d) => oracoesDoDia(c, d).find((x) => x.id === 'manha').hora;
    expect(h('2026-11-20')).toBe('05:10'); expect(h('2026-11-21')).toBe('04:30'); expect(h('2026-11-24')).toBe('05:10');
  });
  it('marcar a missa não é obrigatório para a sequência, e marcar fica registrado nas marcas do dia', () => {
    expect(minimoOracao({ manha: true, noite: true })).toBe(true);
    const c = cfg(), cumpridos = { '2026-11-20': true }, treinos = { '2026-11-20': { feito: true } };
    expect(sequencia(c, { cumpridos, treinos, oracoes: { '2026-11-20': { manha: true, noite: true } } }, '2026-11-20')).toBe(1);
  });
  it('Ângelus de domingo continua marcável (nível 2) mas sem reserva própria', () => {
    const c = cfg(); c.oracaoPlano.inicio = '2026-10-01';
    const o = oracoesDoDia(c, '2026-12-06', { oracoes: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`2026-10-${String(i + 1).padStart(2, '0')}`, Object.fromEntries(['manha', 'terco1', 'noite'].map((k) => [k, true]))])) });
    expect(o.some((x) => x.id === 'angelus')).toBe(true);
  });
});

describe('sexta 20/11 (primeiro dia)', () => {
  it('estudo só a partir das 08:30 e nada atrasado às 07:00 nem às 08:00', () => {
    const c = cfg(), fs = gerarFases(c), sexta = blocosDaSemana(c, fs, '2026-11-16', {})[4];
    expect(Math.min(...sexta.filter((b) => b.ini).map((b) => (typeof b.ini === 'number' ? b.ini : toMin(b.ini))))).toBeGreaterThanOrEqual(min(8, 30));
    const r = resumoDoDia({ dia: '2026-11-20', blocos: sexta, dormir: '22:00', acordar: '05:00', livre: false });
    for (const agora of [min(5), min(7), min(8), min(8, 30)]) expect(situacaoDoDia(r, 0, agora).atrasado).toBe(false);
  });
});

describe('migração v15', () => {
  const antigo = () => { const s = cfg(); s.versaoSeed = 14; s.rotina.aulas = s.rotina.aulas.filter((a) => a.tipo !== 'missa'); delete s.rotina.refeicoesPorDia; delete s.rotina.fimEstudoPorDia; delete s.treino.corridaPorDia; s.sono.padrao[5] = { dormir: '22:00', acordar: '06:30' }; return s; };
  it('acrescenta missas, corridaPorDia e o sono novo da sexta sem perder o que foi editado', () => {
    const salvo = antigo(); salvo.carta = 'minha'; salvo.rotina.aulas.push({ dia: 2, inicio: '10:00', fim: '11:00', nome: 'Meu curso', tipo: 'fixo' }); salvo.treino.corrida = '05:45'; salvo.sono.padrao[1] = { dormir: '21:45', acordar: '05:00' };
    const m = migrarCfg(salvo, seed);
    expect(m.versaoSeed).toBe(15); expect(m.carta).toBe('minha'); expect(m.treino.corrida).toBe('05:45'); expect(m.sono.padrao[1].dormir).toBe('21:45');
    expect(m.rotina.aulas.filter((a) => a.tipo === 'missa')).toHaveLength(4); expect(m.rotina.aulas.some((a) => a.nome === 'Meu curso')).toBe(true);
    expect(m.treino.corridaPorDia).toEqual({ 5: '07:30' }); expect(horaCorrida(m, 1)).toBe('05:45');
    expect(m.sono.padrao[5]).toEqual({ dormir: '21:30', acordar: '04:30' });
    expect(m.rotina.fimEstudoPorDia[4]).toBe('18:40'); expect(m.rotina.refeicoesPorDia[4]).toHaveLength(2);
  });
  it('mantém o sono de sexta que você já tinha editado e as missas/corrida editadas', () => {
    const salvo = antigo(); salvo.sono.padrao[5] = { dormir: '22:30', acordar: '06:00' };
    salvo.rotina.aulas.push({ dia: 5, inicio: '05:30', fim: '07:10', nome: 'Missa sexta', tipo: 'missa', trajeto: 30 }); salvo.treino.corridaPorDia = { 5: '07:45' };
    const m = migrarCfg(salvo, seed);
    expect(m.sono.padrao[5]).toEqual({ dormir: '22:30', acordar: '06:00' });
    expect(m.rotina.aulas.filter((a) => a.tipo === 'missa' && a.dia === 5)).toEqual([expect.objectContaining({ inicio: '05:30', trajeto: 30 })]);
    expect(m.rotina.aulas.filter((a) => a.tipo === 'missa')).toHaveLength(4);
    expect(m.treino.corridaPorDia[5]).toBe('07:45');
  });
});
