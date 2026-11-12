// Revisão de domingo: 3 perguntas + um resumo automático da semana; o foco escolhido vale para a semana seguinte.
import { addDays, startOfWeek } from './dates.js';
import { blocosAjustados } from './planner.js';

export const PERGUNTAS = [
  ['bem', 'O que funcionou nesta semana?', 'ex.: acordar às 6h e começar pela Matemática'],
  ['faltou', 'O que faltou ou atrapalhou?', 'ex.: perdi a tarde de quarta; Física ficou para trás'],
  ['foco', 'Qual o foco da próxima semana?', 'ex.: fechar Trigonometria e refazer os erros de Física'],
];
export const semanaDe = (dia) => startOfWeek(dia);

/** Números da semana que começa em `seg`. ctx = { done, errors, reviews, cumpridos, adiados, exams } */
export function resumoSemana(cfg, fases, ctx, seg) {
  const dias = Array.from({ length: 7 }, (_, i) => addDays(seg, i)), fim = dias[6];
  const dentro = (d) => d && d >= seg && d <= fim;
  const adiados = ctx.adiados ?? {};
  let planMin = 0;
  for (const d of dias) planMin += blocosAjustados(cfg, fases, d, { adiados, exams: ctx.exams ?? {} }).reduce((a, b) => a + b.min, 0);
  let feitoMin = 0, feitas = 0, acertos = 0;
  const porMateria = {};
  for (const [k, v] of Object.entries(ctx.done ?? {})) {
    if (!dentro(v.dia ?? k.slice(0, 10))) continue;
    feitoMin += v.min ?? 0;
    porMateria[v.materia] = (porMateria[v.materia] ?? 0) + (v.min ?? 0);
    if (v.questoes) { feitas += v.questoes.feitas ?? 0; acertos += v.questoes.acertos ?? 0; }
  }
  return {
    seg, fim, planMin, feitoMin, pct: planMin ? feitoMin / planMin : 0,
    questoes: { feitas, acertos, pct: feitas ? acertos / feitas : null },
    erros: Object.values(ctx.errors ?? {}).filter((e) => dentro(e.dia)).length,
    diasCumpridos: Object.keys(ctx.cumpridos ?? {}).filter(dentro).length,
    revisoesFeitas: Object.values(ctx.reviews ?? {}).filter((r) => r.feita && dentro(r.feitaEm)).length,
    adiados: Object.keys(adiados).filter((id) => dentro(id.slice(0, 10))).length,
    porMateria: Object.entries(porMateria).sort((a, b) => b[1] - a[1]),
  };
}

/** O foco que você escolheu na revisão da semana anterior vale em todos os dias desta semana. */
export function focoDaSemana(revisoes, dia) {
  const anterior = addDays(startOfWeek(dia), -7);
  const r = revisoes?.[anterior];
  return r?.foco?.trim() ? { foco: r.foco.trim(), semana: anterior } : null;
}
export const historico = (revisoes) => Object.values(revisoes ?? {}).sort((a, b) => b.seg.localeCompare(a.seg));
