import { describe, it, expect } from 'vitest';
import { avaliarTopico, situacao, travados, destravar, resumo } from '../src/lib/dominio.js';
import { proximoTopico, semanaZero } from '../src/lib/trilha.js';

const cfgMini = () => ({
  concursos: [{ id: 'en' }, { id: 'efomm' }],
  materiasInfo: { Matemática: { concursos: ['en', 'efomm'] } },
  topicos: { Matemática: [
    { nome: 'A', fase: 0, sem: 1 }, { nome: 'B', fase: 0, sem: 1 }, { nome: 'C', fase: 0, sem: 2 },
    { nome: 'Funções' }, { nome: 'Trigonometria' },
  ] },
});

describe('modo domínio (Fase 0)', () => {
  const reg = (estado, nota, id, feitas, acertos, extra = {}) => avaliarTopico(estado, nota, id, { feitas, acertos, ...extra });
  it('8 de 10 domina o tópico', () => {
    const r = reg(null, 0, 'b1', 10, 8);
    expect(r.nota).toBe(3); expect(r.veredito).toBe('dominado'); expect(situacao(r.nota, r.estado)).toBe('dominado');
  });
  it('7 de 10 repete; a terceira tentativa ruim trava', () => {
    let nota = 0, estado = null;
    for (let i = 1; i <= 3; i++) {
      const r = reg(estado, nota, `b${i}`, 10, 7);
      nota = r.nota; estado = r.estado;
      expect(r.veredito).toBe(i < 3 ? 'repetir' : 'travado');
    }
    expect(situacao(nota, estado)).toBe('travado');
    expect(travados({ 'Matemática|A': estado }, { Matemática: { A: nota } })).toEqual([{ materia: 'Matemática', topico: 'A' }]);
  });
  it('corrigir o registro do mesmo bloco não conta tentativa em dobro', () => {
    let r = reg(null, 0, 'b1', 10, 6);
    r = reg(r.estado, r.nota, 'b1', 10, 6); r = reg(r.estado, r.nota, 'b1', 10, 7); r = reg(r.estado, r.nota, 'b1', 10, 7);
    expect(resumo(r.estado).falhas).toBe(1); expect(r.veredito).toBe('repetir');
    r = reg(r.estado, r.nota, 'b1', 10, 9); // corrigi: na verdade acertei 9
    expect(r.veredito).toBe('dominado');
  });
  it('menos de 50% de acerto marca "vi pouco"; entre 50 e 79% marca "quase lá"', () => {
    expect(reg(null, 0, 'b', 10, 3).nota).toBe(1);
    expect(reg(null, 0, 'b', 10, 6).nota).toBe(2);
  });
  it('com menos de 10 feitas não conta tentativa (em andamento)', () => {
    const r = reg(null, 0, 'b', 6, 6);
    expect(r.veredito).toBe('parcial'); expect(resumo(r.estado).falhas).toBe(0); expect(r.nota).toBe(1);
  });
  it('"dominado no Khan" vale como dominado e destrava', () => {
    let r = reg(null, 0, 'b1', 10, 5); r = reg(r.estado, r.nota, 'b2', 10, 5); r = reg(r.estado, r.nota, 'b3', 10, 5);
    expect(r.veredito).toBe('travado');
    r = reg(r.estado, r.nota, 'b4', 0, 0, { khan: true });
    expect(r.nota).toBe(3); expect(r.veredito).toBe('dominado'); expect(situacao(r.nota, r.estado)).toBe('dominado');
  });
  it('a nota só sobe: reforço ruim num tópico dominado não tira o 3', () => {
    const r = reg({ regs: { b0: { feitas: 10, acertos: 9 } } }, 3, 'b9', 10, 4);
    expect(r.nota).toBe(3); expect(r.veredito).toBe('dominado');
  });
  it('destravar: as falhas até agora deixam de contar e dá mais 3 tentativas', () => {
    let r = reg(null, 0, 'b1', 10, 5); r = reg(r.estado, r.nota, 'b2', 10, 5); r = reg(r.estado, r.nota, 'b3', 10, 5);
    const est = destravar(r.estado);
    expect(resumo(est).travado).toBe(false); expect(situacao(r.nota, est)).toBe('em andamento');
    const r2 = reg(est, r.nota, 'b4', 10, 5); expect(r2.veredito).toBe('repetir');
  });
  it('situação: não iniciado, em andamento, dominado, travado', () => {
    expect(situacao(0, null)).toBe('não iniciado');
    expect(situacao(1, null)).toBe('em andamento');
    expect(situacao(0, { regs: { b: { feitas: 4, acertos: 2 } } })).toBe('em andamento');
    expect(situacao(3, null)).toBe('dominado');
  });
});

describe('próximo tópico na Fase 0', () => {
  it('segue a ordem estrita e só entre tópicos da Fase 0', () => {
    const c = cfgMini();
    expect(proximoTopico(c, {}, 'Matemática', 1, new Set(), { faseZero: true }).nome).toBe('A');
    expect(proximoTopico(c, { Matemática: { A: 3 } }, 'Matemática', 1, new Set(), { faseZero: true }).nome).toBe('B');
  });
  it('pula o travado, mas volta a ele quando acaba o resto (revisão)', () => {
    const c = cfgMini();
    const dom = { 'Matemática|B': { regs: { x1: { feitas: 10, acertos: 3 }, x2: { feitas: 10, acertos: 3 }, x3: { feitas: 10, acertos: 3 } } } };
    expect(proximoTopico(c, { Matemática: { A: 3 } }, 'Matemática', 1, new Set(), { faseZero: true, dominio: dom }).nome).toBe('C');
    expect(proximoTopico(c, { Matemática: { A: 3, C: 3 } }, 'Matemática', 1, new Set(), { faseZero: true, dominio: dom }).nome).toBe('B');
  });
  it('tudo dominado: reforço no tópico de pior acerto, sem entrar na Fase 1', () => {
    const c = cfgMini();
    const lac = { Matemática: { A: 3, B: 3, C: 3 } };
    const acertos = { 'Matemática|A': { feitas: 10, acertos: 9 }, 'Matemática|B': { feitas: 10, acertos: 8 }, 'Matemática|C': { feitas: 10, acertos: 9 } };
    expect(proximoTopico(c, lac, 'Matemática', 1, new Set(), { faseZero: true, acertos }).nome).toBe('B');
  });
  it('fora da Fase 0 o comportamento antigo continua: janela de 3 e travado fora', () => {
    const c = cfgMini();
    expect(proximoTopico(c, {}, 'Matemática').nome).toBe('A');
    expect(proximoTopico(c, { Matemática: { A: 3, B: 3, C: 3 } }, 'Matemática').nome).toBe('Funções');
    expect(proximoTopico(c, {}, 'Matemática', 3, new Set(), { dominio: { 'Matemática|A': { regs: { x1: { feitas: 10, acertos: 3 }, x2: { feitas: 10, acertos: 3 }, x3: { feitas: 10, acertos: 3 } } } } }).nome).toBe('B');
  });
  it('semana da Fase 0', () => {
    const f = [{ id: 'zero', inicio: '2026-11-16', fim: '2027-01-10' }];
    expect(semanaZero(f, '2026-11-16')).toBe(1);
    expect(semanaZero(f, '2026-12-24')).toBe(6);
    expect(semanaZero(f, '2027-01-10')).toBe(8);
    expect(semanaZero(f, '2027-01-11')).toBe(0);
    expect(semanaZero(f, '2026-11-10')).toBe(0);
  });
});
