import { mesclarBiblioteca } from './livros.js';
// Atualiza a configuração salva no aparelho quando o seed ganha conteúdo novo,
// sem perder o que você editou (datas, status, metas, carta, links, preferências...).
// Conteúdo que você não edita no app (fases, tópicos, textos) é sempre trazido do seed.
const DO_SEED = ['fases', 'provaSabado', 'metodos', 'diagnostico', 'topicos', 'pausasAtivas', 'questoes', 'materias', 'tiposErro', 'materiasInfo', 'regras', 'horasFase', 'categorias', 'ritmos', 'temasRedacao', 'divisaoBloco', 'divisaoBlocoZero', 'sitesQuestoes', 'fase0', 'treinoPlano', 'oracaoPlano', 'frases'];
const CAMPOS_CONCURSO = ['nome', 'sigla', 'cor', 'prioridade', 'idade', 'link', 'plano'];
const mesmoEvento = (a, b) => a.tipo === b.tipo && (a.nome ?? '') === (b.nome ?? '');

const NOMES_AULAS_ANTIGOS = ['Faculdade', 'Academia', 'Jiu-jitsu'];

export function migrarCfg(salvo, seed) {
  if ((salvo.versaoSeed ?? 1) >= (seed.versaoSeed ?? 1)) return salvo;
  const cfg = structuredClone(salvo);
  for (const k of DO_SEED) if (k in seed) cfg[k] = structuredClone(seed[k]);
  for (const k of Object.keys(seed)) if (!(k in cfg)) cfg[k] = structuredClone(seed[k]);
  cfg.perfil = { ...structuredClone(seed.perfil), ...cfg.perfil };
  // rotina: o que você editou fica; campos novos entram.
  cfg.rotina = { ...structuredClone(seed.rotina), ...(cfg.rotina ?? {}) };
  delete cfg.modeloSemana;
  const v = salvo.versaoSeed ?? 1;
  if (v < 12) {
    // v12 (plano ~55 h): janelas passam a ser calculadas (6h30–21h menos os fixos); a meta padrão antiga (43 h) vira 55 h
    delete cfg.rotina.janelas; delete cfg.rotina.metaNominal; delete cfg.rotina.pesoFimDeSemana; delete cfg.rotina.metaHoras;
    if (salvo.rotina?.metaLiquida == null || salvo.rotina.metaLiquida === 43) cfg.rotina.metaLiquida = seed.rotina.metaLiquida;
    // aulas: as do seed (faculdade com "vou/não vou", jiu-jitsu); o que você cadastrou à mão continua
    const meus = (salvo.rotina?.aulas ?? []).filter((a) => !NOMES_AULAS_ANTIGOS.includes(a.nome) && !seed.rotina.aulas.some((n) => n.nome === a.nome));
    cfg.rotina.aulas = [...structuredClone(seed.rotina.aulas), ...meus];
    cfg.treino = { ...structuredClone(seed.treino), ...(cfg.treino ?? {}) };
    for (const k of ['inicioFase2', 'semanasEspecifica']) delete cfg.perfil[k];
    cfg.sono = { ...structuredClone(seed.sono), ...(cfg.sono ?? {}) };
  }
  if (v < 14 && seed.perfil?.inicioReal) cfg.perfil.inicioReal = seed.perfil.inicioReal; // v14: tudo começa em 20/11/2026 (treinoPlano e oracaoPlano já vêm do seed)
  cfg.biblioteca = mesclarBiblioteca(salvo.biblioteca, seed.biblioteca); // o que você cadastrou fica; recursos novos do seed entram

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
