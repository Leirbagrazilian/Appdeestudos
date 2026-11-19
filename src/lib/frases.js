// Frases motivacionais por contexto (cfg.frases, vindas do seed).
// A escolha é determinística: muda com o dia (e com os blocos feitos), nunca a cada render.

/** Contexto do momento, do mais urgente para o mais geral. */
export function contextoFrase({ hora = 12, pct = 0, feitos = 0, dificil = false, diaSemana = 1, diasProva = null } = {}) {
  if (hora >= 22 || hora < 4) return 'noite';
  if (pct >= 1) return 'cumprido';
  if (dificil) return 'dificil';
  if (feitos > 0) return 'bloco';
  if (diasProva != null && diasProva >= 0 && diasProva <= 14) return 'prova';
  if (diaSemana === 0) return 'domingo';
  return 'inicio';
}

const semente = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/** Frase do contexto para o dia (AAAA-MM-DD). `passo` avança na lista (ex.: blocos feitos). */
export function escolherFrase(frases, contexto, dia, passo = 0) {
  const lista = frases?.[contexto]?.length ? frases[contexto] : frases?.inicio ?? [];
  if (!lista.length) return '';
  return lista[(semente(`${dia}|${contexto}`) + passo) % lista.length];
}

/** Banco de frases do tom: 'sargento' usa `frases.sargento` (se existir); qualquer outro usa o padrão. */
export const bancoDoTom = (frases, tom) => (tom === 'sargento' && frases?.sargento ? frases.sargento : frases);

export function fraseDoDia(frases, estado, dia, tom = 'padrao') {
  const c = contextoFrase(estado);
  return escolherFrase(bancoDoTom(frases, tom), c, dia, c === 'bloco' ? estado.feitos : 0);
}
