import { mesclarBiblioteca } from './livros.js';
// Atualiza a configuração salva no aparelho quando o seed ganha conteúdo novo,
// sem perder o que você editou (datas, status, metas, carta, links, preferências...).
// Conteúdo que você não edita no app (fases, tópicos, textos) é sempre trazido do seed.
const DO_SEED = ['fases', 'provaSabado', 'metodos', 'diagnostico', 'topicos', 'pausasAtivas', 'questoes', 'materias', 'tiposErro', 'materiasInfo', 'regras', 'horasFase', 'categorias', 'ritmos', 'temasRedacao', 'divisaoBloco', 'divisaoBlocoZero', 'sitesQuestoes', 'fase0'];
const CAMPOS_CONCURSO = ['nome', 'sigla', 'cor', 'prioridade', 'idade', 'link', 'plano'];
const mesmoEvento = (a, b) => a.tipo === b.tipo && (a.nome ?? '') === (b.nome ?? '');

const AULAS_V1 = JSON.stringify([{ dia: 1, inicio: '07:30', fim: '11:10', nome: 'Faculdade' }, { dia: 3, inicio: '09:30', fim: '10:10', nome: 'Faculdade' }, { dia: 4, inicio: '13:00', fim: '18:00', nome: 'Faculdade' }]);

// janelas de fim de semana do seed v7: se você não mexeu nelas, passam para as da v8 (sábado e domingo mais cheios)
const SAB_V7 = JSON.stringify([{ ini: '08:00', fim: '15:00', tipo: 'prova' }]);
const DOM_V7 = JSON.stringify([{ ini: '09:00', fim: '12:00', tipo: 'domingo' }]);

export function migrarCfg(salvo, seed) {
  if ((salvo.versaoSeed ?? 1) >= (seed.versaoSeed ?? 1)) return salvo;
  const cfg = structuredClone(salvo);
  for (const k of DO_SEED) if (k in seed) cfg[k] = structuredClone(seed[k]);
  for (const k of Object.keys(seed)) if (!(k in cfg)) cfg[k] = structuredClone(seed[k]);
  cfg.perfil = { ...structuredClone(seed.perfil), ...cfg.perfil };
  // rotina: o que você editou fica; campos novos entram. As aulas do primeiro cadastro (sem edição) são trocadas pelas do SPEC.
  const aulasSemEdicao = JSON.stringify(salvo.rotina?.aulas ?? null) === AULAS_V1;
  cfg.rotina = { ...structuredClone(seed.rotina), ...(cfg.rotina ?? {}) };
  delete cfg.rotina.metaHoras;
  if ((salvo.versaoSeed ?? 1) < 8) {
    cfg.rotina.metaNominal = seed.rotina.metaNominal; // a tabela de horas da v3 já é líquida
    cfg.rotina.janelas = { ...cfg.rotina.janelas };
    if (JSON.stringify(salvo.rotina?.janelas?.[6] ?? null) === SAB_V7) cfg.rotina.janelas[6] = structuredClone(seed.rotina.janelas[6]);
    if (JSON.stringify(salvo.rotina?.janelas?.[0] ?? null) === DOM_V7) cfg.rotina.janelas[0] = structuredClone(seed.rotina.janelas[0]);
  }
  if (aulasSemEdicao) cfg.rotina.aulas = structuredClone(seed.rotina.aulas);
  delete cfg.modeloSemana;
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
