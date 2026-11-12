import { parse } from './dates.js';

/** Idade completa em uma data ("AAAA-MM-DD"), a partir do nascimento. */
export function idadeEm(nasc, data) {
  const n = parse(nasc), d = parse(data);
  const fez = d.getMonth() > n.getMonth() || (d.getMonth() === n.getMonth() && d.getDate() >= n.getDate());
  return d.getFullYear() - n.getFullYear() - (fez ? 0 : 1);
}

/**
 * Confere o limite de idade de um concurso.
 * regra: { ref: "MM-DD", max, min? } = idade completa em `ref` do ano da matrícula (ano da prova + 1).
 * max é a maior idade permitida (ex.: "menos de 23 anos" => max 22).
 */
export function idadeOk(nasc, regra, anoProva, defasagem = 1) {
  const max = regra.max ?? (regra.limite != null ? regra.limite - 1 : Infinity); // aceita o formato antigo
  const min = regra.min ?? 0;
  const anoMat = anoProva + defasagem;
  const ref = `${anoMat}-${regra.ref ?? '12-31'}`;
  const idade = idadeEm(nasc, ref);
  return { ok: idade >= min && idade <= max, idade, anoMat, ref, acima: idade > max, abaixo: idade < min };
}
