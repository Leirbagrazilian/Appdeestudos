// Rotina: janelas de estudo derivadas de 6h30–21h menos os horários fixos (corrida, musculação, jiu-jitsu, refeições e as aulas
// que você marcou "vou"). As orações saem depois, pelas reservas (oracao.js). Tudo puro.
import { weekday } from './dates.js';
import { toMin, toHHMM } from './semana.js';

const R = (cfg) => cfg.rotina ?? {};
const num = (h, pad) => (typeof h === 'string' && /^\d{1,2}:\d{2}$/.test(h) ? toMin(h) : pad);

/** Aulas da faculdade (as que entram no contador de presença e no "vou/não vou"). */
export const aulasFaculdade = (cfg) => (R(cfg).aulas ?? []).map((a, i) => ({ ...a, i })).filter((a) => a.tipo === 'faculdade');
/** Dia livre de estudo (24–25/12 e 31/12–01/01, por padrão). */
export const diaLivre = (cfg, dia) => (R(cfg).diasLivres ?? ['12-24', '12-25', '12-31', '01-01']).includes(dia.slice(5));

/** Intervalos fixos do dia da semana `wd` (0 = domingo), em minutos: [{ ini, fim, nome }]. */
export function fixosDoDia(cfg, wd) {
  const r = R(cfg), t = cfg.treino ?? {}, out = [];
  const corrida = wd === 6 ? t.corridaSab ?? t.corrida : t.corrida;
  const cMin = num(corrida, null);
  if (wd !== 0 && cMin != null) out.push({ ini: cMin, fim: cMin + 60, nome: 'Corrida' }); // 45 min de corrida + banho
  const mus = t.musculacao?.[wd], mIni = num(mus?.ini, null);
  if (mIni != null) out.push({ ini: mIni, fim: mIni + (t.musculacaoMin ?? 60), nome: 'Musculação' });
  for (const j of r.refeicoes ?? []) out.push({ ini: toMin(j.ini), fim: toMin(j.fim), nome: 'Refeição' });
  for (const a of r.aulas ?? []) {
    if (a.dia !== wd) continue;
    if (a.tipo === 'faculdade' && !a.vou) continue; // "não vou" libera a janela
    out.push({ ini: toMin(a.inicio), fim: toMin(a.fim), nome: a.nome });
  }
  return out.filter((x) => Number.isFinite(x.ini) && Number.isFinite(x.fim) && x.fim > x.ini);
}

/**
 * Janelas de estudo do dia da semana `wd` como lista { ini, fim, tipo? } em "HH:MM" (mesmo formato de antes).
 * Segunda a sexta: 6h30–21h. Sábado: começa 1 h depois da corrida; a primeira janela é a da prova antiga (tipo 'prova').
 * Domingo: só a janela do domingo (revisão leve e planejamento, tipo 'domingo').
 * `cfg.rotina.janelas[wd]` (se existir) vale no lugar do cálculo, para quem quiser fixar à mão.
 */
export function janelasDoDia(cfg, wd) {
  const manual = R(cfg).janelas?.[wd];
  if (manual) return manual;
  const r = R(cfg);
  if (wd === 0) { const d = r.domingo ?? { ini: '15:00', fim: '17:00' }; return [{ ini: d.ini, fim: d.fim, tipo: 'domingo' }]; }
  const fixos = fixosDoDia(cfg, wd);
  let ini = toMin(r.inicioEstudo ?? '06:30');
  if (wd === 6) { const c = fixos.find((f) => f.nome === 'Corrida'); if (c) ini = Math.max(ini, c.fim); }
  const fim = toMin(r.fimEstudo ?? '21:00');
  let livres = [{ ini, fim }];
  for (const f of fixos) livres = livres.flatMap((j) => (f.fim <= j.ini || f.ini >= j.fim ? [j] : [{ ini: j.ini, fim: f.ini }, { ini: f.fim, fim: j.fim }].filter((x) => x.fim - x.ini > 0)));
  livres.sort((a, b) => a.ini - b.ini);
  const out = livres.filter((j) => j.fim - j.ini >= 30).map((j) => ({ ini: toHHMM(j.ini), fim: toHHMM(j.fim) }));
  if (wd === 6 && out[0]) out[0].tipo = 'prova';
  return out;
}

/** As 7 janelas (0 a 6), para a tela de Ajustes. */
export const janelasDaSemana = (cfg) => Object.fromEntries([1, 2, 3, 4, 5, 6, 0].map((wd) => [wd, janelasDoDia(cfg, wd)]));

// ---------- presença na faculdade ----------
/** presenca = { [nomeDaAula]: { [dia]: 'p' | 'f' } }. Devolve { nome, presentes, faltas, total, pct, alerta } por aula da faculdade. */
export function presencaPorAula(cfg, presenca) {
  const min = (R(cfg).presencaMin ?? 75) / 100;
  return aulasFaculdade(cfg).map((a) => {
    const regs = Object.values(presenca?.[a.nome] ?? {});
    const presentes = regs.filter((x) => x === 'p').length, faltas = regs.filter((x) => x === 'f').length, total = presentes + faltas;
    const pct = total ? presentes / total : null;
    return { nome: a.nome, aula: a, presentes, faltas, total, pct, alerta: pct != null && pct < min };
  });
}
/** Aulas da faculdade que caem no dia. */
export const aulasDoDia = (cfg, dia) => aulasFaculdade(cfg).filter((a) => a.dia === weekday(dia));
