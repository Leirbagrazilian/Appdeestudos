// Checkpoint mensal (as mesmas 10 questões de Matemática da EFOMM do diagnóstico, cronometradas) e portão da Fase 0 -> Fase 1.
import { addDays, weekday } from './dates.js';
import { topicosDe, dominio } from './trilha.js';

export const CHECKPOINT_PADRAO = { questoes: 10, minutos: 30, baseline: { data: '2026-11-15', acertos: 0 } };
export const PORTAO_PADRAO = { khanMin: 80, checkpointMin: 5, semanasExtras: 2 };
const cp = (cfg) => ({ ...CHECKPOINT_PADRAO, ...(cfg.checkpoint ?? {}) });
export const regrasPortao = (cfg) => ({ ...PORTAO_PADRAO, ...(cfg.fase0?.portao ?? {}) });

/** Primeiro sábado do mês de `dia` (AAAA-MM-DD). */
export function primeiroSabado(dia) {
  const d = `${dia.slice(0, 7)}-01`;
  return addDays(d, (6 - weekday(d) + 7) % 7);
}

/** Linha do tempo: o diagnóstico (marco zero) e cada checkpoint, em ordem de data. */
export function serieCheckpoints(cfg, checkpoints) {
  const c = cp(cfg), b = c.baseline;
  const lista = Object.values(checkpoints ?? {}).map((x) => ({ ...x, feitas: x.feitas ?? c.questoes }));
  if (b && !lista.some((x) => x.data === b.data)) lista.push({ data: b.data, acertos: b.acertos, feitas: c.questoes, base: true });
  return lista.sort((a, b2) => a.data.localeCompare(b2.data));
}

/** Checkpoint do mês de `dia`, se já foi feito (o diagnóstico conta no mês em que foi feito). */
export const checkpointDoMes = (cfg, checkpoints, dia) => serieCheckpoints(cfg, checkpoints).find((x) => x.data.slice(0, 7) === dia.slice(0, 7)) ?? null;

/** Há checkpoint a fazer? Vale a partir do primeiro sábado do mês, até o fim do mês, se ainda não foi feito. */
export const checkpointPendente = (cfg, checkpoints, dia) => dia >= primeiroSabado(dia) && !checkpointDoMes(cfg, checkpoints, dia);

/**
 * Portão da Fase 0: teste de saída do Khan (9º ano) com 80% ou mais E checkpoint melhor que o diagnóstico
 * (e com o mínimo de acertos definido). `portao` = { khan: { pct, data } | null }.
 */
export function portaoZero(cfg, portao, checkpoints, lacunas = {}) {
  const r = regrasPortao(cfg), serie = serieCheckpoints(cfg, checkpoints);
  const base = serie.find((x) => x.base) ?? serie[0] ?? null;
  const depois = serie.filter((x) => !x.base && (!base || x.data > base.data));
  const ultimo = depois.at(-1) ?? null;
  const khan = portao?.khan?.pct ?? null;
  const khanOk = khan != null && khan >= r.khanMin;
  const cpOk = !!ultimo && ultimo.acertos > (base?.acertos ?? 0) && ultimo.acertos >= r.checkpointMin;
  const fracos = ['Matemática', 'Física', 'Química'].flatMap((m) => topicosDe(cfg, m).filter((t) => t.fase === 0 && dominio(lacunas, m, t.nome) < 3).map((t) => ({ materia: m, topico: t.nome })));
  return {
    ok: khanOk && cpOk, fracos,
    khan: { valor: khan, min: r.khanMin, ok: khanOk },
    checkpoint: { ultimo, base, min: r.checkpointMin, ok: cpOk },
    extras: r.semanasExtras,
  };
}
