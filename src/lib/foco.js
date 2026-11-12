// Cronômetro de foco: funções puras. O estado guarda a hora de início de cada fase,
// então o tempo continua certo mesmo com o app fechado.
export const FOCO_PADRAO = { sessaoMin: 50, pausaMin: 10 };

/** Divide um bloco em sessões de até `sessaoMin`, com pausas entre elas. */
export function planoSessoes(min, foco = FOCO_PADRAO) {
  const s = foco.sessaoMin, p = foco.pausaMin;
  const n = Math.max(1, Math.round((min + p) / (s + p)));
  const len = Math.max(5, Math.min(s, Math.round((min - p * (n - 1)) / n)));
  return { sessoes: n, len: n === 1 ? Math.min(s, min) : len, pausa: p };
}

/** Plano de sessões de um bloco: bloco contínuo (prova, correção, redação) é uma sessão só; os demais usam o tempo bruto (com as pausas). */
export function planoDoBloco(b, foco = FOCO_PADRAO) {
  if (b.sessoes === 0) return { sessoes: 1, len: b.min, pausa: foco.pausaMin };
  return planoSessoes(b.bruto ?? b.min, foco);
}

export function iniciar(b, foco, agora) {
  const { sessoes, len, pausa } = planoDoBloco(b, foco);
  return {
    id: b.id, titulo: b.titulo, materia: b.materia, chave: b.chave, comAssunto: !!b.comAssunto,
    sessoes, len, pausa, sessao: 1, fase: 'foco', inicio: agora, focoMs: 0, avisado: false,
    tarefa: b.tarefa ?? null, // a tarefa exata do bloco (vídeo, páginas, exercícios, questões), para mostrar no modo foco
    registro: { feitas: 0, acertos: 0, sozinho: null, assunto: b.tarefa?.topico ?? '', site: null, paginas: b.tarefa?.paginas?.n ?? 0, vinculoId: b.tarefa?.vinculoId ?? null },
  };
}

/** Situação da fase atual. `acabou` = passou do tempo planejado. */
export function estado(t, agora) {
  const dur = (t.fase === 'foco' ? t.len : t.fase === 'pausa' ? t.pausa : 0) * 60000;
  const decorrido = Math.max(0, agora - t.inicio);
  return { dur, decorrido, restante: Math.max(0, dur - decorrido), acabou: t.fase !== 'fim' && decorrido >= dur, pct: dur ? Math.min(1, decorrido / dur) : 1 };
}

// Uma sessão conta no máximo o tempo planejado (se você esquecer o app aberto, não infla as horas).
const focoDaSessao = (t, agora) => (t.fase === 'foco' ? Math.min(Math.max(0, agora - t.inicio), t.len * 60000) : 0);

/** Encerra a sessão de foco atual: vai para a pausa, ou para o registro final se era a última. */
export function encerrarSessao(t, agora) {
  const focoMs = t.focoMs + focoDaSessao(t, agora);
  return { ...t, focoMs, fase: t.sessao >= t.sessoes ? 'fim' : 'pausa', inicio: agora, avisado: false };
}
export function proximaSessao(t, agora) {
  return { ...t, sessao: t.sessao + 1, fase: 'foco', inicio: agora, avisado: false };
}
/** Minutos reais de foco até agora (arredondados). */
export const minutosFoco = (t, agora) => Math.round((t.focoMs + focoDaSessao(t, agora)) / 60000);

export const fmtRelogio = (ms) => {
  const s = Math.round(ms / 1000), m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
