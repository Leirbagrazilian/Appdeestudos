// Bloco = tarefa exata: vídeo -> páginas do livro -> exercícios -> questões do tópico.
// O app não guarda questões: cada tópico tem links (colados por você) para listas em sites grátis.
import { proximoTopico } from './trilha.js';
import { recursoPorId, recursosAtivos, vinculosDoTopico, temPaginas, ritmoDe, ritmoQuestoes, cotaPaginas, proximaPagina } from './livros.js';

export const ESTUDO = ['mat', 'fis', 'qui', 'por', 'ing', 'hg'];
export const REGISTRAVEL = [...ESTUDO, 'minimo']; // blocos que abrem o registro de resultado
export const QUESTOES_DIA_MINIMO = 20;
export const CAMPOS_LINK = ['video', 'qconcursos', 'estuda', 'pdf', 'outro'];
const SITES_COTA = ['qconcursos', 'estuda'];

export const linksDe = (cfg, materia, topico) => ({ video: '', qconcursos: '', estuda: '', pdf: '', outro: '', ...(cfg.questoesLinks?.[materia]?.[topico] ?? {}) });
export const limitesCota = (cfg) => ({ qconcursos: cfg.cotasGratis?.qconcursos ?? 10, estuda: cfg.cotasGratis?.estuda ?? 5 });
const nomeSite = (cfg, id) => cfg.sitesQuestoes?.find((s) => s.id === id)?.nome ?? id;

/** Links de questões do tópico, em ordem de uso, já com a situação da cota grátis do dia. */
export function fontesQuestoes(cfg, materia, topico, cotasDia = {}) {
  const l = linksDe(cfg, materia, topico), lim = limitesCota(cfg);
  return ['qconcursos', 'estuda', 'pdf', 'outro'].filter((s) => l[s]).map((s) => {
    const limite = SITES_COTA.includes(s) ? lim[s] : null, usadas = cotasDia[s] ?? 0;
    return { site: s, rotulo: nomeSite(cfg, s), url: l[s], usadas, limite, restante: limite != null ? Math.max(0, limite - usadas) : null, esgotada: limite != null && usadas >= limite };
  });
}
/** Soma o que você registrou no dia por site (só QConcursos e Estuda.com têm cota). */
export const aplicarCota = (cotasDia, deltas) => {
  const novo = { ...(cotasDia ?? {}) };
  for (const [s, n] of Object.entries(deltas)) if (SITES_COTA.includes(s)) novo[s] = Math.max(0, (novo[s] ?? 0) + n);
  return novo;
};

/** Divide os minutos do bloco entre vídeo, teoria (páginas e exercícios) e questões, só entre o que existe. */
export function divisaoBloco(cfg, minutos, { video, paginas }) {
  const peso = cfg.divisaoBloco ?? { video: 25, teoria: 45, questoes: 30 };
  const p = { video: video ? peso.video : 0, teoria: paginas ? peso.teoria : 0, questoes: peso.questoes };
  const soma = p.video + p.teoria + p.questoes;
  const r5 = (x) => Math.round(x / 5) * 5;
  const v = r5((minutos * p.video) / soma), t = r5((minutos * p.teoria) / soma);
  return { video: v, teoria: t, questoes: Math.max(0, minutos - v - t) };
}

/** Vídeo do tópico: o link colado para ele; senão, o primeiro vídeo/site da matéria; senão, o link que você guardou na matéria. */
export function videoDe(cfg, materia, topico) {
  const l = linksDe(cfg, materia, topico).video;
  if (l) return { url: l, origem: 'topico' };
  const rec = recursosAtivos(cfg, materia).find((r) => r.tipo !== 'livro' && r.link);
  if (rec) return { url: rec.link, origem: 'recurso', rotulo: rec.titulo };
  const m = cfg.links?.[materia];
  return m ? { url: m, origem: 'materia' } : null;
}

const rotuloLivro = (r, v) => `${r.titulo}${r.volume ? ` v.${r.volume}` : ''}${v.cap ? `, cap. ${v.cap}` : ''}`;

/**
 * Tarefa de cada bloco de estudo do dia (id -> tarefa). Blocos já feitos ficam de fora.
 * Vários blocos da mesma matéria no dia continuam de onde o anterior parou (ponteiro virtual).
 * ctx = { lacunas, leitura, done, cotasDia, faseId }
 */
export function tarefasDoDia(cfg, blocos, ctx = {}) {
  const out = {}, virt = {}, esgotados = {};
  const lim = ctx.faseId;
  for (const b of blocos) {
    if (!REGISTRAVEL.includes(b.cat) || b.diagnostico || ctx.done?.[b.id]) continue;
    const materia = b.materia;
    const ex = (esgotados[materia] ??= new Set());
    const t = proximoTopico(cfg, ctx.lacunas ?? {}, materia, 3, ex);
    if (!t) { out[b.id] = { semTopico: true, materia }; continue; }
    if (b.cat === 'minimo') {
      // Dia mínimo: só questões (20 em 45 min) do próximo tópico; as revisões vencidas ficam na lista de revisões
      const fontes = fontesQuestoes(cfg, materia, t.nome, ctx.cotasDia ?? {});
      const comCota = fontes.filter((f) => f.limite != null), cotaEsgotada = comCota.length > 0 && comCota.every((f) => f.esgotada);
      out[b.id] = { materia, topico: t.nome, concursos: t.concursos, min: b.min, partes: { video: 0, teoria: 0, questoes: b.min }, video: null, paginas: null, exercicios: null,
        concluidoLivro: false, temLivro: false, semPaginas: false, vinculoId: null,
        questoes: { n: b.questoes ?? QUESTOES_DIA_MINIMO, min: b.min, fontes, semLinks: fontes.length === 0, cotaEsgotada, alternativa: cotaEsgotada ? (fontes.some((f) => f.limite == null) ? 'pdf' : 'livro') : null } };
      continue;
    }

    const vincs = vinculosDoTopico(cfg, materia, t.nome);
    const vivo = (v) => temPaginas(v) && (virt[v.id] ?? proximaPagina(v, ctx.leitura?.[v.id])) <= +v.pagFim;
    const v = vincs.find(vivo) ?? vincs.find(temPaginas) ?? null;
    const concluidoLivro = !!v && !vivo(v) && vincs.filter(temPaginas).every((x) => !vivo(x));
    const video = videoDe(cfg, materia, t.nome);
    const usaPaginas = !!v && vivo(v);
    const div = divisaoBloco(cfg, b.min, { video, paginas: usaPaginas });

    let paginas = null, exercicios = null;
    if (usaPaginas) {
      const r = recursoPorId(cfg, v.recurso);
      const ritmo = ritmoDe(cfg, r, ctx.leitura?.[v.id]?.registros ?? []).ritmo;
      const inicio = virt[v.id] ?? proximaPagina(v, ctx.leitura?.[v.id]);
      const c = cotaPaginas(v, { proxima: inicio }, div.teoria, ritmo);
      if (c && !c.concluido) {
        paginas = { de: c.de, ate: c.ate, n: c.n, min: div.teoria, vinculoId: v.id, livro: rotuloLivro(r, v), restante: c.restante };
        exercicios = c.ex;
        virt[v.id] = c.ate + 1;
        if (c.restante === 0 && vincs.filter(temPaginas).every((x) => (virt[x.id] ?? proximaPagina(x, ctx.leitura?.[x.id])) > +x.pagFim)) ex.add(t.nome);
      }
    }
    const nQ = Math.max(1, Math.round((ritmoQuestoes(cfg, lim) * div.questoes) / 60));
    const fontes = fontesQuestoes(cfg, materia, t.nome, ctx.cotasDia ?? {});
    // a cota grátis (QConcursos + Estuda.com) acabou quando todos os sites COM cota que você usa estão esgotados
    const comCota = fontes.filter((f) => f.limite != null);
    const cotaEsgotada = comCota.length > 0 && comCota.every((f) => f.esgotada);
    out[b.id] = {
      materia, topico: t.nome, concursos: t.concursos, min: b.min, partes: div,
      video: video && div.video ? { ...video, min: div.video } : null,
      paginas, exercicios, concluidoLivro,
      temLivro: recursosAtivos(cfg, materia).some((r) => r.tipo === 'livro'),
      semPaginas: !usaPaginas && !concluidoLivro,
      vinculoId: v?.id ?? null,
      questoes: {
        n: nQ, min: div.questoes, fontes,
        semLinks: fontes.length === 0,
        cotaEsgotada,
        // acabou a cota grátis do dia: sugere a prova em PDF (se você colou o link) ou os exercícios do livro
        alternativa: cotaEsgotada ? (fontes.some((f) => f.limite == null) ? 'pdf' : 'livro') : null,
      },
    };
  }
  return out;
}

/** Acerto por tópico a partir dos blocos feitos: { 'Matéria|Tópico': { feitas, acertos } }. */
export function acertoPorTopico(done) {
  const out = {};
  for (const v of Object.values(done ?? {})) {
    if (!v.questoes?.feitas || !v.topico) continue;
    const k = `${v.materia}|${v.topico}`;
    const a = (out[k] ??= { feitas: 0, acertos: 0 });
    a.feitas += v.questoes.feitas; a.acertos += v.questoes.acertos ?? 0;
  }
  return out;
}

/** O que muda quando você registra (ou corrige) o resultado de um bloco: páginas, cota por site e erros ainda sem registro. */
export function deltaResultado(antigo, novo) {
  const a = antigo ?? { feitas: 0, paginas: 0, site: null, errosRegistrados: 0 };
  const cotas = {};
  if (a.site && a.feitas) cotas[a.site] = (cotas[a.site] ?? 0) - a.feitas;
  if (novo.site && novo.feitas) cotas[novo.site] = (cotas[novo.site] ?? 0) + novo.feitas;
  return { paginas: (novo.paginas ?? 0) - (a.paginas ?? 0), cotas, errosFaltando: Math.max(0, (novo.feitas ?? 0) - (novo.acertos ?? 0) - (a.errosRegistrados ?? 0)) };
}
