import { describe, it, expect } from 'vitest';
import seed from '../src/data/seed.json';
import { nivelOracao, progressoMes, misteriosDoDia, novenaDoDia, oracoesDoDia, reservasOracao, pascoa, tempoPascal, chaveEvangelho, evangelhoDoDia, itensDoNivel, minimoOracao } from '../src/lib/oracao.js';
import { planoSemana } from '../src/lib/semana.js';
import { gerarFases } from '../src/lib/phases.js';
import { sequencia } from '../src/lib/treino.js';
import { addDays } from '../src/lib/dates.js';

import { legado } from './_legado.js';
const cfg = () => legado(structuredClone(seed));
const completos = (ini, n, nivel = 1, c = cfg()) => Object.fromEntries(Array.from({ length: n }, (_, i) => [addDays(ini, i), Object.fromEntries(itensDoNivel(c, nivel).map((x) => [x, true]))]));

describe('oração: progressão mensal (27 de 30)', () => {
  it('começa no nível 1 em 17/11/2026', () => expect(nivelOracao(cfg(), {}, '2026-11-17')).toBe(1));
  it('27 dias completos no mês 1 -> nível 2 no mês 2', () => {
    const o = completos('2026-11-17', 27);
    expect(nivelOracao(cfg(), o, '2026-12-16')).toBe(1); // ainda no 1º mês
    expect(nivelOracao(cfg(), o, '2026-12-17')).toBe(2);
  });
  it('26 dias -> repete o mês; não perde o que já conquistou', () => {
    const o = completos('2026-11-17', 26);
    expect(nivelOracao(cfg(), o, '2026-12-17')).toBe(1);
    const o2 = { ...completos('2026-11-17', 30), ...completos('2026-12-17', 10, 2) }; // mês 2 fraco
    expect(nivelOracao(cfg(), o2, '2027-01-16')).toBe(2); // repete o nível 2, não volta ao 1
  });
  it('no nível 2, o dia só conta com os itens do nível 2', () => {
    const o = { ...completos('2026-11-17', 30), ...completos('2026-12-17', 30, 1) }; // mês 2 só com itens do nível 1
    expect(nivelOracao(cfg(), o, '2027-01-16')).toBe(2);
    const o2 = { ...completos('2026-11-17', 30), ...completos('2026-12-17', 30, 2) };
    expect(nivelOracao(cfg(), o2, '2027-01-16')).toBe(3);
  });
  it('não passa do nível 4', () => {
    let o = {}; for (let m = 0; m < 8; m++) o = { ...o, ...completos(addDays('2026-11-17', 30 * m), 30, 4) };
    expect(nivelOracao(cfg(), o, '2027-08-01')).toBe(4);
  });
  it('progresso do mês conta só até hoje', () => {
    const p = progressoMes(cfg(), completos('2026-11-17', 5), '2026-11-21');
    expect(p).toMatchObject({ nivel: 1, ok: 5, meta: 27, de: 30 });
  });
});

describe('oração: mistérios, Ângelus e Evangelho', () => {
  it('gozosos seg/qui, dolorosos ter/sex, gloriosos qua/sáb/dom', () => {
    const t = (d) => misteriosDoDia(cfg(), d).tipo;
    expect(t('2026-11-16')).toBe('gozosos'); expect(t('2026-11-19')).toBe('gozosos');
    expect(t('2026-11-17')).toBe('dolorosos'); expect(t('2026-11-20')).toBe('dolorosos');
    expect(t('2026-11-18')).toBe('gloriosos'); expect(t('2026-11-21')).toBe('gloriosos'); expect(t('2026-11-22')).toBe('gloriosos');
    expect(misteriosDoDia(cfg(), '2026-11-17').lista).toHaveLength(5);
  });
  it('o item do terço mostra os mistérios do dia', () => {
    const terco = oracoesDoDia(cfg(), '2026-11-17').find((x) => x.id === 'terco1');
    expect(terco.titulo).toMatch(/dolorosos/); expect(terco.partes[0].texto).toMatch(/Agonia/);
  });
  it('Páscoa e tempo pascal (Regina Caeli)', () => {
    expect(pascoa(2027)).toBe('2027-03-28'); expect(pascoa(2026)).toBe('2026-04-05');
    expect(tempoPascal('2027-04-10')).toBe(true); expect(tempoPascal('2027-07-01')).toBe(false);
  });
  it('Evangelho: domingos do calendário de 1962', () => {
    expect(chaveEvangelho('2026-11-29')).toBe('advento1');
    expect(chaveEvangelho('2026-12-25')).toBe('natal');
    expect(chaveEvangelho('2027-03-28')).toBe('pascoa');
    expect(chaveEvangelho('2027-02-14')).toBe('quaresma1'); expect(chaveEvangelho('2027-02-21')).toBe('quaresma2');
    expect(chaveEvangelho('2026-11-22')).toBe('pent24'); // último domingo depois de Pentecostes
    expect(chaveEvangelho('2026-10-25')).toBe('cristoRei');
    expect(evangelhoDoDia(cfg(), '2026-11-29').ref).toBe('Lc 21,25-33');
  });
});

describe('oração: novena e provas', () => {
  it('novena a São José de Cupertino nos 9 dias antes da prova (EFOMM 25/07/2027)', () => {
    expect(novenaDoDia(cfg(), '2027-07-16')).toMatchObject({ dia: 1 });
    expect(novenaDoDia(cfg(), '2027-07-24')).toMatchObject({ dia: 9 });
    expect(novenaDoDia(cfg(), '2027-07-15')).toBe(null);
    expect(novenaDoDia(cfg(), '2027-07-25').prova.nome).toMatch(/ESA/); // dia da EFOMM: 9º dia da novena pela ESA (26/07)
    expect(novenaDoDia(cfg(), '2027-07-26')).toBe(null); // depois das provas de julho: nada até a próxima
    expect(oracoesDoDia(cfg(), '2027-07-20').some((x) => x.id === 'novena')).toBe(true);
  });
  it('dia de prova antiga/simulado/checkpoint ganha a oração a São José de Cupertino', () => {
    expect(oracoesDoDia(cfg(), '2026-12-05', { temProva: true }).some((x) => x.id === 'prova')).toBe(true);
    expect(oracoesDoDia(cfg(), '2026-12-05').some((x) => x.id === 'prova')).toBe(false);
  });
  it('festas de São Tomás (7/3) e São José de Cupertino (18/9)', () => {
    expect(oracoesDoDia(cfg(), '2027-03-07').some((x) => x.id === 'festa')).toBe(true);
    expect(oracoesDoDia(cfg(), '2027-09-18').find((x) => x.id === 'festa').titulo).toMatch(/Cupertino/);
  });
  it('exame da noite pergunta pelo dever de estado', () => {
    const noite = oracoesDoDia(cfg(), '2026-11-17').find((x) => x.id === 'noite');
    expect(noite.partes.map((p) => p.texto).join(' ')).toMatch(/Cumpri meu dever de estado hoje/);
  });
});

describe('oração, estudo e sequência', () => {
  it('nível 3: terço depois do almoço e depois da corrida saem das janelas de estudo', () => {
    const c = cfg(), r = reservasOracao(c, 3);
    const dias = planoSemana(c, gerarFases(c), '2026-11-23', { reservas: r });
    for (const [i, d] of dias.entries()) for (const b of d.blocos) for (const x of r[(i + 1) % 7]) expect(b.fim <= x.ini || b.ini >= x.fim, `${d.dia} ${b.cat} ${b.ini}`).toBe(true);
  });
  it('mínimo de oração: manhã e noite', () => {
    expect(minimoOracao({ manha: true, noite: true })).toBe(true);
    expect(minimoOracao({ manha: true })).toBe(false);
  });
  it('a sequência pede estudo, treino e oração', () => {
    const cumpridos = { '2026-11-17': true }, treinos = { '2026-11-17': { feito: true } };
    expect(sequencia(cfg(), { cumpridos, treinos, oracoes: {} }, '2026-11-17')).toBe(0);
    expect(sequencia(cfg(), { cumpridos, treinos, oracoes: { '2026-11-17': { manha: true, noite: true } } }, '2026-11-17')).toBe(1);
  });
});

import { reservasDaSemana, proximaPergunta } from '../src/lib/oracao.js';
describe('revisão da etapa 2', () => {
  it('domingos depois de Pentecostes: Trindade é o 1º; 2º = Lc 14; o último é o 24º; sobras da Epifania entram antes dele', () => {
    expect(chaveEvangelho('2027-05-30')).toBe('pent2');
    expect(evangelhoDoDia(cfg(), '2027-05-30').ref).toBe('Lc 14,16-24');
    expect(chaveEvangelho('2027-11-21')).toBe('pent24');
    expect(chaveEvangelho('2027-11-14')).toMatch(/^epifania[3-6]$/);
    expect(chaveEvangelho('2026-11-01')).toBe('pent23'); expect(chaveEvangelho('2026-11-08')).toBe('epifania5'); expect(chaveEvangelho('2026-11-15')).toBe('epifania6');
  });
  it('2 a 5/1 vindo de dezembro e 26 a 31/12', () => {
    expect(chaveEvangelho('2027-01-02')).toBe('circuncisao');
    expect(chaveEvangelho('2027-01-03')).toBe('santoNome');
    expect(chaveEvangelho('2026-12-26')).toBe('natal');
    expect(chaveEvangelho('2026-12-27')).toBe('oitavaNatal');
    expect(chaveEvangelho('2027-01-07')).toBe('epifania');
  });
  it('reservas: nível da segunda vale a semana toda e nada antes do início', () => {
    const r = reservasDaSemana(cfg(), {}, '2026-11-16');
    expect(r[1]).toEqual([]); // segunda 16/11, antes do início
    expect(r[2].length).toBeGreaterThan(0);
  });
  it('sábado com prova: a reserva do Ângelus não parte a prova cronometrada', () => {
    const c = cfg(), r = reservasDaSemana(c, {}, '2027-08-02');
    const nivel3 = (seg) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v]));
    const dias = planoSemana(c, gerarFases(c), '2027-08-02', { reservas: nivel3 });
    const prova = dias[5].blocos.filter((b) => b.cat === 'prova' && !b.sessoes);
    expect(prova).toHaveLength(1); expect(prova[0].ini).toBe(8 * 60);
  });
  it('sobras do recorte não viram bloco curto de Matemática', () => {
    const c = cfg(); const res = { 1: [{ ini: 12 * 60 + 55, fim: 13 * 60 + 15 }] };
    c.rotina.janelas = { 1: [{ ini: '06:40', fim: '07:10' }, { ini: '12:30', fim: '18:30' }, { ini: '20:00', fim: '21:00' }] }; // janela curta feita à mão
    const dias = planoSemana(c, gerarFases(c), '2026-11-23', { reservas: res });
    expect(dias[0].blocos.filter((b) => b.curta)).toHaveLength(1); // só a de 6h40
  });
  it('catecismo: base + 3 por dia marcado', () => {
    expect(proximaPergunta({ base: 1, dias: { a: true, b: true } })).toBe(7);
    expect(proximaPergunta({ proxima: 10 })).toBe(10);
  });
});
