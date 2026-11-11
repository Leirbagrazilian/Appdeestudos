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
    const adiados = { '2026-11-23:fis': '2026-11-24' };
    expect(blocosAjustados(c, f, '2026-11-23', { adiados }).some((b) => b.id === '2026-11-23:fis')).toBe(false);
    const amanha = blocosAjustados(c, f, '2026-11-24', { adiados });
    expect(amanha.find((b) => b.id === '2026-11-23:fis')?.adiadoDe).toBe('2026-11-23');
  });
  it('dia difícil deixa só o essencial', () => {
    const f = gerarFases(cfg()); const c = cfg();
    const l = blocosAjustados(c, f, '2026-11-23', { dificeis: { '2026-11-23': true } });
    expect(l.map((b) => b.chave)).toEqual(['mat', 'erros']);
    expect(l[0].min).toBe(50);
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
    expect(novo.versaoSeed).toBe(3);
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
    const prova = blocosDoDia(novo, f, sabado).find((b) => b.chave === 'prova');
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
