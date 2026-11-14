import { describe, it, expect } from 'vitest';
import seed from '../src/data/seed.json';
import { gerarFases } from '../src/lib/phases.js';
import { blocosDoDia, blocosAjustados } from '../src/lib/planner.js';
import { tarefasDoDia } from '../src/lib/tarefas.js';
import { migrarCfg } from '../src/lib/migracao.js';
import { migrarLacunas } from '../src/lib/trilha.js';

const cfg = () => structuredClone(seed);
const DIA = '2026-11-17'; // terça-feira da semana 1 da Fase 0
const fases = gerarFases(cfg());
const zeroDe = (c, m) => c.topicos[m].filter((t) => t.fase === 0);
const dominarZero = (c, materias = c.materias.filter((m) => c.topicos?.[m])) =>
  Object.fromEntries(materias.map((m) => [m, Object.fromEntries(zeroDe(c, m).map((t) => [t.nome, 3]))]));
const reg = (n, acertos, feitas = 10) => ({ feitas, acertos, data: `2026-11-${10 + n}` });
const falhas = (n) => ({ regs: Object.fromEntries(Array.from({ length: n }, (_, i) => [`b${i}`, reg(i, 5)])) });
/** Tarefa do primeiro bloco de Matemática do dia, na Fase 0. */
const tarefaMat = (c, ctx = {}, bls = blocosAjustados(c, fases, DIA, {})) => {
  const b = bls.find((x) => x.cat === 'mat');
  return tarefasDoDia(c, bls, { lacunas: {}, faseId: 'zero', ...ctx })[b.id];
};

describe('Fase 0: integridade do seed', () => {
  const c = cfg();
  const porSemana = (m) => {
    const o = {};
    for (const t of zeroDe(c, m)) o[t.sem] = (o[t.sem] ?? 0) + 1;
    return o;
  };
  it('todo tópico da Fase 0 tem semana inteira; nomes únicos por matéria', () => {
    for (const m of Object.keys(c.topicos)) {
      const nomes = c.topicos[m].map((t) => t.nome);
      expect(new Set(nomes).size, `${m}: nomes repetidos`).toBe(nomes.length);
      for (const t of zeroDe(c, m)) expect(Number.isInteger(t.sem) && t.sem >= 1 && t.sem <= 8, `${m} / ${t.nome}`).toBe(true);
    }
  });
  it('Fase 0 vem antes dos tópicos do ensino médio em cada matéria', () => {
    for (const m of Object.keys(c.topicos)) {
      const l = c.topicos[m];
      const ultimoZero = l.findLastIndex((t) => t.fase === 0), primeiroOutro = l.findIndex((t) => t.fase !== 0);
      if (ultimoZero >= 0 && primeiroOutro >= 0) expect(ultimoZero, m).toBeLessThan(primeiroOutro);
    }
  });
  it('Matemática, Física e Química têm tópicos nas semanas 1 a 7', () => {
    for (const m of ['Matemática', 'Física', 'Química']) {
      const p = porSemana(m);
      for (let s = 1; s <= 7; s++) expect(p[s], `${m} semana ${s}`).toBeGreaterThan(0);
    }
  });
  it('quantidade por semana: Matemática >= 12, Física 5 ou 6, Química 3', () => {
    for (let s = 1; s <= 7; s++) {
      expect(porSemana('Matemática')[s], `Matemática s${s}`).toBeGreaterThanOrEqual(12);
      expect([5, 6], `Física s${s}`).toContain(porSemana('Física')[s]);
      expect(porSemana('Química')[s], `Química s${s}`).toBe(3);
    }
  });
  it('Português tem 8 tópicos (semanas 1 a 8) e Inglês 4', () => {
    expect(zeroDe(c, 'Português')).toHaveLength(8);
    expect(zeroDe(c, 'Português').map((t) => t.sem).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(zeroDe(c, 'Inglês')).toHaveLength(4);
  });
  it('cfg.fase0.semanas tem 8 itens numerados de 1 a 8', () => {
    expect(c.fase0.semanas).toHaveLength(8);
    expect(c.fase0.semanas.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('Fase 0: tarefa do dia', () => {
  it('o primeiro bloco de Matemática pega o primeiro tópico da trilha', () => {
    const t = tarefaMat(cfg());
    expect(t.topico).toBe('Números inteiros: adição e subtração');
    expect(t.zero).toBe(true);
    expect(blocosDoDia(cfg(), fases, DIA).some((b) => b.cat === 'mat')).toBe(true);
  });
  it('mínimo de 10 exercícios e vídeo de no máximo 20 minutos', () => {
    const c = cfg();
    const bls = blocosAjustados(c, fases, DIA, {});
    const ts = tarefasDoDia(c, bls, { lacunas: {}, faseId: 'zero' });
    const lista = Object.values(ts).filter((t) => t.questoes);
    expect(lista.length).toBeGreaterThan(0);
    for (const t of lista) {
      expect(t.questoes.n, t.materia).toBeGreaterThanOrEqual(10);
      if (t.video) expect(t.video.min, t.materia).toBeLessThanOrEqual(20);
    }
    expect(lista.some((t) => t.video)).toBe(true);
  });
  it('o mínimo de 10 vale mesmo num bloco curto', () => {
    const c = cfg();
    const t = tarefasDoDia(c, [{ id: `${DIA}:mat@0700`, cat: 'mat', materia: 'Matemática', min: 30 }], { lacunas: {}, faseId: 'zero' })[`${DIA}:mat@0700`];
    expect(t.questoes.n).toBeGreaterThanOrEqual(10);
  });
  it('fontes: Khan e OBMEP em vez de QConcursos e Estuda.com, mesmo com links colados', () => {
    const c = cfg();
    const topico = 'Números inteiros: adição e subtração';
    c.questoesLinks = { Matemática: { [topico]: { khan: 'https://k/x', obmep: 'https://o/x', qconcursos: 'https://qc/x', estuda: 'https://es/x' } } };
    const t = tarefaMat(c);
    expect(t.questoes.fontes.map((f) => f.site)).toEqual(['khan', 'obmep']);
    expect(t.questoes.fontes.every((f) => !f.curso)).toBe(true);
    expect(t.questoes.cotaEsgotada).toBe(false);
    for (const t2 of Object.values(tarefasDoDia(c, blocosAjustados(c, fases, DIA, {}), { lacunas: {}, faseId: 'zero' })))
      for (const f of t2.questoes?.fontes ?? []) expect(['qconcursos', 'estuda']).not.toContain(f.site);
  });
  it('sem links colados cai nos exercícios do curso (cfg.fase0.exercicios) com curso:true', () => {
    const c = cfg();
    const t = tarefaMat(c);
    const esperado = c.fase0.exercicios.Matemática;
    expect(esperado.length).toBeGreaterThan(0);
    expect(t.questoes.fontes.map((f) => f.url)).toEqual(esperado.map((r) => r.url));
    expect(t.questoes.fontes.every((f) => f.curso === true)).toBe(true);
    expect(t.questoes.semLinks).toBe(false);
    expect(t.questoes.fontes.some((f) => ['qconcursos', 'estuda'].includes(f.site))).toBe(false);
  });
  it('fora da Fase 0 (faseId base) as fontes continuam sendo QConcursos e Estuda.com', () => {
    const c = cfg();
    c.questoesLinks = { Matemática: { 'Conjuntos, lógica e funções': { qconcursos: 'https://qc/x', khan: 'https://k/x' } } };
    const bls = blocosAjustados(c, fases, DIA, {});
    const b = bls.find((x) => x.cat === 'mat');
    const t = tarefasDoDia(c, bls, { lacunas: dominarZero(c), faseId: 'base' })[b.id];
    expect(t.zero).toBeFalsy();
    expect(t.topico).toBe('Conjuntos, lógica e funções');
    expect(t.questoes.fontes.map((f) => f.site)).toEqual(['qconcursos']);
  });
});

describe('Fase 0: repetição até dominar', () => {
  const T1 = 'Números inteiros: adição e subtração', T2 = 'Números inteiros: multiplicação e divisão';
  it('uma tentativa que falhou: o bloco repete o MESMO tópico como tentativa 2', () => {
    const c = cfg();
    const t = tarefaMat(c, { dominio: { [`Matemática|${T1}`]: falhas(1) } });
    expect(t.topico).toBe(T1);
    expect(t.repeticao).toBe(true);
    expect(t.tentativa).toBe(2);
  });
  it('sem tentativas, a tarefa não é repetição e é a tentativa 1', () => {
    const t = tarefaMat(cfg());
    expect(t.repeticao).toBe(false); expect(t.tentativa).toBe(1);
  });
  it('três falhas travam o tópico e o bloco passa para o próximo', () => {
    const t = tarefaMat(cfg(), { dominio: { [`Matemática|${T1}`]: falhas(3) } });
    expect(t.topico).toBe(T2);
    expect(t.repeticao).toBe(false);
  });
  it('menos de 10 exercícios não conta como tentativa', () => {
    const c = cfg();
    const estado = { regs: { a: reg(0, 2, 4) } };
    const t = tarefaMat(c, { dominio: { [`Matemática|${T1}`]: estado } });
    expect(t.topico).toBe(T1); expect(t.repeticao).toBe(false);
  });
  it('com todos os tópicos de Matemática da Fase 0 dominados, o bloco faz reforço em tópico da Fase 0', () => {
    const c = cfg();
    const t = tarefaMat(c, { lacunas: dominarZero(c, ['Matemática']) });
    expect(t.semTopico).toBeUndefined();
    expect(zeroDe(c, 'Matemática').map((x) => x.nome)).toContain(t.topico);
    expect(t.topico).not.toBe('Conjuntos, lógica e funções');
  });
  it('o reforço escolhe o tópico de pior acerto', () => {
    const c = cfg();
    const alvo = zeroDe(c, 'Matemática')[5].nome;
    const done = {
      x: { materia: 'Matemática', topico: zeroDe(c, 'Matemática')[0].nome, questoes: { feitas: 10, acertos: 9 } },
      y: { materia: 'Matemática', topico: alvo, questoes: { feitas: 10, acertos: 3 } },
    };
    const t = tarefaMat(c, { lacunas: dominarZero(c, ['Matemática']), done });
    expect(t.topico).toBe(alvo);
  });
});

describe('Fase 0: migração', () => {
  it('cfg antiga (seed 7) ganha tópicos da Fase 0, cfg.fase0 e a divisão do bloco; lacunas antigas não quebram', () => {
    const velho = cfg();
    velho.versaoSeed = 7;
    delete velho.fase0; delete velho.divisaoBlocoZero;
    velho.topicos = { Matemática: [{ nome: 'Matemática básica (aritmética e álgebra)' }, { nome: 'Funções' }], Física: [{ nome: 'Cinemática' }] };
    const novo = migrarCfg(velho, cfg());
    expect(novo.versaoSeed).toBe(seed.versaoSeed);
    expect(novo.topicos.Matemática.some((t) => t.fase === 0)).toBe(true);
    expect(novo.topicos.Matemática[0]).toMatchObject({ fase: 0, sem: 1 });
    expect(novo.fase0.semanas).toHaveLength(8);
    expect(novo.divisaoBlocoZero).toEqual(seed.divisaoBlocoZero);
    const lacunas = { Matemática: { 'Matemática básica (aritmética e álgebra)': 3, Funções: 2, 'Logaritmos e exponenciais': 1 }, Física: { Cinemática: 2 } };
    const l = migrarLacunas(lacunas, novo.topicos);
    expect(l.Matemática['Conjuntos, lógica e funções']).toBe(1);
    expect(tarefaMat(novo, { lacunas: l })).toBeTruthy();
  });
});
