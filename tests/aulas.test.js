import { describe, it, expect } from 'vitest';
import seed from '../src/data/seed.json';
import { migrarCfg } from '../src/lib/migracao.js';
import { videoDe, aulasDe, buscasDoTopico } from '../src/lib/tarefas.js';
import { portaoZero, regrasPortao } from '../src/lib/portao.js';

const cfg = () => structuredClone(seed);
const CANAIS = ['Universo Narrado', 'Universo Narrado Militares', 'Pedro Assaad'];

describe('aulas indicadas por tópico (v16)', () => {
  it('só Matemática e Física, com canal conhecido, título e link https (YouTube ou Plataforma Assaad)', () => {
    let n = 0;
    for (const [m, ts] of Object.entries(seed.topicos)) for (const t of ts) for (const a of t.aulas ?? []) {
      n++;
      expect(['Matemática', 'Física'], t.codigo).toContain(m);
      expect(CANAIS, t.codigo).toContain(a.canal);
      expect(a.titulo.trim().length, t.codigo).toBeGreaterThan(3);
      expect(new URL(a.url).hostname, a.url).toMatch(/^(www\.youtube\.com|plataformaassaad\.com\.br)$/);
      if (a.canal === 'Pedro Assaad') expect(a.url).toMatch(/^https:\/\/plataformaassaad\.com\.br\/assaadflix-catalogo\/[a-z0-9-]+\/$/);
    }
    expect(n).toBeGreaterThan(150);
  });
  it('a base (Fase 0) de Matemática e Física tem aula indicada em quase todo tópico', () => {
    for (const m of ['Matemática', 'Física']) {
      const base = seed.topicos[m].filter((t) => t.fase === 0);
      expect(base.filter((t) => t.aulas?.length).length / base.length, m).toBeGreaterThanOrEqual(0.7);
    }
  });
  it('o vídeo do bloco é a 1ª aula indicada; o link que você cola continua na frente', () => {
    const c = cfg(), a = aulasDe(c, 'Matemática', 'Frações e equações');
    expect(a.length).toBeGreaterThan(1);
    expect(videoDe(c, 'Matemática', 'Frações e equações')).toMatchObject({ url: a[0].url, origem: 'aula' });
    c.questoesLinks = { Matemática: { 'Frações e equações': { video: 'https://v/meu' } } };
    expect(videoDe(c, 'Matemática', 'Frações e equações')).toMatchObject({ url: 'https://v/meu', origem: 'topico' });
  });
  it('busca nos canais: Universo Narrado, Universo Militares e Pedro Assaad (Química fica na busca geral)', () => {
    const r = buscasDoTopico('Física', 'MU').video.map((x) => x.rotulo);
    expect(r).toEqual(['Universo Narrado: buscar no canal', 'Universo Narrado Militares: buscar no canal', 'Pedro Assaad: buscar no YouTube']);
    expect(buscasDoTopico('Química', 'Mol').video.at(-1).rotulo).toBe('YouTube: aulas deste tópico');
  });
});

describe('migração v16: sem Khan Academy', () => {
  it('tira os recursos e os links colados do Khan e mantém o resto do que você editou', () => {
    const s = cfg(); s.versaoSeed = 15;
    s.biblioteca.recursos.push({ id: 'khan-mat', tipo: 'site', materia: 'Matemática', titulo: 'Khan', link: 'https://pt.khanacademy.org/math/brazil-math-grades' },
      { id: 'meu', tipo: 'video', materia: 'Física', titulo: 'Minha playlist', link: 'https://www.youtube.com/playlist?list=X' });
    s.biblioteca.vinculos.push({ id: 'khan-mat|MMC', recurso: 'khan-mat', materia: 'Matemática', topico: 'Divisibilidade, MMC e MDC' });
    s.questoesLinks = { Matemática: { 'Frações e equações': { khan: 'https://pt.khanacademy.org/x', obmep: 'https://o/x' } } };
    s.carta = 'minha';
    const m = migrarCfg(s, seed);
    expect(m.biblioteca.recursos.some((r) => /khanacademy/.test(r.link ?? ''))).toBe(false);
    expect(m.biblioteca.recursos.some((r) => r.id === 'meu')).toBe(true);
    expect(m.biblioteca.vinculos.some((v) => v.recurso === 'khan-mat')).toBe(false);
    expect(m.questoesLinks.Matemática['Frações e equações']).toEqual({ obmep: 'https://o/x' });
    expect(m.sitesQuestoes.some((x) => x.id === 'khan')).toBe(false);
    expect(m.carta).toBe('minha');
    expect(JSON.stringify(m.fase0)).not.toMatch(/khan/i);
  });
  it('portão: teste de saída da base; o resultado antigo salvo como "khan" continua valendo', () => {
    expect(regrasPortao(seed).testeMin).toBe(80);
    expect(regrasPortao({ fase0: { portao: { khanMin: 70 } } }).testeMin).toBe(70);
    const p1 = portaoZero(cfg(), { teste: { pct: 85 } }, {}), p2 = portaoZero(cfg(), { khan: { pct: 85 } }, {});
    expect(p1.teste).toMatchObject({ valor: 85, ok: true }); expect(p2.teste).toMatchObject({ valor: 85, ok: true });
  });
});
