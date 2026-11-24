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
  if (v < 15) {
    // v15: Santa Missa (quinta, sexta, sábado, domingo), corrida de sexta às 07:30 e sono de sexta 21:30 → 04:30; o que você editou fica
    const aulas = cfg.rotina.aulas ?? (cfg.rotina.aulas = []);
    for (const m of seed.rotina.aulas.filter((a) => a.tipo === 'missa')) if (!aulas.some((a) => a.tipo === 'missa' && a.dia === m.dia)) aulas.push(structuredClone(m));
    cfg.rotina.refeicoesPorDia = { ...structuredClone(seed.rotina.refeicoesPorDia), ...(salvo.rotina?.refeicoesPorDia ?? {}) };
    cfg.rotina.fimEstudoPorDia = { ...structuredClone(seed.rotina.fimEstudoPorDia), ...(salvo.rotina?.fimEstudoPorDia ?? {}) };
    cfg.treino = { ...(cfg.treino ?? {}), corridaPorDia: { ...structuredClone(seed.treino.corridaPorDia), ...(salvo.treino?.corridaPorDia ?? {}) } };
    const s5 = salvo.sono?.padrao?.[5], antigo = !s5 || (s5.dormir === '22:00' && s5.acordar === '06:30'); // não editado: troca pelo novo padrão
    cfg.sono = { ...(cfg.sono ?? {}), padrao: { ...(cfg.sono?.padrao ?? {}), 5: antigo ? structuredClone(seed.sono.padrao[5]) : s5 } };
  }
  cfg.biblioteca = mesclarBiblioteca(salvo.biblioteca, seed.biblioteca); // o que você cadastrou fica; recursos novos do seed entram
  if (v < 16) {
    // v16: sem Khan Academy. As aulas indicadas (Universo Narrado, Universo Militares, Pedro Assaad) vêm nos tópicos do seed.
    const khan = (r) => /khanacademy\.org/.test(r.link ?? '');
    const fora = new Set(cfg.biblioteca.recursos.filter(khan).map((r) => r.id));
    cfg.biblioteca.recursos = cfg.biblioteca.recursos.filter((r) => !fora.has(r.id));
    cfg.biblioteca.vinculos = cfg.biblioteca.vinculos.filter((x) => !fora.has(x.recurso));
    for (const [m, porTopico] of Object.entries(cfg.questoesLinks ?? {}))
      for (const t of Object.keys(porTopico ?? {})) { const { khan: _k, ...resto } = porTopico[t] ?? {}; cfg.questoesLinks[m][t] = resto; }
  }

  if (v < 17) {
    // v17 (SPEC v2, ~41 h): rotina, treino e sono padrão novos. Sem missas, jiu-jitsu, ultra nem maratona. O que você editou em compromissos
    // é substituído pela rotina nova; ficam o "vou/não vou" da faculdade, a presença mínima, os dias livres, a rampa, o ritmo e o tênis.
    const r0 = salvo.rotina ?? {}, vou = Object.fromEntries((r0.aulas ?? []).filter((a) => a.tipo === 'faculdade').map((a) => [a.nome, a.vou]));
    cfg.rotina = { ...structuredClone(seed.rotina), presencaMin: r0.presencaMin ?? seed.rotina.presencaMin, diasLivres: r0.diasLivres ?? seed.rotina.diasLivres, rampa: r0.rampa ?? seed.rotina.rampa };
    cfg.rotina.aulas = cfg.rotina.aulas.map((a) => ({ ...a, vou: vou[a.nome] ?? a.vou }));
    cfg.treino = { ...structuredClone(seed.treino), ritmoMinKm: salvo.treino?.ritmoMinKm ?? seed.treino.ritmoMinKm, tenis: salvo.treino?.tenis ?? seed.treino.tenis };
    const ANTIGOS_SONO = ['22:00>05:00', '22:00>06:30', '21:30>04:30', '21:00>05:15']; // padrões do seed antigo: não editados trocam pelo novo
    const padrao = {};
    for (let wd = 0; wd < 7; wd++) { const s = salvo.sono?.padrao?.[wd]; padrao[wd] = s && !ANTIGOS_SONO.includes(`${s.dormir}>${s.acordar}`) ? s : structuredClone(seed.sono.padrao[wd]); }
    cfg.sono = { ...(cfg.sono ?? {}), padrao };
  }

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
