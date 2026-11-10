import { parse } from './dates.js';
/** Tentativas possíveis: para cada ano de prova, o ano da matrícula é o seguinte. */
export function idadeOk(nasc, regra, anoProva) {
  const n = parse(nasc), anoMat = anoProva + 1;
  if (regra.tipo === 'menorQue') { // idade em 1º/jan do ano da matrícula
    const idade = anoMat - n.getFullYear() - ((n.getMonth() > 0 || n.getDate() > 1) ? 1 : 0);
    return { ok: idade < regra.limite, idade, anoMat };
  }
  const idade = anoMat - n.getFullYear(); // idade que completa até 31/dez
  return { ok: idade < regra.limite, idade, anoMat };
}
