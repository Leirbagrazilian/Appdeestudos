import { describe, it, expect } from 'vitest';
import seed from '../src/data/seed.json';
import { gerarFases } from '../src/lib/phases.js';
import { planoPrazos } from '../src/lib/prazos.js';
import { migrarCfg } from '../src/lib/migracao.js';
import * as foco from '../src/lib/foco.js';
import { blocoAtual, tituloTarefa, passosDoBloco, timerCinco, cincoDoTimer, TIMER_MIN } from '../src/lib/bloco.js';
import { pedidoClaude, nivelDaFase, fonteDasQuestoes } from '../src/lib/questoesIA.js';
import { horaFimDia, mostrarFimDia, PASSOS_FIM_DIA, faseDeProvas, questaoDeOntem, passosFeitos } from '../src/lib/fimdia.js';
import { agendarRefazer, PASSOS_PROVA } from '../src/lib/provasantigas.js';
import { avisoCadernoAntesDaProva } from '../src/lib/erros.js';
import { tarefasDoDia } from '../src/lib/tarefas.js';
import { blocosAjustados } from '../src/lib/planner.js';
import { acordarAmanha, noiteDe } from '../src/lib/sono.js';
import { decidirAcordar, textoAviso } from '../src/lib/avisos.js';
import { oracoesDoDia } from '../src/lib/oracao.js';
import { legado } from './_legado.js';

const cfg = () => structuredClone(seed);
const m = (h, mi = 0) => h * 60 + mi;

describe('bloco atual e timer de 5 minutos', () => {
  const blocos = [{ id: 'a', cat: 'mat', ini: '13:00', fim: '14:50' }, { id: 'b', cat: 'fis', ini: '15:00', fim: '16:50' }, { id: 'e', cat: 'erros' }];
  it('em andamento pelo horário; senão o próximo; senão o atrasado; feitos saem', () => {
    expect(blocoAtual(blocos, () => false, m(13, 30))).toMatchObject({ quando: 'agora', bloco: { id: 'a' } });
    expect(blocoAtual(blocos, () => false, m(14, 55))).toMatchObject({ quando: 'proximo', bloco: { id: 'b' } });
    expect(blocoAtual(blocos, (b) => b.id === 'a', m(13, 30))).toMatchObject({ quando: 'proximo', bloco: { id: 'b' } });
    expect(blocoAtual(blocos, () => false, m(18))).toMatchObject({ quando: 'atrasado', bloco: { id: 'a' } });
    expect(blocoAtual(blocos, () => true, m(13))).toBeNull();
  });
  it('timer: 5 minutos regressivos', () => {
    expect(TIMER_MIN).toBe(5);
    expect(timerCinco(0, 0)).toEqual({ restante: 300, acabou: false });
    expect(timerCinco(0, 61000).restante).toBe(239);
    expect(timerCinco(0, 300000).acabou).toBe(true); expect(timerCinco(0, 999999).restante).toBe(0);
  });
});

describe('tarefa concreta e passos', () => {
  const c = cfg();
  for (const x of c.topicos.Matemática) x.aulas = [{ canal: 'Universo Narrado', titulo: 'Aula', url: 'https://www.youtube.com/watch?v=abc' }];
  const bl = { id: '2026-11-24:mat@0745', cat: 'mat', materia: 'Matemática', min: 100 };
  const tarefa = () => tarefasDoDia(c, [bl], { lacunas: {}, faseId: 'zero' })[bl.id];
  it('o título diz o que fazer, não o tempo', () => {
    const t = tarefa(), s = tituloTarefa(bl, t);
    expect(s).toMatch(/^vídeo de .+ \+ .*\d+ questões/); expect(s).not.toMatch(/\d+ ?h|hora|min/i);
    expect(tituloTarefa({ cat: 'resg' }, null)).toMatch(/sem matéria nova/);
    expect(tituloTarefa({ cat: 'revl' }, null)).toMatch(/caderno de erros refeito sem olhar/);
  });
  it('passos: celular, pré-teste, vídeo, questões em lotes de 10 com dicas e registro', () => {
    const p = passosDoBloco(tarefa(), {});
    expect(p.map((x) => x.id)).toEqual(expect.arrayContaining(['comecar', 'pretest', 'video', 'questoes', 'registrar']));
    expect(p.find((x) => x.id === 'pretest').titulo).toMatch(/3 questões/);
    expect(p.find((x) => x.id === 'video').url).toMatch(/^https:/);
    expect(p.find((x) => x.id === 'questoes').dicas.join(' ')).toMatch(/difíceis primeiro.*reescreva o enunciado.*lave o rosto/is);
    expect(p.find((x) => x.id === 'registrar').detalhe).toMatch(/caderno de erros.*causa/);
  });
  it('1º bloco do dia começa pela questão difícil da noite anterior', () => {
    const p = passosDoBloco(tarefa(), { primeiroDoDia: true, questaoDificil: 'Prove que a soma dos ângulos...' });
    expect(p.find((x) => x.id === 'pretest').titulo).toMatch(/questão difícil de ontem/); expect(p.find((x) => x.id === 'pretest').detalhe).toMatch(/Prove que a soma/);
    expect(passosDoBloco(tarefa(), { primeiroDoDia: false, questaoDificil: 'x' }).find((x) => x.id === 'pretest').titulo).toMatch(/3 questões/);
  });
  it('sem vídeo dos canais: "sem aula dos canais" e só o livro (sem busca no canal)', () => {
    const c2 = cfg(), t = tarefasDoDia(c2, [bl], { lacunas: {}, faseId: 'zero' })[bl.id];
    const nome = t.topico; c2.topicos.Matemática.find((x) => x.nome === nome).aulas = [];
    const t2 = tarefasDoDia(c2, [bl], { lacunas: {}, faseId: 'zero' })[bl.id];
    expect(t2.video).toBeNull(); expect(t2.semAula).toBe(true);
    const v = passosDoBloco(t2, {}).find((x) => x.id === 'video'); expect(v.titulo).toBe('Sem aula dos canais'); expect(v.url).toBeUndefined();
    expect(tituloTarefa(bl, t2)).not.toMatch(/^vídeo/);
  });
});

describe('pedido para o Claude', () => {
  it('modelo da spec: tópico, quantidade e nível; Base usa nível do 9º ano', () => {
    const t = pedidoClaude({ topico: 'MMC e MDC', n: 10, faseId: 'zero' });
    expect(t).toBe('Crie 10 questões de MMC e MDC, começando no nível do 9º ano e subindo até o estilo da EFOMM. Numere e não mostre as respostas. Quando eu mandar as minhas, corrija uma por uma, mostre a resolução e diga o tipo de erro.');
  });
  it('o nível acompanha a fase/concurso e a fonte muda depois da Base', () => {
    expect(nivelDaFase('ano3')).toMatch(/Escola Naval/); expect(nivelDaFase('ita')).toMatch(/ITA/); expect(nivelDaFase('enem')).toMatch(/ENEM/);
    expect(fonteDasQuestoes('zero')).toBe('claude'); expect(fonteDasQuestoes('ano1')).toBe('reais');
  });
});

describe('fim do dia', () => {
  it('4 passos; 20h40 (quinta ~19h30); a questão de prova só na fase de provas', () => {
    expect(PASSOS_FIM_DIA.map((p) => p.id)).toEqual(['filme', 'questao', 'tarefas', 'celular']);
    expect(horaFimDia(2)).toBe('20:40'); expect(horaFimDia(4)).toBe('19:30');
    expect(mostrarFimDia(2, m(20, 20))).toBe(true); expect(mostrarFimDia(2, m(19))).toBe(false); expect(mostrarFimDia(4, m(19, 45))).toBe(true);
    expect(faseDeProvas('ano2')).toBe(false); expect(faseDeProvas('ita')).toBe(true);
  });
  it('a questão separada hoje aparece amanhã', () => {
    const reg = { '2026-11-24': { questao: '  Qual é o MMC de 12 e 18?  ', passos: { filme: true, questao: true } } };
    expect(questaoDeOntem(reg, '2026-11-25', '2026-11-24')).toBe('Qual é o MMC de 12 e 18?');
    expect(questaoDeOntem(reg, '2026-11-26', '2026-11-25')).toBe('');
    expect(passosFeitos(reg['2026-11-24'])).toBe(2);
  });
});

describe('provas antigas e caderno', () => {
  it('fluxo de 4 passos e refazer agendado: 1 semana depois e antes da prova', () => {
    expect(PASSOS_PROVA.map((p) => p.id)).toEqual(['cronometrada', 'destrinchar', 'refazer', 'lento']);
    const r = agendarRefazer({ origem: 'prova:1', nome: 'EFOMM 2024', dia: '2027-06-05', provaData: '2027-08-29', lento: 'geometria' });
    expect(r.map((x) => x.due)).toEqual(['2027-06-12', '2027-08-26']);
    expect(r[0].assunto).toMatch(/Refazer prova: EFOMM 2024.*treinar: geometria/); expect(r.every((x) => !x.feita)).toBe(true);
    expect(agendarRefazer({ origem: 'p', nome: 'x', dia: '2027-06-05', provaData: '2027-06-10' })[1].due).toBe('2027-06-19'); // prova perto demais: o 2º não vem antes do 1º
  });
  it('antes da prova: avisa o que sobrou no caderno', () => {
    const e = [{ id: 'a', status: 'novo' }, { id: 'b', status: 'dominado' }];
    expect(avisoCadernoAntesDaProva(e, 2)).toMatch(/1 erro/); expect(avisoCadernoAntesDaProva(e, 9)).toBeNull(); expect(avisoCadernoAntesDaProva([e[1]], 1)).toBeNull();
  });
});

describe('prazos para ~41 h e prazo final de 22/08/2027', () => {
  it('com o seed, o conteúdo cabe até 22/08/2027 e não há aviso', () => {
    const p = planoPrazos(cfg(), gerarFases(cfg()));
    expect(p.aviso).toBeNull(); expect(p.fim <= '2027-08-22').toBe(true);
  });
  it('se o conteúdo passar de 22/08, avisa e põe EN/ITA na frente (EFOMM/ESA/ENEM por último)', () => {
    const c = cfg(); c.rotina.metaLiquida = 6; c.rotina.metaDia = undefined;
    for (const t of c.topicos['Matemática'].filter((_, i) => i % 3 === 0)) t.concursos = ['efomm'];
    const f = gerarFases(c), p = planoPrazos(c, f);
    expect(p.aviso).toMatchObject({ limite: '2027-08-22' }); expect(p.aviso.texto).toMatch(/passa de 22\/08\/2027/); expect(p.aviso.texto).toMatch(/Escola Naval e no ITA/);
    const ano = (i) => i.ano, ord = p.porMateria['Matemática'].filter((i) => i.ano === 1);
    const sec = (i) => (c.topicos['Matemática'].find((t) => t.nome === i.nome).concursos ?? []).join() === 'efomm';
    const ultPrincipal = ord.map((i, k) => (sec(i) ? -1 : k)).reduce((a, b) => Math.max(a, b), -1), primSec = ord.findIndex(sec);
    expect(primSec).toBeGreaterThan(-1); expect(primSec).toBeGreaterThan(ultPrincipal - 0); // secundários depois dos que caem em EN/ITA
    void ano;
  });
});

describe('rotina nova: sono, avisos e oração sem missa', () => {
  it('acordar 5h e dormir 22h todos os dias; "acordar amanhã" avisa 5h inclusive sexta e sábado', () => {
    for (const d of ['2026-11-22', '2026-11-23', '2026-11-26', '2026-11-27', '2026-11-28']) expect(noiteDe(cfg(), d)).toMatchObject({ dormir: '22:00', acordar: '05:00' });
    expect(acordarAmanha(cfg(), '2026-11-27').acordar).toBe('05:00');
    const resumo = { dia: '2026-11-24', dormir: '22:00', acordar: '05:00', acordarAmanha: { acordar: '05:00' } };
    expect(decidirAcordar({ resumo, agora: m(20, 40) })).toMatchObject({ chave: '2026-11-24:acordar', corpo: expect.stringContaining('05:00') });
    expect(textoAviso('sargento', { zerado: true, falta: 100, inicio1: 780 }, m(14), 'tarde').corpo).not.toMatch(/concorrente/i);
  });
  it('oração sem Santa Missa', () => {
    for (const d of ['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']) expect(oracoesDoDia(legado(cfg()), d).some((o) => /missa/i.test(o.id + o.titulo))).toBe(false);
  });
});

describe('migração v17 sem perder dados', () => {
  it('troca rotina, treino e sono padrão; mantém "vou", presença mínima, sono editado e o resto do cfg', () => {
    const velho = cfg(); velho.versaoSeed = 16; velho.carta = 'minha carta'; velho.rotina.presencaMin = 80;
    velho.rotina.aulas = [{ dia: 1, inicio: '07:30', fim: '11:10', nome: 'Faculdade seg', tipo: 'faculdade', vou: true }, { dia: 5, inicio: '05:40', fim: '07:20', nome: 'Missa sexta', tipo: 'missa' }, { dia: 2, inicio: '18:30', fim: '20:00', nome: 'Jiu-jitsu', tipo: 'fixo' }];
    velho.treino = { musculacao: { 1: { ini: '18:30', tipo: 'upper' } }, corridaPorDia: { 5: '07:30' }, ritmoMinKm: 6 };
    velho.treinoPlano = { inicio: '2026-11-20', meta: { nome: '100 km' }, fases: [{ n: 1 }] };
    velho.sono = { padrao: { 0: { dormir: '22:00', acordar: '05:00' }, 5: { dormir: '21:30', acordar: '04:30' }, 6: { dormir: '21:00', acordar: '05:15' }, 3: { dormir: '23:00', acordar: '06:00' } } };
    const n = migrarCfg(velho, cfg());
    expect(n.versaoSeed).toBe(seed.versaoSeed); expect(n.carta).toBe('minha carta'); expect(n.rotina.presencaMin).toBe(80);
    expect(n.rotina.aulas.map((a) => a.nome)).toEqual(['Faculdade seg', 'Faculdade qua', 'Faculdade qui']);
    expect(n.rotina.aulas[0]).toMatchObject({ fim: '11:00', vou: true });
    expect(n.rotina.janelas[5]).toHaveLength(3); expect(n.rotina.metaLiquida).toBe(41);
    expect(n.treino.corridaPorDia[5]).toBe('05:30'); expect(n.treino.ritmoMinKm).toBe(6); expect(n.treino.musculacao[2]).toMatchObject({ tipo: 'lower', ini: '05:30' });
    expect(n.treinoPlano.meta).toBeUndefined(); expect(n.treinoPlano.fases).toBeUndefined();
    expect(n.sono.padrao[5]).toEqual({ dormir: '22:00', acordar: '05:00' }); expect(n.sono.padrao[6]).toEqual({ dormir: '22:00', acordar: '05:00' });
    expect(n.sono.padrao[3]).toEqual({ dormir: '23:00', acordar: '06:00' }); // você editou: fica
    expect(migrarCfg(n, cfg())).toBe(n); // já migrado
  });
});

describe('cronômetro persistido ao sair do app', () => {
  it('cincoDoTimer continua pelo timestamp após 3 min fora', () => {
    const t = { id: 'b1', cinco: 1000 };
    expect(cincoDoTimer(t, 'b1', 1000 + 180000)).toEqual({ restante: 120, acabou: false });
    expect(cincoDoTimer(t, 'b2', 5000)).toBeNull();
    expect(cincoDoTimer({ id: 'b1' }, 'b1', 5000)).toBeNull();
    expect(cincoDoTimer(null, 'b1', 5000)).toBeNull();
  });
  it('sessão de foco continua certa após 20 min fora', () => {
    const t = foco.iniciar({ id: 'b1', titulo: 'x', min: 50 }, undefined, 0);
    const e = foco.estado(t, 20 * 60000);
    expect(e.restante).toBe(30 * 60000); expect(e.acabou).toBe(false);
    expect(foco.minutosFoco(t, 20 * 60000)).toBe(20);
  });
});
