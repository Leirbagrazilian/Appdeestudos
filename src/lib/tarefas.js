// Bloco = tarefa exata: vídeo -> páginas do livro -> exercícios -> questões do tópico.
// O app não guarda questões: cada tópico tem links (colados por você) para listas em sites grátis.
import { proximoTopico } from './trilha.js';
import { resumo as resumoDominio, MIN_FEITAS, MAX_TENTATIVAS } from './dominio.js';
import { recursoPorId, recursosAtivos, vinculosDoTopico, temPaginas, ritmoDe, ritmoQuestoes, cotaPaginas, proximaPagina } from './livros.js';

export const ESTUDO = ['mat', 'fis', 'qui', 'por', 'ing', 'hg'];
export const REGISTRAVEL = [...ESTUDO, 'minimo']; // blocos que abrem o registro de resultado
export const QUESTOES_DIA_MINIMO = 20;
export const CAMPOS_LINK = ['video', 'khan', 'obmep', 'qconcursos', 'estuda', 'pdf', 'outro'];
const SITES_COTA = ['qconcursos', 'estuda'];

export const linksDe = (cfg, materia, topico) => ({ video: '', khan: '', obmep: '', qconcursos: '', estuda: '', pdf: '', outro: '', ...(cfg.questoesLinks?.[materia]?.[topico] ?? {}) });
export const limitesCota = (cfg) => ({ qconcursos: cfg.cotasGratis?.qconcursos ?? 10, estuda: cfg.cotasGratis?.estuda ?? 5 });
const nomeSite = (cfg, id) => cfg.sitesQuestoes?.find((s) => s.id === id)?.nome ?? id;

/** Links de questões do tópico, em ordem de uso, já com a situação da cota grátis do dia.
 *  Fase 0: só exercícios (Khan, OBMEP e o que você colou), sem questões de concurso; se o tópico não tem link, entra o curso da matéria. */
export function fontesQuestoes(cfg, materia, topico, cotasDia = {}, faseId = null) {
  const l = linksDe(cfg, materia, topico), lim = limitesCota(cfg), zero = faseId === 'zero';
  const ordem = zero ? ['khan', 'obmep', 'pdf', 'outro'] : ['qconcursos', 'estuda', 'pdf', 'outro'];
  const fontes = ordem.filter((s) => l[s]).map((s) => {
    const limite = SITES_COTA.includes(s) ? lim[s] : null, usadas = cotasDia[s] ?? 0;
    return { site: s, rotulo: nomeSite(cfg, s), url: l[s], usadas, limite, restante: limite != null ? Math.max(0, limite - usadas) : null, esgotada: limite != null && usadas >= limite };
  });
  if (zero && !fontes.length) for (const r of cfg.fase0?.exercicios?.[materia] ?? []) fontes.push({ site: r.site ?? 'outro', rotulo: r.rotulo, url: r.url, usadas: 0, limite: null, restante: null, esgotada: false, curso: true });
  return fontes;
}
/** Soma o que você registrou no dia por site (só QConcursos e Estuda.com têm cota). */
export const aplicarCota = (cotasDia, deltas) => {
  const novo = { ...(cotasDia ?? {}) };
  for (const [s, n] of Object.entries(deltas)) if (SITES_COTA.includes(s)) novo[s] = Math.max(0, (novo[s] ?? 0) + n);
  return novo;
};

/** Divide os minutos do bloco entre vídeo, teoria (páginas e exercícios) e questões, só entre o que existe. */
export function divisaoBloco(cfg, minutos, { video, paginas }, faseId = null) {
  const peso = (faseId === 'zero' ? cfg.divisaoBlocoZero : null) ?? cfg.divisaoBloco ?? { video: 25, teoria: 45, questoes: 30 };
  const p = { video: video ? peso.video : 0, teoria: paginas ? peso.teoria : 0, questoes: peso.questoes };
  const soma = p.video + p.teoria + p.questoes;
  const r5 = (x) => Math.round(x / 5) * 5;
  const v = r5((minutos * p.video) / soma), t = r5((minutos * p.teoria) / soma);
  // vídeo curto: no máximo 20 min na Fase 0
  const vv = faseId === 'zero' ? Math.min(v, 20) : v;
  return { video: vv, teoria: t, questoes: Math.max(0, minutos - vv - t) };
}

// ---------- busca automática ----------
// Enquanto você não cola o link do tópico, o bloco já traz buscas prontas pelo nome dele (YouTube e Khan Academy).
export const MATERIAS_BUSCA = ['Matemática', 'Física', 'Química'];
const CANAL_BUSCA = { Matemática: ['Matemática Zero (Nerckie)', 'Matemática Zero Nerckie'], Física: ['Física Total', 'Física Total Ivys Urquiza'] };
const consulta = (txt) => encodeURIComponent(String(txt).replace(/\s+/g, ' ').trim()).replace(/%20/g, '+');
export const urlYouTube = (txt) => `https://www.youtube.com/results?search_query=${consulta(txt)}`;
export const urlKhan = (txt) => `https://pt.khanacademy.org/search?page_search_query=${consulta(txt)}`;
/** Buscas prontas do tópico: { video: [...], exercicios: [...] }, cada item { site, rotulo, url, auto: true }. Só Matemática, Física e Química. */
export function buscasDoTopico(materia, topico) {
  const nome = String(topico ?? '').replace(/\s+/g, ' ').trim();
  if (!MATERIAS_BUSCA.includes(materia) || !nome) return { video: [], exercicios: [] };
  const curto = nome.replace(/\([^)]*\)/g, ' ').replace(/[:;,]/g, ' '); // a busca do Khan acha mais com o nome enxuto
  const item = (site, rotulo, url) => ({ site, rotulo, url, auto: true });
  const canal = CANAL_BUSCA[materia];
  return {
    video: [
      item('youtube', 'YouTube: aulas deste tópico', urlYouTube(`${nome} ${materia} aula`)),
      ...(canal ? [item('youtube', `YouTube: ${canal[0]}`, urlYouTube(`${curto} ${canal[1]}`))] : []),
    ],
    exercicios: [
      item('khan', 'Khan Academy: buscar este tópico', urlKhan(curto)),
      item('youtube', 'YouTube: exercícios resolvidos', urlYouTube(`${nome} ${materia} exercícios resolvidos`)),
    ],
  };
}

/** Vídeo do tópico: o link colado para ele; senão, o primeiro vídeo/site da matéria; senão, o link que você guardou na matéria;
 *  por último (Matemática, Física e Química), a busca automática do tópico no YouTube. */
export function videoDe(cfg, materia, topico) {
  const l = linksDe(cfg, materia, topico).video;
  if (l) return { url: l, origem: 'topico' };
  const rec = recursosAtivos(cfg, materia).find((r) => r.tipo !== 'livro' && r.link);
  if (rec) return { url: rec.link, origem: 'recurso', rotulo: rec.titulo };
  const m = cfg.links?.[materia];
  if (m) return { url: m, origem: 'materia' };
  const b = buscasDoTopico(materia, topico).video[0];
  return b ? { url: b.url, origem: 'busca', rotulo: 'Busca automática no YouTube', auto: true } : null;
}
/** Buscas que acompanham o passo do vídeo: só quando você não colou o vídeo do tópico (e sem repetir o link principal). */
const buscasVideo = (video, materia, topico) => (video?.origem === 'topico' ? [] : buscasDoTopico(materia, topico).video.filter((x) => x.url !== video?.url));
/** Buscas de exercícios: só na Fase 0 e enquanto o tópico não tem link colado (as fontes são só as do curso, ou nenhuma). */
const buscasExercicios = (zero, fontes, materia, topico) => (zero && fontes.every((f) => f.curso) ? buscasDoTopico(materia, topico).exercicios : []);

/** Links para "abrir tudo do bloco": o vídeo (ou a 1ª busca) e a 1ª lista de exercícios/questões ainda disponível, sem repetir. */
export function linksDoBloco(tarefa) {
  if (!tarefa || tarefa.semTopico) return [];
  const out = [], add = (rotulo, url) => { if (url && !out.some((x) => x.url === url)) out.push({ rotulo, url }); };
  if (tarefa.video) add('Vídeo', tarefa.video.url);
  const q = tarefa.questoes ?? {};
  const fonte = (q.fontes ?? []).find((f) => !f.esgotada && !f.curso) ?? q.buscas?.[0] ?? (q.fontes ?? []).find((f) => !f.esgotada);
  if (fonte) add(fonte.rotulo, fonte.url);
  return out;
}

const rotuloLivro = (r, v) => `${r.titulo}${r.volume ? ` v.${r.volume}` : ''}${v.cap ? `, cap. ${v.cap}` : ''}`;

/**
 * Tarefa de cada bloco de estudo do dia (id -> tarefa). Blocos já feitos ficam de fora.
 * Vários blocos da mesma matéria no dia continuam de onde o anterior parou (ponteiro virtual).
 * ctx = { lacunas, leitura, done, cotasDia, faseId, dominio }
 */
export function tarefasDoDia(cfg, blocos, ctx = {}) {
  const out = {}, virt = {}, esgotados = {};
  const lim = ctx.faseId, zero = lim === 'zero';
  const acertos = zero ? acertoPorTopico(ctx.done) : {};
  for (const b of blocos) {
    if (!REGISTRAVEL.includes(b.cat) || b.diagnostico || ctx.done?.[b.id]) continue;
    const materia = b.materia;
    const ex = (esgotados[materia] ??= new Set());
    const opts = { faseZero: zero, dominio: ctx.dominio ?? {}, acertos };
    // Fase 0: blocos ainda não feitos do mesmo dia seguem para o tópico seguinte; se o resultado do anterior for ruim, ele volta a ser o próximo
    const t = proximoTopico(cfg, ctx.lacunas ?? {}, materia, zero ? 1 : 3, ex, opts) ?? (zero ? proximoTopico(cfg, ctx.lacunas ?? {}, materia, 1, new Set(), opts) : null);
    if (!t) { out[b.id] = { semTopico: true, materia }; continue; }
    if (zero && b.cat !== 'minimo') ex.add(t.nome);
    if (b.cat === 'minimo') {
      // Dia mínimo: só questões (20 em 45 min) do próximo tópico; as revisões vencidas ficam na lista de revisões
      const fontes = fontesQuestoes(cfg, materia, t.nome, ctx.cotasDia ?? {}, lim);
      const comCota = fontes.filter((f) => f.limite != null), cotaEsgotada = comCota.length > 0 && comCota.every((f) => f.esgotada);
      out[b.id] = { materia, topico: t.nome, concursos: t.concursos, min: b.min, partes: { video: 0, teoria: 0, questoes: b.min }, video: null, paginas: null, exercicios: null,
        concluidoLivro: false, temLivro: false, semPaginas: false, vinculoId: null,
        questoes: { n: b.questoes ?? QUESTOES_DIA_MINIMO, min: b.min, fontes, buscas: buscasExercicios(zero, fontes, materia, t.nome), semLinks: fontes.length === 0, cotaEsgotada, alternativa: cotaEsgotada ? (fontes.some((f) => f.limite == null) ? 'pdf' : 'livro') : null } };
      continue;
    }

    const vincs = vinculosDoTopico(cfg, materia, t.nome);
    const vivo = (v) => temPaginas(v) && (virt[v.id] ?? proximaPagina(v, ctx.leitura?.[v.id])) <= +v.pagFim;
    const v = vincs.find(vivo) ?? vincs.find(temPaginas) ?? null;
    const concluidoLivro = !!v && !vivo(v) && vincs.filter(temPaginas).every((x) => !vivo(x));
    const video = videoDe(cfg, materia, t.nome);
    const usaPaginas = !!v && vivo(v);
    const div = divisaoBloco(cfg, b.min, { video, paginas: usaPaginas }, lim);

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
    const nQ = Math.max(zero ? MIN_FEITAS : 1, Math.round((ritmoQuestoes(cfg, lim) * div.questoes) / 60)); // Fase 0: no mínimo 10 para valer 8 em 10
    const fontes = fontesQuestoes(cfg, materia, t.nome, ctx.cotasDia ?? {}, lim);
    // a cota grátis (QConcursos + Estuda.com) acabou quando todos os sites COM cota que você usa estão esgotados
    const comCota = fontes.filter((f) => f.limite != null);
    const cotaEsgotada = comCota.length > 0 && comCota.every((f) => f.esgotada);
    out[b.id] = {
      materia, topico: t.nome, concursos: t.concursos, min: b.min, partes: div,
      video: video && div.video ? { ...video, min: div.video, buscas: buscasVideo(video, materia, t.nome) } : null,
      paginas, exercicios, concluidoLivro,
      temLivro: recursosAtivos(cfg, materia).some((r) => r.tipo === 'livro'),
      semPaginas: !usaPaginas && !concluidoLivro,
      zero, ...(zero ? dominioDoTopico(ctx.dominio, materia, t.nome) : {}),
      vinculoId: v?.id ?? null,
      questoes: {
        n: nQ, min: div.questoes, fontes, buscas: buscasExercicios(zero, fontes, materia, t.nome),
        semLinks: fontes.length === 0,
        cotaEsgotada,
        // acabou a cota grátis do dia: sugere a prova em PDF (se você colou o link) ou os exercícios do livro
        alternativa: cotaEsgotada ? (fontes.some((f) => f.limite == null) ? 'pdf' : 'livro') : null,
      },
    };
  }
  return out;
}

/** Fase 0: onde o tópico está no modo domínio (tentativas que falharam, se já é repetição). */
function dominioDoTopico(dominio, materia, topico) {
  const r = resumoDominio(dominio?.[`${materia}|${topico}`]);
  return { repeticao: r.falhas > 0, tentativa: Math.min(MAX_TENTATIVAS, r.falhas + 1), maxTentativas: MAX_TENTATIVAS };
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
