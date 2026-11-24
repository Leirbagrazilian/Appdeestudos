// Bloco de estudo (SPEC v2 seção 3): o bloco ATUAL, a tarefa concreta (nunca "estudar 2 horas"), os passos e o timer de 5 minutos. Tudo puro.
export const TIMER_MIN = 5; // "só 5 minutos": a promessa que tira a resistência de começar
export const DICAS_QUESTOES = [
  'Leia as difíceis primeiro e comece pelas fáceis.',
  'Sem consultar, com o timer rodando.',
  'Travou? Reescreva o enunciado, pergunte "por quê?" e lave o rosto.',
];
const hm = (s) => { const m = /^(\d{1,2}):(\d{2})/.exec(s ?? ''); return m ? +m[1] * 60 + +m[2] : null; };
const COM_TAREFA = ['mat', 'fis', 'qui', 'por', 'ing', 'hg', 'red', 'prova', 'corr', 'resg', 'revl', 'minimo'];

/**
 * Bloco atual pelo horário. `blocos` com `ini`/`fim` "HH:MM"; `feito(b)` diz se já foi concluído.
 * Devolve { bloco, quando: 'agora' | 'proximo' | 'atrasado' } ou null (nenhum bloco pendente com horário).
 * Em andamento primeiro; senão o próximo a começar; senão o primeiro que ficou para trás.
 */
export function blocoAtual(blocos, feito, agoraMin) {
  const lista = (blocos ?? []).filter((b) => COM_TAREFA.includes(b.cat) && hm(b.ini) != null && !feito(b)).sort((a, b) => hm(a.ini) - hm(b.ini));
  const agora = lista.find((b) => hm(b.ini) <= agoraMin && agoraMin < hm(b.fim));
  if (agora) return { bloco: agora, quando: 'agora' };
  const prox = lista.find((b) => hm(b.ini) > agoraMin);
  if (prox) return { bloco: prox, quando: 'proximo' };
  return lista.length ? { bloco: lista[0], quando: 'atrasado' } : null;
}

/** Texto da tarefa: o que fazer, em concreto. Ex.: "vídeo de MMC + 10 questões". */
export function tituloTarefa(b, tarefa) {
  if (tarefa && !tarefa.semTopico && !tarefa.resgateLivre && tarefa.topico) {
    const p = [];
    if (tarefa.video) p.push('vídeo');
    if (tarefa.paginas) p.push(`livro págs ${tarefa.paginas.de}–${tarefa.paginas.ate}`);
    if (tarefa.exercicios) p.push(`exercícios ${tarefa.exercicios.de}–${tarefa.exercicios.ate}`);
    p.push(`${tarefa.questoes.n} questões`);
    const [primeiro, ...resto] = p;
    return `${primeiro}${primeiro === 'vídeo' ? ` de ${tarefa.topico}` : ''}${resto.length ? ` + ${resto.join(' + ')}` : ''}${primeiro !== 'vídeo' ? ` de ${tarefa.topico}` : ''}`;
  }
  const FIXOS = {
    resg: 'Resgate: refazer os tópicos que não passaram e os erros (sem matéria nova)',
    prova: 'Prova antiga cronometrada, sem consultar',
    corr: 'Destrinchar a resolução da prova e anotar os erros com a causa',
    revl: 'Revisão intercalada + caderno de erros refeito sem olhar a resolução',
    minimo: '20 questões do próximo tópico',
    red: 'Escrever 1 redação e corrigir pelas 5 competências',
  };
  if (tarefa?.resgateLivre) return 'Resgate: prova antiga ou questões, e anotar os erros no caderno';
  if (tarefa?.semTopico) return `Revisar ${tarefa.materia} com questões e provas antigas`;
  return FIXOS[b?.cat] ?? b?.titulo ?? 'Bloco de estudo';
}

/**
 * Passos do bloco de estudo, em ordem. `ctx` = { primeiroDoDia, questaoDificil, provas (fase de provas) }.
 * Cada passo: { id, titulo, detalhe?, url?, semAula? }.
 */
export function passosDoBloco(tarefa, ctx = {}) {
  if (!tarefa || tarefa.semTopico || tarefa.resgateLivre) return [];
  const out = [{ id: 'comecar', titulo: 'Celular em outro cômodo', detalhe: `Comece com ${TIMER_MIN} minutos. Só isso.` }];
  const pre = ctx.primeiroDoDia && ctx.questaoDificil?.trim()
    ? { titulo: 'Pré-teste: comece pela questão difícil de ontem', detalhe: `"${ctx.questaoDificil.trim()}" Depois, mais 2 questões do tópico, antes do vídeo.` }
    : { titulo: 'Pré-teste: 3 questões do tópico, antes do vídeo', detalhe: 'Errar aqui é esperado: o cérebro fica atento à explicação.' };
  if (!tarefa.matar) out.push({ id: 'pretest', ...pre });
  else if (ctx.primeiroDoDia && ctx.questaoDificil?.trim()) out.push({ id: 'pretest', titulo: 'Comece pela questão difícil de ontem', detalhe: `"${ctx.questaoDificil.trim()}"` });
  if (!tarefa.matar) {
    out.push(tarefa.video ? { id: 'video', titulo: `Vídeo · ~${tarefa.video.min} min`, detalhe: tarefa.video.rotulo, url: tarefa.video.url }
      : { id: 'video', titulo: 'Sem aula dos canais', detalhe: 'Use só o livro neste tópico.', semAula: true });
  }
  if (tarefa.paginas) out.push({ id: 'livro', titulo: `${tarefa.paginas.livro}: págs ${tarefa.paginas.de}–${tarefa.paginas.ate}`, detalhe: tarefa.exercicios ? `Exercícios nº ${tarefa.exercicios.de}–${tarefa.exercicios.ate}, sem consultar.` : `~${tarefa.paginas.min} min` });
  out.push({ id: 'questoes', titulo: `Questões em lotes de 10 · ${tarefa.questoes.n} no bloco`, detalhe: DICAS_QUESTOES.join(' '), dicas: DICAS_QUESTOES });
  out.push({ id: 'registrar', titulo: 'Registrar', detalhe: 'Acertos no app; erros no caderno de erros, com a causa.' });
  return out;
}

/** Timer de 5 minutos: { restante (s), acabou }. `inicio` em ms. */
export function timerCinco(inicio, agora) {
  const rest = Math.max(0, TIMER_MIN * 60 - Math.floor((agora - inicio) / 1000));
  return { restante: rest, acabou: rest === 0 };
}
