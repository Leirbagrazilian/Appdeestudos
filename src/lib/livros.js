// Meus livros: recursos (livros, vídeos, sites), vínculos com os tópicos da Trilha e cotas de páginas.
import { topicosDe } from './trilha.js';

export const TIPOS = [['livro', 'Livro'], ['video', 'Vídeo'], ['site', 'Site'], ['lista', 'Lista de exercícios'], ['prova', 'Prova']];
export const slug = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const bib = (cfg) => cfg.biblioteca ?? { principal: {}, recursos: [], vinculos: [], removidos: [] };
export const recursoPorId = (cfg, id) => bib(cfg).recursos.find((r) => r.id === id);

/** Coleções (séries) de livros da matéria, em ordem de aparição. */
export function series(cfg, materia) {
  const mapa = new Map();
  for (const r of bib(cfg).recursos) if (r.tipo === 'livro' && r.materia === materia) {
    const id = r.serie ?? r.id;
    if (!mapa.has(id)) mapa.set(id, { id, titulo: r.titulo, autor: r.autor, volumes: [] });
    mapa.get(id).volumes.push(r);
  }
  for (const s of mapa.values()) s.volumes.sort((a, b) => (+a.volume || 0) - (+b.volume || 0));
  return [...mapa.values()];
}
export const principalDe = (cfg, materia) => bib(cfg).principal?.[materia] ?? null;

/** Recursos que valem para a matéria: tudo que não é livro + os volumes do livro principal. */
export function recursosAtivos(cfg, materia) {
  const prin = principalDe(cfg, materia);
  return bib(cfg).recursos.filter((r) => r.materia === materia && (r.tipo !== 'livro' || (r.serie ?? r.id) === prin));
}
export const vinculosDoTopico = (cfg, materia, topico) => {
  const ativos = new Set(recursosAtivos(cfg, materia).map((r) => r.id));
  return bib(cfg).vinculos.filter((v) => v.materia === materia && v.topico === topico && ativos.has(v.recurso));
};
export const temPaginas = (v) => Number.isFinite(+v?.pagIni) && Number.isFinite(+v?.pagFim) && v.pagIni != null && v.pagFim != null && +v.pagFim >= +v.pagIni;

// ---------- ritmo e cotas ----------
const num = (x) => (x === '' || x == null ? null : +x);
/** Páginas por hora: o padrão do tipo de conteúdo (teoria 10, gramática 15) ajustado pelo que você registrou. */
export function ritmoDe(cfg, recurso, registros = []) {
  const tabela = cfg.ritmos ?? { teoria: 10, gramatica: 15 };
  const base = tabela[recurso?.ritmo ?? (recurso?.materia === 'Português' ? 'gramatica' : 'teoria')] ?? 10;
  const horas = registros.reduce((a, r) => a + (r.min ?? 0), 0) / 60;
  const pags = registros.reduce((a, r) => a + (r.pags ?? 0), 0);
  if (horas <= 0 || pags <= 0) return { base, ritmo: base, ajustado: false };
  const peso = Math.min(1, horas / 5); // com 5 h registradas, vale só o seu ritmo real
  const real = pags / horas;
  const ritmo = Math.min(base * 2.5, Math.max(base * 0.4, base * (1 - peso) + real * peso));
  return { base, ritmo, ajustado: true };
}
/** Questões por hora: 6 para Escola Naval/EFOMM, 3 para o ITA. */
export const ritmoQuestoes = (cfg, faseId) => (faseId === 'ita' ? cfg.ritmos?.questoesITA ?? 3 : cfg.ritmos?.questoesNaval ?? 6);

/** Próxima página a ler: continua de onde você parou. */
export const proximaPagina = (v, leit) => Math.max(+v.pagIni, leit?.proxima ?? +v.pagIni);
export const progresso = (v, leit) => (temPaginas(v) ? Math.min(1, Math.max(0, (proximaPagina(v, leit) - +v.pagIni) / (+v.pagFim - +v.pagIni + 1))) : 0);

/** Cota de um bloco de `minutos`: páginas (e exercícios, na mesma proporção) a partir de onde você parou. */
export function cotaPaginas(v, leit, minutos, ritmo) {
  if (!temPaginas(v)) return null;
  const ini = proximaPagina(v, leit), fim = +v.pagFim;
  if (ini > fim) return { concluido: true };
  const n = Math.max(1, Math.round((ritmo * minutos) / 60));
  const ate = Math.min(fim, ini + n - 1);
  const total = fim - +v.pagIni + 1;
  let ex = null;
  if (num(v.exIni) != null && num(v.exFim) != null && +v.exFim >= +v.exIni) {
    const t = +v.exFim - +v.exIni + 1;
    const de = +v.exIni + Math.floor(((ini - +v.pagIni) / total) * t), ateEx = +v.exIni + Math.ceil(((ate - +v.pagIni + 1) / total) * t) - 1;
    ex = { de: Math.min(de, +v.exFim), ate: Math.max(Math.min(ateEx, +v.exFim), Math.min(de, +v.exFim)) };
  }
  return { concluido: false, de: ini, ate, n: ate - ini + 1, restante: fim - ate, ex };
}

/** Registra leitura: a próxima página anda só o que você leu (o que não foi feito fica para o próximo bloco). */
export function registrarLeitura(leit, v, pags, min, dia) {
  const atual = leit ?? { proxima: null, registros: [] };
  const prox = Math.min(+v.pagFim + 1, proximaPagina(v, atual) + Math.max(0, Math.round(pags)));
  return { proxima: prox, registros: [...(atual.registros ?? []), { dia, pags: Math.round(pags), min: Math.round(min) }] };
}
/** Corrige o ponteiro ao mudar um registro: delta positivo conta como leitura, negativo volta o ponteiro. */
export function ajustarLeitura(leit, v, delta, min, dia) {
  if (delta > 0) return registrarLeitura(leit, v, delta, min, dia);
  if (delta < 0) return { ...(leit ?? { registros: [] }), proxima: Math.max(+v.pagIni, proximaPagina(v, leit) + delta) };
  return leit;
}
/** "Parei na página X": a próxima é a X + 1. */
export const pararNaPagina = (leit, v, pagina) => ({ ...(leit ?? { registros: [] }), proxima: Math.min(+v.pagFim + 1, Math.max(+v.pagIni, Math.round(pagina) + 1)) });

// ---------- cadastro ----------
export function novoRecurso(cfg, { tipo, materia, titulo, autor = '', volume = '', link = '', assunto = '' }) {
  const base = slug(`${titulo}${volume ? '-' + volume : ''}`) || 'recurso';
  let id = base, k = 2;
  while (recursoPorId(cfg, id)) id = `${base}-${k++}`;
  const r = { id, tipo, materia, titulo: titulo.trim(), autor: autor.trim(), link: link.trim(), linkStatus: link.trim() ? 'informado por você' : 'a confirmar' };
  if (volume !== '') r.volume = volume;
  if (assunto) r.assunto = assunto;
  if (tipo === 'livro') r.serie = slug(titulo) || id;
  return r;
}
export const idVinculo = (recurso, topico) => `${recurso}|${topico}`;

/** Leva a biblioteca salva para o seed novo sem perder o que você cadastrou ou editou. */
export function mesclarBiblioteca(salva, seed) {
  if (!salva) return structuredClone(seed);
  const removidos = new Set(salva.removidos ?? []);
  const porId = (l) => new Map(l.map((x) => [x.id, x]));
  const rs = porId(salva.recursos ?? []), vs = porId(salva.vinculos ?? []);
  for (const r of seed.recursos) {
    const velho = rs.get(r.id);
    if (!velho && !removidos.has(r.id)) rs.set(r.id, structuredClone(r));
    else if (velho && !velho.link && r.link) { velho.link = r.link; velho.linkStatus = r.linkStatus; } // link novo para quem ainda não tinha
  }
  for (const v of seed.vinculos) if (!vs.has(v.id) && !removidos.has(v.id) && rs.has(v.recurso)) vs.set(v.id, structuredClone(v));
  return { principal: { ...seed.principal, ...(salva.principal ?? {}) }, recursos: [...rs.values()], vinculos: [...vs.values()].filter((v) => rs.has(v.recurso)), removidos: [...removidos] };
}

/** Para a tela: tópicos da matéria com os vínculos de cada um. */
export const topicosComVinculos = (cfg, materia) => topicosDe(cfg, materia).map((t) => ({ ...t, vinculos: vinculosDoTopico(cfg, materia, t.nome) }));
