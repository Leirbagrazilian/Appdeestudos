import { addDays, diffDays } from './dates.js';

const prova = (c) => c.eventos.filter((e) => e.tipo === 'prova');
export const provaInicio = (c) => prova(c).map((e) => e.inicio).sort()[0];
export const provaFim = (c) => prova(c).map((e) => e.fim).sort().at(-1);

const menor = (l) => [...l].sort()[0], maior = (l) => [...l].sort().at(-1);

/** Gera as 6 fases (0 a 5). A Fase 0 e o início da Fase 2 vêm do perfil; o resto segue as datas de prova. */
export function gerarFases(cfg) {
  const get = (id) => cfg.concursos.find((c) => c.id === id);
  const p = cfg.perfil;
  const efomm = get('efomm'), esa = get('esa'), en = get('en'), enem = get('enem'), ita = get('ita');
  const navais = [efomm, esa].filter(Boolean); // a fase 2 serve EFOMM e ESA (a ESA só entra se existir)

  const zIni = p.inicioZero ?? '2026-11-16';
  const zFim = addDays(p.fimZero ?? '2027-01-10', 7 * (p.extraZero ?? 0)); // +2 semanas quando o portão não passa
  let f2Ini = p.inicioFase2 ?? '2027-05-01';
  if (f2Ini <= addDays(zFim, 1)) f2Ini = addDays(zFim, 2);
  const f2Fim = maior([...navais.map(provaFim), f2Ini]);
  const enFim = maior([provaFim(en), f2Fim]);
  const itaFim = maior([provaFim(ita), enFim]);
  const enemFim = maior([provaFim(enem), addDays(itaFim, 1)]);

  const lista = [
    { id: 'zero', inicio: zIni, fim: zFim },
    { id: 'base', inicio: addDays(zFim, 1), fim: addDays(f2Ini, -1) },
    { id: 'efomm', inicio: f2Ini, fim: f2Fim },
    { id: 'en', inicio: addDays(f2Fim, 1), fim: enFim },
    { id: 'ita', inicio: addDays(enFim, 1), fim: itaFim },
    { id: 'enem', inicio: addDays(itaFim, 1), fim: enemFim },
  ];
  return lista.map((f) => ({ ...f, ...cfg.fases[f.id] }));
}

export function faseDoDia(fases, dia) {
  return fases.find((f) => dia >= f.inicio && dia <= f.fim) ?? (dia < fases[0].inicio ? fases[0] : fases.at(-1));
}

/** Última semana antes de cada prova: revisão leve. Retorna o concurso ou null. */
export function revisaoLeve(cfg, dia) {
  for (const c of cfg.concursos) for (const e of c.eventos) {
    if (e.tipo !== 'prova') continue;
    const d = diffDays(dia, e.inicio);
    if (d >= 1 && d <= 7) return c;
  }
  return null;
}

export const semanaDaFase = (f, dia) => Math.floor(diffDays(f.inicio, dia) / 7) + 1;
export const totalSemanas = (f) => Math.ceil((diffDays(f.inicio, f.fim) + 1) / 7);

/** Próxima prova (primeira de cada concurso) ainda por vir. */
export function proximaProva(cfg, dia) {
  const lista = [];
  for (const c of cfg.concursos) for (const e of c.eventos)
    if (e.tipo === 'prova' && e.inicio >= dia) lista.push({ concurso: c, evento: e, dias: diffDays(dia, e.inicio) });
  return lista.sort((a, b) => a.dias - b.dias)[0] ?? null;
}
