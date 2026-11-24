<script>
  import { slide } from 'svelte/transition';
  import { app, fases, prazos, ajustes, registrarPresenca, fazerBackup, adiarLembreteBackup, alternarBloco, alternarRevisao, avaliarRevisao, adiar, diaDificil, marcarCumprido, iniciarFoco, salvarCfg, registrarReteste } from '../stores/app.svelte.js';
  import { blocosDaSemana } from '../lib/planner.js';
  import { faseDoDia, semanaDaFase, totalSemanas, proximaProva, revisaoLeve } from '../lib/phases.js';
  import { revisoesDoDia } from '../lib/spaced.js';
  import { diaNome, fmtCurta, fmtBR, fmtMin, addDays, startOfWeek, diffDays } from '../lib/dates.js';
  import { alertasInscricao, conflitosProvas } from '../lib/alerts.js';
  import { planoDoBloco } from '../lib/foco.js';
  import { tarefasDoDia } from '../lib/tarefas.js';
  import Registro from '../components/Registro.svelte';
  import Treino from '../components/Treino.svelte';
  import Oracao from '../components/Oracao.svelte';
  import { sequencia, alertasTreino, treinoDoDia, treinoFeito } from '../lib/treino.js';
  import { oracoesDoDia } from '../lib/oracao.js';
  import Linha from '../components/Linha.svelte';
  import Tarefa from '../components/Tarefa.svelte';
  import { dur } from '../lib/prefs.js';
  import { precisaBackup } from '../lib/erros.js';
  import { focoDaSemana } from '../lib/revisao.js';
  import { travados as listaTravados } from '../lib/dominio.js';
  import { checkpointPendente, portaoZero } from '../lib/portao.js';
  import { semanaZero } from '../lib/trilha.js';
  import Check from '../components/Check.svelte';
  import Icon from '../components/Icon.svelte';
  import BlocoAtual from '../components/BlocoAtual.svelte';
  import BlocoEspecial from '../components/BlocoEspecial.svelte';
  import FimDia from '../components/FimDia.svelte';
  import { fraseDoDia } from '../lib/frases.js';
  import { blocoAtual, tituloTarefa } from '../lib/bloco.js';
  import { horaFimDia, mostrarFimDia, questaoDeOntem } from '../lib/fimdia.js';
  import { retestesDoDia, retestesAgendados } from '../lib/dominio.js';
  import { avisoCadernoAntesDaProva } from '../lib/erros.js';
  import Sono from '../components/Sono.svelte';
  import { horariosNoite, estadoDoDia, alertaSono, noiteDe, acordarAmanha } from '../lib/sono.js';
  import { presencaPorAula, aulasDoDia, antesDoInicio } from '../lib/rotina.js';
  import { ritmo as ritmoPrazos, contarBlocos, dividasAtuais } from '../lib/prazos.js';

  const REV_MIN = 10;
  const diaCurto = (d) => `${diaNome(d).slice(0, 3)} ${fmtBR(d).slice(0, 5)}`;
  let aberto = $state(null), assuntos = $state({}), verCarta = $state(false), fotoAberta = $state(null);
  let hora = $state(new Date().getHours()), agoraMin = $state(new Date().getHours() * 60 + new Date().getMinutes());
  $effect(() => { const i = setInterval(() => { const d = new Date(); hora = d.getHours(); agoraMin = hora * 60 + d.getMinutes(); }, 60000); return () => clearInterval(i); });

  const fs = $derived(fases());
  const fase = $derived(faseDoDia(fs, app.dia));
  const plano = $derived(prazos());
  // a semana é montada uma vez (e não a cada bloco marcado): serve à lista de hoje e à cidade
  const semana = $derived(blocosDaSemana(app.cfg, fs, startOfWeek(app.dia), ajustes()));
  const blocos = $derived(semana[diffDays(startOfWeek(app.dia), app.dia)]);
  // tarefa exata de cada bloco de estudo: tópico da Trilha, vídeo, páginas, exercícios e questões
  const tarefas = $derived(tarefasDoDia(app.cfg, blocos, { lacunas: app.lacunas, leitura: app.leitura, done: app.done, cotasDia: app.cotas[app.dia] ?? {}, faseId: fase.id, dominio: app.dominio, plano: plano, dia: app.dia, dividas: app.dividas }));
  const bRegistro = $derived(app.registroAberto ? blocos.find((x) => x.id === app.registroAberto.id) : null);
  const tituloDe = (b) => {
    const topico = tarefas[b.id]?.topico ?? app.done[b.id]?.topico;
    return topico ? `${b.materia} · ${topico}` : b.titulo;
  };
  const revs = $derived(revisoesDoDia(Object.values(app.reviews), app.dia));
  const prox = $derived(proximaProva(app.cfg, app.dia));
  const leve = $derived(revisaoLeve(app.cfg, app.dia));
  const alertas = $derived(alertasInscricao(app.cfg, app.dia));
  const conflito = $derived(conflitosProvas(app.cfg).find((c) => diffDays(app.dia, c.de) >= 0 && diffDays(app.dia, c.de) <= 120));
  const diag = $derived(blocos.some((b) => b.diagnostico));
  // sequência única: dias seguidos com estudo E treino feitos
  const seq = $derived(sequencia(app.cfg, { cumpridos: app.cumpridos, treinos: app.treinos, oracoes: app.oracoes }, app.dia));
  const avisosTreino = $derived(alertasTreino(app.cfg, app.dia, app.treinos));
  // modo domínio (Fase 0): tópicos travados, checkpoint do mês e o portão da última semana
  const travados = $derived(listaTravados(app.dominio, app.lacunas));
  const cpPendente = $derived(!diag && checkpointPendente(app.cfg, app.checkpoints, app.dia));
  const portaoAberto = $derived(fase.id === 'zero' && semanaZero(fs, app.dia) >= 8 && !portaoZero(app.cfg, app.portao, app.checkpoints, app.lacunas).ok);
  const dificil = $derived(!!app.dificeis[app.dia]);
  // sono, faculdade e prazos
  const sonoCtx = $derived({ noites: app.sonoNoites, sono: app.sono });
  const estadoSono = $derived(estadoDoDia(app.cfg, app.dia, sonoCtx)); // 'minimo' | 'curta' | null
  const curta = $derived(estadoSono === 'curta' || estadoSono === 'minimo');
  const noiteHoje = $derived(horariosNoite(app.cfg, app.dia, sonoCtx));
  const noiteAnterior = $derived(noiteDe(app.cfg, addDays(app.dia, -1), sonoCtx));
  const alertaDeSono = $derived(alertaSono(app.cfg, app.sono, app.dia));
  const aulas = $derived(aulasDoDia(app.cfg, app.dia));
  const presenca = $derived(presencaPorAula(app.cfg, app.presenca));
  const presencaBaixa = $derived(presenca.filter((x) => x.alerta));
  const ritmoGeral = $derived(ritmoPrazos(plano, app.lacunas, app.dia));
  const dividasN = $derived(dividasAtuais(plano, { lacunas: app.lacunas, feitos: contarBlocos(app.done), dividas: app.dividas }, app.dia).length);
  // Progresso pelo tempo planejado de cada bloco concluído (os minutos reais aparecem no bloco).
  const totalMin = $derived(blocos.reduce((s, b) => s + b.min, 0) + revs.length * REV_MIN);
  const feitoMin = $derived(blocos.reduce((s, b) => s + (app.done[b.id] ? b.min : 0), 0) + revs.filter((r) => r.feita).length * REV_MIN);
  const pct = $derived(totalMin ? feitoMin / totalMin : 0);
  $effect(() => { if (pct >= 1 && blocos.length) marcarCumprido(app.dia); });

  // A base da semana: uma luz por bloco planejado, acesa quando concluído.
  const base = $derived.by(() => {
    let total = 0, acesas = 0;
    for (const lista of semana) for (const b of lista) { total++; if (app.done[b.id]) acesas++; }
    return { total, acesas };
  });

  // Lembrete de backup: 7 dias depois do último (ou nunca feito depois de 3 dias de uso).
  const diasDeUso = $derived(new Set(Object.entries(app.done).map(([k, v]) => v.dia ?? k.slice(0, 10))).size);
  const lembrarBackup = $derived(app.lembreteAdiado !== app.dia && precisaBackup(app.ultimoBackup, app.dia, diasDeUso));
  const focoSemana = $derived(focoDaSemana(app.revisoes, app.dia));
  const tarde = $derived(hora >= 22 || hora < 4);
  const mostrarCarta = $derived(verCarta || (app.cfg.carta && (dificil || (hora >= 19 && pct < 0.3))));
  // Frase por contexto (noite, dia cumprido, dia mínimo, bloco feito, prova próxima, domingo, início), estável ao longo do dia.
  const feitos = $derived(blocos.filter((b) => app.done[b.id]).length);
  const frase = $derived(fraseDoDia(app.cfg.frases, { hora, pct, feitos, dificil, diaSemana: new Date(app.dia + 'T12:00').getDay(), diasProva: prox?.dias ?? null }, app.dia, app.cfg.tom ?? 'sargento') || 'Disciplina hoje, farda amanhã.');

  const wdHoje = $derived(new Date(app.dia + 'T12:00').getDay());
  // bloco atual (pelo horário), questão difícil de ontem e retestes de domínio
  const ordemEstudo = $derived(blocos.filter((b) => b.ini && ['mat', 'fis', 'qui', 'por', 'ing', 'hg'].includes(b.cat)).sort((x, y) => x.ini.localeCompare(y.ini)));
  const primeiroId = $derived(ordemEstudo[0]?.id);
  const questaoOntem = $derived(questaoDeOntem(app.fimDia, app.dia, addDays(app.dia, -1)));
  const tarefasOntem = $derived((app.fimDia[addDays(app.dia, -1)]?.tarefas ?? '').trim());
  const atual = $derived(!diag && !dificil ? blocoAtual(blocos, (b) => !!app.done[b.id], agoraMin) : null);
  const ctxPasso = (b) => ({ primeiroDoDia: b?.id === primeiroId, questaoDificil: questaoOntem });
  const retestes = $derived(retestesDoDia(app.dominio, app.dia));
  const retestesFuturos = $derived(retestesAgendados(app.dominio, app.dia));
  let resRet = $state({});
  const avisoCaderno = $derived(avisoCadernoAntesDaProva(Object.values(app.errors), prox?.dias ?? null));

  function comecar(b) {
    if (app.timer && app.timer.id !== b.id && !confirm(`Já há um cronômetro de ${app.timer.titulo}. Trocar por ${b.titulo}?`)) return;
    if (!app.timer || app.timer.id !== b.id) iniciarFoco({ ...b, tarefa: tarefas[b.id] ?? null });
    location.hash = '#/foco';
  }
  const fotoDe = (r) => (r.origem?.startsWith('erro:') ? app.errors[r.origem.slice(5)]?.foto : null);
  const descSessoes = (b) => { const p = planoDoBloco(b, app.cfg.foco); return p.sessoes > 1 ? `${p.sessoes} × ${p.len} min` : fmtMin(b.min); };

  // Linha do tempo única: estudo + treino + oração, em Manhã · Tarde · Noite.
  const temProva = $derived(blocos.some((b) => ['prova', 'diag'].includes(b.cat)) || cpPendente);
  const trn = $derived(treinoDoDia(app.cfg, app.dia, { treinos: app.treinos, editadas: app.treinoSemanas, noiteCurta: curta }));
  const orac = $derived(oracoesDoDia(app.cfg, app.dia, { oracoes: app.oracoes, temProva, noites: app.sonoNoites, sono: app.sono }));
  const emMin = (h) => { const m = /^(\d{1,2}):(\d{2})/.exec(h ?? ''); return m ? +m[1] * 60 + +m[2] : null; };
  const DEPOIS_ALMOCO = 13 * 60 + 30;
  // noite curta: o bloco MATAR HOJE vai para depois do almoço
  const matarDepois = (b) => curta && tarefas[b.id]?.matar && (emMin(b.ini) ?? 0) < DEPOIS_ALMOCO;
  const itens = $derived([
    ...blocos.map((b) => ({ k: 'e', id: 'e' + b.id, b, m: matarDepois(b) ? DEPOIS_ALMOCO : emMin(b.ini), feito: !!app.done[b.id], depois: matarDepois(b) })),
    { k: 's', id: 'sono-manha', tipo: 'manha', m: emMin(noiteAnterior.acordar), feito: !!app.sono[app.dia] },
    { k: 's', id: 'sono-noite', tipo: 'noite', m: emMin(noiteHoje.terco), feito: false },
    { k: 's', id: 'sono-cochilo', tipo: 'cochilo', m: 12 * 60 + 40, feito: false },
    ...(mostrarFimDia(wdHoje, agoraMin) ? [{ k: 'f', id: 'fim-dia', m: emMin(horaFimDia(wdHoje)), feito: false }] : []),
    ...(trn ? [{ k: 't', id: 't', m: emMin(trn.hora), feito: treinoFeito(app.treinos[app.dia] ?? {}) }] : []),
    ...orac.map((o) => ({ k: 'o', id: 'o' + o.id, o, m: emMin(o.hora), feito: !!app.oracoes[app.dia]?.[o.id] })),
  ]);
  const PERIODOS = [['Manhã', 0, 720], ['Tarde', 720, 1080], ['Noite', 1080, 1441]];
  const grupos = $derived([
    ...PERIODOS.map(([nome, a, z]) => ({ nome, lista: itens.filter((i) => i.m != null && i.m >= a && i.m < z).sort((x, y) => x.m - y.m) })),
    { nome: 'Sem horário', lista: itens.filter((i) => i.m == null) },
  ].filter((g) => g.lista.length));
  // Antes do início real: só o cartão "Começa amanhã", sem checklist.
  const antes = $derived(antesDoInicio(app.cfg, app.dia));
  const faltam = $derived(antes ? diffDays(app.dia, app.cfg.perfil.inicioReal) : 0);
  const vespera = $derived(antes ? acordarAmanha(app.cfg, app.dia, sonoCtx) : null);
  const SEDES = ['mat', 'fis', 'qui', 'por', 'ing', 'hg', 'red', 'prova', 'diag', 'minimo'];
  const abrir = (id) => (aberto = aberto === id ? null : id);
</script>
{#if antes}
  <section class="card antes" aria-label="Antes do início">
    <p class="data">{diaNome(app.dia)} · {fmtCurta(app.dia)}</p>
    <h1>{faltam === 1 ? 'Começa amanhã' : `Começa em ${faltam} dias`} · {diaNome(app.cfg.perfil.inicioReal)} {fmtBR(app.cfg.perfil.inicioReal).slice(0, 5)}</h1>
    <p class="acordar">Acordar amanhã às <strong>{vespera.acordar}</strong> · dormir às <strong>{vespera.dormir}</strong></p>
    <p class="sub">Hoje não tem nada para fazer. Descanse: o plano começa de verdade no primeiro dia.</p>
  </section>
{:else}
<header>
  <p class="data">{diaNome(app.dia)} · {fmtCurta(app.dia)}</p>
  <h1>{pct >= 1 ? 'Missão cumprida.' : `Avante, ${app.cfg.perfil.nome}.`}</h1>
  <p class="frase">{frase}</p>
</header>

<section class="prog" aria-label="Progresso do dia">
  <div class="topo"><strong>{Math.round(pct * 100)}%</strong><span>{fmtMin(feitoMin)} de {fmtMin(totalMin)}</span></div>
  <div class="bar" role="progressbar" aria-label="Progresso" aria-valuenow={Math.round(pct * 100)} aria-valuemin="0" aria-valuemax="100"><i style="width:{pct * 100}%"></i></div>
  <p class="fase">Fase {fase.numero} · {fase.nome}<span> · semana {semanaDaFase(fase, app.dia)}/{totalSemanas(fase)}</span></p>
  <p class="sr" aria-live="polite">{Math.round(pct * 100)}% do dia concluído</p>
  {#if dificil}
    <p class="dif"><Icon nome="moon" size={16} />Dia mínimo: 45 min de questões e as revisões vencidas. Isso conta como dia cumprido.
      <button class="lk" onclick={() => diaDificil(app.dia, false)}>Voltar ao dia completo</button></p>
  {:else if pct < 1 && blocos.length > 2}
    <button class="lk dif-bt" onclick={() => diaDificil(app.dia, true)}>Dia corrido? Fazer só o dia mínimo (45 min)</button>
  {/if}
  <p class="luzes seq">Sequência: <strong>{seq}</strong> {seq === 1 ? 'dia' : 'dias'} com estudo, treino e oração</p>
  <p class="luzes"><span class="ponto" aria-hidden="true"></span>Base da semana: <strong>{base.acesas}</strong> de {base.total} luzes acesas</p>
</section>

{#if atual}
  <BlocoAtual info={atual} tarefa={tarefas[atual.bloco.id]} ctx={ctxPasso(atual.bloco)} faseId={fase.id} onFoco={() => comecar(atual.bloco)} />
{/if}
{#if questaoOntem && !atual}<p class="nota" role="status"><Icon nome="bulb" />Questão difícil de ontem, para o 1º bloco: {questaoOntem}</p>{/if}
{#if tarefasOntem}<details class="nota"><summary><Icon nome="bulb" />Tarefas que você anotou ontem</summary><p class="pre">{tarefasOntem}</p></details>{/if}

{#if prox}
  <a class="prova" href="#/calendario" style="--c:{prox.concurso.cor}">
    <span class="num">{prox.dias}</span>
    <span class="lbl"><strong>dias para {prox.concurso.nome}{prox.evento.nome ? ` · ${prox.evento.nome}` : ''}</strong>
      <span>{fmtBR(prox.evento.inicio)} · {prox.evento.status}</span></span>
  </a>
{/if}

{#each avisosTreino as a}<p class="nota" role="status">{a}</p>{/each}
{#if avisoCaderno}<a class="nota alerta" href="#/erros"><Icon nome="clock" />{avisoCaderno}</a>{/if}
{#if plano.aviso}<a class="nota alerta" href="#/trilha"><Icon nome="clock" />{plano.aviso.texto}</a>{/if}

{#if focoSemana}
  <p class="foco-sem"><span class="data">Foco da semana</span>{focoSemana.foco}</p>
{/if}
{#each travados as x (x.materia + x.topico)}
  <a class="nota alerta" href="#/trilha"><Icon nome="clock" />Travado: {x.materia} · {x.topico}. Peça ajuda e destrave na Trilha.</a>
{/each}
{#if cpPendente}
  <a class="nota" href="#/progresso"><Icon nome="clock" />Checkpoint do mês: 10 questões de Matemática da EFOMM em 30 min.</a>
{/if}
{#if portaoAberto}
  <a class="nota" href="#/progresso"><Icon nome="clock" />Última semana da Fase 0: faça o teste de saída da base e o checkpoint para abrir o portão.</a>
{/if}
{#if alertaDeSono.alerta}
  <a class="nota alerta" href="#/semana"><Icon nome="moon" />{alertaDeSono.texto}</a>
{/if}
{#each presencaBaixa as x (x.nome)}
  <a class="nota alerta" href="#/ajustes"><Icon nome="clock" />Presença em {x.nome}: {Math.round(x.pct * 100)}% ({x.presentes} de {x.total}), abaixo de {app.cfg.rotina.presencaMin ?? 75}%.</a>
{/each}
{#if ritmoGeral.alerta}
  <a class="nota alerta" href="#/trilha"><Icon nome="clock" />Prazos atrasados em {ritmoGeral.atraso} dias. Veja a aba Prazos na Trilha: sábado inteiro de recuperação ou baixar o peso de um tópico leve.</a>
{/if}
{#if dividasN}
  <a class="nota" href="#/erros"><Icon nome="clock" />{dividasN} {dividasN === 1 ? 'dívida' : 'dívidas'} de tópico no caderno de erros (revisões 1, 7 e 30 dias). O resgate de sábado ajuda a pagar.</a>
{/if}
{#if lembrarBackup}
  <div class="nota backup entra">
    <p><Icon nome="clock" />{app.ultimoBackup ? 'Faz uma semana do último backup.' : 'Você ainda não fez nenhum backup.'} Guarde seu progresso fora do tablet.</p>
    <div class="bk"><button class="pri" onclick={fazerBackup}>Fazer backup agora</button><button class="lk" onclick={adiarLembreteBackup}>Amanhã</button></div>
  </div>
{/if}
{#if conflito}
  <a class="nota alerta" href="#/calendario"><Icon nome="clock" />{conflito.a.sigla} e {conflito.b.sigla} caem {conflito.de === conflito.ate ? `em ${fmtBR(conflito.de)}` : `de ${fmtBR(conflito.de)} a ${fmtBR(conflito.ate)}`}. Prioridade: {conflito.vence.sigla}.</a>
{/if}
{#if tarde}<p class="nota"><Icon nome="moon" />Já passou das 22h. Feche o caderno: dormir bem fixa o que você estudou hoje.</p>{/if}
{#each alertas as a}
  <a class="nota alerta" href="#/calendario"><Icon nome="clock" />Inscrição {a.concurso.nome} fecha {a.dias === 0 ? 'hoje' : a.dias === 1 ? 'amanhã' : `em ${a.dias} dias`}</a>
{/each}
{#if diag}
  <details class="nota">
    <summary><Icon nome="bulb" />{app.cfg.diagnostico.titulo}: leia antes de começar</summary>
    <p>{app.cfg.diagnostico.intro}</p>
    <ol>{#each app.cfg.diagnostico.como as c}<li>{c}</li>{/each}</ol>
    <p><a class="lk" href="#/questoes">Onde achar provas e gabaritos →</a> · <a class="lk" href="#/trilha">Trilha →</a></p>
  </details>
{/if}
{#if leve}<p class="nota"><Icon nome="moon" />Última semana antes da prova de {leve.nome}: revisão leve. Sem conteúdo novo, durma bem.</p>{/if}
{#if mostrarCarta && app.cfg.carta}
  <blockquote class="carta entra"><p class="data">Sua carta</p><p>{app.cfg.carta}</p></blockquote>
{/if}

{#if aulas.length}
  <h2 class="gr">Faculdade<span class="n">{aulas.length}</span></h2>
  <ul class="lista">
    {#each aulas as a (a.nome)}
      {@const p = presenca.find((x) => x.nome === a.nome)}
      <li class="aula">
        <span class="txt"><span class="tit">{a.nome} · {a.inicio}–{a.fim}</span>
          <span class="sub">{a.vou ? 'Você marcou "vou"' : 'Você marcou "não vou"'}{p?.total ? ` · presença ${Math.round(p.pct * 100)}% (${p.presentes} de ${p.total})` : ''}</span></span>
        <span class="pres" role="group" aria-label="Presença em {a.nome}">
          <button class:on={app.presenca[a.nome]?.[app.dia] === 'p'} aria-pressed={app.presenca[a.nome]?.[app.dia] === 'p'} onclick={() => registrarPresenca(a.nome, app.dia, 'p')}>Fui</button>
          <button class:on={app.presenca[a.nome]?.[app.dia] === 'f'} aria-pressed={app.presenca[a.nome]?.[app.dia] === 'f'} onclick={() => registrarPresenca(a.nome, app.dia, 'f')}>Faltei</button>
        </span>
      </li>
    {/each}
  </ul>
{/if}

{#each grupos as g (g.nome)}
  <h2 class="gr">{g.nome}<span class="n">{g.lista.filter((i) => i.k !== 's' && i.feito).length}/{g.lista.filter((i) => i.k !== 's').length}</span></h2>
  <ul class="lista">
    {#each g.lista as it (it.id)}
      {#if it.k === 't'}
        <Treino dia={app.dia} aberto={aberto === it.id} onAbrir={() => abrir(it.id)} {curta} />
      {:else if it.k === 's'}
        <Sono dia={app.dia} tipo={it.tipo} aberto={aberto === it.id} onAbrir={() => abrir(it.id)} />
      {:else if it.k === 'f'}
        <FimDia dia={app.dia} faseId={fase.id} aberto={aberto === it.id} onAbrir={() => abrir(it.id)} />
      {:else if it.k === 'o'}
        <Oracao dia={app.dia} it={it.o} aberto={aberto === it.id} onAbrir={() => abrir(it.id)} />
      {:else}
        {@render estudo(it.b, it.id, it.depois)}
      {/if}
    {/each}
  </ul>
{/each}

{#snippet estudo(b, id, depois = false)}
  {@const feito = !!app.done[b.id]}
  {@const rodando = app.timer?.id === b.id}
  {@const tarefa = tarefas[b.id]}
  <Linha {feito} label={`${b.titulo}, ${fmtMin(b.min)}`} onToggle={() => alternarBloco(b, assuntos[b.id] ?? '', tarefas[b.id])}
    aberto={aberto === id} onAbrir={() => abrir(id)} icone="livro" hora={depois ? 'depois do almoço' : b.ini ? `${b.ini}–${b.fim}` : ''} titulo={tituloDe(b)}
    sub={`${feito ? `${fmtMin(app.done[b.id].min)} feitos` : descSessoes(b)}${app.done[b.id]?.questoes ? ` · ${app.done[b.id].questoes.acertos}/${app.done[b.id].questoes.feitas} questões` : ''}${app.done[b.id]?.assunto ? ` · ${app.done[b.id].assunto}` : ''}${b.adiadoDe ? ` · veio de ${diaNome(b.adiadoDe)}` : ''}`}>
    {#snippet extra()}
      {#if tarefa?.prazo}<span class="pz">{#if tarefa.matar}<span class="matar">MATAR HOJE</span>{/if}{tarefa.prazo.resgate ? 'Resgate' : tarefa.prazo.pagandoDivida ? 'Pagando dívida' : tarefa.prazo.reforco ? 'Reforço' : `bloco ${tarefa.prazo.k} de ${tarefa.prazo.de}`} · prazo {diaCurto(tarefa.prazo.data)}{tarefa.prazo.atrasado && !tarefa.prazo.resgate ? ' (atrasado)' : ''}</span>{/if}
      {#if SEDES.includes(b.cat)}<span class="sedes">Sedes Sapientiae, rogai por nós</span>{/if}
    {/snippet}
    {#snippet acao()}
      {#if !feito}
        <button class="play" class:rodando aria-label={rodando ? `Abrir cronômetro de ${b.titulo}` : `Começar cronômetro de ${b.titulo}`} onclick={() => comecar(b)}>
          {#if rodando}<span class="onda" aria-hidden="true"></span>{:else}<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" /></svg>{/if}
        </button>
      {/if}
    {/snippet}
    {#if tarefa}<p class="tarefa-txt"><strong>{tituloTarefa(b, tarefa)}</strong></p>{/if}
    <Tarefa {tarefa} materia={b.materia} ctx={ctxPasso(b)} faseId={fase.id} />
    <BlocoEspecial {b} nomeProva={b.titulo.replace(/^Prova antiga: /, '')} />
    {#if b.cat === 'plan'}
      <a class="pri" href="#/revisao">Fazer a revisão da semana (3 perguntas)</a>
    {/if}
    {#if feito && b.comAssunto}
      <button class="sec" onclick={() => (app.registroAberto = { id: b.id })}>{app.done[b.id].resultado ? 'Corrigir o resultado' : 'Registrar resultado (questões, páginas, erros)'}</button>
    {/if}
    <p class="dica"><Icon nome="bulb" />{b.dica}</p>
    {#if b.como}<strong>Como fazer</strong><ul>{#each b.como as c}<li>{c}</li>{/each}</ul>{/if}
    {#if b.onde}<strong>Onde achar</strong><ul>{#each b.onde as c}<li>{c}</li>{/each}</ul>{/if}
    <label for="l-{b.id}">Aula ou playlist de {b.materia} (link)</label>
    <div class="link">
      <input id="l-{b.id}" type="url" inputmode="url" placeholder="cole o link do vídeo" value={app.cfg.links?.[b.materia] ?? ''}
        onchange={(e) => { app.cfg.links = { ...(app.cfg.links ?? {}), [b.materia]: e.currentTarget.value.trim() }; salvarCfg(); }} />
      {#if app.cfg.links?.[b.materia]}<a class="sec mini" href={app.cfg.links[b.materia]} target="_blank" rel="noopener">Abrir <Icon nome="ext" size={14} /></a>{/if}
    </div>
    {#if b.comAssunto && !feito}
      <label for="a-{b.id}">Assunto estudado (agenda revisões em 1, 7 e 30 dias)</label>
      <input id="a-{b.id}" placeholder="ex.: funções do 2º grau" bind:value={assuntos[b.id]} />
    {/if}
    {#if !feito}
      <div class="acoes">
        <button class="pri" onclick={() => comecar(b)}>{rodando ? 'Abrir cronômetro' : `Começar · ${descSessoes(b)}`}</button>
        {#if !b.diagnostico}<button class="sec" onclick={() => { aberto = null; adiar(b, addDays(app.dia, 1)); }}>Passar para amanhã</button>{/if}
      </div>
    {/if}
  </Linha>
{/snippet}

{#if revs.length}
  {@const pend = revs.filter((r) => !r.feita).length}
  <h2 class="gr">Revisões<span class="n">{pend} {pend === 1 ? 'pendente' : 'pendentes'}</span></h2>
  <ul class="lista">
    {#each revs as r (r.id)}
      {@const foto = fotoDe(r)}
      <li class:feito={r.feita}>
        <div class="linha">
          <Check feito={r.feita} label={`Revisão de ${r.assunto}`} onclick={() => alternarRevisao(r)} />
          <span class="txt"><span class="tit">{r.assunto}</span><span class="sub">{r.materia} · {r.extra ? 'revisão extra' : `revisão de ${r.intervalo} dia${r.intervalo > 1 ? 's' : ''}`}{r.nota ? ` · ${{ facil: 'fácil', ok: 'ok', dificil: 'difícil' }[r.nota]}` : ` · ${REV_MIN} min`}</span></span>
          {#if foto}<button class="mini-foto" aria-label="Ver foto da questão" onclick={() => (fotoAberta = fotoAberta === r.id ? null : r.id)}><img src={foto} alt="" /></button>{/if}
        </div>
        {#if !r.feita}
          <div class="notas" role="group" aria-label="Como foi a revisão de {r.assunto}?">
            <button class="nt dificil" onclick={() => avaliarRevisao(r, 'dificil')}>Difícil</button>
            <button class="nt" onclick={() => avaliarRevisao(r, 'ok')}>Ok</button>
            <button class="nt facil" onclick={() => avaliarRevisao(r, 'facil')}>Fácil</button>
          </div>
        {/if}
        {#if fotoAberta === r.id && foto}<img class="foto" src={foto} alt="Foto da questão de {r.assunto}" transition:slide={{ duration: dur(220) }} />{/if}
      </li>
    {/each}
  </ul>
{/if}

{#if retestes.length || retestesFuturos.length}
  <h2 class="gr">Reteste de domínio<span class="n">{retestes.length} {retestes.length === 1 ? 'pendente' : 'pendentes'}</span></h2>
  <ul class="lista">
    {#each retestes as x (x.materia + x.topico)}
      {@const k = x.materia + '|' + x.topico}
      <li class="ret">
        <span class="txt"><span class="tit">Reteste: {x.topico}</span><span class="sub">{x.materia} · passou em {fmtBR(x.desde)}. 10 questões, sem consultar: 8 acertos viram dominado.</span></span>
        <span class="rf">
          <label>Feitas<input type="number" inputmode="numeric" min="1" max="50" value={resRet[k]?.feitas ?? 10} onchange={(e) => (resRet[k] = { ...resRet[k], feitas: +e.currentTarget.value })} /></label>
          <label>Acertos<input type="number" inputmode="numeric" min="0" max="50" value={resRet[k]?.acertos ?? ''} onchange={(e) => (resRet[k] = { ...resRet[k], acertos: +e.currentTarget.value })} /></label>
          <button type="button" class="pri" disabled={resRet[k]?.acertos == null} onclick={() => registrarReteste(x.materia, x.topico, resRet[k]?.feitas ?? 10, resRet[k]?.acertos ?? 0)}>Registrar</button>
        </span>
      </li>
    {/each}
    {#each retestesFuturos as x (x.materia + x.topico)}
      <li class="ret"><span class="txt"><span class="tit">{x.topico}</span><span class="sub">Reteste em {diaCurto(x.em)} (3 dias depois de passar). Só então vira dominado.</span></span></li>
    {/each}
  </ul>
{/if}

{#if bRegistro}<Registro b={bRegistro} tarefa={tarefas[bRegistro.id] ?? null} soErros={!!app.registroAberto?.soErros} />{/if}

<p class="lembrete">
  {#if app.cfg.carta}<button class="lk" onclick={() => (verCarta = !verCarta)}>{verCarta ? 'Fechar minha carta' : 'Ler minha carta'}</button>
  {:else}<a class="lk" href="#/ajustes">Escreva sua carta: por que você quer a farda?</a>{/if}
</p>
{/if}

<style>
  .pz { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: .85rem; color: var(--tx2); font-weight: 600; }
  .matar { font-size: .8125rem; font-weight: 800; letter-spacing: .06em; color: var(--al); background: var(--al-bg); border: 1px solid var(--al); border-radius: 8px; padding: 2px 10px; }
  .aula { display: grid; gap: 6px; padding: 8px 4px; }
  .pres { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .pres button { min-height: 44px; border-radius: 12px; border: 1px solid var(--line); font-weight: 700; color: var(--tx); }
  .pres button.on { background: var(--ac); border-color: var(--ac); color: var(--ac-tx); }
  .sedes { display: block; font-size: .75rem; font-style: italic; color: var(--tx2); }
  header { padding: 20px 4px 4px; position: relative; }
  .data { color: var(--tx2); font-size: .8125rem; text-transform: uppercase; letter-spacing: .14em; font-weight: 600; }
  h1 { margin-top: 4px; font-size: 1.75rem; font-weight: 800; letter-spacing: -.03em; max-width: calc(100% - 60px); }
  .frase { margin-top: 8px; color: var(--tx2); font-size: .95rem; line-height: 1.45; max-width: 36ch; text-wrap: pretty; }
  .fase { margin-top: 12px; display: block; font-size: .8125rem; font-weight: 600; color: var(--ac); }
  .fase span { color: var(--tx2); font-weight: 400; }
  .luzes { margin-top: 6px; display: flex; align-items: center; gap: 8px; font-size: .8125rem; color: var(--tx2); }
  .luzes strong { color: var(--tx); font-variant-numeric: tabular-nums; }
  .ponto { width: 8px; height: 8px; border-radius: 2px; background: var(--luz); border: 1px solid var(--sil2); }
  .cap { padding: 16px; display: grid; gap: 10px; margin-top: 16px; border-color: var(--ac); }
  .capt { margin: 0; font-size: 1.2rem; text-transform: none; letter-spacing: -.01em; color: var(--tx); }
  .nums { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .nums li { display: grid; font-size: .85rem; color: var(--tx2); } .nums strong { font-size: 1.4rem; color: var(--ac); }
  .prova { display: flex; align-items: center; gap: 14px; padding: 10px 4px; margin-top: 12px; text-decoration: none; color: inherit; min-height: 64px; }
  .num { font-size: 2.2rem; font-weight: 300; letter-spacing: -.04em; font-variant-numeric: tabular-nums; min-width: 3ch; text-align: right; color: var(--ac); }
  .emb { margin-left: auto; color: var(--tx2); flex: none; display: grid; opacity: .8; }
  .lbl { display: grid; font-size: .85rem; color: var(--tx2); border-left: 2px solid var(--c); padding-left: 12px; }
  .lbl strong { color: var(--tx); font-size: .95rem; font-weight: 600; }
  .prog { padding: 20px 4px 4px; }
  .topo { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; color: var(--tx2); font-size: .85rem; font-variant-numeric: tabular-nums; }
  .topo strong { color: var(--tx); font-size: 1.5rem; font-weight: 600; }
  .bar { height: 6px; background: var(--line); border-radius: 99px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--ac); border-radius: 99px; transition: width .5s cubic-bezier(.2,.8,.2,1); }
  .dif { margin-top: 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; font-size: .85rem; color: var(--warn); }
  .dif-bt { margin-top: 4px; min-height: 44px; font-size: .85rem; }
  .lk { color: var(--ac); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; min-height: 44px; }
  .nota { display: block; margin-top: 12px; padding: 4px 0 4px 14px; border-left: 2px solid var(--warn); color: var(--warn); font-size: .9rem; text-decoration: none; font-weight: 500; }
  .nota.alerta { border-left-color: var(--al); color: var(--al); }
  .nota :global(svg), summary :global(svg) { vertical-align: -3px; margin-right: 8px; }
  .nota summary { cursor: pointer; font-weight: 600; min-height: 24px; }
  .nota p, .nota ol { margin: 8px 0 0; color: var(--tx); } .nota ol { padding-left: 20px; }
  .backup p { margin: 0; color: var(--warn); }
  .bk { display: flex; gap: 12px; align-items: center; margin-top: 10px; }
  .bk .pri { flex: 1; }
  .carta { margin: 16px 0 0; padding: 4px 0 4px 14px; border-left: 2px solid var(--ac); display: grid; gap: 6px; }
  .carta p:last-child { font-style: italic; white-space: pre-line; }
  .gr::before { display: none !important; }
  .gr { display: flex; justify-content: space-between; align-items: baseline; margin: 32px 4px 4px; color: var(--tx2); text-align: left; letter-spacing: .14em; }
  .gr .n { font-weight: 500; letter-spacing: 0; text-transform: none; font-variant-numeric: tabular-nums; }
  .lista { list-style: none; padding: 0; }
  .lista > :global(li:last-child) { border-bottom: 1px solid var(--line); }
  .lista > li { border-top: 1px solid var(--line); }
  .linha { display: flex; align-items: center; gap: 2px; }
  .txt { flex: 1; text-align: left; display: grid; padding: 8px 4px; min-height: 56px; align-content: center; }
  .tit { font-weight: 600; }
  .sub { color: var(--tx2); font-size: .85rem; }
  .feito .tit { text-decoration: line-through; text-decoration-thickness: 1px; color: var(--tx2); font-weight: 500; }
  .play { width: 44px; height: 44px; flex: none; border-radius: 50%; display: grid; place-items: center; color: var(--ac); border: 1.5px solid var(--ac); }
  .play svg { fill: currentColor; margin-left: 2px; }
  .play.rodando { background: var(--ac); }
  .onda { width: 12px; height: 12px; border-radius: 50%; background: var(--ac-tx); animation: pisca 1.2s ease-in-out infinite; }
  @keyframes pisca { 50% { opacity: .3; transform: scale(.7); } }
  .det ul { padding-left: 18px; display: grid; gap: 4px; color: var(--tx2); } .det strong, :global(.det) strong { font-size: .8125rem; text-transform: uppercase; letter-spacing: .06em; color: var(--tx2); }
  .dica { padding: 0; display: flex; gap: 10px; align-items: flex-start; color: var(--tx2); } .dica :global(svg) { flex: none; margin-top: 3px; color: var(--ac); }
  label { color: var(--tx2); font-size: .85rem; }
  .link { display: flex; gap: 8px; }
  input { width: 100%; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); }
  .acoes { display: grid; gap: 8px; margin-top: 4px; }
  .pri, .sec { min-height: 48px; border-radius: 14px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; text-decoration: none; padding: 0 14px; }
  .pri { background: var(--ac); color: var(--ac-tx); } .sec { border: 1px solid var(--line); color: var(--tx); }
  .mini { min-height: 44px; flex: none; font-size: .85rem; }
  .notas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 0 4px 10px 46px; }
  .nt { min-height: 44px; border-radius: 12px; border: 1px solid var(--line); font-size: .85rem; font-weight: 600; }
  .nt.dificil { color: var(--al); border-color: color-mix(in srgb, var(--al) 45%, var(--line)); }
  .nt.facil { color: var(--ac); border-color: color-mix(in srgb, var(--ac) 45%, var(--line)); }
  .mini-foto { width: 44px; height: 44px; flex: none; border-radius: 8px; overflow: hidden; border: 1px solid var(--line); }
  .mini-foto img { width: 100%; height: 100%; object-fit: cover; }
  .foto { display: block; width: calc(100% - 46px); margin: 0 0 12px 46px; border-radius: 12px; }
  .antes { margin-top: 20px; padding: 20px 18px; display: grid; gap: 10px; border-color: var(--ac); }
  .antes h1 { max-width: none; font-size: 1.6rem; }
  .antes .acordar { font-size: 1.1rem; }
  .antes .acordar strong { color: var(--ac); font-variant-numeric: tabular-nums; }
  .antes .sub { color: var(--tx2); font-size: .9rem; margin: 0; }
  .foco-sem { margin-top: 12px; padding: 4px 0 4px 14px; border-left: 2px solid var(--ac); display: grid; gap: 2px; font-weight: 600; }
  .lembrete { display: flex; gap: 8px; justify-content: center; align-items: center; color: var(--tx2); font-size: .85rem; margin: 24px 0 0; text-align: center; }
  .tarefa-txt { margin: 0 0 8px; font-size: 1rem; }
  .pre { white-space: pre-wrap; margin: 6px 0 0; }
  .ret { display: grid; gap: 8px; padding: 10px 4px; border-top: 1px solid var(--line); }
  .ret .txt { display: grid; gap: 2px; } .ret .tit { font-weight: 600; } .ret .sub { color: var(--tx2); font-size: .85rem; }
  .rf { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: end; }
  .rf label { display: grid; gap: 4px; font-size: .85rem; color: var(--tx2); }
  .rf input { width: 100%; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); }
  .rf .pri { min-height: 44px; padding: 0 16px; border-radius: 12px; font-weight: 700; background: var(--ac); color: var(--ac-tx); }
  .rf .pri:disabled { opacity: .5; }
</style>
