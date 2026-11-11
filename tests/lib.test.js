import { describe, it, expect } from 'vitest';
import seed from '../src/data/seed.json';
import { gerarFases, faseDoDia, revisaoLeve } from '../src/lib/phases.js';
import { agendarRevisoes, vencidas } from '../src/lib/spaced.js';
import { idadeOk, idadeEm } from '../src/lib/age.js';
import { blocosDoDia } from '../src/lib/planner.js';
import { addDays, weekday } from '../src/lib/dates.js';

const cfg = () => structuredClone(seed);

describe('fases', () => {
  it('geram 6 fases contíguas sem sobreposição', () => {
    const f = gerarFases(cfg());
    expect(f.map((x) => x.id)).toEqual(['base', 'desenvolvimento', 'efomm', 'en', 'ita', 'enem']);
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
    // a fase 3 serve EFOMM e ESA: começa 7 semanas antes da primeira das duas provas (ESA, 26/07)
    expect(gerarFases(c).find((x) => x.id === 'efomm').inicio).toBe('2027-06-07');
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
  const nasc = '2005-11-25';
  const por = (id) => cfg().concursos.find((c) => c.id === id);
  it('idade completa na data de referência', () => {
    expect(idadeEm(nasc, '2028-06-30')).toBe(22);
    expect(idadeEm(nasc, '2028-11-25')).toBe(23);
    expect(idadeEm(nasc, '2028-11-24')).toBe(22);
  });
  it('Escola Naval: menos de 23 em 30/06 do ano da matrícula; só a prova de 2027 vale', () => {
    const en = por('en').idade;
    expect(idadeOk(nasc, en, 2027)).toMatchObject({ ok: true, idade: 22, anoMat: 2028 });
    expect(idadeOk(nasc, en, 2028)).toMatchObject({ ok: false, idade: 23 });
    // quem faz 23 em julho ainda entra pela data de 30/06 (e não pela de 01/01)
    expect(idadeOk('2005-07-15', en, 2027).ok).toBe(true);
    expect(idadeOk('2005-06-15', en, 2027).ok).toBe(false);
  });
  it('EFOMM: 23 incompletos em 01/01; só 2027', () => {
    const e = por('efomm').idade;
    expect(idadeOk(nasc, e, 2027).ok).toBe(true);
    expect(idadeOk(nasc, e, 2028).ok).toBe(false);
  });
  it('ITA: não completar 25 até 31/12; vale 2027 e 2028, não 2029', () => {
    const i = por('ita').idade;
    expect([2027, 2028, 2029].map((a) => idadeOk(nasc, i, a).ok)).toEqual([true, true, false]);
  });
  it('ESA área Geral: 17 a 24 até 31/12; vale 2027 e 2028', () => {
    const e = por('esa').idade;
    expect([2027, 2028].map((a) => idadeOk(nasc, e, a).ok)).toEqual([true, true]);
    expect(idadeOk(nasc, e, 2029).ok).toBe(false); // 25 anos
    expect(idadeOk('2012-01-01', e, 2027)).toMatchObject({ ok: false, abaixo: true }); // 16 anos
  });
  it('IME: fora do limite (ativa até 22 em 31/12)', () => {
    const m = por('ime');
    expect(m.plano).toBe(false);
    expect([2027, 2028].map((a) => idadeOk(nasc, m.idade, a).ok)).toEqual([false, false]);
  });
});

describe('planner', () => {
  it('semana diagnóstica usa os blocos detalhados', () => {
    const f = gerarFases(cfg());
    const b = blocosDoDia(cfg(), f, '2026-11-10');
    expect(b[0].onde.length).toBeGreaterThan(0);
  });
  it('depois da semana diagnóstica vale o planner: blocos com horário e id por matéria', () => {
    const f = gerarFases(cfg());
    const b = blocosDoDia(cfg(), f, '2026-11-23');
    expect(b[0]).toMatchObject({ ini: '06:00', fim: '06:50', min: 50, bruto: 50 });
    expect(b.every((x) => /^2026-11-23:[a-z]+\d*$/.test(x.id))).toBe(true);
    expect(new Set(b.map((x) => x.id)).size).toBe(b.length);
    expect(b.at(-1).cat).toBe('erros'); // caderno de erros: 10 min, sem horário fixo
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
    expect((s.match(/BEGIN:VEVENT/g) ?? []).length).toBe(12);
    expect(s).toContain('TRIGGER:-P14D'); expect(s).toContain('TRIGGER:-P1D');
    expect(s).toContain('DTEND;VALUE=DATE:20270606'); // fim exclusivo
  });
  it('valida backup', () => {
    expect(() => validar('xx')).toThrow();
    expect(() => validar('{"versao":1,"cfg":{},"done":{}}')).toThrow();
    expect(validar(JSON.stringify({ versao: 1, cfg: cfg(), done: {} })).cfg.concursos.length).toBe(6);
  });
});

import { planoSessoes, iniciar, estado, encerrarSessao, proximaSessao, minutosFoco } from '../src/lib/foco.js';
import { blocosAjustados } from '../src/lib/planner.js';
import { avaliar, revisoesDoDia } from '../src/lib/spaced.js';
import { conquistas, estatisticas } from '../src/lib/conquistas.js';

describe('cronômetro de foco', () => {
  it('Matemática de 2h vira 2 sessões de 50 min; Física 1h vira 1 de 50; caderno de erros 10 min', () => {
    expect(planoSessoes(120)).toEqual({ sessoes: 2, len: 50, pausa: 10 });
    expect(planoSessoes(60)).toEqual({ sessoes: 1, len: 50, pausa: 10 });
    expect(planoSessoes(10)).toEqual({ sessoes: 1, len: 10, pausa: 10 });
    expect(planoSessoes(240).sessoes).toBe(4);
  });
  it('conta o tempo pelo relógio, mesmo com o app fechado, e limita ao planejado', () => {
    const t0 = 1_000_000, min = 60000;
    let t = iniciar({ id: 'd:mat', titulo: 'Mat', materia: 'Matemática', chave: 'mat', min: 120 }, undefined, t0);
    expect(estado(t, t0 + 30 * min).restante).toBe(20 * min);
    expect(estado(t, t0 + 55 * min).acabou).toBe(true);
    t = encerrarSessao(t, t0 + 180 * min); // esqueceu o app aberto por 3h
    expect(t.fase).toBe('pausa');
    expect(minutosFoco(t, t0 + 180 * min)).toBe(50);
    t = proximaSessao(t, t0 + 190 * min);
    expect(t.sessao).toBe(2);
    t = encerrarSessao(t, t0 + 220 * min); // parou cedo: 30 min
    expect(t.fase).toBe('fim');
    expect(minutosFoco(t, t0 + 220 * min)).toBe(80);
  });
});

describe('ajustes do dia', () => {
  it('passar para amanhã tira o bloco de hoje e coloca amanhã', () => {
    const f = gerarFases(cfg()); const c = cfg();
    const alvo = blocosDoDia(c, f, '2026-11-23').find((b) => b.cat === 'fis');
    const adiados = { [alvo.id]: '2026-11-24' };
    expect(blocosAjustados(c, f, '2026-11-23', { adiados }).some((b) => b.id === alvo.id)).toBe(false);
    const amanha = blocosAjustados(c, f, '2026-11-24', { adiados });
    expect(amanha.find((b) => b.id === alvo.id)?.adiadoDe).toBe('2026-11-23');
  });
  it('dia difícil deixa só o essencial: o primeiro bloco (até 50 min) e o caderno de erros', () => {
    const f = gerarFases(cfg()); const c = cfg();
    const l = blocosAjustados(c, f, '2026-11-23', { dificeis: { '2026-11-23': true } });
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ essencial: true, min: 50 });
    expect(l[1].cat).toBe('erros');
  });
});

describe('revisão com dificuldade', () => {
  const base = agendarRevisoes({ origem: 'o', assunto: 'a', materia: 'm', dia: '2026-11-10' });
  it('fácil empurra as próximas revisões para mais longe', () => {
    const { mudadas } = avaliar(base, base[0], 'facil', '2026-11-11');
    expect(mudadas.find((x) => x.id === base[1].id).due).toBe('2026-11-20'); // 17/11 + 3
  });
  it('difícil cria uma revisão extra em 2 dias', () => {
    const { novas } = avaliar(base, base[0], 'dificil', '2026-11-11');
    expect(novas[0].due).toBe('2026-11-13');
  });
  it('revisão feita hoje continua na lista do dia', () => {
    const r = [{ ...base[0], feita: true, feitaEm: '2026-11-11' }, base[1]];
    expect(revisoesDoDia(r, '2026-11-11')).toHaveLength(1);
  });
});

describe('insígnias', () => {
  it('nunca exigem perfeição e contam questões registradas', () => {
    const done = { '2026-11-10:mat': { min: 100, questoes: { feitas: 120, acertos: 80 }, sozinho: true } };
    expect(estatisticas({ done }).questoes).toBe(120);
    const ok = conquistas({ done }).filter((x) => x.ok).map((x) => x.id);
    expect(ok).toEqual(expect.arrayContaining(['primeiro-bloco', 'cem-questoes']));
    expect(ok).not.toContain('sete-dias');
  });
});

import { treinar, filaTreino, viloes, precisaBackup, totalRedacao } from '../src/lib/erros.js';
describe('caderno de erros', () => {
  const e = { id: 'a', assunto: 'Trigonometria', materia: 'Matemática', tipo: 'conteudo' };
  it('2 acertos seguidos = dominado; errar zera a sequência', () => {
    let x = treinar(e, true, '2026-11-10');
    expect(x.status).toBe('treinando');
    x = treinar(treinar(x, false, '2026-11-11'), true, '2026-11-12');
    expect(x.status).toBe('treinando');
    x = treinar(x, true, '2026-11-13');
    expect(x.status).toBe('dominado');
  });
  it('fila: nunca treinados primeiro, dominados fora', () => {
    const l = [{ ...e, id: 'b', ultimoTreino: '2026-11-09' }, { ...e, id: 'c' }, { ...e, id: 'd', status: 'dominado' }];
    expect(filaTreino(l).map((x) => x.id)).toEqual(['c', 'b']);
  });
  it('vilões: assunto repetido e dica pelo tipo dominante', () => {
    const l = [e, { ...e, id: 'b', assunto: ' trigonometria ' }, { ...e, id: 'c', assunto: 'PA', tipo: 'atencao' }, { ...e, id: 'd', assunto: 'PG', tipo: 'atencao' }, { ...e, id: 'f', assunto: 'PG', tipo: 'atencao' }];
    const v = viloes(l);
    expect(v.top[0]).toMatchObject({ assunto: 'Trigonometria', n: 2 });
    expect(v.dica).toMatch(/atenção/);
  });
  it('lembrete de backup', () => {
    expect(precisaBackup(null, '2026-11-10', 2)).toBe(false);
    expect(precisaBackup(null, '2026-11-10', 3)).toBe(true);
    expect(precisaBackup('2026-11-04', '2026-11-10', 9)).toBe(false);
    expect(precisaBackup('2026-11-03', '2026-11-10', 9)).toBe(true);
  });
  it('total da redação', () => expect(totalRedacao({ notas: [120, 160, 120, 160, 80] })).toBe(640));
});

import { conflitosProvas } from '../src/lib/alerts.js';
import { migrarCfg } from '../src/lib/migracao.js';
describe('conflito de provas e migração', () => {
  it('EFOMM x ESA no mesmo fim de semana: prioridade EFOMM', () => {
    const [c] = conflitosProvas(cfg());
    expect([c.a.id, c.b.id].sort()).toEqual(['efomm', 'esa']);
    expect(c).toMatchObject({ de: '2027-07-26', ate: '2027-07-26' });
    expect(c.vence.id).toBe('efomm');
    expect(c.perde.id).toBe('esa');
  });
  it('sem conflito quando as datas se separam', () => {
    const c = cfg();
    const esa = c.concursos.find((x) => x.id === 'esa').eventos.find((e) => e.tipo === 'prova');
    esa.inicio = esa.fim = '2027-09-05';
    expect(conflitosProvas(c)).toHaveLength(0);
  });
  it('migra a configuração antiga sem perder suas edições', () => {
    const velho = cfg();
    delete velho.versaoSeed;
    velho.concursos = velho.concursos.filter((c) => !['esa', 'ime'].includes(c.id));
    const en = velho.concursos.find((c) => c.id === 'en');
    en.idade = { tipo: 'menorQue', limite: 23, ref: '01-01', texto: 'antigo' };
    en.eventos.find((e) => e.tipo === 'prova').inicio = '2027-08-22'; // você editou a data
    en.eventos.find((e) => e.tipo === 'prova').status = 'confirmada';
    velho.fases = { base: { nome: 'Base', numero: 1 } };
    velho.carta = 'minha carta'; velho.links = { Matemática: 'https://x' };
    const novo = migrarCfg(velho, cfg());
    expect(novo.concursos.map((c) => c.id)).toEqual(['en', 'efomm', 'esa', 'enem', 'ita', 'ime']);
    const en2 = novo.concursos.find((c) => c.id === 'en');
    expect(en2.idade.ref).toBe('06-30');
    expect(en2.eventos.find((e) => e.tipo === 'prova')).toMatchObject({ inicio: '2027-08-22', status: 'confirmada' });
    expect(Object.keys(novo.fases)).toHaveLength(6);
    expect(novo.carta).toBe('minha carta');
    expect(novo.links.Matemática).toBe('https://x');
    expect(novo.versaoSeed).toBe(4);
    expect(migrarCfg(novo, cfg())).toBe(novo); // já migrada: não mexe
  });
  it('as 6 fases seguem a ordem e a Fase 6 vai do fim do ITA até o ENEM', () => {
    const f = gerarFases(cfg());
    expect(f[4]).toMatchObject({ id: 'ita', fim: '2027-10-23' });
    expect(f[5]).toMatchObject({ id: 'enem', inicio: '2027-10-24', fim: '2027-11-15' });
    expect(f[2]).toMatchObject({ inicio: '2027-06-06', fim: '2027-07-26' });
  });
});

describe('backup antigo importado', () => {
  it('depois de migrar, as fases têm nome e a prova de sábado tem texto (nada de undefined)', () => {
    const velho = cfg();
    delete velho.versaoSeed;
    velho.concursos = velho.concursos.filter((c) => !['esa', 'ime'].includes(c.id));
    velho.fases = { base: velho.fases.base, desenvolvimento: velho.fases.desenvolvimento, efomm: velho.fases.efomm, en: velho.fases.en, final: { nome: 'Reta final', numero: 5, foco: '' } };
    velho.provaSabado = { base: 'a', desenvolvimento: 'b', efomm: 'c', en: 'd', final: 'e' };
    const novo = migrarCfg(validar(JSON.stringify({ versao: 1, cfg: velho, done: {} })).cfg, cfg());
    const f = gerarFases(novo);
    expect(f.every((x) => x.nome && x.numero)).toBe(true);
    const sabado = '2027-06-12';
    const prova = blocosDoDia(novo, f, sabado).find((b) => b.cat === 'prova' && !b.sessoes);
    expect(prova.titulo).not.toMatch(/undefined/);
  });
  it('sem a ESA no cadastro, as fases ainda se formam', () => {
    const c = cfg();
    c.concursos = c.concursos.filter((x) => x.id !== 'esa');
    const f = gerarFases(c);
    expect(f.find((x) => x.id === 'efomm')).toMatchObject({ inicio: '2027-06-06', fim: '2027-07-26' });
  });
});

import { topicosDe, proximoTopico, cobertura, migrarLacunas, dominio } from '../src/lib/trilha.js';
describe('trilha', () => {
  const c = cfg();
  it('matérias × concursos: Química só ITA, Hist/Geo só ESA, Cálculo só EN', () => {
    expect(topicosDe(c, 'Química')[0].concursos).toEqual(['ita']);
    expect(topicosDe(c, 'Hist/Geo')[0].concursos).toEqual(['esa']);
    const calc = topicosDe(c, 'Matemática').at(-1);
    expect(calc.nome).toMatch(/Cálculo/); expect(calc.concursos).toEqual(['en']);
    expect(topicosDe(c, 'Matemática')[0].concursos).toEqual(['en', 'efomm', 'ita', 'esa']);
    expect(topicosDe(c, 'Física')[0].concursos).toEqual(['en', 'efomm', 'ita']);
  });
  it('trilha de Matemática segue a ordem do SPEC', () => {
    const n = topicosDe(c, 'Matemática').map((t) => t.nome);
    expect(n[0]).toMatch(/básica/); expect(n[2]).toBe('Trigonometria'); expect(n.at(-1)).toMatch(/Cálculo/);
    expect(n.indexOf('Geometria plana')).toBeLessThan(n.indexOf('Geometria espacial'));
  });
  it('próximo tópico: respeita a ordem e prefere o que serve a mais concursos dentro da janela', () => {
    expect(proximoTopico(c, {}, 'Matemática').ordem).toBe(0);
    // primeiros 9 dominados: sobram complexos (4 concursos) e cálculo (1): vem complexos
    const todos = Object.fromEntries(topicosDe(c, 'Matemática').slice(0, 8).map((t) => [t.nome, 3]));
    expect(proximoTopico(c, { Matemática: todos }, 'Matemática').nome).toMatch(/complexos/);
    // tópico de 1 concurso não passa na frente de um de 3 que está na janela
    const cc = cfg(); cc.topicos['Física'][0].concursos = ['en']; // grandezas só EN
    expect(proximoTopico(cc, {}, 'Física').ordem).toBe(1); // cinemática serve a 3
    expect(proximoTopico(c, { 'Hist/Geo': Object.fromEntries(topicosDe(c, 'Hist/Geo').map((t) => [t.nome, 3])) }, 'Hist/Geo')).toBeNull();
  });
  it('cobertura e domínio', () => {
    const l = { Física: Object.fromEntries(topicosDe(c, 'Física').map((t) => [t.nome, 3])) };
    expect(cobertura(c, l, 'Física')).toBe(1);
    expect(cobertura(c, {}, 'Física')).toBe(0);
    expect(dominio({}, 'Física', 'x')).toBe(0);
  });
  it('notas do mapa de lacunas antigo são aproveitadas (menor nota entre os tópicos antigos)', () => {
    const velho = { Matemática: { Funções: 3, 'Logaritmos e exponenciais': 1, 'PA e PG': 2, 'Matrizes e sistemas': 3 }, Física: { Cinemática: 2 } };
    const novo = migrarLacunas(velho, c.topicos);
    expect(novo.Matemática['Conjuntos, lógica e funções']).toBe(1);
    expect(novo.Matemática['PA, PG, matrizes e sistemas']).toBe(2);
    expect(novo.Física.Cinemática).toBe(2);
    expect(novo.Matemática.Trigonometria).toBeUndefined();
    expect(migrarLacunas(novo, c.topicos)).toEqual(novo); // idempotente
  });
});

import { planoSemana, orcamentoSemana, slotsDaJanela, brutoDeSlots, toMin, repartir } from '../src/lib/semana.js';
describe('planner v2: janelas, horas por fase e regras', () => {
  const f = gerarFases(cfg());
  const semana = (seg, c = cfg(), ctx = {}) => planoSemana(c, f, seg, ctx);
  const liquido = (dias) => dias.flatMap((d) => d.blocos).filter((b) => b.sessoes || ['prova', 'corr', 'red'].includes(b.cat)).reduce((a, b) => a + b.min, 0);

  it('contas de sessão: 50 min de foco com 10 de pausa, sem pausa no fim', () => {
    expect([60, 120, 300, 360, 240, 110].map((m) => slotsDaJanela(m))).toEqual([1, 2, 5, 6, 4, 2]);
    expect([1, 2, 3].map((k) => brutoDeSlots(k))).toEqual([50, 110, 170]);
  });
  it('repartir mantém o total', () => {
    const r = repartir({ a: 17.2, b: 12.1, c: 2.6 }, 32);
    expect(Object.values(r).reduce((x, y) => x + y, 0)).toBe(32);
  });
  it('as horas por matéria seguem a tabela da fase (43/50) e a semana fecha perto de 43h líquidas', () => {
    const o = orcamentoSemana(cfg(), 'base', '2026-11-23');
    expect(o).toMatchObject({ mat: 1032, fis: 722, qui: 155, por: 206, red: 103, ing: 103, hg: 0, provas: 258 });
    const dias = semana('2026-11-23');
    expect(liquido(dias)).toBeGreaterThan(2480); expect(liquido(dias)).toBeLessThan(2620);
    const mat = dias.flatMap((d) => d.blocos).filter((b) => b.cat === 'mat').reduce((a, b) => a + b.min, 0);
    expect(Math.abs(mat - 1032)).toBeLessThanOrEqual(100);
  });
  it('fase 3 inclui Hist/Geo (ESA) e o excedente de provas vira estudo na semana', () => {
    const dias = semana('2027-07-12');
    const por = (cat) => dias.flatMap((d) => d.blocos).filter((b) => b.cat === cat).reduce((a, b) => a + b.min, 0);
    expect(por('hg')).toBeGreaterThanOrEqual(200);
    expect(dias[4].blocos.some((b) => b.cat === 'prova' && b.sessoes)).toBe(true);
    expect(por('prova')).toBeGreaterThanOrEqual(300 + 20); // sábado + excedente
  });
  it('encaixe nas janelas: todo bloco cabe numa janela do dia, sem sobreposição e com pausa de 10 min', () => {
    const c = cfg();
    for (const seg of ['2026-11-23', '2027-03-08', '2027-07-12', '2027-09-13']) {
      for (const d of semana(seg, c)) {
        const janelas = (c.rotina.janelas[d.wd] ?? []).map((j) => [toMin(j.ini), toMin(j.fim)]);
        const bl = d.blocos;
        for (const b of bl) {
          expect(janelas.some(([a, z]) => b.ini >= a && b.fim <= z)).toBe(true);
          expect(b.fim - b.ini).toBe(b.bruto);
        }
        for (let i = 1; i < bl.length; i++) expect(bl[i].ini).toBeGreaterThanOrEqual(bl[i - 1].fim);
        for (let i = 1; i < bl.length; i++) {
          const mesmaJanela = janelas.find(([a, z]) => bl[i].ini >= a && bl[i].fim <= z) === janelas.find(([a, z]) => bl[i - 1].ini >= a && bl[i - 1].fim <= z);
          if (mesmaJanela && bl[i].sessoes && bl[i - 1].sessoes) expect(bl[i].ini - bl[i - 1].fim).toBe(10);
        }
      }
    }
  });
  it('sábado: prova antiga cronometrada e correção; domingo: redação e planejamento', () => {
    const dias = semana('2026-11-23');
    expect(dias[5].blocos.slice(0, 2).map((b) => b.cat)).toEqual(['prova', 'corr']);
    expect(dias[5].blocos[0].ini).toBe(toMin('08:00'));
    expect(dias[6].blocos.map((b) => b.cat)).toEqual(['red', 'plan']);
    expect(dias[6].blocos[1].fim).toBe(toMin('12:00'));
  });
  it('rampa de 75% nas 2 primeiras semanas (quando ligada)', () => {
    const c = cfg(); c.rotina.rampa.ativa = true;
    const r = orcamentoSemana(c, 'base', '2026-11-16'); // semana 2 do plano
    expect(r.mat).toBe(Math.round(20 * 0.86 * 60 * 0.75));
    expect(orcamentoSemana(c, 'base', '2026-11-23').mat).toBe(1032); // a partir da 3ª semana, cheio
    expect(orcamentoSemana(cfg(), 'base', '2026-11-16').mat).toBe(1032); // desligada
  });
  it('matéria abaixo de 50% no último simulado: +2h na semana seguinte, tiradas da mais forte', () => {
    const exams = { a: { id: 'a', data: '2026-11-21', concurso: 'efomm', notas: { Matemática: 80, Física: 40, Português: 60 } } };
    const base = orcamentoSemana(cfg(), 'base', '2026-11-23');
    const o = orcamentoSemana(cfg(), 'base', '2026-11-23', { exams });
    expect(o.fis - base.fis).toBe(120);
    expect(base.mat - o.mat).toBe(120); // Matemática (80%) é a mais forte
    // duas semanas depois a regra já não vale
    expect(orcamentoSemana(cfg(), 'base', '2026-12-07', { exams }).fis).toBe(base.fis);
  });
  it('inglês com 75% ou mais: só manutenção (1h) e o resto vai para a Matemática', () => {
    const exams = { a: { id: 'a', data: '2026-11-14', concurso: 'efomm', notas: { Inglês: 80 } } };
    const base = orcamentoSemana(cfg(), 'base', '2026-11-23');
    const o = orcamentoSemana(cfg(), 'base', '2026-11-23', { exams });
    expect(o.ing).toBe(60);
    expect(o.mat - base.mat).toBe(base.ing - 60);
  });
  it('semana antes da prova: revisão leve reduz o estudo do dia', () => {
    const c = cfg(); const g = gerarFases(c);
    const cheio = blocosDoDia(c, g, '2027-07-14').filter((b) => b.sessoes).length; // 11 dias antes da EFOMM
    const leve = blocosDoDia(c, g, '2027-07-21').filter((b) => b.sessoes).length; // dentro dos 7 dias
    expect(leve).toBeLessThan(cheio);
  });
  it('configuração antiga é migrada: rotina nova entra e as aulas do primeiro cadastro são atualizadas', () => {
    const velho = cfg(); delete velho.versaoSeed;
    velho.rotina = { aulas: [{ dia: 1, inicio: '07:30', fim: '11:10', nome: 'Faculdade' }, { dia: 3, inicio: '09:30', fim: '10:10', nome: 'Faculdade' }, { dia: 4, inicio: '13:00', fim: '18:00', nome: 'Faculdade' }], metaHoras: { 1: 4 } };
    delete velho.janelas; delete velho.horasFase; delete velho.categorias;
    const novo = migrarCfg(velho, cfg());
    expect(novo.rotina.janelas[1]).toHaveLength(3);
    expect(novo.rotina.metaLiquida).toBe(43);
    expect(novo.rotina.metaHoras).toBeUndefined();
    expect(novo.rotina.aulas.find((a) => a.dia === 4).inicio).toBe('13:30');
    expect(novo.horasFase.base.mat).toBe(20);
    // aulas editadas por você são mantidas
    const editado = cfg(); delete editado.versaoSeed; editado.rotina = { aulas: [{ dia: 2, inicio: '08:00', fim: '09:00', nome: 'Minha aula' }] };
    expect(migrarCfg(editado, cfg()).rotina.aulas).toEqual([{ dia: 2, inicio: '08:00', fim: '09:00', nome: 'Minha aula' }]);
  });
});
