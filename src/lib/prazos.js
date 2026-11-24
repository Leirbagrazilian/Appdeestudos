// Prazo de cada tópico (Matemática, Física e Química): distribui os tópicos, na ordem da trilha, dentro da janela do Ano
// (proporcional ao peso e às horas da matéria) -> nº de blocos previstos + data-limite ("MATAR HOJE" no último bloco).
// Também decide o status de cada tópico (dominado, dívida, bloqueado, atrasado...) e o ritmo geral. Tudo puro.
import { addDays, diffDays, weekday } from './dates.js';
import { diaLivre } from './rotina.js';
import { baseMinutos } from './semana.js';
import { estaTravado, aguardaReteste, resumo as resumoDominio } from './dominio.js';

export const BLOCO_MIN = 100; // 1 bloco previsto = 2 sessões de foco (100 min líquidos)
export const MATERIAS_PRAZO = ['Matemática', 'Física', 'Química'];
export const PESO_PADRAO = 2;
export const PESOS = [[1, 'leve'], [2, 'normal'], [3, 'pesado']];
const CAT = { Matemática: 'mat', Física: 'fis', Química: 'qui' };
const FASE_DO_ANO = ['zero', 'ano1', 'ano2', 'ano3'];
const FASES_SEM_CONTEUDO_NOVO = ['leve', 'ita', 'disc', 'enem'];

export const temPrazo = (materia) => MATERIAS_PRAZO.includes(materia);
export const chave = (materia, nome) => `${materia}|${nome}`;
export const semConteudoNovo = (faseId) => FASES_SEM_CONTEUDO_NOVO.includes(faseId);

/** Peso do tópico: o que você escolheu (cfg.pesos) > o do seed > 2. */
export function pesoDe(cfg, materia, t) {
  const o = cfg.pesos?.[chave(materia, t.nome)];
  if (o === 1 || o === 2 || o === 3) return o;
  return t.peso === 1 || t.peso === 3 ? t.peso : PESO_PADRAO;
}

/** Minutos líquidos da matéria num dia (meta semanal × % da fase × fatia do dia na semana). 0 nos dias livres. */
function minutosDoDia(cfg, faseId, dia, cat) {
  if (diaLivre(cfg, dia)) return 0;
  const pct = cfg.horasFase?.[faseId]?.[cat] ?? 0;
  const semana = (baseMinutos(cfg) * pct) / 100; // mesma base do planner (sem resgate e domingo)
  const md = cfg.rotina?.metaDia;
  const soma = md ? Object.values(md).reduce((a, b) => a + Number(b), 0) : 7;
  const parte = md ? Number(md[weekday(dia)] ?? 0) / soma : 1 / 7;
  return semana * parte;
}

/** Datas dos blocos previstos da matéria na janela [ini, fim]; se `minimo` pedir mais, a lista segue depois do fim. */
function suprimento(cfg, faseId, ini, fim, cat, minimo = 0) {
  const datas = [];
  let acc = 0, d = ini;
  for (let g = 0; g < 700; g++) {
    acc += minutosDoDia(cfg, faseId, d, cat) / BLOCO_MIN;
    while (acc >= 1 - 1e-9) { datas.push(d); acc -= 1; }
    if (d >= fim && datas.length >= minimo) break;
    d = addDays(d, 1);
  }
  return datas;
}

/** Reparte `total` blocos pelos pesos (maior resto), no mínimo 1 por tópico. */
export function alocar(pesos, total) {
  const k = pesos.length;
  if (!k) return [];
  if (total <= k) return pesos.map(() => 1);
  const soma = pesos.reduce((a, b) => a + b, 0);
  const x = pesos.map((w) => (total * w) / soma), n = x.map((v) => Math.max(1, Math.floor(v)));
  let resto = total - n.reduce((a, b) => a + b, 0);
  const ordem = x.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let j = 0; resto > 0; j++, resto--) n[ordem[j % k][1]]++;
  for (let j = 0; resto < 0 && j < 1000; j++) { // o mínimo de 1 pode ter passado do total: tira do maior
    const m = n.indexOf(Math.max(...n)); if (n[m] <= 1) break; n[m]--; resto++;
  }
  return n;
}

/**
 * Calendário de prazos. `fases` = gerarFases(cfg). Devolve { porMateria: { [matéria]: item[] }, por: Map('Matéria|Tópico' -> item), fim }.
 * item = { materia, nome, codigo, ano, peso, blocos, inicio, prazo, seq, prereq, libera, empurrado, aviso, alem }.
 * Matemática primeiro; Física e Química só começam um tópico depois do prazo da Matemática que ele usa
 * (o que não cabe na janela do ano é empurrado para o ano seguinte, com aviso).
 */
export function planoPrazos(cfg, fases) {
  const porMateria = {}, por = new Map(), prazoMat = new Map();
  const janela = (ano) => fases.find((f) => f.id === FASE_DO_ANO[ano]);
  let seq = 0;
  for (const materia of MATERIAS_PRAZO) {
    const todos = (cfg.topicos?.[materia] ?? []).map((t) => ({ t, ano: t.ano ?? (t.fase === 0 ? 0 : 1) }));
    const lista = [];
    let carry = [];
    for (let ano = 0; ano <= 3; ano++) {
      const f = janela(ano);
      if (!f) continue;
      const doAno = todos.filter((x) => x.ano === ano).map(({ t }) => ({ t, ano, empurrado: false }));
      const fila = [...carry, ...doAno];
      const mk = (x) => {
        const libera = materia === 'Matemática' ? null : (x.t.prereq ?? []).reduce((m, c) => (prazoMat.has(c) && prazoMat.get(c) > (m ?? '') ? prazoMat.get(c) : m), null);
        return { materia, nome: x.t.nome, codigo: x.t.codigo ?? x.t.nome, ano: x.ano ?? ano, peso: pesoDe(cfg, materia, x.t), prereq: x.t.prereq ?? [], libera: libera ? addDays(libera, 1) : null, empurrado: x.empurrado, aviso: null, alem: false };
      };
      let itens = fila.map(mk);
      carry = [];
      // o que só libera depois do fim da janela vai para o ano seguinte (no último ano fica, com aviso)
      if (ano < 3) {
        const fica = itens.filter((i) => !i.libera || i.libera <= f.fim);
        const sai = itens.filter((i) => !fica.includes(i));
        carry = sai.map((i) => ({ t: (cfg.topicos[materia] ?? []).find((y) => y.nome === i.nome), empurrado: true }));
        itens = fica;
      }
      if (!itens.length) continue;
      const ini = cfg.perfil?.inicioReal && cfg.perfil.inicioReal > f.inicio ? cfg.perfil.inicioReal : f.inicio; // nada nasce atrasado: conta a partir do início real
      const base = suprimento(cfg, f.id, ini, f.fim, CAT[materia]);
      const blocos = alocar(itens.map((i) => i.peso), base.length);
      const total = blocos.reduce((a, b) => a + b, 0);
      const datas = suprimento(cfg, f.id, ini, f.fim, CAT[materia], total);
      itens.forEach((i, n) => { i.blocos = blocos[n]; });
      // ordem de colocação: o primeiro da fila que já está liberado na data do bloco; bloqueados ficam para depois
      const espera = [...itens];
      let p = 0;
      while (espera.length) {
        const data = datas[Math.min(p, datas.length - 1)] ?? ini;
        let k = espera.findIndex((i) => !i.libera || i.libera <= data);
        if (k < 0) {
          // todos os que restam esperam a Matemática: pula para o 1º bloco depois do prazo dela; se não cabe na janela, vai para o ano seguinte
          const lib = espera.map((i) => i.libera).sort()[0];
          const q = datas.findIndex((d, idx) => idx >= p && d >= lib);
          if (q >= 0) { p = q; continue; }
          if (ano < 3) {
            carry.push(...espera.splice(0).map((i) => ({ t: (cfg.topicos[materia] ?? []).find((y) => y.nome === i.nome), empurrado: true })));
            break;
          }
          k = 0; espera[0].aviso = true;
        }
        for (let j = 0; j < k; j++) espera[j].empurrado = true;
        const [i] = espera.splice(k, 1);
        i.inicio = datas[Math.min(p, datas.length - 1)] ?? ini;
        i.prazo = datas[Math.min(p + i.blocos - 1, datas.length - 1)] ?? f.fim;
        i.alem = i.prazo > f.fim;
        i.seq = seq++;
        p += i.blocos;
        lista.push(i);
        if (materia === 'Matemática') prazoMat.set(i.codigo, i.prazo);
      }
    }
    // o que sobrou em carry (ano 3 sem janela seguinte) já ficou na lista; garante nomes
    for (const i of lista) {
      i.aviso = i.empurrado && i.libera ? `Empurrado para depois de ${i.prereq.join(' e ')} (Matemática), que fecha em ${fmtDM(addDays(i.libera, -1))}.` : i.aviso === true ? `Espera ${i.prereq.join(' e ')} (Matemática) até ${fmtDM(addDays(i.libera, -1))}.` : null;
      por.set(chave(materia, i.nome), i);
    }
    porMateria[materia] = lista.sort((a, b) => a.seq - b.seq);
  }
  const todos = Object.values(porMateria).flat();
  return { porMateria, por, fim: todos.map((i) => i.prazo).sort().at(-1) ?? null, porCodigo: new Map(porMateria.Matemática?.map((i) => [i.codigo, i]) ?? []) };
}
const fmtDM = (d) => d.slice(5).split('-').reverse().join('/');

// ---------- estado do tópico ----------
export const dominadoT = (lacunas, materia, nome) => (lacunas?.[materia]?.[nome] ?? 0) >= 3;
/** Sábado do resgate: o primeiro sábado depois do prazo. */
export const sabadoDoResgate = (prazo) => addDays(prazo, ((6 - weekday(prazo) + 7) % 7) || 7);

/** Blocos de estudo já feitos por tópico: { 'Matéria|Tópico': blocos de 100 min } (conta o que tem tópico e tempo). */
export function contarBlocos(done) {
  const out = {};
  for (const v of Object.values(done ?? {})) {
    if (!v?.topico || !v.materia || !(v.min > 0)) continue;
    const k = chave(v.materia, v.topico);
    out[k] = (out[k] ?? 0) + v.min / BLOCO_MIN; // blocos "equivalentes" de 100 min: um bloco de 1 sessão vale meio

  }
  return out;
}

/** Pré-requisitos (Matemática) ainda não dominados: [{ codigo, nome }]. */
export function prereqPendentes(plano, lacunas, item) {
  return (item.prereq ?? []).map((c) => plano.porCodigo?.get(c)).filter((m) => m && !dominadoT(lacunas, 'Matemática', m.nome)).map((m) => ({ codigo: m.codigo, nome: m.nome }));
}
/**
 * Dívida: o prazo passou, o sábado de resgate também, e o tópico (já começado) ainda não foi dominado.
 * st = { lacunas, feitos, dividas }.
 */
export function emDivida(item, st, dia) {
  const k = chave(item.materia, item.nome);
  if (dominadoT(st.lacunas, item.materia, item.nome)) return false;
  if (st.dividas?.[k]) return true;
  return dia > sabadoDoResgate(item.prazo) && (st.feitos?.[k] ?? 0) > 0;
}

/** Status do tópico: dominado | divida | bloqueado | atrasado | hoje | andamento | futuro. */
export function statusDe(plano, item, st, dia) {
  if (dominadoT(st.lacunas, item.materia, item.nome)) return 'dominado';
  if (emDivida(item, st, dia)) return 'divida';
  if (prereqPendentes(plano, st.lacunas, item).length) return 'bloqueado';
  if (item.prazo < dia) return 'atrasado';
  if (item.prazo === dia) return 'hoje';
  return item.inicio <= dia ? 'andamento' : 'futuro';
}

/** O MATAR HOJE do tópico já falhou (abaixo de 8/10) e ele ainda não foi dominado: vai para o resgate do sábado. */
export const falhouMatar = (dominio, materia, nome, lacunas) => !dominadoT(lacunas, materia, nome) && resumoDominio(dominio?.[chave(materia, nome)]).falhas > 0;

/** Dívidas de verdade agora (para o caderno de erros): [{ materia, nome }]. */
export function dividasAtuais(plano, st, dia) {
  return Object.values(plano.porMateria).flat().filter((i) => emDivida(i, st, dia)).map((i) => ({ materia: i.materia, nome: i.nome, prazo: i.prazo }));
}

/** Tópicos que o resgate deste sábado cobre: os que falharam no MATAR HOJE, os não dominados e já começados cujo prazo caiu na semana
 *  (o sábado de resgate deles é este) e, depois, as dívidas mais antigas (é a chance de pagar). */
export function resgateDoSabado(plano, st, dia) {
  const todos = Object.values(plano.porMateria).flat();
  const naoDom = (i) => !dominadoT(st.lacunas, i.materia, i.nome);
  const iniciado = (i) => (st.feitos?.[chave(i.materia, i.nome)] ?? 0) > 0;
  const falhou = todos.filter((i) => falhouMatar(st.dominio, i.materia, i.nome, st.lacunas) && !emDivida(i, st, dia));
  const semana = todos.filter((i) => !falhou.includes(i) && sabadoDoResgate(i.prazo) === dia && iniciado(i) && naoDom(i));
  const dividas = todos.filter((i) => !falhou.includes(i) && !semana.includes(i) && st.dividas?.[chave(i.materia, i.nome)] && naoDom(i));
  const ord = (a, b) => a.prazo.localeCompare(b.prazo) || a.seq - b.seq;
  return [...falhou.sort(ord), ...semana.sort(ord), ...dividas.sort(ord)];
}

/**
 * Tópico do próximo bloco de `materia`. st = { lacunas, feitos, dividas, virt, excluir, faseId, acertos }.
 * Segue a ordem do plano; pula o que está dominado, em dívida ou bloqueado por pré-requisito (o plano segue com o próximo).
 * Retorna { item, k, de, matar, prazo, pagandoDivida?, reforco? } ou null.
 */
export function escolherTopico(cfg, plano, materia, st, dia) {
  const lista = plano.porMateria[materia] ?? [];
  const zero = st.faseId === 'zero', sem = semConteudoNovo(st.faseId);
  const feito = (i) => st.feitos?.[chave(materia, i.nome)] ?? 0;
  const livre = (i) => !dominadoT(st.lacunas, materia, i.nome) && !emDivida(i, st, dia) && !prereqPendentes(plano, st.lacunas, i).length && !st.excluir?.has(i.nome) && !estaTravado(st.dominio?.[chave(materia, i.nome)]) // travado (3 tentativas): precisa de ajuda antes
    && !aguardaReteste(st.dominio?.[chave(materia, i.nome)]) // passou uma vez: o reteste (3 dias depois) é um item à parte
    && !falhouMatar(st.dominio, materia, i.nome, st.lacunas); // não matou: vai para o resgate do sábado e o plano segue com o próximo
  const abertos = lista.filter((i) => livre(i) && (zero ? i.ano === 0 : true) && (sem ? feito(i) > 0 : true));
  const monta = (i, extra = {}) => {
    const k = Math.floor(feito(i) + (st.virt?.[chave(materia, i.nome)] ?? 0) + 1e-6) + 1; // bloco em que você está
    return { item: i, k: Math.min(k, i.blocos), de: i.blocos, matar: k >= i.blocos, prazo: i.prazo, atrasado: i.prazo < dia, ...extra };
  };
  if (abertos.length) return monta(abertos[0]);
  // sem tópico aberto: paga uma dívida (tentar de novo), senão reforço do mais fraco (só na Fase 0)
  const div = lista.filter((i) => (emDivida(i, st, dia) || falhouMatar(st.dominio, materia, i.nome, st.lacunas)) && !st.excluir?.has(i.nome));
  if (div.length) return { ...monta(div[0]), matar: true, k: div[0].blocos, pagandoDivida: true };
  if (zero) {
    const pool = lista.filter((i) => i.ano === 0 && !st.excluir?.has(i.nome));
    const pct = (i) => { const a = st.acertos?.[chave(materia, i.nome)]; return a?.feitas ? a.acertos / a.feitas : 1; };
    if (pool.length) { const i = pool.reduce((m, x) => (pct(x) < pct(m) ? x : m), pool[0]); return { ...monta(i), matar: false, reforco: true }; }
  }
  return null;
}

// ---------- ritmo ----------
/** Dominados × previstos até hoje, atraso (dias) e data projetada de término. `materia` null = as três juntas. */
export function ritmo(plano, lacunas, dia, materia = null) {
  const itens = (materia ? plano.porMateria[materia] ?? [] : Object.values(plano.porMateria).flat()).slice().sort((a, b) => a.prazo.localeCompare(b.prazo) || a.seq - b.seq);
  const dom = (i) => dominadoT(lacunas, i.materia, i.nome);
  const previstos = itens.filter((i) => i.prazo <= dia).length, dominados = itens.filter(dom).length;
  const fimPlano = itens.at(-1)?.prazo ?? null;
  // o próximo tópico "devido" pela contagem: o (dominados+1)-ésimo no ritmo do plano
  const proximo = itens[Math.min(dominados, itens.length - 1)];
  let atraso = 0, adianto = 0;
  if (proximo && dominados < itens.length) { const d = diffDays(proximo.prazo, dia); if (d > 0) atraso = d; else adianto = -d; }
  const fimProjetado = fimPlano ? addDays(fimPlano, atraso - adianto) : null;
  return { previstos, dominados, total: itens.length, pct: previstos ? Math.min(1, dominados / previstos) : 1, atraso, adianto, fimPlano, fimProjetado,
    alerta: atraso > 7, sugestoes: atraso > 7 ? ['Dedique o sábado inteiro à recuperação (sem prova antiga) até zerar o atraso.', 'Ou baixe o peso de um tópico leve que ainda não começou: ele libera blocos para os próximos.'] : [] };
}
