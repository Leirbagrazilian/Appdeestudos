import { describe, it, expect } from 'vitest';
import seed from '../src/data/seed.json';
import { contextoFrase, escolherFrase, fraseDoDia } from '../src/lib/frases.js';

describe('frases', () => {
  it('o seed traz pelo menos 60 frases, sem repetição, em todos os contextos', () => {
    const todas = Object.values(seed.frases).flat();
    expect(todas.length).toBeGreaterThanOrEqual(60);
    expect(new Set(todas).size).toBe(todas.length);
    for (const c of ['inicio', 'bloco', 'dificil', 'domingo', 'noite', 'prova', 'cumprido']) expect(seed.frases[c].length).toBeGreaterThanOrEqual(5);
  });
  it('contexto: prioridade noite > cumprido > difícil > bloco > prova > domingo > início', () => {
    expect(contextoFrase({ hora: 23, pct: 1 })).toBe('noite');
    expect(contextoFrase({ hora: 2 })).toBe('noite');
    expect(contextoFrase({ hora: 20, pct: 1, dificil: true })).toBe('cumprido');
    expect(contextoFrase({ dificil: true, feitos: 2 })).toBe('dificil');
    expect(contextoFrase({ feitos: 1, diasProva: 3 })).toBe('bloco');
    expect(contextoFrase({ diasProva: 14, diaSemana: 0 })).toBe('prova');
    expect(contextoFrase({ diasProva: 15, diaSemana: 0 })).toBe('domingo');
    expect(contextoFrase({ hora: 7 })).toBe('inicio');
    expect(contextoFrase()).toBe('inicio');
  });
  it('a escolha é determinística no dia e varia entre dias', () => {
    const a = escolherFrase(seed.frases, 'inicio', '2026-11-16');
    expect(escolherFrase(seed.frases, 'inicio', '2026-11-16')).toBe(a);
    expect(seed.frases.inicio).toContain(a);
    const dias = Array.from({ length: 30 }, (_, i) => `2026-12-${String(i + 1).padStart(2, '0')}`);
    expect(new Set(dias.map((d) => escolherFrase(seed.frases, 'inicio', d))).size).toBeGreaterThan(5);
  });
  it('depois de cada bloco a frase muda; contexto vazio cai no início; sem banco devolve vazio', () => {
    const e = { hora: 10, feitos: 1 };
    const f1 = fraseDoDia(seed.frases, e, '2026-11-16'), f2 = fraseDoDia(seed.frases, { ...e, feitos: 2 }, '2026-11-16');
    expect(seed.frases.bloco).toContain(f1); expect(f2).not.toBe(f1);
    expect(fraseDoDia(seed.frases, { hora: 23 }, '2026-11-16')).toBe(fraseDoDia(seed.frases, { hora: 22, feitos: 3 }, '2026-11-16'));
    expect(escolherFrase({ inicio: ['x'], noite: [] }, 'noite', '2026-11-16')).toBe('x');
    expect(escolherFrase(undefined, 'inicio', '2026-11-16')).toBe('');
  });
});
