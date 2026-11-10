// Insígnias: só por constância e marcos, nunca por perfeição. Nada é perdido depois de ganho.
const LISTA = [
  ['primeiro-bloco', 'Primeira patrulha', 'Concluiu o primeiro bloco de estudo.', (s) => s.blocos >= 1],
  ['dia-cumprido', 'Missão do dia', 'Cumpriu um dia inteiro.', (s) => s.diasCumpridos >= 1],
  ['sete-dias', 'Sete noites', 'Estudou em 7 dias diferentes.', (s) => s.diasEstudo >= 7],
  ['trinta-dias', 'Guardião da cidade', 'Estudou em 30 dias diferentes.', (s) => s.diasEstudo >= 30],
  ['cinco-cumpridos', 'Disciplina de aço', 'Cumpriu 5 dias inteiros.', (s) => s.diasCumpridos >= 5],
  ['cem-questoes', 'Cem alvos', 'Registrou 100 questões resolvidas.', (s) => s.questoes >= 100],
  ['quinhentas-questoes', 'Arsenal completo', 'Registrou 500 questões resolvidas.', (s) => s.questoes >= 500],
  ['sozinho-10', 'Sem rede de proteção', 'Refez questões sem olhar a resolução em 10 blocos.', (s) => s.sozinho >= 10],
  ['dez-erros', 'Detetive', 'Registrou 10 erros no caderno.', (s) => s.erros >= 10],
  ['cinquenta-erros', 'Arquivo do detetive', 'Registrou 50 erros no caderno.', (s) => s.erros >= 50],
  ['vinte-revisoes', 'Memória de elefante', 'Fez 20 revisões.', (s) => s.revisoes >= 20],
  ['primeiro-simulado', 'Primeiro confronto', 'Registrou o primeiro simulado.', (s) => s.simulados >= 1],
  ['simulado-60', 'Acima da linha', 'Tirou 60% ou mais de média num simulado.', (s) => s.melhorSimulado >= 60],
];

/** Números que alimentam as insígnias. */
export function estatisticas({ done = {}, reviews = {}, errors = {}, exams = {}, cumpridos = {} }) {
  const regs = Object.entries(done);
  const media = (e) => { const v = Object.values(e.notas ?? {}); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
  return {
    blocos: regs.length,
    diasEstudo: new Set(regs.map(([k, v]) => v.dia ?? k.slice(0, 10))).size,
    diasCumpridos: Object.keys(cumpridos).length,
    questoes: regs.reduce((s, [, v]) => s + (v.questoes?.feitas ?? 0), 0),
    sozinho: regs.filter(([, v]) => v.sozinho === true).length,
    erros: Object.keys(errors).length,
    revisoes: Object.values(reviews).filter((r) => r.feita).length,
    simulados: Object.keys(exams).length,
    melhorSimulado: Math.max(0, ...Object.values(exams).map(media)),
  };
}

export function conquistas(dados) {
  const s = estatisticas(dados);
  return LISTA.map(([id, nome, desc, f]) => ({ id, nome, desc, ok: f(s) }));
}
