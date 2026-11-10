import { addDays, diffDays } from './dates.js';

const prova = (c) => c.eventos.filter((e) => e.tipo === 'prova');
export const provaInicio = (c) => prova(c).map((e) => e.inicio).sort()[0];
export const provaFim = (c) => prova(c).map((e) => e.fim).sort().at(-1);

/** Gera as 5 fases a partir das datas de prova. Muda uma data, as fases se reajustam. */
export function gerarFases(cfg) {
  const get = (id) => cfg.concursos.find((c) => c.id === id);
  const sem = (cfg.perfil.semanasEspecifica ?? 7) * 7;
  const ini = cfg.perfil.inicioPlano;
  const efomm = get('efomm'), en = get('en'), enem = get('enem'), ita = get('ita');

  let efommIni = addDays(provaInicio(efomm), -sem);
  const devIni = efommIni < cfg.perfil.inicioDesenvolvimento ? addDays(efommIni, -1) : cfg.perfil.inicioDesenvolvimento;
  if (efommIni <= devIni) efommIni = addDays(devIni, 1);
  const efommFim = provaFim(efomm);
  const enIni = [addDays(provaInicio(en), -sem), addDays(efommFim, 1)].sort().at(-1);
  const enFim = provaFim(en);
  const ultima = [provaFim(enem), provaFim(ita)].sort().at(-1);

  const lista = [
    { id: 'base', inicio: ini, fim: addDays(devIni, -1) },
    { id: 'desenvolvimento', inicio: devIni, fim: addDays(efommIni, -1) },
    { id: 'efomm', inicio: efommIni, fim: efommFim },
    { id: 'en', inicio: enIni, fim: enFim },
    { id: 'final', inicio: addDays(enFim, 1), fim: ultima },
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
