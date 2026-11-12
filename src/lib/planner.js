import { diaNome, startOfWeek } from './dates.js';
import { faseDoDia, revisaoLeve } from './phases.js';
import { planoSemana, toHHMM } from './semana.js';
import { ESTUDO, QUESTOES_DIA_MINIMO } from './tarefas.js';

const ESTUDO_MATERIAS = new Set(['Matemática', 'Física', 'Química', 'Português', 'Inglês', 'Hist/Geo']);
const COM_ASSUNTO = ['mat', 'fis', 'qui', 'por', 'ing', 'hg', 'red'];

/** Monta o checklist de um dia (não é salvo: só o que você marca é salvo).
 *  ctx = { exams } (resultados de simulados, para as regras dos 50% e do inglês). */
export function blocosDoDia(cfg, fases, dia, ctx = {}) {
  const fase = faseDoDia(fases, dia);
  const diag = cfg.diagnostico?.dias?.[dia];
  const cats = cfg.categorias ?? {};

  // Semana diagnóstica: blocos escritos à mão no seed, com "como fazer" e "onde achar".
  if (diag) {
    return diag.map((b) => ({
      id: `${dia}:${b.chave}`, chave: b.chave, cat: ['erros', 'plan'].includes(b.chave) ? b.chave : 'diag',
      materia: b.materia, titulo: b.titulo ?? b.materia, min: b.min, bruto: b.min,
      metodo: b.metodo, dica: cfg.metodos[b.metodo], como: b.como, onde: b.onde, diagnostico: true, comAssunto: false,
    }));
  }

  const dias = planoSemana(cfg, fases, startOfWeek(dia), ctx);
  const d = dias.find((x) => x.dia === dia);
  let blocos = d.blocos;

  // Última semana antes da prova: revisão leve (só ~60% do estudo do dia).
  const leve = revisaoLeve(cfg, dia);
  if (leve) {
    const total = blocos.filter((b) => b.sessoes).reduce((a, b) => a + b.min, 0);
    let acum = 0;
    blocos = blocos.filter((b) => { if (!b.sessoes) return true; if (acum >= total * 0.6) return false; acum += b.min; return true; });
  }

  const cont = {};
  const lista = blocos.map((b) => {
    const c = cats[b.cat] ?? { materia: b.cat, metodo: 'recuperacao' };
    cont[b.cat] = (cont[b.cat] ?? 0) + 1;
    let titulo = c.titulo ?? c.materia;
    if (b.cat === 'prova' && b.sessoes) titulo = 'Questões de provas antigas (cronometradas)'; // excedente durante a semana
    else if (b.cat === 'prova') titulo = leve ? 'Revisão leve: refazer erros da última prova (sem prova nova)' : `Prova antiga: ${cfg.provaSabado[fase.id]}`;
    return {
      id: `${dia}:${b.cat}@${toHHMM(b.ini).replace(':', '')}`, chave: `${b.cat}${cont[b.cat]}`, cat: b.cat,
      materia: c.materia, titulo, min: b.min, bruto: b.bruto, ini: toHHMM(b.ini), fim: toHHMM(b.fim), sessoes: b.sessoes,
      metodo: c.metodo, dica: cfg.metodos[c.metodo], diagnostico: false, comAssunto: COM_ASSUNTO.includes(b.cat),
    };
  });

  // Caderno de erros: 10 minutos de segunda a sexta, a qualquer hora (não entra nas sessões de foco).
  if (d.wd >= 1 && d.wd <= 5) {
    const c = cats.erros ?? { materia: 'Caderno de erros', metodo: 'espacada' };
    lista.push({ id: `${dia}:erros`, chave: 'erros', cat: 'erros', materia: c.materia, titulo: c.titulo ?? c.materia, min: 10, bruto: 10,
      metodo: c.metodo, dica: cfg.metodos[c.metodo], diagnostico: false, comAssunto: false });
  }
  return lista;
}

/** Blocos que realmente valem para o dia: o que foi passado para outro dia sai,
 *  o que veio de outro dia entra, e no "dia mínimo" o dia inteiro vira 45 min de questões (20 do próximo tópico), mais as revisões vencidas. */
export function blocosAjustados(cfg, fases, dia, { adiados = {}, dificeis = {}, exams = {} } = {}) {
  const ctx = { exams };
  let lista = blocosDoDia(cfg, fases, dia, ctx).filter((b) => !adiados[b.id] || adiados[b.id] === dia);
  for (const [id, alvo] of Object.entries(adiados)) {
    const orig = id.slice(0, 10);
    if (alvo !== dia || orig === dia) continue;
    const b = blocosDoDia(cfg, fases, orig, ctx).find((x) => x.id === id);
    if (b) lista.push({ ...b, adiadoDe: orig });
  }
  if (dificeis[dia] && lista.length) {
    const principal = lista.find((b) => ESTUDO.includes(b.cat));
    const materia = principal?.materia ?? lista.find((b) => b.cat !== 'erros' && b.cat !== 'plan')?.materia ?? 'Matemática';
    lista = [{ id: `${dia}:minimo`, chave: 'minimo', cat: 'minimo', materia: ESTUDO_MATERIAS.has(materia) ? materia : 'Matemática', titulo: 'Dia mínimo', min: 45, bruto: 45, sessoes: 1,
      metodo: 'recuperacao', dica: cfg.metodos.recuperacao, diagnostico: false, comAssunto: true, questoes: QUESTOES_DIA_MINIMO, essencial: true }];
    lista[0].titulo = `Dia mínimo · ${lista[0].materia}`;
  }
  return lista;
}
export { diaNome };
