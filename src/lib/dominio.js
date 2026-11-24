// Modo domínio (SPEC v2 §4): dominado = 8 acertos em 10 no dia E de novo 3 dias depois (reteste agendado). Só vira dominado depois
// dos dois. Abaixo de 8, o próximo bloco repete o tópico com exercícios novos; reprovar no reteste também conta como falha.
// Depois de 3 tentativas sem chegar lá, o tópico fica "travado" (hora de pedir ajuda).
// O estado do tópico guarda o resultado de cada bloco (por id), então corrigir um registro não conta tentativa em dobro.
export const ACERTO_MIN = 0.8;
export const MIN_FEITAS = 10; // exercícios para valer como tentativa (8 de 10)
export const MAX_TENTATIVAS = 3;
export const DIAS_RETESTE = 3; // o reteste vale a partir de 3 dias depois da 1ª aprovação
import { addDays, diffDays } from './dates.js';

export const chave = (materia, topico) => `${materia}|${topico}`;
export const estadoDe = (dominio, materia, topico) => dominio?.[chave(materia, topico)] ?? null;

const vale = (r) => r.khan || (r.feitas ?? 0) >= MIN_FEITAS;
const passou = (r) => r.khan || (vale(r) && r.acertos / r.feitas >= ACERTO_MIN);

/**
 * Leitura do estado: dominado, tentativas que falharam, travado, resultado mais recente e o reteste.
 * Dominado = duas aprovações (8/10) separadas por 3 dias ou mais. Uma reprovação entre elas zera a 1ª aprovação.
 * `primeira` = data da aprovação que espera o reteste; `retesteEm` = a partir de quando o reteste vale (primeira + 3 dias).
 */
export function resumo(estado) {
  const ign = new Set(estado?.ignorados ?? []); // falhas de antes do "destravar"
  const ent = Object.entries(estado?.regs ?? {}).sort((a, b) => (a[1].data ?? '').localeCompare(b[1].data ?? '') || a[0].localeCompare(b[0]));
  const regs = ent.map(([, r]) => r);
  let primeira = null, dominado = false;
  for (const r of regs) {
    if (!vale(r)) continue;
    if (passou(r)) {
      if (r.khan) dominado = true; // registro antigo da Khan: vale como dominado
      else if (primeira == null) primeira = r.data ?? '';
      else if (r.data && primeira && diffDays(primeira, r.data) >= DIAS_RETESTE) dominado = true;
    } else if (!r.treino) primeira = null; // reprovou: recomeça (bloco de treino abaixo de 8 não pune)
  }
  const falhas = ent.filter(([id, r]) => vale(r) && !passou(r) && !r.treino && !ign.has(id)).length; // bloco de treino (antes do prazo) que não chegou a 8/10 não conta como falha
  const ult = regs.at(-1) ?? null;
  const aguarda = !dominado && !!primeira && /^\d{4}-\d{2}-\d{2}$/.test(primeira);
  return { dominado, falhas, travado: !dominado && falhas >= MAX_TENTATIVAS, ult, tentativas: regs.filter(vale).length,
    primeira: aguarda ? primeira : null, retesteEm: aguarda ? addDays(primeira, DIAS_RETESTE) : null };
}

/** O tópico passou uma vez e espera o reteste (ainda não é dominado). */
export const aguardaReteste = (estado) => !!resumo(estado).retesteEm;

/** Retestes que valem hoje: [{ materia, topico, desde, em }] (a 1ª aprovação foi há 3 dias ou mais e o tópico ainda não foi dominado). */
export const retestesDoDia = (dominio, dia) => Object.entries(dominio ?? {})
  .map(([k, e]) => { const r = resumo(e); const [materia, topico] = k.split('|'); return r.retesteEm && r.retesteEm <= dia ? { materia, topico, desde: r.primeira, em: r.retesteEm } : null; })
  .filter(Boolean).sort((a, b) => a.em.localeCompare(b.em) || a.topico.localeCompare(b.topico));
/** Retestes ainda por vir: o mesmo formato, para mostrar "reteste em dd/mm". */
export const retestesAgendados = (dominio, dia) => Object.entries(dominio ?? {})
  .map(([k, e]) => { const r = resumo(e); const [materia, topico] = k.split('|'); return r.retesteEm && r.retesteEm > dia ? { materia, topico, desde: r.primeira, em: r.retesteEm } : null; })
  .filter(Boolean).sort((a, b) => a.em.localeCompare(b.em) || a.topico.localeCompare(b.topico));

/**
 * Registra o resultado de um bloco no tópico. `res` = { feitas, acertos, khan, data, treino }.
 * `treino: true` = bloco antes do último (MATAR HOJE): passar com 8/10 domina o tópico, mas ficar abaixo não gasta tentativa.
 * Devolve { nota, estado, veredito } (veredito: 'dominado' | 'reteste' | 'repetir' | 'travado' | 'parcial' | 'treino').
 * A nota (0 a 3 da Trilha) nunca desce: só sobe, e vai a 3 quando o tópico é dominado (duas aprovações com 3 dias de distância).
 */
export function avaliarTopico(estado, nota, blocoId, res) {
  const novo = { ...(estado ?? {}), regs: { ...(estado?.regs ?? {}), [blocoId]: { feitas: res.feitas ?? 0, acertos: Math.min(res.acertos ?? 0, res.feitas ?? 0), khan: !!res.khan, data: res.data ?? null, ...(res.treino ? { treino: true } : {}) } } };
  if (novo.antes == null && (nota ?? 0) < 3) novo.antes = nota ?? 0; // nota de antes do domínio: volta a ela se você corrigir o registro para baixo
  const r = resumo(novo);
  const reg = novo.regs[blocoId];
  let veredito, n = nota ?? 0;
  if (r.dominado || ((nota ?? 0) >= 3 && vale(reg) && passou(reg))) { veredito = 'dominado'; n = 3; } // quem já estava dominado (nota 3) e passa de novo continua
  else if (vale(reg) && passou(reg) && r.retesteEm && (nota ?? 0) < 3) { veredito = 'reteste'; n = Math.max(n, 2); } // passou uma vez: falta o reteste em 3 dias
  else if (reg.treino && vale(reg) && !passou(reg)) { veredito = 'treino'; n = Math.max(n, reg.acertos / reg.feitas < 0.5 ? 1 : 2); } // ainda há blocos até o prazo
  else if (n >= 3 && novo.antes != null) { n = novo.antes; veredito = 'repetir'; if (!vale(reg)) veredito = 'parcial'; n = Math.max(n, vale(reg) ? (reg.acertos / reg.feitas < 0.5 ? 1 : 2) : (reg.feitas > 0 ? 1 : 0)); if (r.travado) veredito = 'travado'; }
  else if (!vale(reg)) { veredito = 'parcial'; n = Math.max(n, reg.feitas > 0 ? 1 : 0); }
  else { veredito = r.travado ? 'travado' : 'repetir'; n = Math.max(n, reg.acertos / reg.feitas < 0.5 ? 1 : 2); }
  return { nota: n, estado: novo, veredito };
}

/** Situação para mostrar na Trilha: não iniciado, em andamento, dominado ou travado. */
export function situacao(nota, estado) {
  if ((nota ?? 0) >= 3) return 'dominado';
  if (estado && resumo(estado).travado) return 'travado';
  if (estado && resumo(estado).retesteEm) return 'reteste';
  return !nota && !Object.keys(estado?.regs ?? {}).length ? 'não iniciado' : 'em andamento';
}
export const estaTravado = (estado) => !!estado && resumo(estado).travado;

/** Tópicos travados: [{ materia, topico }] para avisar na tela Hoje. */
export const travados = (dominio, lacunas) => Object.entries(dominio ?? {})
  .filter(([k, e]) => { const [m, t] = k.split('|'); return estaTravado(e) && (lacunas?.[m]?.[t] ?? 0) < 3; })
  .map(([k]) => { const [materia, topico] = k.split('|'); return { materia, topico }; });

/** Destrava o tópico: as tentativas que falharam até agora deixam de contar (você pediu ajuda ou viu outra explicação). */
export const destravar = (estado) => {
  const falhas = Object.entries(estado?.regs ?? {}).filter(([, r]) => vale(r) && !passou(r)).map(([id]) => id);
  return { ...(estado ?? {}), ignorados: falhas };
};
