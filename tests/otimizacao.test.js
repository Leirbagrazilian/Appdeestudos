import { describe, it, expect } from 'vitest';
import seed from '../src/data/seed.json';
import { gerarFases } from '../src/lib/phases.js';
import { blocosAjustados, blocosDaSemana } from '../src/lib/planner.js';
import { tarefasDoDia, buscasDoTopico, videoDe, linksDoBloco, urlYouTube, urlKhan, MATERIAS_BUSCA } from '../src/lib/tarefas.js';
import { fichaDoTopico } from '../src/lib/erros.js';
import { resumoSemana } from '../src/lib/revisao.js';
import { addDays } from '../src/lib/dates.js';

const cfg = () => structuredClone(seed);
const fases = gerarFases(cfg());
const DIA = '2026-11-17'; // terça-feira da semana 1 da Fase 0
const urlOk = (u) => /^https:\/\/\S+$/.test(u) && !!new URL(u).hostname.includes('.');

describe('integridade do seed: links e ids', () => {
  // todo texto do seed que é um endereço (começa com http ou está num campo url/link)
  const urls = [];
  (function andar(v, chave, caminho) {
    if (typeof v === 'string') { if (/^\s*https?:/i.test(v) || (['url', 'link'].includes(chave) && v !== '')) urls.push([caminho, v]); }
    else if (Array.isArray(v)) v.forEach((x, i) => andar(x, chave, `${caminho}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) andar(x, k, `${caminho}.${k}`);
  })(seed, '', 'seed');

  it('toda URL começa com https://, sem espaços, e é um endereço válido', () => {
    expect(urls.length).toBeGreaterThan(20);
    for (const [onde, u] of urls) expect(urlOk(u), `${onde}: ${u}`).toBe(true);
  });
  it('sem ids duplicados nem ids com espaço nas pontas', () => {
    const listas = { concursos: seed.concursos, recursos: seed.biblioteca.recursos, vinculos: seed.biblioteca.vinculos, sitesQuestoes: seed.sitesQuestoes, questoes: seed.questoes };
    for (const [nome, lista] of Object.entries(listas)) {
      const ids = lista.map((x) => x.id);
      expect(new Set(ids).size, `ids repetidos em ${nome}`).toBe(ids.length);
      for (const id of ids) { expect(typeof id).toBe('string'); expect(id, nome).toBe(id.trim()); expect(id.length).toBeGreaterThan(0); }
    }
    for (const id of [...seed.concursos, ...seed.biblioteca.recursos, ...seed.sitesQuestoes, ...seed.questoes].map((x) => x.id)) expect(id).not.toMatch(/\s/);
  });
  it('tópicos: nomes únicos por matéria, sem espaços sobrando', () => {
    for (const [m, lista] of Object.entries(seed.topicos)) {
      const nomes = lista.map((t) => t.nome);
      expect(new Set(nomes).size, m).toBe(nomes.length);
      for (const n of nomes) { expect(n).toBe(n.trim()); expect(n).not.toMatch(/\s{2,}/); }
    }
  });
  it('recursos: situação do link coerente; vínculos apontam para recurso e tópico que existem', () => {
    const ids = new Set(seed.biblioteca.recursos.map((r) => r.id));
    for (const r of seed.biblioteca.recursos) {
      expect(['visto na busca', 'a confirmar'], r.id).toContain(r.linkStatus);
      if (!r.link) expect(r.linkStatus, r.id).toBe('a confirmar'); // sem link não pode constar como visto
    }
    for (const v of seed.biblioteca.vinculos) {
      expect(ids.has(v.recurso), v.id).toBe(true);
      expect(seed.topicos[v.materia]?.some((t) => t.nome === v.topico), v.id).toBe(true);
    }
  });
  it('Fase 0: Matemática, Física e Química têm lista de exercícios direta (não a página inicial do Khan)', () => {
    for (const m of MATERIAS_BUSCA) {
      const l = seed.fase0.exercicios[m];
      expect(l.length, m).toBeGreaterThan(0);
      for (const r of l) { expect(urlOk(r.url)).toBe(true); expect(new URL(r.url).pathname === '/' && r.site === 'khan', r.url).toBe(false); expect(r.rotulo.trim().length).toBeGreaterThan(3); }
    }
  });
});

describe('busca automática por tópico', () => {
  it('todo tópico da Fase 0 de Matemática, Física e Química ganha buscas válidas (YouTube e Khan)', () => {
    let n = 0;
    for (const m of MATERIAS_BUSCA) for (const t of seed.topicos[m].filter((x) => x.fase === 0)) {
      const b = buscasDoTopico(m, t.nome); n++;
      expect(b.video.length).toBeGreaterThan(0); expect(b.exercicios.length).toBeGreaterThan(0);
      for (const f of [...b.video, ...b.exercicios]) { expect(urlOk(f.url), f.url).toBe(true); expect(f.auto).toBe(true); expect(f.rotulo).toBeTruthy(); }
      expect(b.video[0].url.startsWith('https://www.youtube.com/results?search_query=')).toBe(true);
      expect(b.exercicios[0].url.startsWith('https://pt.khanacademy.org/search?page_search_query=')).toBe(true);
    }
    expect(n).toBeGreaterThan(100);
  });
  it('a consulta leva o nome do tópico, codificada (acentos, dois-pontos, sinais)', () => {
    expect(urlYouTube('Frações: soma  e subtração')).toBe('https://www.youtube.com/results?search_query=Fra%C3%A7%C3%B5es%3A+soma+e+subtra%C3%A7%C3%A3o');
    expect(urlKhan('MMC & MDC')).toBe('https://pt.khanacademy.org/search?page_search_query=MMC+%26+MDC');
    const b = buscasDoTopico('Física', 'Movimento uniforme (MU): gráficos');
    expect(new URL(b.video[0].url).searchParams.get('search_query')).toBe('Movimento uniforme (MU): gráficos Física aula');
    expect(new URL(b.video[1].url).searchParams.get('search_query')).toMatch(/Física Total/);
    expect(new URL(b.exercicios[0].url).searchParams.get('page_search_query')).toBe('Movimento uniforme gráficos');
  });
  it('outras matérias e tópico vazio não geram busca', () => {
    expect(buscasDoTopico('Português', 'Crase')).toEqual({ video: [], exercicios: [] });
    expect(buscasDoTopico('Matemática', '  ')).toEqual({ video: [], exercicios: [] });
  });

  const blocoDe = (c, cat, ctx = {}) => {
    const bls = blocosAjustados(c, fases, DIA, {});
    return tarefasDoDia(c, bls, { lacunas: {}, faseId: 'zero', ...ctx })[bls.find((x) => x.cat === cat).id];
  };
  it('bloco da Fase 0 sem link colado: buscas no vídeo e nos exercícios, sem mexer nas fontes do curso', () => {
    for (const [cat, m] of [['mat', 'Matemática'], ['fis', 'Física']]) {
      const c = cfg(), t = blocoDe(c, cat);
      expect(t.materia).toBe(m);
      expect(t.questoes.fontes.map((f) => f.url)).toEqual(c.fase0.exercicios[m].map((r) => r.url));
      expect(t.questoes.buscas).toEqual(buscasDoTopico(m, t.topico).exercicios);
      expect(t.video.buscas).toEqual(buscasDoTopico(m, t.topico).video);
    }
  });
  it('quando você cola o link do tópico, a busca automática daquele passo some', () => {
    const c = cfg(), topico = blocoDe(c, 'mat').topico;
    c.questoesLinks = { Matemática: { [topico]: { khan: 'https://k/x', video: 'https://v/x' } } };
    const t = blocoDe(c, 'mat');
    expect(t.questoes.buscas).toEqual([]);
    expect(t.video).toMatchObject({ url: 'https://v/x', origem: 'topico', buscas: [] });
  });
  it('fora da Fase 0 não há busca de exercícios (as questões são de concurso)', () => {
    const c = cfg(), bls = blocosAjustados(c, fases, DIA, {});
    const t = tarefasDoDia(c, bls, { lacunas: {}, faseId: 'base' })[bls.find((x) => x.cat === 'mat').id];
    expect(t.questoes.buscas).toEqual([]);
    expect(t.video.buscas.length).toBeGreaterThan(0);
  });
  it('matéria sem vídeo cadastrado cai na busca do YouTube; outras matérias continuam sem vídeo', () => {
    const c = cfg(); c.biblioteca.recursos = c.biblioteca.recursos.filter((r) => r.tipo === 'livro'); c.links = {};
    expect(videoDe(c, 'Química', 'Mol e massa molar')).toMatchObject({ origem: 'busca', auto: true, url: buscasDoTopico('Química', 'Mol e massa molar').video[0].url });
    expect(videoDe(c, 'Hist/Geo', 'Brasil Colônia')).toBe(null);
    expect(videoDe(cfg(), 'Matemática', 'MMC').origem).toBe('recurso'); // o recurso cadastrado continua na frente
  });
});

describe('abrir tudo do bloco', () => {
  it('vídeo + primeira lista disponível, sem repetir e pulando cota esgotada', () => {
    const t = { video: { url: 'https://v/1' }, questoes: { fontes: [{ rotulo: 'QC', url: 'https://q/1', esgotada: true }, { rotulo: 'PDF', url: 'https://p/1', esgotada: false }], buscas: [] } };
    expect(linksDoBloco(t)).toEqual([{ rotulo: 'Vídeo', url: 'https://v/1' }, { rotulo: 'PDF', url: 'https://p/1' }]);
    expect(linksDoBloco({ video: { url: 'https://x/1' }, questoes: { fontes: [{ rotulo: 'A', url: 'https://x/1', esgotada: false }] } })).toHaveLength(1);
  });
  it('sem link colado: prefere a busca do tópico ao curso inteiro; sem nada, o curso', () => {
    const curso = { rotulo: 'Curso', url: 'https://c/1', esgotada: false, curso: true };
    expect(linksDoBloco({ video: null, questoes: { fontes: [curso], buscas: [{ rotulo: 'Khan', url: 'https://k/1' }] } })).toEqual([{ rotulo: 'Khan', url: 'https://k/1' }]);
    expect(linksDoBloco({ video: null, questoes: { fontes: [curso], buscas: [] } })).toEqual([{ rotulo: 'Curso', url: 'https://c/1' }]);
  });
  it('bloco sem tópico ou vazio não tem links', () => {
    expect(linksDoBloco(null)).toEqual([]); expect(linksDoBloco({ semTopico: true })).toEqual([]);
  });
  it('todo bloco de Matemática/Física da Fase 0 tem 2 links https para abrir', () => {
    const c = cfg(), bls = blocosAjustados(c, fases, DIA, {});
    const ts = Object.values(tarefasDoDia(c, bls, { lacunas: {}, faseId: 'zero' })).filter((t) => ['Matemática', 'Física'].includes(t.materia));
    expect(ts.length).toBeGreaterThan(0);
    for (const t of ts) { const l = linksDoBloco(t); expect(l).toHaveLength(2); for (const x of l) expect(urlOk(x.url)).toBe(true); }
  });
});

describe('ficha de revisão rápida do tópico', () => {
  const E = (id, assunto, dia, extra = {}) => ({ id, materia: 'Matemática', assunto, tipo: 'conteudo', licao: '', dia, status: 'novo', ...extra });
  const erros = [
    E('a', 'MMC', '2026-11-10'), E('b', 'mmc ', '2026-11-12', { licao: 'fatorar junto' }), E('c', 'MMC', '2026-11-14', { status: 'dominado' }),
    E('d', 'MMC', '2026-11-16'), E('e', 'MMC', '2026-11-13'), E('f', 'MDC', '2026-11-16'), E('g', 'MMC', '2026-11-17', { materia: 'Física' }),
  ];
  it('os 3 mais recentes do tópico, não dominados primeiro; conta total e abertos', () => {
    const f = fichaDoTopico(erros, 'Matemática', 'MMC');
    expect(f.itens.map((e) => e.id)).toEqual(['d', 'e', 'b']);
    expect(f).toMatchObject({ total: 5, abertos: 4 });
    expect(fichaDoTopico(erros, 'Matemática', 'MMC', 10).itens.map((e) => e.id)).toEqual(['d', 'e', 'b', 'a', 'c']);
  });
  it('casa assunto contido no nome do tópico (e o contrário), sem misturar matérias', () => {
    expect(fichaDoTopico(erros, 'Matemática', 'Problemas com MMC e MDC').total).toBe(6);
    expect(fichaDoTopico([E('x', 'Frações: soma e subtração com denominadores diferentes (erro de sinal)', '2026-11-10')], 'Matemática', 'Frações: soma e subtração com denominadores diferentes').total).toBe(1);
    expect(fichaDoTopico(erros, 'Física', 'MMC').itens.map((e) => e.id)).toEqual(['g']);
  });
  it('sem erros, tópico vazio ou assunto curto demais: ficha vazia', () => {
    expect(fichaDoTopico([], 'Matemática', 'MMC')).toEqual({ total: 0, abertos: 0, itens: [] });
    expect(fichaDoTopico(erros, 'Matemática', '')).toEqual({ total: 0, abertos: 0, itens: [] });
    expect(fichaDoTopico([E('y', 'a', '2026-11-10')], 'Matemática', 'Razão e proporção').total).toBe(0);
    expect(fichaDoTopico(undefined, 'Matemática', 'MMC').total).toBe(0);
  });
});

describe('desempenho: a semana é montada uma vez', () => {
  it('blocosDaSemana devolve o mesmo que blocosAjustados dia a dia (Fase 0, diagnóstica, fases seguintes, reta final)', () => {
    const c = cfg();
    for (const seg of ['2026-11-09', '2026-11-16', '2026-12-28', '2027-03-01', '2027-07-19', '2027-08-23', '2027-11-01']) {
      const semana = blocosDaSemana(c, fases, seg, {});
      expect(semana).toHaveLength(7);
      semana.forEach((lista, i) => expect(lista).toEqual(blocosAjustados(c, fases, addDays(seg, i), {})));
    }
  });
  it('igual também com blocos adiados (inclusive de outra semana), dia mínimo e simulados', () => {
    const c = cfg(), seg = '2026-11-23';
    const base = blocosDaSemana(c, fases, seg, {});
    const b1 = base[0].find((b) => b.cat === 'mat'), b2 = blocosAjustados(c, fases, '2026-11-20', {}).find((b) => b.sessoes && b.cat !== 'mat');
    const aj = { adiados: { [b1.id]: addDays(seg, 1), [b2.id]: addDays(seg, 2) }, dificeis: { [addDays(seg, 3)]: true },
      exams: { x: { id: 'x', data: '2026-11-21', concurso: 'efomm', notas: { Matemática: 30, Física: 80, Inglês: 90 } } } };
    const semana = blocosDaSemana(c, fases, seg, aj);
    semana.forEach((lista, i) => expect(lista).toEqual(blocosAjustados(c, fases, addDays(seg, i), aj)));
    expect(semana[0].some((b) => b.id === b1.id)).toBe(false);
    expect(semana[1].find((b) => b.id === b1.id)?.adiadoDe).toBe(seg);
    expect(semana[2].find((b) => b.id === b2.id)?.adiadoDe).toBe('2026-11-20');
    expect(semana[3]).toHaveLength(1);
  });
  it('o resumo da semana (revisão de domingo) não muda com o cache', () => {
    const c = cfg(), seg = '2026-11-23';
    const plan = blocosDaSemana(c, fases, seg, {}).flat().reduce((a, b) => a + b.min, 0);
    const r = resumoSemana(c, fases, { done: {}, errors: {}, reviews: {}, cumpridos: {}, adiados: {}, exams: {} }, seg);
    expect(plan).toBeGreaterThan(0);
    expect(r.planMin).toBe(plan);
  });
});
