// Atualiza a configuração salva no aparelho quando o seed ganha conteúdo novo,
// sem perder o que você editou (datas, status, metas, carta, links, preferências...).
// Conteúdo que você não edita no app (fases, tópicos, textos) é sempre trazido do seed.
const DO_SEED = ['fases', 'provaSabado', 'metodos', 'diagnostico', 'topicos', 'pausasAtivas', 'questoes', 'materias', 'tiposErro'];
const CAMPOS_CONCURSO = ['nome', 'sigla', 'cor', 'prioridade', 'idade', 'link', 'plano'];
const mesmoEvento = (a, b) => a.tipo === b.tipo && (a.nome ?? '') === (b.nome ?? '');

export function migrarCfg(salvo, seed) {
  if ((salvo.versaoSeed ?? 1) >= (seed.versaoSeed ?? 1)) return salvo;
  const cfg = structuredClone(salvo);
  for (const k of DO_SEED) if (k in seed) cfg[k] = structuredClone(seed[k]);
  for (const k of Object.keys(seed)) if (!(k in cfg)) cfg[k] = structuredClone(seed[k]);
  cfg.perfil = { ...structuredClone(seed.perfil), ...cfg.perfil };

  const antigos = new Map((salvo.concursos ?? []).map((c) => [c.id, c]));
  cfg.concursos = seed.concursos.map((novo) => {
    const velho = antigos.get(novo.id);
    if (!velho) return structuredClone(novo);
    const c = structuredClone(velho);
    for (const k of CAMPOS_CONCURSO) if (k in novo) c[k] = structuredClone(novo[k]); else delete c[k];
    for (const e of novo.eventos) if (!c.eventos.some((x) => mesmoEvento(x, e))) c.eventos.push(structuredClone(e));
    return c;
  });
  cfg.versaoSeed = seed.versaoSeed ?? 1;
  return cfg;
}
