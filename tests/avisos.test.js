import { describe, it, expect } from 'vitest';
import seed from '../src/data/seed.json';
import { migrarCfg } from '../src/lib/migracao.js';
import { fraseDoDia, bancoDoTom } from '../src/lib/frases.js';
import { resumoDoDia, devidoAte, situacaoDoDia, feitoDoResumo, janelaDe, emSilencio, decidirAviso, placar, textoSaldo, textoAviso, LIMIAR_MIN } from '../src/lib/avisos.js';

const h = (s) => { const [a, b] = s.split(':').map(Number); return a * 60 + b; };
// 06:30–08:20 (100 min), 08:30–10:20 (100 min), 14:00–15:40 (100 min)
const blocos = [
  { id: 'a', ini: '06:30', fim: '08:20', min: 100 }, { id: 'b', ini: '08:30', fim: '10:20', min: 100 }, { id: 'c', ini: '14:00', fim: '15:40', min: 100 },
];
const resumo = (extra = {}) => resumoDoDia({ dia: '2027-01-18', blocos, dormir: '22:00', acordar: '05:00', ...extra });

describe('atraso do dia', () => {
  it('devido = blocos cujo horário de fim já passou', () => {
    const r = resumo();
    expect(devidoAte(r.blocos, h('06:00'))).toBe(0);
    expect(devidoAte(r.blocos, h('09:00'))).toBe(100);
    expect(devidoAte(r.blocos, h('10:30'))).toBe(200);
    expect(devidoAte(r.blocos, h('16:00'))).toBe(300);
    expect(r.meta).toBe(300);
  });
  it('zerado: nenhum bloco feito depois do fim do primeiro', () => {
    const s = situacaoDoDia(resumo(), 0, h('10:00'));
    expect(s).toMatchObject({ cobra: true, atrasado: true, zerado: true, falta: 100, inicio1: h('06:30') });
  });
  it('atrasado sem zerar, em dia e dentro do limiar', () => {
    const r = resumo();
    expect(situacaoDoDia(r, 100, h('10:30'))).toMatchObject({ atrasado: true, zerado: false, falta: 100 });
    expect(situacaoDoDia(r, 200, h('10:30')).atrasado).toBe(false);
    expect(situacaoDoDia(r, 100, h('08:00')).atrasado).toBe(false);
    expect(LIMIAR_MIN).toBeGreaterThan(0);
  });
  it('feito vem dos blocos marcados do resumo', () => {
    expect(feitoDoResumo(resumo(), { a: { min: 100 }, c: {}, x: {} })).toBe(200);
    expect(feitoDoResumo(null, {})).toBe(0);
  });
  it('dia mínimo (bloco sem horário) vence às 18h e não conta como início', () => {
    const r = resumoDoDia({ dia: '2027-01-18', blocos: [{ id: 'm', min: 45 }], dormir: '22:00', acordar: '05:00' });
    expect(r.blocos[0]).toMatchObject({ semHora: true, fim: h('18:00') });
    expect(situacaoDoDia(r, 0, h('17:00')).atrasado).toBe(false);
    expect(situacaoDoDia(r, 0, h('18:30'))).toMatchObject({ atrasado: true, inicio1: null });
    expect(situacaoDoDia(r, 45, h('18:30')).atrasado).toBe(false);
  });
  it('feriado livre e dia sem blocos não cobram', () => {
    expect(situacaoDoDia(resumo({ livre: true }), 0, h('20:00')).cobra).toBe(false);
    expect(situacaoDoDia(resumoDoDia({ dia: '2027-01-18', blocos: [], dormir: '22:00', acordar: '05:00' }), 0, h('20:00')).atrasado).toBe(false);
    expect(decidirAviso({ resumo: resumo({ livre: true }), feito: 0, agora: h('20:00') })).toBeNull();
    expect(decidirAviso({ resumo: null, agora: h('20:00') })).toBeNull();
  });
});

describe('janela, silêncio e aviso', () => {
  it('janelas manhã, tarde e noite; fora delas, nenhuma', () => {
    expect(janelaDe(h('06:00'))).toBe('manha'); expect(janelaDe(h('11:59'))).toBe('manha');
    expect(janelaDe(h('12:00'))).toBe('tarde'); expect(janelaDe(h('18:00'))).toBe('noite');
    expect(janelaDe(h('22:00'))).toBeNull(); expect(janelaDe(h('03:00'))).toBeNull();
  });
  it('silêncio entre dormir e acordar (cruzando a meia-noite)', () => {
    expect(emSilencio(h('23:00'), '22:00', '05:00')).toBe(true);
    expect(emSilencio(h('04:59'), '22:00', '05:00')).toBe(true);
    expect(emSilencio(h('05:00'), '22:00', '05:00')).toBe(false);
    expect(emSilencio(h('21:59'), '22:00', '05:00')).toBe(false);
    expect(emSilencio(h('07:00'), '21:00', '08:00')).toBe(true);
    expect(emSilencio(h('07:00'), null, null)).toBe(false);
  });
  it('avisa 1 vez por janela e respeita o sono', () => {
    const r = resumo(), n = {};
    const a = decidirAviso({ resumo: r, feito: 0, agora: h('10:00'), notificados: n });
    expect(a.chave).toBe('2027-01-18:aviso:manha');
    expect(a.titulo).toBe('Sargento');
    expect(a.corpo).toContain('10h. Zero blocos. Seu concorrente começou às 6h30.');
    expect(decidirAviso({ resumo: r, feito: 0, agora: h('11:00'), notificados: { [a.chave]: 1 } })).toBeNull(); // mesma janela
    expect(decidirAviso({ resumo: r, feito: 0, agora: h('16:00'), notificados: { [a.chave]: 1 } }).janela).toBe('tarde'); // outra janela
    expect(decidirAviso({ resumo: resumo({ acordar: '10:30' }), feito: 0, agora: h('10:00') })).toBeNull(); // ainda dormindo
    expect(decidirAviso({ resumo: resumo({ dormir: '19:00' }), feito: 0, agora: h('20:00') })).toBeNull(); // já deitado
    expect(decidirAviso({ resumo: r, feito: 300, agora: h('20:00') })).toBeNull(); // em dia
  });
  it('tom padrão é gentil e sem tom militar', () => {
    const t = textoAviso('padrao', { zerado: false, falta: 100 }, h('10:00'), 'manha');
    expect(t.titulo).toBe('Estuda Gabriel'); expect(t.corpo).toContain('1h40');
    expect(decidirAviso({ resumo: resumo(), feito: 100, agora: h('10:30'), tom: 'padrao' }).titulo).toBe('Estuda Gabriel');
  });
});

describe('placar contra o concorrente', () => {
  const semana = [
    { dia: '2027-01-18', meta: 300, feito: 200 }, { dia: '2027-01-19', meta: 300, feito: 0 }, { dia: '2027-01-20', meta: 300, feito: 0 },
  ];
  it('dia e semana (só até hoje): saldo = feito - meta', () => {
    expect(placar(semana, '2027-01-18')).toEqual({ dia: { meta: 300, feito: 200, saldo: -100 }, semana: { meta: 300, feito: 200, saldo: -100 } });
    const p = placar([{ dia: '2027-01-18', meta: 300, feito: 360 }, { dia: '2027-01-19', meta: 300, feito: 200 }], '2027-01-19');
    expect(p.dia.saldo).toBe(-100); expect(p.semana.saldo).toBe(-40);
  });
  it('texto: atrás, à frente e empatado', () => {
    expect(textoSaldo(-150)).toBe('2h30 atrás'); expect(textoSaldo(60)).toBe('1h à frente'); expect(textoSaldo(0)).toBe('empatado');
  });
});

describe('modo Sargento: frases e migração', () => {
  const CTX = ['inicio', 'bloco', 'cumprido', 'dificil', 'prova', 'domingo', 'noite'];
  it('o seed traz o conjunto sargento, em todos os contextos, sem repetição e sem ofensa', () => {
    const todas = CTX.flatMap((c) => { expect(seed.frases.sargento[c].length).toBeGreaterThanOrEqual(5); return seed.frases.sargento[c]; });
    expect(new Set(todas).size).toBe(todas.length);
    expect(todas.join(' ')).not.toMatch(/idiota|burro|incompetente|lixo|vagabundo|imbecil|ameaç/i);
    expect(seed.tom).toBe('sargento');
  });
  it('escolhe a frase do banco Sargento (ou o padrão no tom padrão) e o contexto vale nos dois', () => {
    const f = fraseDoDia(seed.frases, { hora: 7 }, '2027-01-18', 'sargento');
    expect(seed.frases.sargento.inicio).toContain(f);
    expect(fraseDoDia(seed.frases, { hora: 7 }, '2027-01-18', 'sargento')).toBe(f);
    expect(seed.frases.inicio).toContain(fraseDoDia(seed.frases, { hora: 7 }, '2027-01-18', 'padrao'));
    expect(seed.frases.sargento.noite).toContain(fraseDoDia(seed.frases, { hora: 23 }, '2027-01-18', 'sargento'));
    expect(seed.frases.sargento.bloco).toContain(fraseDoDia(seed.frases, { hora: 10, feitos: 2 }, '2027-01-18', 'sargento'));
    expect(bancoDoTom(seed.frases, 'padrao')).toBe(seed.frases);
    expect(bancoDoTom({ inicio: ['x'] }, 'sargento')).toEqual({ inicio: ['x'] }); // sem banco Sargento, cai no padrão
  });
  it('migração para a v13 liga o Sargento e não perde dados', () => {
    const velho = structuredClone(seed); delete velho.tom; velho.versaoSeed = 12; velho.carta = 'minha carta'; velho.frases = { inicio: ['velha'] };
    const novo = migrarCfg(velho, seed);
    expect(novo.versaoSeed).toBe(13); expect(novo.tom).toBe('sargento'); expect(novo.carta).toBe('minha carta');
    expect(novo.frases.sargento.inicio.length).toBeGreaterThan(0);
    const desligado = structuredClone(seed); desligado.versaoSeed = 13; desligado.tom = 'padrao';
    expect(migrarCfg(desligado, seed).tom).toBe('padrao');
    const v12 = structuredClone(seed); v12.versaoSeed = 12; v12.tom = 'padrao';
    expect(migrarCfg(v12, seed).tom).toBe('padrao'); // escolha existente é mantida
  });
});
