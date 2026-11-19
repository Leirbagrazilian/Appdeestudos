import { describe, it, expect } from 'vitest';
import seed from '../src/data/seed.json';
import { gerarFases } from '../src/lib/phases.js';
import { janelasDoDia, presencaPorAula, aulasDoDia, diaLivre } from '../src/lib/rotina.js';
import { planoPrazos, alocar, statusDe, emDivida, escolherTopico, resgateDoSabado, sabadoDoResgate, ritmo, contarBlocos, pesoDe } from '../src/lib/prazos.js';
import { avaliarTopico, resumo } from '../src/lib/dominio.js';
import { tarefasDoDia } from '../src/lib/tarefas.js';
import { noiteDe, horariosNoite, validarNoite, estadoDoDia, resumoSono, alertaSono, horasEntre } from '../src/lib/sono.js';
import { oracoesDoDia, reservasOracao } from '../src/lib/oracao.js';
import { treinoDoDia } from '../src/lib/treino.js';

const cfg = () => structuredClone(seed);
const fases = gerarFases(cfg());
const plano = planoPrazos(cfg(), fases);
const item = (m, cod) => plano.porMateria[m].find((i) => i.codigo === cod);

describe('rotina: janelas derivadas', () => {
  it('segunda: 6h30–12h, 13h–18h (musculação 18h30), 19h30–21h; terça sem jiu-jitsu e musculação', () => {
    const j = (wd) => janelasDoDia(cfg(), wd).map((x) => `${x.ini}-${x.fim}`);
    expect(j(1)).toEqual(['06:30-12:00', '13:00-18:00', '19:30-21:00']);
    expect(j(2)).toEqual(['06:30-12:00', '13:00-15:00', '16:00-18:00', '20:00-21:00']);
    expect(j(4)).toEqual(['06:30-12:00', '13:00-17:00', '19:00-21:00']);
  });
  it('sábado começa 1 h depois da corrida das 7h, com a janela da prova; domingo só tem a janela de 2 h', () => {
    const s = janelasDoDia(cfg(), 6);
    expect(s[0]).toEqual({ ini: '08:00', fim: '12:00', tipo: 'prova' });
    expect(janelasDoDia(cfg(), 0)).toEqual([{ ini: '15:00', fim: '17:00', tipo: 'domingo' }]);
  });
  it('"vou" na faculdade tira a aula da janela; "não vou" libera', () => {
    const c = cfg();
    c.rotina.aulas.find((a) => a.dia === 1 && a.tipo === 'faculdade').vou = true; // seg 7h30–11h10
    expect(janelasDoDia(c, 1).map((x) => `${x.ini}-${x.fim}`)).toEqual(['06:30-07:30', '11:10-12:00', '13:00-18:00', '19:30-21:00']);
  });
  it('presença por disciplina com alerta abaixo de 75%', () => {
    const c = cfg(); const nome = c.rotina.aulas.find((a) => a.tipo === 'faculdade').nome;
    const r = presencaPorAula(c, { [nome]: { a: 'p', b: 'p', c: 'p', d: 'f' } }).find((x) => x.nome === nome);
    expect(r).toMatchObject({ presentes: 3, faltas: 1, pct: 0.75, alerta: false });
    expect(presencaPorAula(c, { [nome]: { a: 'p', b: 'f' } }).find((x) => x.nome === nome).alerta).toBe(true);
    expect(aulasDoDia(c, '2027-01-18').map((a) => a.nome)).toContain(nome); // segunda
    expect(diaLivre(c, '2026-12-25')).toBe(true); expect(diaLivre(c, '2026-12-26')).toBe(false);
  });
});

describe('prazos: calendário dos tópicos', () => {
  it('cada tópico tem blocos ≥ 1 e prazo dentro da janela do Ano (ordem da trilha mantida em cada matéria)', () => {
    for (const m of ['Matemática', 'Física', 'Química']) {
      const l = plano.porMateria[m];
      expect(l).toHaveLength(seed.topicos[m].length);
      for (const i of l) { expect(i.blocos).toBeGreaterThanOrEqual(1); expect(i.prazo >= i.inicio).toBe(true); }
    }
    const mat = plano.porMateria['Matemática'];
    expect(mat[0].codigo).toBe('TN01'); expect(mat.at(-1).prazo <= '2027-08-22').toBe(true);
    expect(item('Matemática', 'TG02').prazo <= '2027-01-10').toBe(true);
  });
  it('alocação proporcional ao peso (blocos somam o total)', () => {
    const n = alocar([1, 2, 3], 12);
    expect(n.reduce((a, b) => a + b, 0)).toBe(12); expect(n[2]).toBeGreaterThan(n[1]); expect(n[1]).toBeGreaterThan(n[0]);
    expect(alocar([2, 2], 1)).toEqual([1, 1]);
  });
  it('peso do tópico (cfg.pesos) muda os blocos', () => {
    const c = cfg(); const antes = item('Matemática', 'MB04').blocos;
    c.pesos = { 'Matemática|Razão e proporção': 3 };
    const depois = planoPrazos(c, fases).por.get('Matemática|Razão e proporção').blocos;
    expect(pesoDe(c, 'Matemática', c.topicos.Matemática.find((t) => t.codigo === 'MB04'))).toBe(3);
    expect(depois).toBeGreaterThan(antes);
  });
  it('pré-requisitos: Física/Química só começam depois do prazo da Matemática (empurra e avisa)', () => {
    const cn02 = item('Física', 'F-CN02'), mb02 = item('Matemática', 'MB02');
    expect(cn02.inicio > mb02.prazo).toBe(true); expect(cn02.aviso).toMatch(/MB02/);
    const md04 = item('Física', 'F-MD04'), tg02 = item('Matemática', 'TG02');
    expect(md04.inicio > tg02.prazo).toBe(true); expect(md04.ano).toBe(1); // não coube na Fase 0: vai para o Ano 1
    for (const f of plano.porMateria['Física'].filter((x) => x.prereq.length)) for (const p of f.prereq) expect(f.inicio > plano.porCodigo.get(p).prazo, f.codigo).toBe(true);
  });
  it('tópico dominado, atrasado, bloqueado e dívida', () => {
    const cn02 = item('Física', 'F-CN02'), tn01 = item('Matemática', 'TN01');
    const st = (l = {}, f = {}, d = {}) => ({ lacunas: l, feitos: f, dividas: d });
    expect(statusDe(plano, tn01, st({ Matemática: { [tn01.nome]: 3 } }), '2026-12-01')).toBe('dominado');
    expect(statusDe(plano, tn01, st(), '2026-11-18')).toBe('andamento');
    expect(statusDe(plano, tn01, st(), tn01.prazo)).toBe('hoje');
    expect(statusDe(plano, tn01, st(), addD(tn01.prazo, 1))).toBe('atrasado');
    expect(statusDe(plano, cn02, st(), '2026-12-01')).toBe('bloqueado');
    // dívida: prazo e sábado de resgate passaram e o tópico foi começado
    const dia = addD(sabadoDoResgate(tn01.prazo), 1);
    expect(emDivida(tn01, st(), dia)).toBe(false); // nem começou
    expect(emDivida(tn01, st({}, { [`Matemática|${tn01.nome}`]: 3 }), dia)).toBe(true);
    expect(emDivida(tn01, st({}, { [`Matemática|${tn01.nome}`]: 3 }), sabadoDoResgate(tn01.prazo))).toBe(false); // ainda é o dia do resgate
  });
  it('escolha do tópico: segue a ordem, pula dívida e bloqueado, e depende de dívida fica bloqueado', () => {
    const tn01 = item('Matemática', 'TN01'), mb01 = item('Matemática', 'MB01');
    const base = { lacunas: {}, feitos: {}, dividas: {}, virt: {}, excluir: new Set(), faseId: 'zero', acertos: {} };
    expect(escolherTopico(cfg(), plano, 'Matemática', base, '2026-11-17').item.codigo).toBe('TN01');
    // dívida em TN01: o plano segue com MB01
    const comDivida = { ...base, dividas: { [`Matemática|${tn01.nome}`]: { desde: 'x' } } };
    expect(escolherTopico(cfg(), plano, 'Matemática', comDivida, '2026-11-17').item.codigo).toBe(mb01.codigo);
    // Física: F-CN02 depende de MB02; com MB02 em dívida (não dominado) continua bloqueado
    const mb02 = item('Matemática', 'MB02');
    const lac = { Física: { 'Grandezas, SI e notação científica': 3, MU: 3, 'Gráficos do movimento': 3, 'Queda livre e lançamento vertical': 3, 'Leis de Newton': 3, 'Forças: peso, normal, tração, elástica': 3 } };
    const e = escolherTopico(cfg(), plano, 'Física', { ...base, lacunas: lac, dividas: { [`Matemática|${mb02.nome}`]: {} } }, '2026-12-05');
    expect(e?.item.codigo).not.toBe('F-CN02');
    const livre = escolherTopico(cfg(), plano, 'Física', { ...base, lacunas: { ...lac, Matemática: { [mb02.nome]: 3 } } }, '2026-12-05');
    expect(livre.item.codigo).toBe('F-CN02');
  });
  it('último bloco é MATAR HOJE: bloco k de n e blocos equivalentes', () => {
    const tn01 = item('Matemática', 'TN01');
    const base = { lacunas: {}, feitos: {}, dividas: {}, virt: {}, excluir: new Set(), faseId: 'zero', acertos: {} };
    const k = (feitos) => escolherTopico(cfg(), plano, 'Matemática', { ...base, feitos: { [`Matemática|${tn01.nome}`]: feitos } }, '2026-11-17');
    expect(k(0)).toMatchObject({ k: 1, de: tn01.blocos, matar: false });
    expect(k(1.5)).toMatchObject({ k: 2 });
    expect(k(tn01.blocos - 1)).toMatchObject({ k: tn01.blocos, matar: true });
    expect(contarBlocos({ a: { materia: 'Matemática', topico: 'X', min: 50 }, b: { materia: 'Matemática', topico: 'X', min: 100 } })['Matemática|X']).toBe(1.5);
  });
  it('tarefa do dia mostra prazo, bloco e MATAR HOJE sem aula nova (sem vídeo)', () => {
    const tn01 = item('Matemática', 'TN01');
    const bl = [{ id: 'd:mat@0630', cat: 'mat', materia: 'Matemática', min: 100 }];
    const done = Object.fromEntries(Array.from({ length: tn01.blocos - 1 }, (_, i) => [`x${i}`, { materia: 'Matemática', topico: tn01.nome, min: 100 }]));
    const t = tarefasDoDia(cfg(), bl, { lacunas: {}, faseId: 'zero', plano, dia: '2026-11-17', done })['d:mat@0630'];
    expect(t.matar).toBe(true); expect(t.video).toBeNull(); expect(t.prazo).toMatchObject({ k: tn01.blocos, de: tn01.blocos, data: tn01.prazo });
    expect(t.questoes.n).toBeGreaterThanOrEqual(10);
    const t1 = tarefasDoDia(cfg(), bl, { lacunas: {}, faseId: 'zero', plano, dia: '2026-11-17' })['d:mat@0630'];
    expect(t1.matar).toBe(false); expect(t1.prazo.k).toBe(1);
  });
  it('resgate do sábado: tópicos começados e não matados da semana; sem pendência, vazio (prova antiga/questões)', () => {
    const tn01 = item('Matemática', 'TN01'), sab = sabadoDoResgate(tn01.prazo);
    const st = { lacunas: {}, feitos: { [`Matemática|${tn01.nome}`]: 5 }, dividas: {} };
    expect(resgateDoSabado(plano, st, sab).map((i) => i.codigo)).toContain('TN01');
    expect(resgateDoSabado(plano, { ...st, lacunas: { Matemática: { [tn01.nome]: 3 } } }, sab).map((i) => i.codigo)).not.toContain('TN01');
    const bl = [{ id: 's:resg', cat: 'resg', materia: 'Resgate', min: 100 }];
    const t = tarefasDoDia(cfg(), bl, { lacunas: {}, faseId: 'zero', plano, dia: sab, done: { x: { materia: 'Matemática', topico: tn01.nome, min: 500 } } })['s:resg'];
    expect(t).toMatchObject({ topico: tn01.nome, materia: 'Matemática', matar: true });
    expect(tarefasDoDia(cfg(), bl, { lacunas: {}, faseId: 'zero', plano, dia: '2030-01-05' })['s:resg'].resgateLivre).toBe(true);
  });
  it('modo domínio: bloco de treino abaixo de 8/10 não gasta tentativa; ≥ 8/10 domina; MATAR HOJE falho conta', () => {
    const r1 = avaliarTopico(null, 0, 'a', { feitas: 10, acertos: 5, treino: true });
    expect(r1.veredito).toBe('treino'); expect(resumo(r1.estado).falhas).toBe(0);
    const r2 = avaliarTopico(r1.estado, r1.nota, 'b', { feitas: 10, acertos: 8, treino: true });
    expect(r2.veredito).toBe('dominado'); expect(r2.nota).toBe(3);
    const r3 = avaliarTopico(null, 0, 'c', { feitas: 10, acertos: 5 });
    expect(resumo(r3.estado).falhas).toBe(1);
  });
  it('ritmo: dominados × previstos até hoje, atraso, data projetada e alerta de mais de 1 semana', () => {
    const r0 = ritmo(plano, {}, '2026-12-20');
    expect(r0.previstos).toBeGreaterThan(5); expect(r0.dominados).toBe(0); expect(r0.atraso).toBeGreaterThan(7); expect(r0.alerta).toBe(true);
    expect(r0.fimProjetado > r0.fimPlano).toBe(true); expect(r0.sugestoes).toHaveLength(2);
    const tn = item('Matemática', 'TN01');
    const ok = ritmo(plano, { Matemática: { [tn.nome]: 3 } }, tn.prazo, 'Matemática');
    expect(ok.atraso).toBe(0); expect(ok.alerta).toBe(false);
  });
});

function addD(d, n) { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }

describe('sono', () => {
  const ctx = (sono = {}, noites = {}) => ({ sono, noites });
  it('padrão: dom–qui 22h→5h, sex 22h→6h30, sáb 21h→5h15', () => {
    const c = cfg();
    expect(noiteDe(c, '2027-01-18', ctx())).toMatchObject({ dormir: '22:00', acordar: '05:00', horas: 7 }); // segunda
    expect(noiteDe(c, '2027-01-22', ctx())).toMatchObject({ dormir: '22:00', acordar: '06:30', horas: 8.5 }); // sexta
    expect(noiteDe(c, '2027-01-23', ctx())).toMatchObject({ dormir: '21:00', acordar: '05:15', horas: 8.25 }); // sábado
  });
  it('terço = dormir − 1 h, oração da noite = dormir − 40 min, telas off = dormir − 30 min (22h fica 21h e 21h20)', () => {
    const h = horariosNoite(cfg(), '2027-01-18', ctx());
    expect([h.terco, h.oracao, h.telas]).toEqual(['21:00', '21:20', '21:30']);
    const s = horariosNoite(cfg(), '2027-01-23', ctx()); // sábado 21h
    expect([s.terco, s.oracao, s.telas]).toEqual(['20:00', '20:20', '20:30']);
    const o = oracoesDoDia(cfg(), '2027-01-23', { oracoes: {} });
    expect(o.find((x) => x.id === 'terco1').hora).toBe('20:00'); expect(o.find((x) => x.id === 'noite').hora).toBe('20:20');
    expect(reservasOracao(cfg(), 1)[6].some((r) => r.ini === 20 * 60)).toBe(true);
  });
  it('noite curta (6–7 h): no máximo 1 por semana, nunca 2 seguidas, nunca na véspera de longão/prova', () => {
    const c = cfg(); const curta = { dormir: '23:00', acordar: '05:30' }; // 6,5 h
    expect(validarNoite(c, '2027-01-19', curta, ctx()).avisos).toEqual([]); // terça
    const noites = { '2027-01-19': curta };
    expect(validarNoite(c, '2027-01-21', curta, ctx({}, noites)).avisos.join()).toMatch(/1 por semana/);
    expect(validarNoite(c, '2027-01-20', curta, ctx({}, noites)).avisos.join()).toMatch(/seguida/);
    expect(validarNoite(c, '2027-01-23', curta, ctx()).avisos.join()).toMatch(/longão/); // sábado
    expect(validarNoite(c, '2027-07-25', curta, ctx()).avisos.join()).toMatch(/prova/); // véspera da ESA (26/07)
    expect(validarNoite(c, '2027-01-19', { dormir: '00:00', acordar: '05:00' }, ctx()).erro).toMatch(/6 h/);
    expect(validarNoite(c, '2027-01-19', { dormir: '22:00', acordar: '05:00' }, ctx()).avisos).toEqual([]); // 7 h não é curta
  });
  it('depois de noite curta: dia marcado, próxima noite 30 min mais cedo, corrida leve; < 6 h vira Dia mínimo', () => {
    const c = cfg();
    const sono = { '2027-01-19': { dormiu: '23:00', acordou: '05:30', q: 3 } }; // acordou terça, dormiu 6,5 h
    expect(estadoDoDia(c, '2027-01-19', ctx(sono))).toBe('curta');
    expect(estadoDoDia(c, '2027-01-20', ctx(sono))).toBe(null);
    expect(noiteDe(c, '2027-01-19', ctx(sono))).toMatchObject({ dormir: '21:30', maisCedo: true });
    expect(estadoDoDia(c, '2027-01-19', ctx({ '2027-01-19': { dormiu: '00:00', acordou: '05:00' } }))).toBe('minimo');
    const t = treinoDoDia(c, '2027-01-21', { noiteCurta: true }); // quinta: qualidade vira leve
    expect(t.tipo).toBe('leve'); expect(t.noiteCurta).toBe(true);
    expect(horasEntre('23:00', '05:30')).toBe(6.5);
  });
  it('semana: horas por noite, média e noites < 7 h; média < 7 h por 2 semanas dá alerta', () => {
    const c = cfg(); const sono = {};
    const dias = (seg, h) => Array.from({ length: 5 }, (_, i) => { const d = addD(seg, i); sono[d] = { dormiu: '23:00', acordou: h === 6.5 ? '05:30' : '06:00' }; });
    dias('2027-01-11', 6.5); dias('2027-01-18', 6.5);
    const r = resumoSono(c, sono, '2027-01-18');
    expect(r.media).toBe(6.5); expect(r.abaixo7).toBe(5); expect(r.noites[0]).toMatchObject({ horas: 6.5, abaixo7: true }); expect(r.noites[6].horas).toBeNull();
    expect(alertaSono(c, sono, '2027-01-20').alerta).toBe(true);
    dias('2027-01-18', 7);
    expect(alertaSono(c, sono, '2027-01-20').alerta).toBe(false);
  });
});

import { migrarLacunas, migrarDominio, migrarDone } from '../src/lib/trilha.js';
import { planoSemana } from '../src/lib/semana.js';
import { blocosDoDia } from '../src/lib/planner.js';
import { reservasDaSemana } from '../src/lib/oracao.js';

describe('revisão: migração sem perda de dados', () => {
  const c = cfg();
  it('lacunas: órfãs ficam guardadas e matérias fora do seed novo continuam', () => {
    const velho = { Matemática: { 'Números inteiros: adição e subtração': 3, MMC: 2, 'Conjuntos, lógica e funções': 1 }, 'Outra matéria': { x: 2 } };
    const novo = migrarLacunas(velho, c.topicos);
    expect(novo.Matemática['Números inteiros: adição e subtração']).toBe(3); // sem correspondência: fica
    expect(novo.Matemática['Divisibilidade, MMC e MDC']).toBe(2);
    expect(novo.Matemática['Teoria de conjuntos']).toBe(1);
    expect(novo.Matemática['Conjuntos, lógica e funções']).toBe(1); // o antigo também fica
    expect(novo['Outra matéria']).toEqual({ x: 2 });
    expect(migrarLacunas(novo, c.topicos)).toEqual(novo);
  });
  it('dominio: o estado do tópico antigo vale também na chave nova, sem apagar a antiga', () => {
    const est = { regs: { a: { feitas: 10, acertos: 5, data: '2026-11-17' }, b: { feitas: 10, acertos: 6, data: '2026-11-18' } } };
    const dom = { 'Matemática|MMC': est, 'Matemática|Sem correspondência': { regs: {} } };
    const novo = migrarDominio(dom, c.topicos);
    expect(novo['Matemática|Divisibilidade, MMC e MDC']).toEqual(est);
    expect(novo['Matemática|MMC']).toEqual(est);
    expect(novo['Matemática|Sem correspondência']).toBeTruthy();
    const ja = { ...dom, 'Matemática|Divisibilidade, MMC e MDC': { regs: {} } };
    expect(migrarDominio(ja, c.topicos)['Matemática|Divisibilidade, MMC e MDC']).toEqual({ regs: {} }); // não sobrescreve o que já existe
  });
  it('done: o tópico antigo dos blocos feitos passa para o novo (contarBlocos segue valendo)', () => {
    const done = { a: { materia: 'Matemática', topico: 'MDC', min: 100 }, b: { materia: 'Matemática', topico: 'Teoria de conjuntos', min: 50 }, c: { materia: 'Português', topico: 'X', min: 50 } };
    const mud = migrarDone(done, c.topicos);
    expect(Object.keys(mud)).toEqual(['a']);
    expect(mud.a).toMatchObject({ topico: 'Divisibilidade, MMC e MDC', topicoAntigo: 'MDC' });
    expect(contarBlocos({ ...done, ...mud })['Matemática|Divisibilidade, MMC e MDC']).toBe(1);
  });
});

describe('revisão: carga da semana', () => {
  const f = fases;
  const res = (c) => (seg) => reservasDaSemana(c, {}, seg);
  const min = (dias, cat) => dias.flatMap((d) => d.blocos).filter((b) => b.cat === cat).reduce((a, b) => a + b.min, 0);
  it('os % por matéria da spec batem (Ano 1 e Fase 0), contando o que sobra das janelas', () => {
    const c = cfg();
    const testa = (seg, pct) => {
      const dias = planoSemana(c, f, seg);
      const cats = Object.keys(pct), tot = cats.reduce((a, k) => a + min(dias, k), 0);
      for (const k of cats) expect(Math.abs((min(dias, k) / tot) * 100 - pct[k]), `${seg} ${k}`).toBeLessThan(4.5);
    };
    testa('2027-01-18', { mat: 38, fis: 32, qui: 15, por: 6, red: 5, ing: 4 });
    testa('2026-11-23', { mat: 55, fis: 25, qui: 12, por: 6, ing: 2 });
  });
  it('resgate do sábado tem 2 h (120 min) e segunda/quarta/quinta/sexta ficam entre 9,5 e 10 h, com as orações', () => {
    const c = cfg();
    for (const seg of ['2026-11-23', '2027-01-18', '2027-05-10']) {
      const dias = planoSemana(c, f, seg, { reservas: res(c) });
      expect(dias[5].blocos.find((b) => b.cat === 'resg')).toMatchObject({ min: 120, bruto: 120 });
      for (const i of [0, 2, 3, 4]) { const h = dias[i].blocos.reduce((a, b) => a + b.min, 0) / 60; expect(h, `${seg} dia ${i}`).toBeGreaterThanOrEqual(9.5); expect(h, `${seg} dia ${i}`).toBeLessThanOrEqual(10); }
      const ter = dias[1].blocos.reduce((a, b) => a + b.min, 0) / 60; expect(ter).toBeGreaterThanOrEqual(7.5); expect(ter).toBeLessThanOrEqual(8.5);
      const tot = dias.reduce((a, d) => a + d.blocos.reduce((x, b) => x + b.min, 0), 0) / 60; expect(tot).toBeGreaterThan(53); expect(tot).toBeLessThan(59);
    }
  });
  it('a semana leve (23–29/08) tem carga reduzida (~60%) no checklist do dia', () => {
    const c = cfg();
    const sess = (dia) => blocosDoDia(c, f, dia).filter((b) => b.sessoes).reduce((a, b) => a + b.min, 0);
    const normal = sess('2027-07-14'), leve = sess('2027-08-25');
    expect(leve).toBeLessThanOrEqual(normal * 0.7); expect(leve).toBeGreaterThan(0);
    c.concursos.find((x) => x.id === 'en').eventos.find((e) => e.tipo === 'prova').inicio = '2027-09-15'; // mesmo sem a prova na semana, a fase leve reduz
    expect(sess('2027-08-25')).toBeLessThanOrEqual(normal * 0.7);
  });
});
