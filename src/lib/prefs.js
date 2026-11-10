// Preferências de acessibilidade e sensação (ficam no cfg, então entram no backup).
export const PREFS_PADRAO = { animacoes: 'completas', texto: 'normal', vibracao: true, sons: false };
export const prefs = (cfg) => ({ ...PREFS_PADRAO, ...(cfg?.prefs ?? {}) });
const TAMANHO = { normal: '100%', grande: '112.5%', muito: '125%' };

export function aplicarPrefs(p) {
  const r = document.documentElement;
  r.dataset.motion = p.animacoes;
  r.style.fontSize = TAMANHO[p.texto] ?? '100%';
}
/** Movimento reduzido: pela opção do app ou pela do sistema. */
export const movimentoReduzido = () =>
  document.documentElement.dataset.motion !== 'completas' || matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Duração de animação respeitando a preferência (0 = sem animação). */
export const dur = (ms) => (typeof document !== 'undefined' && movimentoReduzido() ? 0 : ms);

export const VIBRA = { toque: 8, ok: [14, 40, 22], erro: [30, 40, 30], fim: [200, 100, 200, 100, 300] };
export function vibrar(p, tipo = 'ok') {
  if (!p.vibracao || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try { navigator.vibrate(VIBRA[tipo] ?? tipo); } catch { /* sem vibração neste aparelho */ }
}
