import { describe, it, expect } from 'vitest';
import seed from '../src/data/seed.json';
import { gerarFases, faseDoDia, revisaoLeve } from '../src/lib/phases.js';
import { agendarRevisoes, vencidas } from '../src/lib/spaced.js';
import { idadeOk } from '../src/lib/age.js';
import { blocosDoDia } from '../src/lib/planner.js';
import { addDays, weekday } from '../src/lib/dates.js';

const cfg = () => structuredClone(seed);

describe('fases', () => {
  it('geram 5 fases contíguas sem sobreposição', () => {
    const f = gerarFases(cfg());
    expect(f.map((x) => x.id)).toEqual(['base', 'desenvolvimento', 'efomm', 'en', 'final']);
    for (let i = 1; i < f.length; i++) expect(f[i].inicio).toBe(addDays(f[i - 1].fim, 1));
    expect(f[0].inicio).toBe('2026-11-10');
  });
  it('específica EFOMM começa 7 semanas antes da prova', () => {
    expect(gerarFases(cfg()).find((x) => x.id === 'efomm').inicio).toBe('2027-06-06');
  });
  it('mudar a data da prova reajusta as fases', () => {
    const c = cfg();
    c.concursos.find((x) => x.id === 'efomm').eventos.find((e) => e.tipo === 'prova').inicio = '2027-08-01';
    c.concursos.find((x) => x.id === 'efomm').eventos.find((e) => e.tipo === 'prova').fim = '2027-08-02';
    expect(gerarFases(c).find((x) => x.id === 'efomm').inicio).toBe('2027-06-13');
  });
  it('hoje está na fase Base', () => expect(faseDoDia(gerarFases(cfg()), '2026-11-10').id).toBe('base'));
  it('semana antes da prova é revisão leve', () => {
    expect(revisaoLeve(cfg(), '2027-07-20')?.id).toBe('efomm');
    expect(revisaoLeve(cfg(), '2027-03-10')).toBeNull();
  });
});

describe('revisões espaçadas', () => {
  it('agenda 1, 7 e 30 dias', () => {
    const r = agendarRevisoes({ origem: 'x', assunto: 'a', materia: 'm', dia: '2026-11-10' });
    expect(r.map((x) => x.due)).toEqual(['2026-11-11', '2026-11-17', '2026-12-10']);
    expect(vencidas(r, '2026-11-17')).toHaveLength(2);
  });
});

describe('idade', () => {
  it('2027 vale para EN, 2028 não; ITA vale até a prova de 2028', () => {
    const [en, , , ita] = cfg().concursos;
    const n = '2005-11-25';
    expect(idadeOk(n, en.idade, 2027).ok).toBe(true);
    expect(idadeOk(n, en.idade, 2028).ok).toBe(false);
    expect(idadeOk(n, ita.idade, 2028).ok).toBe(true);
    expect(idadeOk(n, ita.idade, 2029).ok).toBe(false);
  });
});

describe('planner', () => {
  it('semana diagnóstica usa os blocos detalhados', () => {
    const f = gerarFases(cfg());
    const b = blocosDoDia(cfg(), f, '2026-11-10');
    expect(b[0].onde.length).toBeGreaterThan(0);
  });
  it('português e inglês alternam por dia', () => {
    const f = gerarFases(cfg()); const c = cfg();
    const dias = ['2026-11-23', '2026-11-24', '2026-11-26', '2026-11-27'];
    const l = dias.map((d) => blocosDoDia(c, f, d).find((b) => b.chave === 'lingua').materia);
    expect(l).toEqual(['Português', 'Inglês', 'Português', 'Inglês']);
  });
  it('dia útil soma 4h e quarta 2h', () => {
    const f = gerarFases(cfg()); const c = cfg();
    const soma = (d) => blocosDoDia(c, f, d).reduce((s, b) => s + b.min, 0);
    expect(soma('2026-11-23')).toBe(250);
    expect(soma('2026-11-25')).toBe(120);
    expect(weekday('2026-11-25')).toBe(3);
  });
});

import { alertasInscricao, marcos } from '../src/lib/alerts.js';
describe('alertas', () => {
  it('avisa inscrições que fecham em até 14 dias', () => {
    const a = alertasInscricao(cfg(), '2027-05-25'); // EFOMM fecha 02/06 (8 dias)
    expect(a.find((x) => x.concurso.id === 'efomm').dias).toBe(8);
    expect(alertasInscricao(cfg(), '2026-11-10')).toHaveLength(0);
  });
  it('marcos vêm em ordem', () => {
    const m = marcos(cfg()).map((x) => x.data);
    expect(m).toEqual([...m].sort());
  });
});

import { gerarICS } from '../src/lib/ics.js';
import { validar } from '../src/lib/backup.js';
describe('ics e backup', () => {
  it('gera VEVENTs e alarmes 14/7/1', () => {
    const s = gerarICS(cfg());
    expect((s.match(/BEGIN:VEVENT/g) ?? []).length).toBe(10);
    expect(s).toContain('TRIGGER:-P14D'); expect(s).toContain('TRIGGER:-P1D');
    expect(s).toContain('DTEND;VALUE=DATE:20270606'); // fim exclusivo
  });
  it('valida backup', () => {
    expect(() => validar('xx')).toThrow();
    expect(() => validar('{"versao":1,"cfg":{},"done":{}}')).toThrow();
    expect(validar(JSON.stringify({ versao: 1, cfg: cfg(), done: {} })).cfg.concursos.length).toBe(4);
  });
});
