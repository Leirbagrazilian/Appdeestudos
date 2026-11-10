import { weekday, weekIndex, diaNome } from './dates.js';
import { faseDoDia, revisaoLeve } from './phases.js';

const LINGUA = { pt: ['Português', 'recuperacao'], en: ['Inglês', 'intercalada'] };

/** Monta o checklist de um dia (não é salvo: só o que você marca é salvo). */
export function blocosDoDia(cfg, fases, dia) {
  const wd = weekday(dia);
  const fase = faseDoDia(fases, dia);
  const diag = cfg.diagnostico.dias[dia];
  const util = [1, 2, 4, 5].includes(wd);
  const modelo = diag ?? (util ? cfg.modeloSemana.util : cfg.modeloSemana[wd]);
  const leve = revisaoLeve(cfg, dia);
  const fator = leve && !diag ? 0.6 : 1;
  const slot = { 1: 0, 2: 1, 4: 2, 5: 3 }[wd] ?? 0;

  return modelo.map((b) => {
    let materia = b.materia, titulo = b.titulo, como = b.como, onde = b.onde;
    if (b.chave === 'lingua') materia = LINGUA[(slot + weekIndex(dia)) % 2 ? 'en' : 'pt'][0];
    if (b.chave === 'prova') titulo = `Prova antiga: ${cfg.provaSabado[fase.id]}`;
    if (leve && !diag && b.chave === 'prova') titulo = 'Revisão leve: refazer erros da última prova (sem prova nova)';
    return {
      id: `${dia}:${b.chave}`, chave: b.chave, materia,
      titulo: titulo ?? (b.chave === 'lingua' ? materia : b.materia),
      min: Math.round(b.min * fator / 5) * 5 || 5,
      metodo: b.metodo, dica: cfg.metodos[b.metodo], como, onde, diagnostico: !!diag,
      comAssunto: !['erros', 'plan', 'prova', 'corr', 'rev'].includes(b.chave) && !diag,
    };
  });
}
export const metaDoDia = (cfg, dia) => cfg.rotina.metaHoras[weekday(dia)] * 60;
export { diaNome };
