import { describe, it, expect } from 'vitest';
import seed from '../src/data/seed.json';
import { diaLivre, antesDoInicio } from '../src/lib/rotina.js';
import { migrarCfg } from '../src/lib/migracao.js';
import { planoPrazos, ritmo } from '../src/lib/prazos.js';
import { gerarFases } from '../src/lib/phases.js';
import { blocosDaSemana } from '../src/lib/planner.js';
import { treinoDoDia, sequencia } from '../src/lib/treino.js';
import { oracoesDoDia, nivelOracao } from '../src/lib/oracao.js';
import { checkpointPendente } from '../src/lib/portao.js';
import { acordarAmanha } from '../src/lib/sono.js';
import { resumoDoDia, situacaoDoDia, decidirAviso, decidirAcordar, textoAcordar, naJanelaAcordar } from '../src/lib/avisos.js';

const cfg = () => structuredClone(seed);
const min = (h, m = 0) => h * 60 + m;

describe('início real (20/11/2026)', () => {
  it('seed: inicioReal, treino e oração começam em 20/11', () => {
    const c = cfg();
    expect(seed.versaoSeed).toBe(14);
    expect(c.perfil.inicioReal).toBe('2026-11-20');
    expect(c.treinoPlano.inicio).toBe('2026-11-20'); expect(c.treinoPlano.fases[0].inicio).toBe('2026-11-20');
    expect(c.oracaoPlano.inicio).toBe('2026-11-20');
  });
  it('antes do início é dia livre; 20/11 não é; dia livre fixo continua', () => {
    const c = cfg();
    expect(antesDoInicio(c, '2026-11-19')).toBe(true); expect(diaLivre(c, '2026-11-19')).toBe(true);
    expect(antesDoInicio(c, '2026-11-20')).toBe(false); expect(diaLivre(c, '2026-11-20')).toBe(false);
    expect(diaLivre(c, '2026-12-25')).toBe(true); expect(antesDoInicio(c, '2026-12-25')).toBe(false);
    delete c.perfil.inicioReal; expect(diaLivre(c, '2026-11-19')).toBe(false);
  });
  it('migração v14 grava inicioReal no cfg salvo sem perder o perfil editado', () => {
    const salvo = cfg(); salvo.versaoSeed = 13; delete salvo.perfil.inicioReal; salvo.perfil.nome = 'Outro'; salvo.perfil.extraZero = 2; salvo.carta = 'minha';
    salvo.treinoPlano.inicio = '2026-11-17'; salvo.oracaoPlano.inicio = '2026-11-17';
    const m = migrarCfg(salvo, seed);
    expect(m.perfil.inicioReal).toBe('2026-11-20'); expect(m.perfil.nome).toBe('Outro'); expect(m.perfil.extraZero).toBe(2); expect(m.carta).toBe('minha');
    expect(m.treinoPlano.inicio).toBe('2026-11-20'); expect(m.oracaoPlano.inicio).toBe('2026-11-20'); expect(m.versaoSeed).toBe(14);
    const velho = cfg(); velho.versaoSeed = 13; velho.perfil.inicioReal = '2026-11-18'; // valor antigo é atualizado
    expect(migrarCfg(velho, seed).perfil.inicioReal).toBe('2026-11-20');
  });
  it('sem blocos, caderno de erros, treino, oração, checkpoint nem cobrança antes do início', () => {
    const c = cfg(), fs = gerarFases(c);
    const sem = blocosDaSemana(c, fs, '2026-11-16', {});
    for (let i = 0; i < 4; i++) expect(sem[i]).toEqual([]); // seg a qui
    expect(sem[4].length).toBeGreaterThan(3); expect(sem[4].some((b) => b.cat === 'erros')).toBe(true); // sexta 20/11
    expect(treinoDoDia(c, '2026-11-19')).toBe(null); expect(oracoesDoDia(c, '2026-11-19')).toEqual([]);
    expect(checkpointPendente(c, {}, '2026-11-19')).toBe(false);
    const r = resumoDoDia({ dia: '2026-11-19', blocos: sem[3], dormir: '22:00', acordar: '05:00', livre: diaLivre(c, '2026-11-19') });
    expect(r.livre).toBe(true); expect(situacaoDoDia(r, 0, min(15)).cobra).toBe(false);
    expect(decidirAviso({ resumo: r, agora: min(15) })).toBe(null);
  });
  it('sexta 20/11: carga normal de sexta, corrida e oração nível 1', () => {
    const c = cfg(), fs = gerarFases(c);
    const sexta = blocosDaSemana(c, fs, '2026-11-16', {})[4], proxima = blocosDaSemana(c, fs, '2026-11-23', {})[4];
    expect(sexta.reduce((s, b) => s + b.min, 0)).toBe(proxima.reduce((s, b) => s + b.min, 0));
    const t = treinoDoDia(c, '2026-11-20');
    expect(t.km).toBe(2); expect(t.tipo).toBe('leve'); expect(t.fase.n).toBe(1);
    expect(nivelOracao(c, {}, '2026-11-20')).toBe(1);
    expect(oracoesDoDia(c, '2026-11-20').map((o) => o.id)).toEqual(expect.arrayContaining(['manha', 'terco1', 'noite']));
  });
  it('prazos: nada nasce atrasado e a Fase 0 começa em 20/11', () => {
    const c = cfg(), p = planoPrazos(c, gerarFases(c));
    const todos = Object.values(p.porMateria).flat();
    expect(todos.every((i) => i.inicio >= '2026-11-20' && i.prazo >= '2026-11-20')).toBe(true);
    expect(p.porMateria['Matemática'][0].inicio).toBe('2026-11-20');
    for (const dia of ['2026-11-19', '2026-11-20']) { const r = ritmo(p, {}, dia); expect(r.atraso).toBe(0); expect(r.previstos).toBe(0); expect(r.alerta).toBe(false); }
  });
  it('sequência: dias antes do início não quebram nem contam', () => {
    const c = cfg();
    expect(sequencia(c, {}, '2026-11-19')).toBe(0);
    const cumpridos = { '2026-11-20': true }, treinos = { '2026-11-20': { feito: true } }, oracoes = { '2026-11-20': { manha: true, noite: true } };
    expect(sequencia(c, { cumpridos, treinos, oracoes }, '2026-11-20')).toBe(1);
    expect(sequencia(c, { cumpridos, treinos, oracoes }, '2026-11-21')).toBe(1); // hoje ainda incompleto: vale até ontem
  });
});

describe('acordar amanhã', () => {
  it('noite de 19/11 (quinta): sexta 20/11, acordar 05:00, dormir 22:00', () => {
    const a = acordarAmanha(cfg(), '2026-11-19');
    expect(a).toMatchObject({ dia: '2026-11-20', acordar: '05:00', dormir: '22:00', linha: 'Amanhã (sexta): acordar às 05:00' });
  });
  it('sexta à noite: sábado 06:30 (padrão da sexta)', () => {
    expect(acordarAmanha(cfg(), '2026-11-20').linha).toBe('Amanhã (sábado): acordar às 06:30');
  });
  it('texto por tom', () => {
    expect(textoAcordar('sargento', '05:00', '22:00')).toEqual({ titulo: 'Sargento', corpo: 'Amanhã: de pé às 05:00. Cama às 22:00. Sem desculpa.' });
    expect(textoAcordar('padrao', '05:00', '22:00').corpo).toMatch(/acorda às 05:00.*22:00/);
  });
  it('janela: a partir das 19h e antes de dormir', () => {
    expect(naJanelaAcordar(min(18, 59), '22:00')).toBe(false); expect(naJanelaAcordar(min(19), '22:00')).toBe(true);
    expect(naJanelaAcordar(min(21, 59), '22:00')).toBe(true); expect(naJanelaAcordar(min(22), '22:00')).toBe(false);
    expect(naJanelaAcordar(min(23), '01:00')).toBe(true); // dormir depois da meia-noite
  });
  it('decidirAcordar: 1 por noite, vale na noite antes do início, usa o tom', () => {
    const c = cfg();
    const resumo = resumoDoDia({ dia: '2026-11-19', blocos: [], dormir: '22:00', acordar: '05:00', livre: true, acordarAmanha: acordarAmanha(c, '2026-11-19') });
    expect(resumo.acordarAmanha.acordar).toBe('05:00');
    const av = decidirAcordar({ resumo, agora: min(20, 30), tom: 'sargento' });
    expect(av.chave).toBe('2026-11-19:acordar'); expect(av.corpo).toBe('Amanhã: de pé às 05:00. Cama às 22:00. Sem desculpa.');
    expect(decidirAcordar({ resumo, agora: min(20, 30), notificados: { '2026-11-19:acordar': 1 } })).toBe(null);
    expect(decidirAcordar({ resumo, agora: min(10) })).toBe(null); expect(decidirAcordar({ resumo, agora: min(22, 30) })).toBe(null);
    expect(decidirAcordar({ resumo: { ...resumo, acordarAmanha: null }, agora: min(20) })).toBe(null);
    expect(decidirAcordar({ resumo, agora: min(20), tom: 'padrao' }).titulo).toBe('Estuda Gabriel');
  });
});
