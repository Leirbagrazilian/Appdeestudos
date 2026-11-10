import { diffDays } from './dates.js';

// Treino do caderno de erros: 2 acertos seguidos = dominado.
export const ACERTOS_PARA_DOMINAR = 2;
export const situacao = (e) => e.status ?? 'novo'; // novo | treinando | dominado

/** Resultado de uma tentativa no treino. */
export function treinar(e, acertou, dia) {
  const seguidos = acertou ? (e.acertosSeguidos ?? 0) + 1 : 0;
  return {
    ...e, acertosSeguidos: seguidos, treinos: (e.treinos ?? 0) + 1, ultimoTreino: dia,
    status: acertou && seguidos >= ACERTOS_PARA_DOMINAR ? 'dominado' : 'treinando',
  };
}

/** Fila de treino: o que nunca foi treinado primeiro, depois o que foi treinado há mais tempo. */
export function filaTreino(erros, limite = 10) {
  return erros.filter((e) => situacao(e) !== 'dominado')
    .sort((a, b) => (a.ultimoTreino ?? '').localeCompare(b.ultimoTreino ?? '') || a.id.localeCompare(b.id))
    .slice(0, limite);
}

const norm = (s) => (s ?? '').trim().toLowerCase();
const DICAS = {
  conteudo: 'Muitos erros de conteúdo: volte à teoria desses assuntos e atualize o mapa de lacunas.',
  atencao: 'Muitos erros de atenção: leia o enunciado duas vezes e circule "não", "exceto" e "incorreta".',
  tempo: 'Muitos erros de tempo: treine mais questões com cronômetro e pule as que travarem.',
};

/** Seus vilões: assuntos que mais se repetem e o tipo de erro que domina. */
export function viloes(erros) {
  const ativos = erros.filter((e) => situacao(e) !== 'dominado');
  const porAssunto = {};
  for (const e of ativos) { const k = norm(e.assunto); if (!k) continue; (porAssunto[k] ??= { assunto: e.assunto.trim(), materia: e.materia, n: 0 }).n++; }
  const top = Object.values(porAssunto).filter((x) => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 3);
  const tipos = { conteudo: 0, atencao: 0, tempo: 0 };
  for (const e of ativos) if (e.tipo in tipos) tipos[e.tipo]++;
  const total = Object.values(tipos).reduce((a, b) => a + b, 0);
  const [maior] = Object.entries(tipos).sort((a, b) => b[1] - a[1]);
  return { top, tipos, total, dica: total >= 3 ? DICAS[maior[0]] : null };
}

/** Lembrete de backup: 7 dias desde o último, ou nunca feito depois de 3 dias de uso. */
export function precisaBackup(ultimo, dia, diasDeUso) {
  if (!ultimo) return diasDeUso >= 3;
  return diffDays(ultimo, dia) >= 7;
}

// Redação (modelo ENEM): 5 competências de 0 a 200, em passos de 40.
export const COMPETENCIAS = [
  ['C1', 'Norma culta da língua escrita'],
  ['C2', 'Compreensão do tema e do texto dissertativo-argumentativo'],
  ['C3', 'Seleção e organização dos argumentos'],
  ['C4', 'Coesão: mecanismos linguísticos'],
  ['C5', 'Proposta de intervenção'],
];
export const NIVEIS_RED = [0, 40, 80, 120, 160, 200];
export const totalRedacao = (r) => (r.notas ?? []).reduce((a, b) => a + (+b || 0), 0);
