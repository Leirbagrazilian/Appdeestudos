import { addDays, diffDays } from './dates.js';

const prova = (c) => c.eventos.filter((e) => e.tipo === 'prova');
export const provaInicio = (c) => prova(c).map((e) => e.inicio).sort()[0];
export const provaFim = (c) => prova(c).map((e) => e.fim).sort().at(-1);

const menor = (l) => [...l].sort()[0], maior = (l) => [...l].sort().at(-1);

/** Gera as 6 fases a partir das datas de prova. Muda uma data, as fases se reajustam. */
export function gerarFases(cfg) {
  const get = (id) => cfg.concursos.find((c) => c.id === id);
  const sem = (cfg.perfil.semanasEspecifica ?? 7) * 7;
  const ini = cfg.perfil.inicioPlano;
  const efomm = get('efomm'), esa = get('esa'), en = get('en'), enem = get('enem'), ita = get('ita');
  const navais = [efomm, esa].filter(Boolean); // fase 3 serve EFOMM e ESA (a ESA só entra se existir)

  let p3Ini = addDays(menor(navais.map(provaInicio)), -sem);
  const devIni = p3Ini < cfg.perfil.inicioDesenvolvimento ? addDays(p3Ini, -1) : cfg.perfil.inicioDesenvolvimento;
  if (p3Ini <= devIni) p3Ini = addDays(devIni, 1);
  const p3Fim = maior(navais.map(provaFim));
  const enIni = maior([addDays(provaInicio(en), -sem), addDays(p3Fim, 1)]);
  const enFim = provaFim(en);
  const itaFim = maior([provaFim(ita), enFim]);
  const enemFim = maior([provaFim(enem), addDays(itaFim, 1)]);

  const lista = [
    { id: 'base', inicio: ini, fim: addDays(devIni, -1) },
    { id: 'desenvolvimento', inicio: devIni, fim: addDays(p3Ini, -1) },
    { id: 'efomm', inicio: p3Ini, fim: p3Fim },
    { id: 'en', inicio: enIni, fim: enFim },
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
