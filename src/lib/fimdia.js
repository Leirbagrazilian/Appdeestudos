// Fim do dia (SPEC v2 seção 5): 20h40 (quinta, logo ao chegar, ~19h30). Tudo puro; o texto da questão difícil fica salvo por dia.
export const HORA_FIM_DIA = '20:40';
export const HORA_FIM_DIA_QUINTA = '19:30';
export const PASSOS_FIM_DIA = [
  { id: 'filme', titulo: 'Passar o filme', detalhe: '10 min: repasse os tópicos do dia sem abrir o caderno.' },
  { id: 'questao', titulo: 'Separar 1 questão difícil', detalhe: 'Do tópico atual, para o primeiro bloco de amanhã.' },
  { id: 'tarefas', titulo: 'Anotar as tarefas de amanhã', detalhe: 'Uma linha por tarefa concreta.' },
  { id: 'celular', titulo: 'Celular fora do quarto', detalhe: 'Depois: terço, oração da noite e cama às 22h.' },
];
/** Hora do cartão no dia da semana `wd` (quinta: logo ao chegar da faculdade). */
export const horaFimDia = (wd) => (wd === 4 ? HORA_FIM_DIA_QUINTA : HORA_FIM_DIA);
/** Fase de provas: só aí a questão difícil pode ser de prova antiga; antes, é do tópico atual. */
export const faseDeProvas = (faseId) => ['leve', 'ita', 'disc', 'enem'].includes(faseId);
export const tipoQuestaoDificil = (faseId) => (faseDeProvas(faseId) ? 'do tópico atual ou de uma prova antiga' : 'do tópico atual (prova antiga só na fase de provas)');
/** A questão que você separou ontem para o 1º bloco de hoje (ou ''). `reg` = { [dia]: { questao, tarefas, passos } }. */
export const questaoDeOntem = (reg, dia, ontem) => (reg?.[ontem]?.questao ?? '').trim();
/** Tarefas que você anotou ontem para hoje. */
export const tarefasDeOntem = (reg, ontem) => (reg?.[ontem]?.tarefas ?? '').trim();
/** Passos feitos de 4. */
export const passosFeitos = (r) => PASSOS_FIM_DIA.filter((p) => r?.passos?.[p.id]).length;
/** Mostrar o cartão: a partir da hora do dia (e até 23h59). */
export function mostrarFimDia(wd, agoraMin) {
  const [h, m] = horaFimDia(wd).split(':').map(Number);
  return agoraMin >= h * 60 + m - 30; // aparece 30 min antes, já destacado
}
