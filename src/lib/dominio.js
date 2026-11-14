// Modo domínio (Fase 0): um tópico só avança com 8 acertos em 10. Abaixo disso, o próximo bloco repete o tópico
// com exercícios novos. Depois de 3 tentativas sem chegar lá, o tópico fica "travado" (hora de pedir ajuda).
// O estado do tópico guarda o resultado de cada bloco (por id), então corrigir um registro não conta tentativa em dobro.
export const ACERTO_MIN = 0.8;
export const MIN_FEITAS = 10; // exercícios para valer como tentativa (8 de 10)
export const MAX_TENTATIVAS = 3;

export const chave = (materia, topico) => `${materia}|${topico}`;
export const estadoDe = (dominio, materia, topico) => dominio?.[chave(materia, topico)] ?? null;

const vale = (r) => r.khan || (r.feitas ?? 0) >= MIN_FEITAS;
const passou = (r) => r.khan || (vale(r) && r.acertos / r.feitas >= ACERTO_MIN);

/** Leitura do estado: dominado, tentativas que falharam, travado, resultado mais recente. */
export function resumo(estado) {
  const regs = Object.entries(estado?.regs ?? {}).sort((a, b) => (a[1].data ?? '').localeCompare(b[1].data ?? '') || a[0].localeCompare(b[0])).map(([, r]) => r);
  const dominado = regs.some(passou);
  const falhas = Math.max(0, regs.filter((r) => vale(r) && !passou(r)).length - (estado?.base ?? 0));
  const ult = regs.at(-1) ?? null;
  return { dominado, falhas, travado: !dominado && falhas >= MAX_TENTATIVAS, ult, tentativas: regs.filter(vale).length };
}

/**
 * Registra o resultado de um bloco no tópico. `res` = { feitas, acertos, khan, data }.
 * Devolve { nota, estado, veredito } (veredito: 'dominado' | 'repetir' | 'travado' | 'parcial').
 * A nota (0 a 3 da Trilha) nunca desce: só sobe, e vai a 3 quando o tópico é dominado.
 */
export function avaliarTopico(estado, nota, blocoId, res) {
  const novo = { ...(estado ?? {}), regs: { ...(estado?.regs ?? {}), [blocoId]: { feitas: res.feitas ?? 0, acertos: Math.min(res.acertos ?? 0, res.feitas ?? 0), khan: !!res.khan, data: res.data ?? null } } };
  const r = resumo(novo);
  const reg = novo.regs[blocoId];
  let veredito, n = nota ?? 0;
  if (r.dominado) { veredito = 'dominado'; n = 3; }
  else if (!vale(reg)) { veredito = 'parcial'; n = Math.max(n, reg.feitas > 0 ? 1 : 0); }
  else { veredito = r.travado ? 'travado' : 'repetir'; n = Math.max(n, reg.acertos / reg.feitas < 0.5 ? 1 : 2); }
  return { nota: n, estado: novo, veredito };
}

/** Situação para mostrar na Trilha: não iniciado, em andamento, dominado ou travado. */
export function situacao(nota, estado) {
  if ((nota ?? 0) >= 3) return 'dominado';
  if (estado && resumo(estado).travado) return 'travado';
  return !nota && !Object.keys(estado?.regs ?? {}).length ? 'não iniciado' : 'em andamento';
}
export const estaTravado = (estado) => !!estado && resumo(estado).travado;

/** Tópicos travados: [{ materia, topico }] para avisar na tela Hoje. */
export const travados = (dominio, lacunas) => Object.entries(dominio ?? {})
  .filter(([k, e]) => { const [m, t] = k.split('|'); return estaTravado(e) && (lacunas?.[m]?.[t] ?? 0) < 3; })
  .map(([k]) => { const [materia, topico] = k.split('|'); return { materia, topico }; });

/** Destrava o tópico: as tentativas que falharam até agora deixam de contar (você pediu ajuda ou viu outra explicação). */
export const destravar = (estado) => {
  const r = resumo({ ...estado, base: 0 });
  return { ...(estado ?? {}), base: r.falhas };
};
