import { describe, it, expect } from 'vitest';
import seed from '../src/data/seed.json';
import { gerarFases, faseDoDia, revisaoLeve } from '../src/lib/phases.js';
import { agendarRevisoes, vencidas } from '../src/lib/spaced.js';
import { idadeOk, idadeEm } from '../src/lib/age.js';
import { blocosDoDia } from '../src/lib/planner.js';
import { addDays, weekday } from '../src/lib/dates.js';

import { legado } from './_legado.js';
const cfg = () => legado(structuredClone(seed));
/** Lacunas com todos os tópicos da Fase 0 em nota 3: a trilha segue a partir do ensino médio (use com faseId 'base'). */
const dominarFase0 = (c) => Object.fromEntries(c.materias.filter((m) => c.topicos?.[m]).map((m) => [m, Object.fromEntries(c.topicos[m].filter((t) => t.fase === 0).map((t) => [t.nome, 3]))]));

describe('fases', () => {
  it('geram 8 fases contíguas sem sobreposição: Fase 0, Ano 1, 2, 3, semana leve, reta final ITA, discursivas e ENEM', () => {
    const f = gerarFases(cfg());
    expect(f.map((x) => x.id)).toEqual(['zero', 'ano1', 'ano2', 'ano3', 'leve', 'ita', 'disc', 'enem']);
    for (let i = 1; i < f.length; i++) expect(f[i].inicio).toBe(addDays(f[i - 1].fim, 1));
    expect(f[0].inicio).toBe('2026-11-16');
    expect(f.map((x) => x.numero)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
  it('datas do plano: Fase 0 até 10/01, Ano 1 11/01–14/03, Ano 2 15/03–13/06, Ano 3 14/06–22/08, leve 23–29/08, ITA 30/08–26/09, discursivas até 22/10', () => {
    const f = Object.fromEntries(gerarFases(cfg()).map((x) => [x.id, x]));
    expect([f.zero.fim, f.ano1.inicio, f.ano1.fim]).toEqual(['2027-01-10', '2027-01-11', '2027-03-14']);
    expect([f.ano2.inicio, f.ano2.fim, f.ano3.inicio, f.ano3.fim]).toEqual(['2027-03-15', '2027-06-13', '2027-06-14', '2027-08-22']);
    expect([f.leve.inicio, f.leve.fim, f.ita.inicio, f.ita.fim, f.disc.fim, f.enem.inicio]).toEqual(['2027-08-23', '2027-08-29', '2027-08-30', '2027-09-26', '2027-10-22', '2027-10-23']);
  });
  it('se o portão passa antes da previsão, o Ano 1 e o Ano 2 se adiantam; o Ano 3 continua terminando em 22/08', () => {
    const c = cfg(); c.perfil.portaoEm = '2026-12-27';
    const f = Object.fromEntries(gerarFases(c).map((x) => [x.id, x]));
    expect(f.zero.fim).toBe('2026-12-27'); expect(f.ano1.inicio).toBe('2026-12-28');
    expect(f.ano1.fim).toBe('2027-02-28'); expect(f.ano2.fim).toBe('2027-05-30'); expect(f.ano3.fim).toBe('2027-08-22');
  });
  it('prorrogar a Fase 0 empurra o Ano 1 e o Ano 2 no mesmo tanto (sem passar do Ano 3)', () => {
    const c = cfg(); c.perfil.extraZero = 2;
    const f = Object.fromEntries(gerarFases(c).map((x) => [x.id, x]));
    expect(f.zero.fim).toBe('2027-01-24'); expect(f.ano1.fim).toBe('2027-03-28'); expect(f.ano2.fim).toBe('2027-06-27');
    expect(f.ano3.inicio).toBe('2027-06-28');
  });
  it('antes do início vale a primeira fase (Zero); depois da Zero vem o Ano 1', () => {
    const f = gerarFases(cfg());
    expect(faseDoDia(f, '2026-11-10').id).toBe('zero');
    expect(faseDoDia(f, '2026-11-16').id).toBe('zero');
    expect(faseDoDia(f, '2027-01-11').id).toBe('ano1');
    expect(faseDoDia(f, '2027-08-25').id).toBe('leve');
  });
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
    expect(b[0]).toMatchObject({ ini: '06:30', fim: '08:20', min: 100, bruto: 110 }); // 2 sessões de 50 min com 10 de pausa
    expect(b.every((x) => /^2026-11-23:[a-z]+(@\d{4})?$/.test(x.id))).toBe(true);
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
  it('dia mínimo: o dia vira um bloco de 45 min com 20 questões, da matéria do primeiro bloco de estudo', () => {
    const f = gerarFases(cfg()); const c = cfg();
    const normal = blocosDoDia(c, f, '2026-11-23');
    const l = blocosAjustados(c, f, '2026-11-23', { dificeis: { '2026-11-23': true } });
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ id: '2026-11-23:minimo', cat: 'minimo', min: 45, questoes: 20, essencial: true, materia: normal[0].materia });
    expect(l[0].titulo).toBe(`Dia mínimo · ${normal[0].materia}`);
    // domingo (só redação e planejamento): cai em Matemática
    expect(blocosAjustados(c, f, '2026-11-29', { dificeis: { '2026-11-29': true } })[0].materia).toBe('Matemática');
    // em outro dia nada muda
    expect(blocosAjustados(c, f, '2026-11-24', { dificeis: { '2026-11-23': true } }).length).toBeGreaterThan(2);
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
    expect(Object.keys(novo.fases)).toHaveLength(8);
    expect(novo.carta).toBe('minha carta');
    expect(novo.links.Matemática).toBe('https://x');
    expect(novo.versaoSeed).toBe(seed.versaoSeed);
    expect(migrarCfg(novo, cfg())).toBe(novo); // já migrada: não mexe
  });
  it('as 8 fases seguem a ordem e o ENEM vai do fim das discursivas até a prova', () => {
    const f = gerarFases(cfg());
    expect(f[6]).toMatchObject({ id: 'disc', fim: '2027-10-22' });
    expect(f[7]).toMatchObject({ id: 'enem', inicio: '2027-10-23', fim: '2027-11-15' });
    expect(f[3]).toMatchObject({ id: 'ano3', inicio: '2027-06-14', fim: '2027-08-22' });
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
    expect(f.every((x) => x.nome && x.numero != null)).toBe(true); // a Fase 0 tem numero 0
    const sabado = '2027-06-12';
    const prova = blocosDoDia(novo, f, sabado).find((b) => b.cat === 'prova' && !b.sessoes);
    expect(prova.titulo).not.toMatch(/undefined/);
  });
  it('sem a ESA no cadastro, as fases ainda se formam', () => {
    const c = cfg();
    c.concursos = c.concursos.filter((x) => x.id !== 'esa');
    const f = gerarFases(c);
    expect(f.find((x) => x.id === 'ano2')).toMatchObject({ inicio: '2027-03-15', fim: '2027-06-13' });
  });
});

import { topicosDe, proximoTopico, cobertura, migrarLacunas, dominio } from '../src/lib/trilha.js';
describe('trilha', () => {
  const c = cfg();
  it('matérias × concursos: Química só ITA, Hist/Geo só ESA, Cálculo só EN', () => {
    expect(topicosDe(c, 'Química')[0].concursos).toEqual(['ita']);
    expect(topicosDe(c, 'Hist/Geo')[0].concursos).toEqual(['esa']);
    const calc = topicosDe(c, 'Matemática').at(-1);
    expect(calc.nome).toMatch(/Integrais/); expect(calc.concursos).toEqual(['en']);
    expect(topicosDe(c, 'Matemática')[0].concursos).toEqual(['en', 'efomm', 'ita', 'esa']);
    expect(topicosDe(c, 'Física')[0].concursos).toEqual(['en', 'efomm', 'ita']);
  });
  it('trilha de Matemática segue a ordem do plano: Fase 0 e depois Anos 1, 2 e 3 (códigos da §5)', () => {
    const todos = topicosDe(c, 'Matemática');
    expect(todos.map((t) => t.codigo).slice(0, 4)).toEqual(['TN01', 'MB01', 'MB03', 'MB04']);
    expect(todos.filter((t) => t.ano === 0)).toHaveLength(11);
    const anos = todos.map((t) => t.ano);
    expect([...anos].sort((x, y) => x - y)).toEqual(anos); // fixa: 0, 1, 2, 3
    expect(todos.at(-1).codigo).toBe('CL04');
    expect(topicosDe(c, 'Física')[0].codigo).toBe('F-MD01'); expect(topicosDe(c, 'Química')[0].codigo).toBe('Q-IN01');
    // os pré-requisitos da §4
    const f = (cod) => topicosDe(c, 'Física').find((t) => t.codigo === cod);
    expect(f('F-CN02').prereq).toEqual(['MB02']); expect(f('F-OD03').prereq).toEqual(['TG03', 'LOG02']);
    expect(topicosDe(c, 'Química').find((t) => t.codigo === 'Q-RA01').prereq).toEqual(['LOG01']);
  });
  it('próximo tópico: respeita a ordem e prefere o que serve a mais concursos dentro da janela', () => {
    expect(proximoTopico(c, {}, 'Matemática').ordem).toBe(0);
    const todos = topicosDe(c, 'Matemática');
    // tudo dominado menos os 5 últimos (só Escola Naval: 1 concurso) e GP06 (4 concursos): GP06 vem antes
    const lac = Object.fromEntries(todos.map((t) => [t.nome, 3]));
    delete lac['Triângulos e pontos notáveis']; delete lac.Limites; delete lac.Derivadas;
    expect(proximoTopico(c, { Matemática: lac }, 'Matemática').codigo).toBe('GP06');
    expect(proximoTopico(c, { 'Hist/Geo': Object.fromEntries(topicosDe(c, 'Hist/Geo').map((t) => [t.nome, 3])) }, 'Hist/Geo')).toBeNull();
  });
  it('cobertura e domínio', () => {
    const l = { Física: Object.fromEntries(topicosDe(c, 'Física').map((t) => [t.nome, 3])) };
    expect(cobertura(c, l, 'Física')).toBe(1);
    expect(cobertura(c, {}, 'Física')).toBe(0);
    expect(dominio({}, 'Física', 'x')).toBe(0);
  });
  it('notas dos tópicos antigos passam para os novos pelo campo `antigos` (menor nota); o resto começa sem nota', () => {
    const velho = { Matemática: { 'Conjuntos, lógica e funções': 2, MMC: 3, MDC: 1, 'Teorema de Pitágoras': 3 }, Física: { Fluidos: 2 } };
    const novo = migrarLacunas(velho, c.topicos);
    expect(novo.Matemática['Divisibilidade, MMC e MDC']).toBe(1); // MMC 3, MDC 1: vale a menor
    expect(novo.Matemática['Triângulo retângulo']).toBe(3);
    expect(novo.Matemática['Função: definições']).toBe(2);
    expect(novo.Matemática['Frações e equações']).toBeUndefined();
    expect(novo.Física['Hidrodinâmica']).toBe(2);
    expect(migrarLacunas(novo, c.topicos)).toEqual(novo); // idempotente
  });
});

import { janelasDaSemana, janelasDoDia } from '../src/lib/rotina.js';
import { planoSemana, orcamentoSemana, slotsDaJanela, brutoDeSlots, toMin, repartir, repartirComTeto, janelasValidas } from '../src/lib/semana.js';
import { planoDoBloco, iniciar as foco_iniciar } from '../src/lib/foco.js';
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
  it('as horas por matéria seguem a % da fase sobre 56 h (menos resgate e domingo) e a semana fecha perto de 55–58 h líquidas', () => {
    const o = orcamentoSemana(cfg(), 'zero', '2026-11-23');
    expect(o).toMatchObject({ mat: 1716, fis: 780, qui: 374, por: 187, red: 0, ing: 62, hg: 0, provas: 0 }); // 55/25/12/6/2 % de 3120 min (56 h menos 2 h de resgate e 2 h de domingo)
    const a1 = orcamentoSemana(cfg(), 'ano1', '2027-01-18');
    expect(a1).toMatchObject({ mat: 1186, fis: 998, qui: 468, por: 187, red: 156, ing: 125, hg: 0 }); // 38/32/15/6/5/4 % de 3120
    const dias = semana('2026-11-23');
    expect(liquido(dias)).toBeGreaterThan(49.5 * 60); expect(liquido(dias)).toBeLessThan(59 * 60);
    const mat = dias.flatMap((d) => d.blocos).filter((b) => b.cat === 'mat').reduce((a, b) => a + b.min, 0);
    expect(Math.abs(mat - 1716)).toBeLessThanOrEqual(200);
  });
  it('sem horas de Hist/Geo (a ESA fica só no calendário); sábados de jun a ago têm prova antiga e correção, e o resgate de 2 h', () => {
    const por = (dias, cat) => dias.flatMap((d) => d.blocos).filter((b) => b.cat === cat).reduce((a, b) => a + b.min, 0);
    for (const seg of ['2026-11-23', '2027-02-08', '2027-06-07', '2027-08-09']) expect(por(semana(seg), 'hg')).toBe(0);
    for (const seg of ['2027-06-07', '2027-07-12', '2027-08-09']) {
      const dias = semana(seg);
      expect(dias[5].blocos.slice(0, 2).map((b) => b.cat)).toEqual(['prova', 'corr']);
      expect(dias[5].blocos.find((b) => b.cat === 'prova').sessoes).toBe(0); // contínua
      expect(dias[5].blocos.find((b) => b.cat === 'resg')).toMatchObject({ sessoes: 0, min: 120, bruto: 120 }); // 2 h contínuas
    }
    expect(semana('2027-02-08')[5].blocos.some((b) => b.cat === 'prova')).toBe(false); // fora de jun a ago: sem prova
    expect(semana('2027-02-08')[5].blocos.find((b) => b.cat === 'resg')).toBeTruthy();
    // a prova é da EFOMM em junho/julho e da Escola Naval em agosto
    const g = gerarFases(cfg());
    const titulo = (d) => blocosDoDia(cfg(), g, d).find((b) => b.cat === 'prova' && !b.sessoes).titulo;
    expect(titulo('2027-07-10')).toMatch(/EFOMM/); expect(titulo('2027-08-14')).toMatch(/Escola Naval/);
  });
  it('encaixe nas janelas: todo bloco cabe numa janela do dia, sem sobreposição e com pausa de 10 min', () => {
    const c = cfg();
    for (const seg of ['2026-11-23', '2027-03-08', '2027-06-07', '2027-09-13']) {
      for (const d of semana(seg, c)) {
        const janelas = janelasDoDia(c, d.wd).map((j) => [toMin(j.ini), toMin(j.fim)]);
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
  it('sábado: prova antiga cronometrada e correção; domingo: revisão leve no começo e planejamento no fim (2 h)', () => {
    const dias = semana('2027-06-07'); // fase com provas > 0
    expect(dias[5].blocos.slice(0, 2).map((b) => b.cat)).toEqual(['prova', 'corr']);
    expect(dias[5].blocos[0].ini).toBe(toMin('08:00'));
    const dom = dias[6].blocos;
    expect(dom[0]).toMatchObject({ cat: 'revl', ini: toMin('15:00'), sessoes: 0 });
    expect(dom.at(-1)).toMatchObject({ cat: 'plan', fim: toMin('17:00') });
    expect(dom.reduce((a, b) => a + b.bruto, 0)).toBeLessThanOrEqual(120);
    expect(dias[6].blocos.some((b) => b.cat === 'red')).toBe(false); // a redação vai para um dia útil
  });
  it('redação: 1 bloco por semana, numa quarta, a partir do Ano 1 (e nenhum na Fase 0)', () => {
    const dias = semana('2027-01-18');
    const reds = dias.flatMap((d) => d.blocos.filter((b) => b.cat === 'red').map((b) => ({ wd: d.wd, b })));
    expect(reds).toHaveLength(1); expect(reds[0].wd).toBe(3); expect(reds[0].b.sessoes).toBeGreaterThanOrEqual(2);
    expect(semana('2026-11-23').flatMap((d) => d.blocos).some((b) => b.cat === 'red')).toBe(false);
  });
  it('24–25/12 e 31/12–01/01 são livres (sem blocos de estudo)', () => {
    const dias = semana('2026-12-21');
    expect(dias[3].blocos).toEqual([]); expect(dias[4].blocos).toEqual([]); // 24 e 25
    expect(dias[2].blocos.length).toBeGreaterThan(0);
    const fim = semana('2026-12-28');
    expect(fim[3].blocos).toEqual([]); expect(fim[4].blocos).toEqual([]); // 31 e 01
  });
  it('cada dia respeita a meta do dia (seg/qua/qui/sex ~9,5–10 h, ter ~8 h, sáb 8 h, dom 2 h)', () => {
    const dias = semana('2026-11-23');
    const h = (d) => d.blocos.reduce((a, b) => a + b.min, 0) / 60;
    [0, 2].forEach((i) => { expect(h(dias[i])).toBeGreaterThanOrEqual(9.5); expect(h(dias[i])).toBeLessThanOrEqual(10); });
    // com a Santa Missa: quinta (sem estudo depois da missa) ~8 h e sexta (missa + corrida às 7h30) ~7,7 h
    [3, 4].forEach((i) => { expect(h(dias[i])).toBeGreaterThanOrEqual(7.5); expect(h(dias[i])).toBeLessThanOrEqual(8.6); });
    expect(h(dias[1])).toBeGreaterThanOrEqual(7.5); expect(h(dias[1])).toBeLessThanOrEqual(8.4);
    expect(h(dias[5])).toBeGreaterThanOrEqual(7.5); expect(h(dias[5])).toBeLessThanOrEqual(8.4);
    expect(h(dias[6])).toBeLessThanOrEqual(2);
  });
  it('fases sem provas (zero e base): sábado não tem bloco de prova nem de correção', () => {
    for (const seg of ['2026-11-23', '2027-03-08']) {
      const cats = semana(seg)[5].blocos.map((b) => b.cat);
      expect(cats).not.toContain('prova'); expect(cats).not.toContain('corr');
      expect(semana(seg)[5].blocos.some((b) => b.sessoes)).toBe(true);
    }
  });
  it('rampa de 75% nas 2 primeiras semanas do planner (depois da semana diagnóstica), quando ligada', () => {
    const c = cfg(); c.rotina.rampa.ativa = true;
    const cheio = Math.round(3120 * 0.38), rampa = Math.round(3120 * 0.75 * 0.38);
    expect(orcamentoSemana(c, 'ano1', '2026-11-16').mat).toBe(rampa); // 1ª semana do planner
    expect(orcamentoSemana(c, 'ano1', '2026-11-23').mat).toBe(rampa); // 2ª
    expect(orcamentoSemana(c, 'ano1', '2026-11-30').mat).toBe(cheio); // a partir da 3ª, cheio
    expect(orcamentoSemana(c, 'ano1', '2026-11-09').mat).toBe(cheio); // semana diagnóstica não entra
    expect(orcamentoSemana(cfg(), 'ano1', '2026-11-16').mat).toBe(cheio); // desligada
  });
  it('matéria abaixo de 50% no último simulado: +2h na semana seguinte, tiradas da mais forte', () => {
    const exams = { a: { id: 'a', data: '2026-11-21', concurso: 'efomm', notas: { Matemática: 80, Física: 40, Português: 60 } } };
    const base = orcamentoSemana(cfg(), 'ano1', '2026-11-23');
    const o = orcamentoSemana(cfg(), 'ano1', '2026-11-23', { exams });
    expect(o.fis - base.fis).toBe(120);
    expect(base.mat - o.mat).toBe(120); // Matemática (80%) é a mais forte
    // duas semanas depois a regra já não vale
    expect(orcamentoSemana(cfg(), 'ano1', '2026-12-07', { exams }).fis).toBe(base.fis);
  });
  it('inglês com 75% ou mais: só manutenção (1h) e o resto vai para a Matemática', () => {
    const exams = { a: { id: 'a', data: '2026-11-14', concurso: 'efomm', notas: { Inglês: 80 } } };
    const base = orcamentoSemana(cfg(), 'ano1', '2026-11-23');
    const o = orcamentoSemana(cfg(), 'ano1', '2026-11-23', { exams });
    expect(o.ing).toBe(60);
    expect(o.mat - base.mat).toBe(base.ing - 60);
  });
  it('semana antes da prova: revisão leve reduz o estudo do dia', () => {
    const c = cfg(); const g = gerarFases(c);
    const cheio = blocosDoDia(c, g, '2027-07-14').filter((b) => b.sessoes).length; // 11 dias antes da EFOMM
    const leve = blocosDoDia(c, g, '2027-07-21').filter((b) => b.sessoes).length; // dentro dos 7 dias
    expect(leve).toBeLessThan(cheio);
  });
  it('configuração antiga é migrada: rotina nova entra, janelas passam a ser calculadas e as aulas do seed substituem as antigas', () => {
    const velho = cfg(); delete velho.versaoSeed;
    velho.rotina = { aulas: [{ dia: 1, inicio: '07:30', fim: '11:10', nome: 'Faculdade' }, { dia: 3, inicio: '09:30', fim: '10:10', nome: 'Faculdade' }], metaHoras: { 1: 4 }, janelas: { 1: [{ ini: '06:00', fim: '07:00' }] } };
    delete velho.horasFase; delete velho.categorias;
    const novo = migrarCfg(velho, cfg());
    expect(novo.rotina.janelas).toBeUndefined();
    expect(novo.rotina.metaLiquida).toBe(56);
    expect(novo.rotina.metaHoras).toBeUndefined();
    expect(novo.rotina.aulas.find((a) => a.dia === 4)).toMatchObject({ inicio: '13:30', tipo: 'faculdade', vou: false });
    expect(novo.horasFase.ano1.mat).toBe(38);
    // compromissos que você cadastrou são mantidos
    const editado = cfg(); delete editado.versaoSeed; editado.rotina = { aulas: [{ dia: 2, inicio: '08:00', fim: '09:00', nome: 'Minha aula' }] };
    const m = migrarCfg(editado, cfg()).rotina.aulas;
    expect(m.find((a) => a.nome === 'Minha aula')).toEqual({ dia: 2, inicio: '08:00', fim: '09:00', nome: 'Minha aula' });
    expect(m.some((a) => a.tipo === 'faculdade')).toBe(true);
  });
});

describe('planner v2: casos de borda (revisão)', () => {
  const f = gerarFases(cfg());
  const fixar = (c) => { c.rotina.janelas = structuredClone(janelasDaSemana(c)); return c; }; // janelas à mão valem no lugar das calculadas
  const sem = (c, seg = '2026-11-23', ctx = {}) => planoSemana(c, f, seg, ctx);
  const sessoes = (dias) => dias.flatMap((d) => d.blocos).reduce((n, b) => n + (b.sessoes || 0), 0); // total de sessões de 50 min
  const semOverlap = (dias) => dias.forEach((d) => { for (let i = 1; i < d.blocos.length; i++) expect(d.blocos[i].ini).toBeGreaterThanOrEqual(d.blocos[i - 1].fim); });

  it('hora vazia, inválida ou fim antes do início: a janela é ignorada e a semana não zera', () => {
    const c = fixar(cfg());
    const base = sessoes(sem(cfg()));
    c.rotina.janelas[3][1].fim = ''; // apagou o fim da janela de quarta
    c.rotina.janelas[4][0].ini = '25:99';
    c.rotina.janelas[2][2] = { ini: '18:00', fim: '16:00' }; // fim antes do início
    const dias = sem(c);
    expect(sessoes(dias)).toBeGreaterThan(20);
    expect(sessoes(dias)).toBeLessThanOrEqual(base);
    dias.forEach((d) => d.blocos.forEach((b) => { expect(Number.isFinite(b.ini)).toBe(true); expect(Number.isFinite(b.fim)).toBe(true); }));
    expect(janelasValidas([{ ini: '', fim: '10:00' }, { ini: '09:00', fim: '08:00' }, {}, null])).toEqual([]);
  });
  it('janelas que se sobrepõem são juntadas: nenhum bloco sobreposto', () => {
    const c = fixar(cfg());
    c.rotina.janelas[2].push({ ini: '10:00', fim: '11:00' }); // dentro da janela 7–12 de terça
    c.rotina.janelas[2].push({ ini: '11:30', fim: '13:30' }); // atravessa o intervalo até 13–15
    const dias = sem(c);
    semOverlap(dias);
    expect(janelasValidas([{ ini: '07:00', fim: '12:00' }, { ini: '10:00', fim: '11:00' }, { ini: '11:30', fim: '13:30' }])).toEqual([{ ini: 420, fim: 810, tipo: undefined }]);
  });
  it('janelas extras de sábado e domingo viram estudo normal (e sábado tem pausa depois da correção)', () => {
    const c = fixar(cfg()); delete c.rotina.metaDia; // sem teto por dia: só as janelas
    c.rotina.janelas[6] = [{ ini: '08:00', fim: '15:00', tipo: 'prova' }, { ini: '18:00', fim: '20:00' }]; // sábado com a janela longa da prova, para sobrar estudo logo depois da correção
    c.rotina.janelas[0].push({ ini: '18:00', fim: '20:00' });
    const dias = sem(c, '2027-06-07'); // fase com provas > 0
    expect(dias[5].blocos.some((b) => b.sessoes && b.ini >= toMin('18:00'))).toBe(true);
    expect(dias[6].blocos.some((b) => b.sessoes && b.ini >= toMin('18:00'))).toBe(true);
    const sab = dias[5].blocos, corr = sab.find((b) => b.cat === 'corr'), prox = sab.find((b) => b.cat === 'resg' || b.sessoes);
    expect(prox.ini - corr.fim).toBe(10);
    semOverlap(dias);
  });
  it('regra dos 50% inclui a Redação e funciona com um simulado de uma matéria só', () => {
    const base = orcamentoSemana(cfg(), 'ano1', '2026-11-23');
    const red = orcamentoSemana(cfg(), 'ano1', '2026-11-23', { exams: { a: { id: 'a', data: '2026-11-21', concurso: 'en', notas: { Redação: 40, Matemática: 80 } } } });
    expect(red.red - base.red).toBe(120); expect(base.mat - red.mat).toBe(120);
    // simulado só de Física, fraca: a doadora é a matéria com mais horas (Matemática)
    const so = orcamentoSemana(cfg(), 'ano1', '2026-11-23', { exams: { a: { id: 'a', data: '2026-11-22', concurso: 'ita', notas: { Física: 40 } } } });
    expect(so.fis - base.fis).toBe(120); expect(base.mat - so.mat).toBe(120);
  });
  it('limites da regra dos 50%: simulado na própria segunda ou 8 dias antes não vale', () => {
    const base = orcamentoSemana(cfg(), 'ano1', '2026-11-23');
    const com = (data) => orcamentoSemana(cfg(), 'ano1', '2026-11-23', { exams: { a: { id: 'a', data, concurso: 'en', notas: { Física: 40, Matemática: 90 } } } }).fis - base.fis;
    expect(com('2026-11-22')).toBe(120); // 1 dia antes
    expect(com('2026-11-16')).toBe(120); // 7 dias antes
    expect(com('2026-11-15')).toBe(0);   // 8 dias antes
    expect(com('2026-11-23')).toBe(0);   // na própria segunda
  });
  it('bloco contínuo (prova, correção, redação) vira uma sessão só no cronômetro, sem descontar pausa', () => {
    const dias = sem(cfg(), '2027-06-07');
    const red = dias[6].blocos.find((b) => b.cat === 'revl'), corr = dias[5].blocos.find((b) => b.cat === 'corr');
    expect(planoDoBloco(red)).toMatchObject({ sessoes: 1, len: red.min });
    expect(planoDoBloco(corr)).toMatchObject({ sessoes: 1, len: corr.min });
    const dois = { sessoes: 2, bruto: 110, min: 100 };
    expect(planoDoBloco(dois)).toMatchObject({ sessoes: 2, len: 50 });
    expect(foco_iniciar({ id: 'x', titulo: 't', materia: 'm', ...red }, undefined, 0)).toMatchObject({ sessoes: 1, len: red.min });
  });
  it('o id do bloco usa o horário: editar outra janela não troca o id dos blocos que não mudaram', () => {
    const c = fixar(cfg()); const g = gerarFases(c);
    const antes = blocosDoDia(c, g, '2026-11-23').find((b) => b.ini === '06:30');
    c.rotina.janelas[2][0].fim = '11:00'; // mexe só na terça
    const depois = blocosDoDia(c, g, '2026-11-23').find((b) => b.ini === '06:30');
    expect(depois.id).toBe(antes.id);
    expect(antes.id).toMatch(/^2026-11-23:[a-z]+@0630$/);
  });
  it('migração: a meta que você editou e a rampa sobrevivem; janelas antigas viram as calculadas', () => {
    const salvo = cfg(); salvo.versaoSeed = 3;
    salvo.rotina.janelas = { 1: [{ ini: '05:00', fim: '07:00' }] }; salvo.rotina.metaLiquida = 38; salvo.rotina.rampa.ativa = true;
    salvo.modeloSemana = { util: [] };
    const novo = migrarCfg(salvo, cfg());
    expect(novo.rotina.janelas).toBeUndefined();
    expect(novo.rotina.metaLiquida).toBe(38); expect(novo.rotina.rampa.ativa).toBe(true);
    expect(novo.modeloSemana).toBeUndefined();
  });
});

import { series, principalDe, recursosAtivos, vinculosDoTopico, temPaginas, ritmoDe, ritmoQuestoes, proximaPagina, progresso, cotaPaginas, registrarLeitura, pararNaPagina, novoRecurso, mesclarBiblioteca, slug } from '../src/lib/livros.js';
describe('Meus livros', () => {
  const c = cfg();
  const iezzi3 = () => ({ id: 'x', recurso: 'iezzi-3', materia: 'Matemática', topico: 'Trigonometria', pagIni: 1, pagFim: 100, exIni: 1, exFim: 50 });
  const rec = (id) => c.biblioteca.recursos.find((r) => r.id === id);

  it('o seed tem a biblioteca do SPEC §7, sem páginas, e todo vínculo aponta para recurso e tópico que existem', () => {
    const b = c.biblioteca;
    expect(b.recursos.filter((r) => r.serie === 'iezzi')).toHaveLength(11);
    expect(b.recursos.filter((r) => r.serie === 'topicos-fisica')).toHaveLength(3);
    for (const v of b.vinculos) {
      expect(rec(v.recurso), v.id).toBeTruthy();
      // vínculos podem apontar para tópicos da Fase 0 (ex.: Feltre v.1 -> Química fase 0)
      expect(c.topicos[v.materia].some((t) => t.nome === v.topico), v.id).toBe(true);
      expect(temPaginas(v)).toBe(false); // sem páginas: você cadastra
    }
    expect(b.vinculos.some((v) => v.recurso === 'feltre-1' && c.topicos.Química.find((t) => t.nome === v.topico)?.fase === 0)).toBe(true);
    for (const id of ['khan-mat', 'quim-intro']) expect(rec(id), id).toBeTruthy();
    for (const r of b.recursos) { expect(c.materias).toContain(r.materia); if (r.link) expect(r.link).toMatch(/^https:\/\//); }
    expect(b.recursos.filter((r) => r.link).every((r) => r.linkStatus === 'visto na busca')).toBe(true);
    for (const m of Object.keys(b.principal)) if (b.principal[m]) expect(series(c, m).some((s) => s.id === b.principal[m])).toBe(true);
  });
  it('Física Clássica é o livro principal; Tópicos de Física fica como opção e só vale quando escolhido', () => {
    expect(principalDe(c, 'Física')).toBe('fisica-classica');
    expect(series(c, 'Física').map((s) => s.id)).toEqual(['fisica-classica', 'topicos-fisica']);
    expect(recursosAtivos(c, 'Física').some((r) => r.serie === 'topicos-fisica')).toBe(false);
    expect(recursosAtivos(c, 'Física').some((r) => r.id === 'fisica-total')).toBe(true); // vídeos valem sempre
    const d = cfg(); d.biblioteca.principal.Física = 'topicos-fisica';
    expect(recursosAtivos(d, 'Física').filter((r) => r.serie === 'topicos-fisica')).toHaveLength(3);
    expect(vinculosDoTopico(d, 'Física', 'Energia mecânica')[0].recurso).toBe('topicos-fisica-1');
    expect(vinculosDoTopico(c, 'Física', 'Energia mecânica')).toHaveLength(0);
    expect(principalDe(c, 'Química')).toBe('feltre');
  });
  it('cota de páginas: 10 pág/h x 2 h = 20 páginas, a partir do início', () => {
    const v = iezzi3();
    expect(cotaPaginas(v, null, 120, 10)).toMatchObject({ de: 1, ate: 20, n: 20, restante: 80, concluido: false });
    expect(cotaPaginas({ ...v, pagIni: null }, null, 120, 10)).toBeNull(); // sem páginas: nada de cota
  });
  it('continua de onde parou e o que não foi feito vai para o próximo bloco', () => {
    const v = iezzi3();
    let l = null;
    expect(cotaPaginas(v, l, 100, 10)).toMatchObject({ de: 1, ate: 17 });
    l = registrarLeitura(l, v, 12, 100, '2026-11-23'); // fez só 12 das 17
    expect(proximaPagina(v, l)).toBe(13);
    expect(cotaPaginas(v, l, 100, 10)).toMatchObject({ de: 13, ate: 29 }); // as 5 que faltaram entram no próximo
    expect(progresso(v, l)).toBeCloseTo(0.12);
    l = pararNaPagina(l, v, 60);
    expect(proximaPagina(v, l)).toBe(61);
  });
  it('termina o livro sem passar do fim e avisa que concluiu', () => {
    const v = iezzi3();
    const l = { proxima: 95, registros: [] };
    expect(cotaPaginas(v, l, 120, 10)).toMatchObject({ de: 95, ate: 100, restante: 0 });
    const fim = registrarLeitura(l, v, 50, 60, 'd');
    expect(fim.proxima).toBe(101);
    expect(cotaPaginas(v, fim, 60, 10)).toEqual({ concluido: true });
    expect(progresso(v, fim)).toBe(1);
  });
  it('exercícios andam na mesma proporção das páginas', () => {
    const v = iezzi3(); // 100 páginas, 50 exercícios
    expect(cotaPaginas(v, null, 120, 10).ex).toEqual({ de: 1, ate: 10 }); // 20% das páginas = 10 exercícios
    const l = { proxima: 51, registros: [] };
    expect(cotaPaginas(v, l, 60, 10)).toMatchObject({ de: 51, ate: 60, ex: { de: 26, ate: 30 } });
    expect(cotaPaginas({ ...v, exIni: '', exFim: '' }, null, 60, 10).ex).toBeNull();
  });
  it('ritmo: teoria 10/h, gramática 15/h; ajusta pelo que você registrar', () => {
    expect(ritmoDe(c, rec('iezzi-3')).ritmo).toBe(10);
    expect(ritmoDe(c, rec('cegalla')).ritmo).toBe(15);
    expect(ritmoDe(c, rec('iezzi-3'), []).ajustado).toBe(false);
    const rapido = ritmoDe(c, rec('iezzi-3'), [{ pags: 40, min: 120 }]); // 20 pág/h em 2 h
    expect(rapido.ajustado).toBe(true); expect(rapido.ritmo).toBeGreaterThan(10); expect(rapido.ritmo).toBeLessThan(20);
    const muitoDados = ritmoDe(c, rec('iezzi-3'), [{ pags: 150, min: 600 }]); // 15 pág/h em 10 h: vale o real
    expect(muitoDados.ritmo).toBeCloseTo(15);
    expect(ritmoDe(c, rec('iezzi-3'), [{ pags: 1000, min: 60 }]).ritmo).toBe(25); // limitado a 2,5x
  });
  it('questões por hora: 6 (EN/EFOMM) e 3 (ITA)', () => {
    expect(ritmoQuestoes(c, 'en')).toBe(6); expect(ritmoQuestoes(c, 'efomm')).toBe(6); expect(ritmoQuestoes(c, 'ita')).toBe(3);
  });
  it('cadastrar recurso: id único, série pelo título e link do usuário', () => {
    const r = novoRecurso(c, { tipo: 'livro', materia: 'Química', titulo: 'Química Geral', volume: '1', link: ' https://x.com ' });
    expect(r).toMatchObject({ id: 'quimica-geral-1', serie: 'quimica-geral', link: 'https://x.com', linkStatus: 'informado por você' });
    c.biblioteca.recursos.push(r);
    expect(novoRecurso(c, { tipo: 'livro', materia: 'Química', titulo: 'Química Geral', volume: '1' }).id).toBe('quimica-geral-1-2');
    expect(slug('Física Clássica (2ª ed.)')).toBe('fisica-classica-2-ed');
  });
  it('migração: o que você cadastrou e editou fica; recursos novos do seed entram; o que você apagou não volta', () => {
    const salva = structuredClone(c.biblioteca);
    salva.recursos = salva.recursos.filter((r) => r.id !== 'cegalla' && r.id !== 'portal-obmep');
    salva.removidos = ['cegalla'];
    salva.recursos.push({ id: 'meu', tipo: 'livro', materia: 'Química', titulo: 'Meu livro', link: '', linkStatus: 'a confirmar' });
    salva.recursos.find((r) => r.id === 'iezzi-3').link = 'https://meu-link';
    salva.vinculos.find((v) => v.recurso === 'iezzi-3').pagIni = 7;
    salva.principal.Matemática = 'iezzi'; salva.principal.Física = 'topicos-fisica';
    const antigoSemLink = salva.recursos.find((r) => r.id === 'matzero'); antigoSemLink.link = ''; antigoSemLink.linkStatus = 'a confirmar';
    const novo = mesclarBiblioteca(salva, c.biblioteca);
    const ids = novo.recursos.map((r) => r.id);
    expect(ids).toContain('meu'); expect(ids).not.toContain('cegalla'); expect(ids).toContain('portal-obmep');
    expect(novo.recursos.find((r) => r.id === 'iezzi-3').link).toBe('https://meu-link');
    expect(novo.vinculos.find((v) => v.recurso === 'iezzi-3').pagIni).toBe(7);
    expect(novo.principal.Física).toBe('topicos-fisica');
    expect(novo.recursos.find((r) => r.id === 'matzero').link).toMatch(/youtube/); // quem não tinha link recebe o novo
    expect(novo.vinculos.some((v) => v.recurso === 'cegalla')).toBe(false);
    expect(mesclarBiblioteca(undefined, c.biblioteca)).toEqual(c.biblioteca);
  });
  it('configuração antiga ganha a biblioteca ao migrar', () => {
    const velho = cfg(); delete velho.biblioteca; velho.versaoSeed = 4;
    const novo = migrarCfg(velho, cfg());
    expect(novo.biblioteca.recursos.length).toBeGreaterThan(20); expect(novo.versaoSeed).toBe(seed.versaoSeed); expect(novo.ritmos.teoria).toBe(10);
  });
});

import { tarefasDoDia, divisaoBloco, fontesQuestoes, aplicarCota, acertoPorTopico, deltaResultado, linksDe, videoDe, limitesCota } from '../src/lib/tarefas.js';
import { ajustarLeitura } from '../src/lib/livros.js';
describe('bloco = tarefa exata', () => {
  const novo = () => {
    const c = cfg();
    const v = c.biblioteca.vinculos.find((x) => x.id === 'iezzi-1|Teoria de conjuntos');
    Object.assign(v, { pagIni: 1, pagFim: 100, exIni: 1, exFim: 50 });
    return c;
  };
  const lac = { Matemática: { ...dominarFase0(cfg()).Matemática } }; // Fase 0 dominada (ctx.faseId 'ano1'); próximo tópico: Teoria de conjuntos
  const bl = (id, min = 100, materia = 'Matemática', cat = 'mat') => ({ id: `2026-11-23:${id}`, cat, materia, min });

  it('divisão do bloco: vídeo 25, teoria 45, questões 30; sem vídeo ou sem páginas, redistribui', () => {
    const c = cfg();
    expect(divisaoBloco(c, 100, { video: true, paginas: true })).toEqual({ video: 25, teoria: 45, questoes: 30 });
    expect(divisaoBloco(c, 100, { video: false, paginas: true })).toEqual({ video: 0, teoria: 60, questoes: 40 });
    expect(divisaoBloco(c, 100, { video: true, paginas: false })).toEqual({ video: 45, teoria: 0, questoes: 55 });
    expect(divisaoBloco(c, 100, { video: false, paginas: false })).toEqual({ video: 0, teoria: 0, questoes: 100 });
    const d = divisaoBloco(c, 110, { video: true, paginas: true });
    expect(d.video + d.teoria + d.questoes).toBe(110);
  });
  it('tarefa completa: tópico da Trilha, vídeo, páginas, exercícios e questões', () => {
    const c = novo();
    const t = tarefasDoDia(c, [bl('mat@0600')], { lacunas: lac, faseId: 'ano1' })['2026-11-23:mat@0600'];
    expect(t.topico).toBe('Teoria de conjuntos');
    expect(t.video).toMatchObject({ min: 25 }); expect(t.video.url).toMatch(/^https:/);
    expect(t.paginas).toMatchObject({ de: 1, ate: 8, n: 8, min: 45, vinculoId: 'iezzi-1|Teoria de conjuntos' });
    expect(t.paginas.livro).toBe('Fundamentos de Matemática Elementar v.1');
    expect(t.exercicios).toEqual({ de: 1, ate: 4 });
    expect(t.questoes.n).toBe(3); // 30 min a 6 questões/h
    expect(t.semPaginas).toBe(false);
  });
  it('sem páginas cadastradas: mostra vídeo e questões e pede para cadastrar as páginas', () => {
    const t = tarefasDoDia(cfg(), [bl('mat@0600')], { lacunas: lac, faseId: 'ano1' })['2026-11-23:mat@0600'];
    expect(t.paginas).toBeNull(); expect(t.semPaginas).toBe(true); expect(t.temLivro).toBe(true);
    expect(t.video.min).toBe(45); expect(t.partes.questoes).toBe(55);
  });
  it('vários blocos da mesma matéria no dia continuam de onde o anterior parou; blocos feitos ficam de fora', () => {
    const c = novo();
    const blocos = [bl('mat@0600'), bl('mat@1230'), bl('mat@1630')];
    const t = tarefasDoDia(c, blocos, { lacunas: lac, faseId: 'ano1' });
    expect(t[blocos[0].id].paginas).toMatchObject({ de: 1, ate: 8 });
    expect(t[blocos[1].id].paginas).toMatchObject({ de: 9, ate: 16 });
    expect(t[blocos[2].id].paginas).toMatchObject({ de: 17, ate: 24 });
    // o primeiro já foi feito e a leitura andou: o segundo começa na 9
    const feito = tarefasDoDia(c, blocos, { lacunas: lac, faseId: 'ano1', done: { [blocos[0].id]: {} }, leitura: { 'iezzi-1|Teoria de conjuntos': { proxima: 9, registros: [] } } });
    expect(feito[blocos[0].id]).toBeUndefined();
    expect(feito[blocos[1].id].paginas.de).toBe(9);
  });
  it('quando o tópico acaba o livro no dia, o bloco seguinte passa ao próximo tópico', () => {
    const c = novo(); c.biblioteca.vinculos.find((x) => x.id === 'iezzi-1|Teoria de conjuntos').pagFim = 10;
    const blocos = [bl('mat@0600'), bl('mat@1230'), bl('mat@1630')];
    const t = tarefasDoDia(c, blocos, { lacunas: lac, faseId: 'ano1' });
    expect(t[blocos[0].id].topico).toBe('Teoria de conjuntos');
    expect(t[blocos[1].id]).toMatchObject({ topico: 'Teoria de conjuntos', paginas: { de: 9, ate: 10, restante: 0 } });
    expect(t[blocos[2].id].topico).toBe('Conjuntos numéricos');
  });
  it('questões: links colados por tópico e cota grátis do dia (10 QConcursos + 5 Estuda.com)', () => {
    const c = novo();
    c.questoesLinks = { Matemática: { 'Teoria de conjuntos': { qconcursos: 'https://qc/x', estuda: 'https://es/x', pdf: 'https://pdf/x', video: 'https://v/x' } } };
    expect(linksDe(c, 'Matemática', 'Teoria de conjuntos').outro).toBe('');
    expect(limitesCota(c)).toEqual({ qconcursos: 10, estuda: 5 });
    expect(fontesQuestoes(c, 'Matemática', 'Teoria de conjuntos', {}).map((f) => [f.site, f.restante, f.esgotada])).toEqual([['qconcursos', 10, false], ['estuda', 5, false], ['pdf', null, false]]);
    const meio = fontesQuestoes(c, 'Matemática', 'Teoria de conjuntos', { qconcursos: 10, estuda: 2 });
    expect(meio[0].esgotada).toBe(true); expect(meio[1]).toMatchObject({ esgotada: false, restante: 3 });
    expect(videoDe(c, 'Matemática', 'Teoria de conjuntos')).toEqual({ url: 'https://v/x', origem: 'topico' });
    // cota acabou: sugere PDF/prova (sem páginas) ou exercícios do livro (com páginas)
    const cotas = { qconcursos: 10, estuda: 5 };
    const t = tarefasDoDia(c, [bl('mat@0600')], { lacunas: lac, faseId: 'ano1', cotasDia: cotas })['2026-11-23:mat@0600'];
    expect(t.questoes).toMatchObject({ cotaEsgotada: true, alternativa: 'pdf' }); // tem link de PDF: sugere a prova em PDF
    delete c.questoesLinks.Matemática['Teoria de conjuntos'].pdf;
    const semPdf = tarefasDoDia(c, [bl('mat@0600')], { lacunas: lac, faseId: 'ano1', cotasDia: cotas })['2026-11-23:mat@0600'];
    expect(semPdf.questoes).toMatchObject({ cotaEsgotada: true, alternativa: 'livro' }); // senão, os exercícios do livro
    const aindaTem = tarefasDoDia(c, [bl('mat@0600')], { lacunas: lac, faseId: 'ano1', cotasDia: { qconcursos: 10, estuda: 4 } })['2026-11-23:mat@0600'];
    expect(aindaTem.questoes).toMatchObject({ cotaEsgotada: false, alternativa: null });
    const sem = tarefasDoDia(cfg(), [bl('mat@0600')], { lacunas: lac, faseId: 'ano1' })['2026-11-23:mat@0600'];
    expect(sem.questoes).toMatchObject({ semLinks: true, cotaEsgotada: false, alternativa: null });
    expect(aplicarCota({ qconcursos: 4 }, { qconcursos: 3, estuda: 2, pdf: 9 })).toEqual({ qconcursos: 7, estuda: 2 }); // PDF não tem cota
    expect(aplicarCota({ estuda: 1 }, { estuda: -5 })).toEqual({ estuda: 0 });
  });
  it('questões por hora: 6 no EN/EFOMM e 3 no ITA mudam o número de questões do bloco', () => {
    const c = novo();
    const n = (faseId) => tarefasDoDia(c, [bl('mat@0600')], { lacunas: lac, faseId })['2026-11-23:mat@0600'].questoes.n;
    expect(n('en')).toBe(3); expect(n('ita')).toBe(2); // 30 min: 6/h = 3 ; 3/h = 1,5 -> 2
  });
  it('registro de resultado: acerto por tópico e deltas de páginas, cota e erros', () => {
    const done = {
      a: { materia: 'Matemática', topico: 'Teoria de conjuntos', questoes: { feitas: 10, acertos: 7 } },
      b: { materia: 'Matemática', topico: 'Teoria de conjuntos', questoes: { feitas: 5, acertos: 2 } },
      c: { materia: 'Física', topico: 'Cinemática', questoes: { feitas: 4, acertos: 4 } },
      d: { materia: 'Física', questoes: { feitas: 9, acertos: 1 } }, // sem tópico: não entra
    };
    expect(acertoPorTopico(done)).toEqual({ 'Matemática|Teoria de conjuntos': { feitas: 15, acertos: 9 }, 'Física|Cinemática': { feitas: 4, acertos: 4 } });
    // primeiro registro
    expect(deltaResultado(null, { feitas: 5, acertos: 3, site: 'qconcursos', paginas: 8 })).toEqual({ paginas: 8, cotas: { qconcursos: 5 }, errosFaltando: 2 });
    // correção: leu 10 em vez de 8, fez 6 no Estuda e já tinha registrado 2 erros
    expect(deltaResultado({ feitas: 5, acertos: 3, site: 'qconcursos', paginas: 8, errosRegistrados: 2 }, { feitas: 6, acertos: 3, site: 'estuda', paginas: 10 }))
      .toEqual({ paginas: 2, cotas: { qconcursos: -5, estuda: 6 }, errosFaltando: 1 });
  });
  it('corrigir o registro de páginas move o ponteiro de leitura', () => {
    const v = { pagIni: 1, pagFim: 100 };
    const l1 = ajustarLeitura(null, v, 8, 45, 'd'); expect(l1.proxima).toBe(9);
    const l2 = ajustarLeitura(l1, v, -3, 0, 'd'); expect(l2.proxima).toBe(6);
    expect(ajustarLeitura(l2, v, 0, 0, 'd')).toBe(l2);
    expect(ajustarLeitura({ proxima: 2, registros: [] }, v, -50, 0, 'd').proxima).toBe(1); // não passa do início
  });
});

describe('etapa 5: migração dos campos novos', () => {
  it('configuração antiga ganha cota grátis, divisão do bloco e sites; os links colados por você sobrevivem', () => {
    const velho = cfg(); delete velho.cotasGratis; delete velho.divisaoBloco; delete velho.sitesQuestoes; delete velho.questoesLinks; velho.versaoSeed = 5;
    const novo = migrarCfg(velho, cfg());
    expect(novo.cotasGratis).toEqual({ qconcursos: 10, estuda: 5 });
    expect(novo.divisaoBloco).toEqual({ video: 25, teoria: 45, questoes: 30 });
    expect(novo.sitesQuestoes.map((s) => s.id)).toEqual(['khan', 'obmep', 'qconcursos', 'estuda', 'pdf', 'outro']);
    expect(novo.questoesLinks).toEqual({});
    const comLinks = cfg(); comLinks.versaoSeed = 5; comLinks.questoesLinks = { Matemática: { 'Teoria de conjuntos': { qconcursos: 'https://qc/x' } } }; comLinks.cotasGratis = { qconcursos: 7, estuda: 3 };
    const n2 = migrarCfg(comLinks, cfg());
    expect(n2.questoesLinks.Matemática['Teoria de conjuntos'].qconcursos).toBe('https://qc/x');
    expect(n2.cotasGratis).toEqual({ qconcursos: 7, estuda: 3 }); // editou: fica
  });
});

import { resumoSemana, focoDaSemana, historico, PERGUNTAS } from '../src/lib/revisao.js';
import { coberturaPaginas } from '../src/lib/livros.js';
import { REGISTRAVEL, QUESTOES_DIA_MINIMO } from '../src/lib/tarefas.js';
describe('etapa 6: dia mínimo, revisão de domingo e cobertura', () => {
  const f = gerarFases(cfg());
  it('tarefa do dia mínimo: só questões (20 em 45 min) do próximo tópico, com os links e a cota', () => {
    const c = cfg();
    c.questoesLinks = { Matemática: { 'Teoria de conjuntos': { qconcursos: 'https://qc/x' } } };
    const bl = blocosAjustados(c, f, '2026-11-23', { dificeis: { '2026-11-23': true } });
    const t = tarefasDoDia(c, bl, { lacunas: dominarFase0(c), faseId: 'ano1', cotasDia: { qconcursos: 10 } })[bl[0].id];
    expect(t.questoes.n).toBe(QUESTOES_DIA_MINIMO); expect(t.questoes.min).toBe(45);
    expect(t.video).toBeNull(); expect(t.paginas).toBeNull();
    expect(t.topico).toBe('Teoria de conjuntos'); expect(t.questoes.cotaEsgotada).toBe(true);
    expect(REGISTRAVEL).toContain('minimo');
  });
  it('resumo da semana: horas, questões, erros, dias cumpridos, revisões e adiados', () => {
    const c = cfg(), seg = '2026-11-23';
    const ctx = {
      done: { '2026-11-23:mat@0600': { dia: '2026-11-23', materia: 'Matemática', min: 50, questoes: { feitas: 10, acertos: 7 } },
              '2026-11-25:fis@1200': { dia: '2026-11-25', materia: 'Física', min: 100, questoes: { feitas: 5, acertos: 2 } },
              '2026-11-20:mat@0600': { dia: '2026-11-20', materia: 'Matemática', min: 999 } }, // semana anterior: não conta
      errors: { a: { dia: '2026-11-24' }, b: { dia: '2026-11-30' } },
      cumpridos: { '2026-11-23': true, '2026-11-22': true },
      reviews: { x: { feita: true, feitaEm: '2026-11-26' }, y: { feita: true, feitaEm: '2026-12-01' }, z: { feita: false } },
      adiados: { '2026-11-24:mat@0900': '2026-11-25', '2026-11-30:mat@0600': '2026-12-01' },
    };
    const r = resumoSemana(c, f, ctx, seg);
    expect(r.feitoMin).toBe(150); expect(r.questoes).toEqual({ feitas: 15, acertos: 9, pct: 0.6 });
    expect(r.erros).toBe(1); expect(r.diasCumpridos).toBe(1); expect(r.revisoesFeitas).toBe(1); expect(r.adiados).toBe(1);
    expect(r.porMateria).toEqual([['Física', 100], ['Matemática', 50]]);
    expect(r.planMin).toBeGreaterThan(2400); expect(r.pct).toBeCloseTo(150 / r.planMin);
    expect(resumoSemana(c, f, {}, seg).questoes.pct).toBeNull();
  });
  it('o foco da revisão vale para a semana seguinte, não para a própria semana', () => {
    const rev = { '2026-11-23': { seg: '2026-11-23', foco: '  fechar Trigonometria ', bem: 'a', faltou: 'b' }, '2026-11-30': { seg: '2026-11-30', foco: '' } };
    expect(focoDaSemana(rev, '2026-11-23')).toBeNull();            // semana revisada
    expect(focoDaSemana(rev, '2026-11-29')).toBeNull();            // domingo da mesma semana
    expect(focoDaSemana(rev, '2026-11-30')).toEqual({ foco: 'fechar Trigonometria', semana: '2026-11-23' });
    expect(focoDaSemana(rev, '2026-12-06')).toMatchObject({ foco: 'fechar Trigonometria' });
    expect(focoDaSemana(rev, '2026-12-07')).toBeNull();            // a revisão de 30/11 não tem foco
    expect(historico(rev).map((x) => x.seg)).toEqual(['2026-11-30', '2026-11-23']);
    expect(PERGUNTAS.map((p) => p[0])).toEqual(['bem', 'faltou', 'foco']);
  });
  it('cobertura de páginas por matéria: só vínculos ativos com páginas cadastradas', () => {
    const c = cfg();
    expect(coberturaPaginas(c, {}, 'Matemática')).toEqual({ lidas: 0, total: 0, pct: null });
    const v = c.biblioteca.vinculos.find((x) => x.id === 'iezzi-1|Teoria de conjuntos'); Object.assign(v, { pagIni: 1, pagFim: 100 });
    const w = c.biblioteca.vinculos.find((x) => x.id === 'iezzi-9|Polígonos'); Object.assign(w, { pagIni: 1, pagFim: 100 });
    const leit = { 'iezzi-1|Teoria de conjuntos': { proxima: 51, registros: [] } }; // 50 de 100
    expect(coberturaPaginas(c, leit, 'Matemática')).toEqual({ lidas: 50, total: 200, pct: 0.25 });
    // vínculo de livro que não é o principal não conta
    const t = c.biblioteca.vinculos.find((x) => x.recurso === 'topicos-fisica-1'); Object.assign(t, { pagIni: 1, pagFim: 10 });
    expect(coberturaPaginas(c, {}, 'Física').total).toBe(0);
  });
});

describe('etapa 1 (v3): fases e fim de semana', () => {
  const f = gerarFases(cfg());
  const semZero = () => planoSemana(cfg(), f, '2026-11-23');
  const blocosLiquidos = (d) => d.blocos.filter((b) => b.sessoes || ['prova', 'corr', 'red'].includes(b.cat));
  const liquido = (d) => d.blocos.reduce((a, b) => a + b.min, 0);
  const sessoesDe = (d) => d.blocos.reduce((n, b) => n + (b.sessoes || 0), 0);

  it('as % de cada fase somam 100 e a Fase 0 dá 55% (1716 min) de Matemática por semana', () => {
    for (const [id, h] of Object.entries(cfg().horasFase)) expect(Object.values(h).reduce((a, b) => a + b, 0), id).toBe(100);
    expect(Object.keys(cfg().horasFase)).toEqual(['zero', 'ano1', 'ano2', 'ano3', 'leve', 'ita', 'disc', 'enem']);
    expect(cfg().horasFase.zero).toMatchObject({ mat: 55, fis: 25, qui: 12, por: 6, ing: 2 });
    for (const id of ['ano1', 'ano2', 'ano3']) expect(cfg().horasFase[id]).toMatchObject({ mat: 38, fis: 32, qui: 15, por: 6, red: 5, ing: 4 });
    expect(orcamentoSemana(cfg(), 'zero', '2026-11-23').mat).toBe(1716);
  });
  it('Natal e Ano Novo (24–25/12 e 31/12–01/01) são livres; os dias em volta têm estudo', () => {
    const c = cfg();
    for (const dia of ['2026-12-24', '2026-12-25', '2026-12-31', '2027-01-01']) expect(blocosDoDia(c, f, dia).some((b) => b.sessoes), dia).toBe(false);
    for (const dia of ['2026-12-23', '2026-12-26', '2026-12-30', '2027-01-02']) expect(blocosDoDia(c, f, dia).some((b) => b.sessoes), dia).toBe(true);
  });
  it('fase zero: sábado tem 8 h (2 de resgate) e o domingo tem 2 h de revisão leve com o planejamento no fim', () => {
    const dias = semZero();
    expect(dias[6].blocos.some((b) => b.cat === 'plan')).toBe(true);
    expect(dias[6].blocos.map((b) => b.cat)).toEqual(['revl', 'plan']);
    expect(dias[5].blocos.reduce((a, b) => a + b.min, 0)).toBeGreaterThanOrEqual(7.5 * 60); // ~8 h, 2 h de resgate
    expect(dias[5].blocos.find((b) => b.cat === 'resg')).toMatchObject({ min: 120, sessoes: 0 });
  });
  it('fase zero: sábado mais domingo ficam com cerca de 18% do tempo líquido da semana (8 h + 2 h de ~55 h)', () => {
    const dias = semZero();
    const total = dias.reduce((a, d) => a + liquido(d), 0);
    const fds = (liquido(dias[5]) + liquido(dias[6])) / total;
    expect(fds).toBeGreaterThanOrEqual(0.14); expect(fds).toBeLessThanOrEqual(0.2);
  });
  it('repartirComTeto respeita os tetos, redistribui a sobra e soma o total', () => {
    const r = repartirComTeto([1, 1, 1, 1], [1, 10, 10, 0], 12);
    expect(r[0]).toBe(1); expect(r[3]).toBe(0);
    expect(r.reduce((a, b) => a + b, 0)).toBe(12);
    r.forEach((x, i) => expect(x).toBeLessThanOrEqual([1, 10, 10, 0][i]));
    // peso maior recebe mais, até o teto
    const p = repartirComTeto([1, 3], [5, 5], 4);
    expect(p[1]).toBeGreaterThan(p[0]); expect(p[0] + p[1]).toBe(4);
    // total maior do que a soma dos tetos: enche todos e para
    expect(repartirComTeto([1, 1], [2, 3], 10)).toEqual([2, 3]);
  });
  it('extraZero=2 empurra o fim da Zero em 14 dias e o início do Ano 1', () => {
    const c = cfg(); c.perfil.extraZero = 2;
    const [z0, b0] = f, [z, b] = gerarFases(c);
    expect(z.fim).toBe(addDays(z0.fim, 14));
    expect(b.inicio).toBe(addDays(b0.inicio, 14));
    expect(b.inicio).toBe(addDays(z.fim, 1));
    expect(b.fim).toBe(addDays(b0.fim, 14));
  });
});
