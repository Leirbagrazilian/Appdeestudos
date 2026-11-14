<script>
  import { slide } from 'svelte/transition';
  import { app, fases, ajustes, fazerBackup, adiarLembreteBackup, alternarBloco, alternarRevisao, avaliarRevisao, adiar, diaDificil, marcarCumprido, iniciarFoco, salvarCfg, verCapitulo } from '../stores/app.svelte.js';
  import { blocosDaSemana } from '../lib/planner.js';
  import { faseDoDia, semanaDaFase, totalSemanas, proximaProva, revisaoLeve } from '../lib/phases.js';
  import { revisoesDoDia } from '../lib/spaced.js';
  import { diaNome, fmtCurta, fmtBR, fmtMin, addDays, startOfWeek, diffDays } from '../lib/dates.js';
  import { alertasInscricao, conflitosProvas } from '../lib/alerts.js';
  import { planoDoBloco } from '../lib/foco.js';
  import { tarefasDoDia } from '../lib/tarefas.js';
  import Registro from '../components/Registro.svelte';
  import Tarefa from '../components/Tarefa.svelte';
  import { dur } from '../lib/prefs.js';
  import { precisaBackup } from '../lib/erros.js';
  import { focoDaSemana } from '../lib/revisao.js';
  import { travados as listaTravados } from '../lib/dominio.js';
  import { checkpointPendente, portaoZero } from '../lib/portao.js';
  import { semanaZero } from '../lib/trilha.js';
  import Check from '../components/Check.svelte';
  import Icon from '../components/Icon.svelte';
  import Farol from '../components/Farol.svelte';
  import Esquadrilha from '../components/Esquadrilha.svelte';
  import Base from '../components/Base.svelte';
  import Emblema from '../components/Emblema.svelte';
  import { fraseDoDia } from '../lib/frases.js';

  const REV_MIN = 10;
  let aberto = $state(null), assuntos = $state({}), verCarta = $state(false), fotoAberta = $state(null);
  let hora = $state(new Date().getHours());
  $effect(() => { const i = setInterval(() => (hora = new Date().getHours()), 60000); return () => clearInterval(i); });

  const EMB = { en: 'en', efomm: 'efomm', esa: 'esa', ita: 'ita', ime: 'ime' }; // emblema do concurso na contagem regressiva
  const fs = $derived(fases());
  const fase = $derived(faseDoDia(fs, app.dia));
  // a semana é montada uma vez (e não a cada bloco marcado): serve à lista de hoje e à cidade
  const semana = $derived(blocosDaSemana(app.cfg, fs, startOfWeek(app.dia), ajustes()));
  const blocos = $derived(semana[diffDays(startOfWeek(app.dia), app.dia)]);
  // tarefa exata de cada bloco de estudo: tópico da Trilha, vídeo, páginas, exercícios e questões
  const tarefas = $derived(tarefasDoDia(app.cfg, blocos, { lacunas: app.lacunas, leitura: app.leitura, done: app.done, cotasDia: app.cotas[app.dia] ?? {}, faseId: fase.id, dominio: app.dominio }));
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
  // modo domínio (Fase 0): tópicos travados, checkpoint do mês e o portão da última semana
  const travados = $derived(listaTravados(app.dominio, app.lacunas));
  const cpPendente = $derived(!diag && checkpointPendente(app.cfg, app.checkpoints, app.dia));
  const portaoAberto = $derived(fase.id === 'zero' && semanaZero(fs, app.dia) >= 8 && !portaoZero(app.cfg, app.portao, app.checkpoints, app.lacunas).ok);
  const dificil = $derived(!!app.dificeis[app.dia]);
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

  // Campanha: quando uma fase termina, mostra o resumo dela uma vez.
  const capitulo = $derived.by(() => {
    const f = fs.find((x) => x.fim < app.dia && x.inicio <= app.dia && !app.vistos.capitulos[x.id]);
    if (!f || !Object.keys(app.done).length) return null;
    const dentro = (d) => d >= f.inicio && d <= f.fim;
    const regs = Object.entries(app.done).filter(([k, v]) => dentro(v.dia ?? k.slice(0, 10))).map(([, v]) => v);
    return { f, blocos: regs.length, horas: Math.round(regs.reduce((s, v) => s + v.min, 0) / 60),
      questoes: regs.reduce((s, v) => s + (v.questoes?.feitas ?? 0), 0),
      erros: Object.values(app.errors).filter((e) => dentro(e.dia)).length,
      simulados: Object.values(app.exams).filter((e) => dentro(e.data)).length };
  });

  // Lembrete de backup: 7 dias depois do último (ou nunca feito depois de 3 dias de uso).
  const diasDeUso = $derived(new Set(Object.entries(app.done).map(([k, v]) => v.dia ?? k.slice(0, 10))).size);
  const lembrarBackup = $derived(app.lembreteAdiado !== app.dia && precisaBackup(app.ultimoBackup, app.dia, diasDeUso));
  const focoSemana = $derived(focoDaSemana(app.revisoes, app.dia));
  const noite = $derived(hora >= 18 || hora < 6);
  const tarde = $derived(hora >= 22 || hora < 4);
  const mostrarCarta = $derived(verCarta || (app.cfg.carta && (dificil || (hora >= 19 && pct < 0.3))));
  // Frase por contexto (noite, dia cumprido, dia mínimo, bloco feito, prova próxima, domingo, início), estável ao longo do dia.
  const feitos = $derived(blocos.filter((b) => app.done[b.id]).length);
  const frase = $derived(fraseDoDia(app.cfg.frases, { hora, pct, feitos, dificil, diaSemana: new Date(app.dia + 'T12:00').getDay(), diasProva: prox?.dias ?? null }, app.dia) || 'Disciplina hoje, farda amanhã.');

  function comecar(b) {
    if (app.timer && app.timer.id !== b.id && !confirm(`Já há um cronômetro de ${app.timer.titulo}. Trocar por ${b.titulo}?`)) return;
    if (!app.timer || app.timer.id !== b.id) iniciarFoco({ ...b, tarefa: tarefas[b.id] ?? null });
    location.hash = '#/foco';
  }
  const fotoDe = (r) => (r.origem?.startsWith('erro:') ? app.errors[r.origem.slice(5)]?.foto : null);
  const descSessoes = (b) => { const p = planoDoBloco(b, app.cfg.foco); return p.sessoes > 1 ? `${p.sessoes} × ${p.len} min` : fmtMin(b.min); };
</script>

<header>
  <Farol {pct} {noite} />{#if pct >= 1}<Esquadrilha festa />{/if}
  <p class="data">{diaNome(app.dia)} · {fmtCurta(app.dia)}</p>
  <h1>{pct >= 1 ? 'Missão cumprida.' : `Avante, ${app.cfg.perfil.nome}.`}</h1>
  <p class="frase">{frase}</p>
  <p class="fase">Fase {fase.numero} · {fase.nome}<span> · semana {semanaDaFase(fase, app.dia)}/{totalSemanas(fase)}</span></p>
  <Base total={base.total} acesas={base.acesas} {noite} />
  <p class="luzes"><span class="ponto" aria-hidden="true"></span>Base da semana: <strong>{base.acesas}</strong> de {base.total} luzes acesas</p>
</header>

{#if capitulo}
  <section class="card cap entra" aria-label="Campanha concluída">
    <p class="data">Campanha concluída</p>
    <h2 class="capt">Fase {capitulo.f.numero} · {capitulo.f.nome}</h2>
    <ul class="nums">
      <li><strong>{capitulo.horas}h</strong>de estudo</li><li><strong>{capitulo.blocos}</strong>blocos</li>
      <li><strong>{capitulo.questoes}</strong>questões</li><li><strong>{capitulo.erros}</strong>erros registrados</li>
    </ul>
    <p class="sub">Próxima campanha: {fase.nome}. {fase.foco}</p>
    <button class="pri" onclick={() => verCapitulo(capitulo.f.id)}>Seguir para a próxima campanha</button>
  </section>
{/if}

{#if prox}
  <a class="prova" href="#/calendario" style="--c:{prox.concurso.cor}">
    <span class="num">{prox.dias}</span>
    <span class="lbl"><strong>dias para {prox.concurso.nome}{prox.evento.nome ? ` · ${prox.evento.nome}` : ''}</strong>
      <span>{fmtBR(prox.evento.inicio)} · {prox.evento.status}</span></span>
    <span class="emb" aria-hidden="true"><Emblema nome={EMB[prox.concurso.id] ?? 'estrela'} size={40} /></span>
  </a>
{/if}

<section class="prog" aria-label="Progresso do dia">
  <div class="topo"><strong>{Math.round(pct * 100)}%</strong><span>{fmtMin(feitoMin)} de {fmtMin(totalMin)}</span></div>
  <div class="bar" role="progressbar" aria-label="Progresso" aria-valuenow={Math.round(pct * 100)} aria-valuemin="0" aria-valuemax="100"><i style="width:{pct * 100}%"></i></div>
  <p class="sr" aria-live="polite">{Math.round(pct * 100)}% do dia concluído</p>
  {#if dificil}
    <p class="dif"><Icon nome="moon" size={16} />Dia mínimo: 45 min de questões e as revisões vencidas. Isso conta como dia cumprido.
      <button class="lk" onclick={() => diaDificil(app.dia, false)}>Voltar ao dia completo</button></p>
  {:else if pct < 1 && blocos.length > 2}
    <button class="lk dif-bt" onclick={() => diaDificil(app.dia, true)}>Dia corrido? Fazer só o dia mínimo (45 min)</button>
  {/if}
</section>

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
  <a class="nota" href="#/progresso"><Icon nome="clock" />Última semana da Fase 0: faça o teste de saída do Khan e o checkpoint para abrir o portão.</a>
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

<h2>Hoje</h2>
<ul class="lista card">
  {#each blocos as b (b.id)}
    {@const feito = !!app.done[b.id]}
    {@const rodando = app.timer?.id === b.id}
    {@const tarefa = tarefas[b.id]}
    <li class:feito>
      <div class="linha">
        <Check {feito} label={`${b.titulo}, ${fmtMin(b.min)}`} onclick={() => alternarBloco(b, assuntos[b.id] ?? '', tarefas[b.id])} />
        <button class="txt" aria-expanded={aberto === b.id} onclick={() => (aberto = aberto === b.id ? null : b.id)}>
          <span class="tit">{tituloDe(b)}</span>
          <span class="sub">{b.ini ? `${b.ini}–${b.fim} · ` : ''}{feito ? `${fmtMin(app.done[b.id].min)} feitos` : descSessoes(b)}{app.done[b.id]?.questoes ? ` · ${app.done[b.id].questoes.acertos}/${app.done[b.id].questoes.feitas} questões` : ''}{app.done[b.id]?.assunto ? ` · ${app.done[b.id].assunto}` : ''}{b.adiadoDe ? ` · veio de ${diaNome(b.adiadoDe)}` : ''}</span>
        </button>
        {#if !feito}
          <button class="play" class:rodando aria-label={rodando ? `Abrir cronômetro de ${b.titulo}` : `Começar cronômetro de ${b.titulo}`} onclick={() => comecar(b)}>
            {#if rodando}<span class="onda" aria-hidden="true"></span>{:else}<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" /></svg>{/if}
          </button>
        {/if}
        <span class="seta" class:aberta={aberto === b.id}><Icon nome="down" /></span>
      </div>
      {#if aberto === b.id}
        <div class="det" transition:slide={{ duration: dur(220) }}>
          <Tarefa {tarefa} materia={b.materia} />
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
        </div>
      {/if}
    </li>
  {/each}
</ul>

{#if revs.length}
  {@const pend = revs.filter((r) => !r.feita).length}
  <h2>Revisões · {pend} {pend === 1 ? 'pendente' : 'pendentes'}</h2>
  <ul class="lista card">
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

{#if bRegistro}<Registro b={bRegistro} tarefa={tarefas[bRegistro.id] ?? null} soErros={!!app.registroAberto?.soErros} />{/if}

<p class="lembrete">
  {#if app.cfg.carta}<button class="lk" onclick={() => (verCarta = !verCarta)}>{verCarta ? 'Fechar minha carta' : 'Ler minha carta'}</button>
  {:else}<a class="lk" href="#/ajustes">Escreva sua carta: por que você quer a farda?</a>{/if}
</p>

<style>
  header { padding: 20px 4px 18px; position: relative; }
  header > :global(*:not(.farol):not(.esquadrilha)) { position: relative; }
  .data { color: var(--ac2); font-size: .8125rem; text-transform: uppercase; letter-spacing: .14em; font-weight: 600; }
  h1 { margin-top: 4px; font-size: 1.9rem; font-weight: 800; letter-spacing: -.03em; max-width: calc(100% - 104px); }
  .frase { margin-top: 8px; padding-left: 12px; border-left: 2px solid var(--ac); color: var(--tx); font-size: .95rem; line-height: 1.4; max-width: min(32ch, calc(100% - 112px)); min-height: 2.8em; text-wrap: pretty; }
  .fase { margin-top: 14px; display: inline-block; background: var(--bg); padding: 4px 12px; border: 1px solid var(--line); border-radius: 99px; font-size: .8125rem; font-weight: 600; color: var(--ac); }
  .fase span { color: var(--tx2); font-weight: 400; }
  .luzes { margin-top: 10px; display: flex; align-items: center; gap: 8px; font-size: .8125rem; color: var(--tx2); }
  .luzes strong { color: var(--ac); }
  .luzes strong { font-variant-numeric: tabular-nums; }
  .ponto { width: 8px; height: 8px; border-radius: 2px; background: var(--luz); box-shadow: 0 0 6px var(--brilho); border: 1px solid var(--sil2); }
  .cap { padding: 16px; display: grid; gap: 10px; margin-bottom: 12px; border-color: var(--ac); }
  .capt { margin: 0; font-size: 1.2rem; text-transform: none; letter-spacing: -.01em; color: var(--tx); }
  .nums { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .nums li { display: grid; font-size: .85rem; color: var(--tx2); } .nums strong { font-size: 1.4rem; color: var(--ac); }
  .prova { display: flex; align-items: center; gap: 16px; padding: 12px 4px; text-decoration: none; color: inherit; min-height: 64px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .num { font-size: 2.6rem; font-weight: 300; letter-spacing: -.04em; font-variant-numeric: tabular-nums; min-width: 3.2ch; text-align: right; color: var(--ac); }
  .emb { margin-left: auto; color: var(--ac); flex: none; display: grid; }
  .lbl { display: grid; font-size: .85rem; color: var(--tx2); border-left: 3px solid var(--c); padding-left: 12px; }
  .lbl strong { color: var(--tx); font-size: .95rem; font-weight: 600; }
  .prog { padding: 20px 4px 8px; }
  .topo { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; color: var(--tx2); font-size: .85rem; font-variant-numeric: tabular-nums; }
  .topo strong { color: var(--ac); font-size: 1.4rem; font-weight: 600; }
  .bar { height: 6px; background: var(--line); border-radius: 99px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--ac); border-radius: 99px; transition: width .5s cubic-bezier(.2,.8,.2,1); box-shadow: 0 0 10px var(--brilho); }
  .dif { margin-top: 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; font-size: .85rem; color: var(--warn); }
  .dif-bt { margin-top: 6px; min-height: 44px; font-size: .85rem; }
  .lk { color: var(--ac); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; min-height: 44px; }
  .nota { display: block; margin-top: 12px; padding: 12px 16px; border-radius: 14px; background: var(--warn-bg); color: var(--warn); font-size: .9rem; text-decoration: none; font-weight: 500; }
  .nota.alerta { background: var(--al-bg); color: var(--al); box-shadow: inset 3px 0 0 var(--al); }
  .nota :global(svg), summary :global(svg) { vertical-align: -3px; margin-right: 8px; }
  .nota summary { cursor: pointer; font-weight: 600; min-height: 24px; }
  .nota p, .nota ol { margin: 8px 0 0; color: var(--tx); } .nota ol { padding-left: 20px; }
  .backup p { margin: 0; color: var(--warn); }
  .bk { display: flex; gap: 12px; align-items: center; margin-top: 10px; }
  .bk .pri { flex: 1; }
  .carta { margin: 12px 0 0; padding: 16px; border-left: 3px solid var(--ac); background: var(--ac-bg); border-radius: 0 14px 14px 0; display: grid; gap: 6px; }
  .carta p:last-child { font-style: italic; white-space: pre-line; }
  h2 { margin-top: 28px; }
  .lista { list-style: none; padding: 0; overflow: hidden; }
  .lista li + li { border-top: 1px solid var(--line); }
  .lista li { padding: 2px 8px 2px 4px; }
  .linha { display: flex; align-items: center; gap: 4px; }
  .txt { flex: 1; text-align: left; display: grid; padding: 8px 4px; min-height: 52px; align-content: center; }
  .tit { font-weight: 600; transition: color .18s; }
  .sub { color: var(--tx2); font-size: .85rem; }
  .feito .tit { text-decoration: line-through; text-decoration-thickness: 1px; color: var(--tx2); font-weight: 500; }
  .play { width: 44px; height: 44px; flex: none; border-radius: 50%; display: grid; place-items: center; color: var(--ac); border: 1.5px solid var(--ac); }
  .play svg { fill: currentColor; margin-left: 2px; }
  .play.rodando { background: var(--ac); }
  .onda { width: 12px; height: 12px; border-radius: 50%; background: var(--ac-tx); animation: pisca 1.2s ease-in-out infinite; }
  @keyframes pisca { 50% { opacity: .3; transform: scale(.7); } }
  .seta { color: var(--tx2); display: grid; width: 28px; place-items: center; transition: transform .22s ease; pointer-events: none; } .seta.aberta { transform: rotate(180deg); }
  .det { padding: 4px 8px 16px 48px; display: grid; gap: 8px; font-size: .9rem; overflow: hidden; }
  .det ul { padding-left: 18px; display: grid; gap: 4px; color: var(--tx2); } .det strong { font-size: .8125rem; text-transform: uppercase; letter-spacing: .06em; color: var(--ac); }
  .dica { background: var(--ac-bg); padding: 10px 12px; border-radius: 12px; display: flex; gap: 10px; align-items: flex-start; } .dica :global(svg) { flex: none; margin-top: 3px; color: var(--ac); }
  .det label { color: var(--tx2); font-size: .85rem; }
  .link { display: flex; gap: 8px; }
  input { width: 100%; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); }
  .acoes { display: grid; gap: 8px; margin-top: 4px; }
  .pri, .sec { min-height: 48px; border-radius: 14px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; text-decoration: none; padding: 0 14px; }
  .pri { background: var(--ac); color: var(--ac-tx); } .sec { border: 1px solid var(--line); color: var(--tx); }
  .mini { min-height: 44px; flex: none; font-size: .85rem; }
  .notas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 0 4px 10px 48px; }
  .nt { min-height: 44px; border-radius: 12px; border: 1px solid var(--line); font-size: .85rem; font-weight: 600; }
  .nt.dificil { color: var(--al); border-color: color-mix(in srgb, var(--al) 45%, var(--line)); }
  .nt.facil { color: var(--ac); border-color: color-mix(in srgb, var(--ac) 45%, var(--line)); }
  .mini-foto { width: 44px; height: 44px; flex: none; border-radius: 8px; overflow: hidden; border: 1px solid var(--line); }
  .mini-foto img { width: 100%; height: 100%; object-fit: cover; }
  .foto { display: block; width: calc(100% - 48px); margin: 0 0 12px 48px; border-radius: 12px; }
  .foco-sem { margin-top: 12px; padding: 12px 16px; border-left: 3px solid var(--ac2); background: var(--ac-bg); border-radius: 0 14px 14px 0; display: grid; gap: 2px; font-weight: 600; }
  .lembrete { display: flex; gap: 8px; justify-content: center; align-items: center; color: var(--tx2); font-size: .85rem; margin: 20px 0 0; text-align: center; }
</style>
