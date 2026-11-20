// Sono: padrão editável por noite, horários da noite puxados da hora de dormir, regras da noite curta e resumo da semana.
// "Noite de D" = a que começa na noite do dia D e termina na manhã de D+1. O registro da manhã fica em sono[D+1] (dia em que você acordou).
// Tudo puro; o sono não entra na sequência de constância.
import { addDays, startOfWeek, weekday, diffDays, diaNome } from './dates.js';
import { toMin, toHHMM } from './semana.js';

export const MIN_H = 6; // abaixo disso: Dia mínimo
export const NORMAL_H = 7; // abaixo disso (e a partir de 6 h): noite curta
const S = (cfg) => cfg.sono ?? {};
const PADRAO_FALLBACK = { dormir: '22:00', acordar: '05:00' };

/** Padrão da noite que começa no dia da semana `wd` (0 = domingo). */
export const padraoDe = (cfg, wd) => ({ ...PADRAO_FALLBACK, ...(S(cfg).padrao?.[wd] ?? {}) });

/** Horas entre dormir e acordar (cruzando a meia-noite quando precisa). */
export function horasEntre(dormir, acordar) {
  if (!/^\d{1,2}:\d{2}$/.test(dormir ?? '') || !/^\d{1,2}:\d{2}$/.test(acordar ?? '')) return null;
  return ((toMin(acordar) - toMin(dormir) + 1440) % 1440) / 60;
}
export const noiteCurta = (h) => h != null && h >= MIN_H && h < NORMAL_H;
export const noiteMuitoCurta = (h) => h != null && h < MIN_H;
export const fmtH = (h) => (h == null ? '-' : `${(Math.round(h * 10) / 10).toString().replace('.', ',')}h`);
const diaNoiteDe = (diaManha) => addDays(diaManha, -1);

/** O que você registrou na manhã de `diaManha` (noite anterior): { dormiu, acordou, q, horas } ou null. */
export function registroDaManha(sono, diaManha) {
  const r = sono?.[diaManha];
  if (!r) return null;
  return { ...r, horas: horasEntre(r.dormiu, r.acordou) };
}

/** Horas da noite de `diaNoite`: o que foi registrado, senão o planejado. */
function horasDaNoite(cfg, sono, noites, diaNoite) {
  const real = registroDaManha(sono, addDays(diaNoite, 1));
  if (real?.horas != null) return { horas: real.horas, real: true };
  const p = noites?.[diaNoite] ?? padraoDe(cfg, weekday(diaNoite));
  return { horas: horasEntre(p.dormir, p.acordar), real: false };
}

/**
 * Plano da noite de `diaNoite`: { dia, dormir, acordar, horas, curta, editada, maisCedo }.
 * Depois de uma noite curta (a anterior, real ou planejada), a hora de dormir vem 30 min mais cedo (se você não fixou outra).
 */
export function noiteDe(cfg, diaNoite, { noites = {}, sono = {} } = {}) {
  const ed = noites[diaNoite];
  const base = ed ?? padraoDe(cfg, weekday(diaNoite));
  let dormir = base.dormir;
  const ant = horasDaNoite(cfg, sono, noites, addDays(diaNoite, -1));
  const maisCedo = !ed && ant.horas != null && ant.horas < NORMAL_H;
  if (maisCedo) dormir = toHHMM(((toMin(dormir) - 30) % 1440 + 1440) % 1440);
  const horas = horasEntre(dormir, base.acordar);
  return { dia: diaNoite, dormir, acordar: base.acordar, horas, curta: noiteCurta(horas), editada: !!ed, maisCedo };
}

/** Horários que saem da hora de dormir: terço (−1 h), oração da noite (−40 min), telas desligadas (−30 min) e lectio (−20 min). */
export function horariosNoite(cfg, diaNoite, ctx = {}) {
  const n = noiteDe(cfg, diaNoite, ctx), d = toMin(n.dormir);
  const h = (m) => toHHMM(((d - m) % 1440 + 1440) % 1440);
  return { ...n, terco: h(60), oracao: h(40), telas: h(30), lectio: h(20) };
}
/** Os mesmos horários pelo padrão do dia da semana (para reservar o tempo de oração nas janelas de estudo). */
export function horariosPadrao(cfg, wd) {
  const p = padraoDe(cfg, wd), d = toMin(p.dormir), h = (m) => toHHMM(((d - m) % 1440 + 1440) % 1440);
  return { terco: h(60), oracao: h(40), telas: h(30), lectio: h(20) };
}

/** Hora em que você acorda no dia `dia` (fim da noite anterior) e a oração da manhã (10 min depois). */
export const acordarDe = (cfg, dia, ctx = {}) => noiteDe(cfg, addDays(dia, -1), ctx).acordar;
export const acordarPadrao = (cfg, wd) => padraoDe(cfg, (wd + 6) % 7).acordar;
export const horaManha = (acordar) => toHHMM(toMin(acordar) + 10);

/** O que a noite de `dia` pede para amanhã: { dia (amanhã), acordar, dormir, linha: 'Amanhã (sexta): acordar às 05:00' }. */
export function acordarAmanha(cfg, dia, ctx = {}) {
  const n = noiteDe(cfg, dia, ctx), amanha = addDays(dia, 1);
  return { dia: amanha, acordar: n.acordar, dormir: n.dormir, linha: `Amanhã (${diaNome(amanha)}): acordar às ${n.acordar}` };
}

// ---------- noite curta planejada: regras ----------
/** Vésperas em que não se planeja noite curta: longão (domingo), prova de concurso, sábado de prova antiga (jun–ago) ou simulado registrado. */
export function motivoVespera(cfg, diaNoite, simulados = []) {
  const amanha = addDays(diaNoite, 1), wd = weekday(amanha);
  if (wd === 0) return 'véspera do longão';
  if ((cfg.concursos ?? []).some((c) => (c.eventos ?? []).some((e) => e.tipo === 'prova' && amanha >= e.inicio && amanha <= (e.fim ?? e.inicio)))) return 'véspera de prova';
  const mes = +amanha.slice(5, 7);
  if (wd === 6 && mes >= 6 && mes <= 8) return 'véspera de prova antiga';
  if (simulados.includes(amanha)) return 'véspera de simulado';
  return null;
}
/**
 * Confere se dá para planejar `{ dormir, acordar }` na noite de `diaNoite`. Devolve { horas, curta, erro, avisos }.
 * Noite curta (6 a 7 h): no máximo 1 por semana, nunca 2 seguidas, nunca na véspera de longão, simulado ou prova.
 * `erro`: menos de 6 h não se planeja. `avisos` != [] pede confirmação.
 */
export function validarNoite(cfg, diaNoite, plano, { noites = {}, sono = {}, simulados = [] } = {}) {
  const horas = horasEntre(plano.dormir, plano.acordar), curta = noiteCurta(horas), avisos = [];
  if (horas == null) return { horas, curta: false, erro: 'Horário inválido.', avisos };
  if (horas < MIN_H) return { horas, curta: false, erro: 'Menos de 6 h de sono não se planeja: o mínimo é 6 h.', avisos };
  if (!curta) return { horas, curta, erro: null, avisos };
  const outras = { ...noites }; delete outras[diaNoite];
  const curtaOutra = (d) => { const h = horasDaNoite(cfg, sono, outras, d).horas; return noiteCurta(h) || noiteMuitoCurta(h); };
  const seg = startOfWeek(diaNoite);
  const mesmaSemana = Array.from({ length: 7 }, (_, i) => addDays(seg, i)).filter((d) => d !== diaNoite && curtaOutra(d));
  if (mesmaSemana.length) avisos.push('Já há outra noite curta nesta semana (o máximo é 1 por semana).');
  if (curtaOutra(addDays(diaNoite, -1)) || curtaOutra(addDays(diaNoite, 1))) avisos.push('Seria a segunda noite curta seguida.');
  const v = motivoVespera(cfg, diaNoite, simulados);
  if (v) avisos.push(`Noite curta na ${v}: evite.`);
  return { horas, curta, erro: null, avisos };
}

/** Como você acordou hoje: 'minimo' (< 6 h), 'curta' (6 a 7 h) ou null. Vale o registro; sem registro, o plano da noite. */
export function estadoDoDia(cfg, dia, { sono = {}, noites = {} } = {}) {
  const h = horasDaNoite(cfg, sono, noites, diaNoiteDe(dia));
  if (h.horas == null) return null;
  return noiteMuitoCurta(h.horas) ? 'minimo' : noiteCurta(h.horas) || h.horas < NORMAL_H ? 'curta' : null;
}

// ---------- semana e revisão ----------
/** Noites que terminam de segunda a domingo da semana de `seg`: horas, qualidade, destaque (< 7 h), média. */
export function resumoSono(cfg, sono, seg) {
  const nomes = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  const noites = Array.from({ length: 7 }, (_, i) => {
    const dia = addDays(seg, i), r = registroDaManha(sono, dia);
    return { dia, nome: nomes[i], horas: r?.horas ?? null, q: r?.q ?? null, abaixo7: r?.horas != null && r.horas < NORMAL_H };
  });
  const reg = noites.filter((n) => n.horas != null);
  const media = reg.length ? reg.reduce((a, n) => a + n.horas, 0) / reg.length : null;
  return { seg, noites, registradas: reg.length, media, abaixo7: reg.filter((n) => n.abaixo7).length };
}
/** Média abaixo de 7 h por 2 semanas (com pelo menos 3 noites registradas em cada): { alerta, medias, texto }. */
export function alertaSono(cfg, sono, dia) {
  const seg = startOfWeek(dia);
  const semanas = [0, 1, 2].map((i) => resumoSono(cfg, sono, addDays(seg, -7 * i))).filter((r) => r.registradas >= 3);
  const duas = semanas.slice(0, 2);
  const alerta = duas.length === 2 && duas.every((r) => r.media < NORMAL_H) && diffDays(duas[1].seg, duas[0].seg) === 7;
  return { alerta, medias: duas.map((r) => r.media), texto: alerta ? `Média de sono abaixo de 7 h por 2 semanas (${fmtH(duas[0].media)} e ${fmtH(duas[1].media)}). Reduza a carga: priorize dormir e corte um bloco por dia.` : null };
}
