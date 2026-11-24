// Questões (SPEC v2 seção 7): Base = questões geradas no Claude + listas grátis; do Desenvolvimento em diante = QConcursos e provas
// antigas (o Claude só completa). Monta o pedido para colar no Claude. Tudo puro.
export const AVISO_IA = 'Questão gerada por IA pode vir com erro. Se a resolução parecer estranha, confira no livro.';

/** Nível do pedido conforme a fase (e o concurso que a fase mira). */
export function nivelDaFase(faseId) {
  switch (faseId) {
    case 'zero': return 'começando no nível do 9º ano e subindo até o estilo da EFOMM';
    case 'ano1': return 'começando no nível do 1º ano do ensino médio e subindo até o estilo da EFOMM';
    case 'ano2': return 'começando no nível do ensino médio e subindo até o estilo da EFOMM';
    case 'ano3': case 'leve': return 'começando no estilo da EFOMM e subindo até o da Escola Naval (CPAEN)';
    case 'ita': return 'no estilo da 1ª fase do ITA, do médio ao difícil';
    case 'disc': return 'no estilo das questões discursivas do ITA';
    case 'enem': return 'no estilo do ENEM';
    default: return 'do nível do ensino médio ao estilo da EFOMM';
  }
}
/** Na Base as questões vêm do Claude e de listas grátis; depois, de QConcursos e provas antigas (o Claude só completa). */
export const fonteDasQuestoes = (faseId) => (faseId === 'zero' ? 'claude' : 'reais');

/** Texto do pedido: tópico, quantidade e nível. */
export function pedidoClaude({ topico, n = 10, faseId }) {
  const q = Math.max(1, Math.round(n) || 10);
  return `Crie ${q} questões de ${topico}, ${nivelDaFase(faseId)}. Numere e não mostre as respostas. Quando eu mandar as minhas, corrija uma por uma, mostre a resolução e diga o tipo de erro.`;
}
