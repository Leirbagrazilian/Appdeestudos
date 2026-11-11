// Trilha: tópicos de cada matéria em ordem de estudo, com os concursos que cada um serve.
export const NIVEIS = [['0', 'nunca vi'], ['1', 'vi pouco'], ['2', 'quase lá'], ['3', 'domino']];
export const MATERIAS_TRILHA = (cfg) => cfg.materias.filter((m) => cfg.topicos?.[m]);

const ativos = (cfg) => new Set(cfg.concursos.filter((c) => c.plano !== false).map((c) => c.id));

/** Tópicos da matéria na ordem da trilha; cada um com os concursos (do plano) que ele serve. */
export function topicosDe(cfg, materia) {
  const padrao = cfg.materiasInfo?.[materia]?.concursos ?? [];
  const ok = ativos(cfg);
  return (cfg.topicos?.[materia] ?? []).map((t, ordem) => ({
    ...t, ordem, concursos: (t.concursos ?? padrao).filter((id) => ok.has(id)),
  }));
}
/** Domínio de 0 a 3 (sem avaliação = 0, "nunca vi"). */
export const dominio = (lacunas, materia, nome) => lacunas?.[materia]?.[nome] ?? 0;
export const status = (n) => (n >= 3 ? 'dominado' : n === 0 ? 'a fazer' : 'em andamento');

/**
 * Próximo tópico a estudar: olha uma janela de `janela` tópicos a partir do primeiro ainda não dominado
 * e escolhe o que serve a mais concursos (empate: o primeiro da trilha). Assim a ordem de estudo é
 * respeitada, mas um tópico que vale para vários concursos passa na frente de vizinhos que valem para um só.
 */
export function proximoTopico(cfg, lacunas, materia, janela = 3) {
  const lista = topicosDe(cfg, materia);
  const primeiro = lista.findIndex((t) => dominio(lacunas, materia, t.nome) < 3);
  if (primeiro < 0) return null;
  const cand = lista.slice(primeiro, primeiro + janela).filter((t) => dominio(lacunas, materia, t.nome) < 3);
  return cand.reduce((melhor, t) => (t.concursos.length > melhor.concursos.length ? t : melhor), cand[0]);
}

/** Fração dominada da matéria (0 a 1). */
export function cobertura(cfg, lacunas, materia) {
  const l = topicosDe(cfg, materia);
  return l.length ? l.reduce((s, t) => s + dominio(lacunas, materia, t.nome), 0) / (3 * l.length) : 0;
}
export function coberturaGeral(cfg, lacunas) {
  const todos = MATERIAS_TRILHA(cfg).flatMap((m) => topicosDe(cfg, m).map((t) => dominio(lacunas, m, t.nome)));
  return todos.length ? todos.reduce((a, b) => a + b, 0) / (3 * todos.length) : 0;
}

/** Aproveita as notas dadas antes da trilha (tópicos com outros nomes). Usa a menor nota dos antigos. */
export function migrarLacunas(lacunas, topicos) {
  const novo = {};
  for (const [materia, lista] of Object.entries(topicos ?? {})) {
    novo[materia] = {};
    for (const t of lista) {
      const atual = lacunas?.[materia]?.[t.nome];
      if (atual != null) { novo[materia][t.nome] = atual; continue; }
      const antigas = (t.antigos ?? []).map((a) => lacunas?.[materia]?.[a]).filter((n) => n != null);
      if (antigas.length) novo[materia][t.nome] = Math.min(...antigas);
    }
  }
  return novo;
}
