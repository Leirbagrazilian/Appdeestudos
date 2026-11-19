// Avisos com o app fechado (service worker) e placar contra o "concorrente".
// Tudo puro e leve: o service worker importa só este arquivo (e dates.js), nunca o planner.
// Tempos em minutos desde 00:00. O app grava um resumo do dia no kv ('resumoAvisos'); o SW lê e decide.
import { fmtMin } from './dates.js';

export const LIMIAR_MIN = 20; // abaixo disso de atraso, não cobra
export const RESUMO_DIAS = 14; // dias que o app grava no resumo para o SW
export const VENCE_SEM_HORA = 18 * 60; // bloco sem horário (dia mínimo, caderno de erros) vence às 18h
export const JANELAS = [['manha', 6 * 60, 12 * 60], ['tarde', 12 * 60, 18 * 60], ['noite', 18 * 60, 22 * 60]];
export const janelaDe = (min) => JANELAS.find(([, a, z]) => min >= a && min < z)?.[0] ?? null;

const hm = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };

/** Silêncio: da hora de dormir até a hora de acordar (cruza a meia-noite). */
export function emSilencio(min, dormir, acordar) {
  if (dormir == null || acordar == null) return false;
  const d = typeof dormir === 'string' ? hm(dormir) : dormir, a = typeof acordar === 'string' ? hm(acordar) : acordar;
  return d >= a ? min >= d || min < a : min >= d && min < a; // d < a: dormir depois da meia-noite
}

/**
 * Resumo do dia que o SW lê: blocos { id, ini, fim, min, semHora? } (minutos), dormir/acordar (HH:MM), meta (min) e `livre`.
 * Blocos sem horário vencem às 18h. Dia livre (feriado) ou sem blocos não cobra.
 */
export function normalizarBlocos(blocos = []) {
  return blocos.map((b) => {
    const ini = typeof b.ini === 'string' ? hm(b.ini) : b.ini, fim = typeof b.fim === 'string' ? hm(b.fim) : b.fim;
    if (ini == null || fim == null || Number.isNaN(ini) || Number.isNaN(fim)) return { id: b.id, ini: VENCE_SEM_HORA - b.min, fim: VENCE_SEM_HORA, min: b.min, semHora: true };
    return { id: b.id, ini, fim, min: b.min };
  }).sort((x, y) => x.fim - y.fim);
}
export function resumoDoDia({ dia, blocos = [], dormir, acordar, livre = false }) {
  const lista = normalizarBlocos(blocos);
  return { dia, blocos: lista, dormir, acordar, meta: lista.reduce((s, b) => s + b.min, 0), livre: !!livre };
}

/** Minutos feitos hoje: soma dos blocos do resumo que estão marcados em `done` (objeto id -> registro). */
export const feitoDoResumo = (resumo, done = {}) => (resumo?.blocos ?? []).reduce((s, b) => s + (done[b.id] ? b.min : 0), 0);

/** Minutos que já deveriam estar feitos às `min`: blocos terminados mais a fração do bloco em andamento (arredondado). */
export const devidoAte = (blocos = [], min) => Math.round(blocos.reduce((s, b) => s + (min >= b.fim || b.fim <= b.ini ? (min >= b.fim ? b.min : 0) : min <= b.ini ? 0 : b.min * (min - b.ini) / (b.fim - b.ini)), 0));

/** Situação do dia: { cobra, atrasado, zerado, devido, feito, falta, inicio1 }. */
export function situacaoDoDia(resumo, feito, agora) {
  const vazio = { cobra: false, atrasado: false, zerado: false, devido: 0, feito, falta: 0, inicio1: null };
  if (!resumo || resumo.livre || !resumo.blocos?.length) return vazio;
  const devido = devidoAte(resumo.blocos, agora), falta = Math.max(0, devido - feito);
  const comHora = resumo.blocos.filter((b) => !b.semHora);
  const inicio1 = comHora.length ? Math.min(...comHora.map((b) => b.ini)) : null;
  const atrasado = falta >= LIMIAR_MIN;
  return { cobra: true, atrasado, zerado: atrasado && feito === 0, devido, feito, falta, inicio1 };
}

const FIM_DA_JANELA = { manha: 'Levanta.', tarde: 'Metade do dia se foi. Recupera agora.', noite: 'Último turno. Fecha o que falta.' };

/** Texto do aviso: tom 'sargento' (seco, cobrando) ou 'padrao' (gentil). */
export function textoAviso(tom, sit, agora, janela) {
  const hora = fmtMin(agora);
  if (tom === 'padrao') {
    return { titulo: 'Estuda Gabriel', corpo: sit.zerado ? `${hora}. Nenhum bloco feito ainda. Que tal começar pelo próximo?` : `Você está ${fmtMin(sit.falta)} atrás do plano de hoje. Um bloco agora já ajuda.` };
  }
  const corpo = sit.zerado
    ? `${hora}. Zero blocos. ${sit.inicio1 != null ? `Seu concorrente começou às ${fmtMin(sit.inicio1)}. ` : 'Seu concorrente já começou. '}${FIM_DA_JANELA[janela] ?? 'Levanta.'}`
    : `${hora}. ${fmtMin(sit.falta)} atrás do plano. O concorrente já cumpriu. ${FIM_DA_JANELA[janela] ?? 'Segue.'}`;
  return { titulo: 'Sargento', corpo };
}

/**
 * Decide se avisa agora. Devolve null ou { chave, janela, titulo, corpo }.
 * Regras: só dia com blocos e não livre; fora do silêncio (dormir a acordar); só nas janelas manhã/tarde/noite;
 * no máximo 1 aviso por janela (`notificados[chave]`); só se estiver atrasado.
 */
export function decidirAviso({ resumo, feito = 0, agora, notificados = {}, tom = 'sargento' }) {
  if (!resumo || emSilencio(agora, resumo.dormir, resumo.acordar)) return null;
  const janela = janelaDe(agora);
  if (!janela) return null;
  const chave = `${resumo.dia}:aviso:${janela}`;
  if (notificados[chave]) return null;
  const sit = situacaoDoDia(resumo, feito, agora);
  if (!sit.atrasado) return null;
  return { chave, janela, ...textoAviso(tom, sit, agora, janela) };
}

// ---------- placar contra o concorrente ----------
// O concorrente cumpre 100% da meta do plano todo dia. Você: minutos feitos. Saldo = feito - meta (negativo = atrás).

/**
 * Saldo do dia e da semana contra o concorrente, que só fez o que o plano já pedia ATÉ AGORA (`agora` em minutos).
 * `dias` = [{ dia, blocos (com ini/fim/min), feito }]; dias anteriores contam inteiros, hoje até agora, dias futuros não contam.
 * Devolve { dia: { meta, devido, feito, saldo }, semana: { meta, devido, feito, saldo } }; saldo = feito - devido.
 */
export function placar(dias, hoje, agora) {
  const linhas = dias.filter((d) => d.dia <= hoje).map((d) => {
    const bl = normalizarBlocos(d.blocos), meta = bl.reduce((s, b) => s + b.min, 0);
    return { dia: d.dia, meta, devido: d.dia < hoje ? meta : devidoAte(bl, agora), feito: d.feito ?? 0 };
  });
  const h = linhas.find((l) => l.dia === hoje) ?? { meta: 0, devido: 0, feito: 0 };
  const soma = (k) => linhas.reduce((s, l) => s + l[k], 0);
  const mk = (o) => ({ ...o, saldo: o.feito - o.devido });
  return { dia: mk({ meta: h.meta, devido: h.devido, feito: h.feito }), semana: mk({ meta: soma('meta'), devido: soma('devido'), feito: soma('feito') }) };
}

/** "2h30 atrás", "1h à frente" ou "empatado". */
export function textoSaldo(saldo) {
  const m = Math.round(Math.abs(saldo));
  return m === 0 ? 'empatado' : `${fmtMin(m)} ${saldo < 0 ? 'atrás' : 'à frente'}`;
}
