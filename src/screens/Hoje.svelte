<script>
  import { app, fases, alternarBloco, alternarRevisao } from '../stores/app.svelte.js';
  import { blocosDoDia } from '../lib/planner.js';
  import { faseDoDia, semanaDaFase, totalSemanas, proximaProva, revisaoLeve } from '../lib/phases.js';
  import { vencidas } from '../lib/spaced.js';
  import { diaNome, fmtCurta, fmtBR, fmtMin, weekday } from '../lib/dates.js';
  import { alertasInscricao } from '../lib/alerts.js';
  import Check from '../components/Check.svelte';
  import Icon from '../components/Icon.svelte';
  import { diffDays } from '../lib/dates.js';

  const alertas = $derived(alertasInscricao(app.cfg, app.dia));
  const REV_MIN = 10;
  let aberto = $state(null);
  let assuntos = $state({});

  const fs = $derived(fases());
  const fase = $derived(faseDoDia(fs, app.dia));
  const blocos = $derived(blocosDoDia(app.cfg, fs, app.dia));
  const revs = $derived(vencidas(Object.values(app.reviews), app.dia));
  const prox = $derived(proximaProva(app.cfg, app.dia));
  const leve = $derived(revisaoLeve(app.cfg, app.dia));
  const diag = $derived(blocos.some((b) => b.diagnostico));
  const totalMin = $derived(blocos.reduce((s, b) => s + b.min, 0) + revs.length * REV_MIN);
  const feitoMin = $derived(blocos.reduce((s, b) => s + (app.done[b.id] ? b.min : 0), 0) + revs.filter((r) => r.feita).length * REV_MIN);
  const pct = $derived(totalMin ? feitoMin / totalMin : 0);
  const pendRevs = $derived(revs);
  const FRASES = ['Respeito se constrói em silêncio, bloco a bloco.', 'A cidade dorme. Você estuda.', 'Disciplina é a única família que nunca falha.', 'Pequenas vitórias, todos os dias, constroem um império.', 'Paciência. A aprovação não se apressa, ela se conquista.', 'A noite é longa, mas o plano é maior.', 'Quem aparece todo dia não precisa de sorte.'];
  const frase = $derived(FRASES[diffDays('2026-11-09', app.dia) % FRASES.length]);
  const lembrete = $derived(weekday(app.dia) === 0 || weekday(app.dia) === 3 ? app.cfg.metodos.exercicio : app.cfg.metodos.sono);
</script>

<header>
  <p class="data">{diaNome(app.dia)} · {fmtCurta(app.dia)}</p>
  <h1>{pct >= 1 ? 'Missão cumprida.' : `Bora, ${app.cfg.perfil.nome}.`}</h1>
  <p class="frase">{frase}</p>
  <p class="fase">Fase {fase.numero} · {fase.nome}<span> · semana {semanaDaFase(fase, app.dia)}/{totalSemanas(fase)}</span></p>
</header>

{#if prox}
  <a class="prova" href="#/calendario" style="--c:{prox.concurso.cor}">
    <span class="num">{prox.dias}</span>
    <span class="lbl"><strong>dias para {prox.concurso.nome}{prox.evento.nome ? ` · ${prox.evento.nome}` : ''}</strong>
      <span>{fmtBR(prox.evento.inicio)} · {prox.evento.status}</span></span>
  </a>
{/if}

<section class="prog" aria-label="Progresso do dia">
  <div class="topo"><strong>{Math.round(pct * 100)}%</strong><span>{fmtMin(feitoMin)} de {fmtMin(totalMin)}</span></div>
  <div class="bar" role="progressbar" aria-label="Progresso" aria-valuenow={Math.round(pct * 100)} aria-valuemin="0" aria-valuemax="100"><i style="width:{pct * 100}%"></i></div>
</section>

{#each alertas as a}
  <a class="nota" href="#/calendario"><Icon nome="clock" />Inscrição {a.concurso.nome} fecha {a.dias === 0 ? 'hoje' : a.dias === 1 ? 'amanhã' : `em ${a.dias} dias`}</a>
{/each}
{#if diag}
  <details class="nota">
    <summary><Icon nome="bulb" />{app.cfg.diagnostico.titulo}: leia antes de começar</summary>
    <p>{app.cfg.diagnostico.intro}</p>
    <ol>{#each app.cfg.diagnostico.como as c}<li>{c}</li>{/each}</ol>
  </details>
{/if}
{#if leve}<p class="nota"><Icon nome="moon" />Última semana antes da prova de {leve.nome}: revisão leve. Sem conteúdo novo, durma bem.</p>{/if}

<h2>Hoje</h2>
<ul class="lista card">
  {#each blocos as b (b.id)}
    {@const feito = !!app.done[b.id]}
    <li class:feito>
      <div class="linha">
        <Check {feito} label={`${b.titulo}, ${fmtMin(b.min)}`} onclick={() => alternarBloco(b, assuntos[b.id] ?? '')} />
        <button class="txt" aria-expanded={aberto === b.id} onclick={() => (aberto = aberto === b.id ? null : b.id)}>
          <span class="tit">{b.titulo}</span>
          <span class="sub">{fmtMin(b.min)}{app.done[b.id]?.assunto ? ` · ${app.done[b.id].assunto}` : ''}</span>
        </button>
        <span class="seta" class:aberta={aberto === b.id}><Icon nome="down" /></span>
      </div>
      {#if aberto === b.id}
        <div class="det">
          <p class="dica"><Icon nome="bulb" />{b.dica}</p>
          {#if b.como}<strong>Como fazer</strong><ul>{#each b.como as c}<li>{c}</li>{/each}</ul>{/if}
          {#if b.onde}<strong>Onde achar</strong><ul>{#each b.onde as c}<li>{c}</li>{/each}</ul>{/if}
          {#if b.comAssunto && !feito}
            <label for="a-{b.id}">Assunto estudado (agenda revisões em 1, 7 e 30 dias)</label>
            <input id="a-{b.id}" placeholder="ex.: funções do 2º grau" bind:value={assuntos[b.id]} />
          {/if}
        </div>
      {/if}
    </li>
  {/each}
</ul>

{#if pendRevs.length}
  <h2>Revisões · {pendRevs.filter((r) => !r.feita).length} pendentes</h2>
  <ul class="lista card">
    {#each pendRevs as r (r.id)}
      <li class:feito={r.feita}>
        <div class="linha">
          <Check feito={r.feita} label={`Revisão de ${r.assunto}`} onclick={() => alternarRevisao(r)} />
          <span class="txt"><span class="tit">{r.assunto}</span><span class="sub">{r.materia} · revisão de {r.intervalo} dia{r.intervalo > 1 ? 's' : ''} · {REV_MIN} min</span></span>
        </div>
      </li>
    {/each}
  </ul>
{/if}

<p class="lembrete"><Icon nome={weekday(app.dia) === 0 || weekday(app.dia) === 3 ? 'run' : 'moon'} size={16} />{lembrete}</p>

<style>
  header { padding: 20px 4px 20px; }
  .data { color: var(--tx2); font-size: .8rem; text-transform: uppercase; letter-spacing: .12em; font-weight: 500; }
  h1 { margin-top: 4px; font-size: 1.9rem; font-weight: 700; letter-spacing: -.03em; }
  .frase { margin-top: 6px; color: var(--tx2); font-style: italic; font-size: .95rem; }
  .fase { margin-top: 14px; display: inline-block; padding: 4px 12px; border: 1px solid var(--line); border-radius: 99px; font-size: .8rem; font-weight: 600; color: var(--ac); }
  .fase span { color: var(--tx2); font-weight: 400; }
  .prova { display: flex; align-items: center; gap: 16px; padding: 12px 4px; text-decoration: none; color: inherit; min-height: 64px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .num { font-size: 2.6rem; font-weight: 300; letter-spacing: -.04em; font-variant-numeric: tabular-nums; min-width: 3.2ch; text-align: right; color: var(--tx); }
  .lbl { display: grid; font-size: .8rem; color: var(--tx2); border-left: 3px solid var(--c); padding-left: 12px; }
  .lbl strong { color: var(--tx); font-size: .95rem; font-weight: 600; }
  .prog { padding: 20px 4px 8px; }
  .topo { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; color: var(--tx2); font-size: .85rem; font-variant-numeric: tabular-nums; }
  .topo strong { color: var(--tx); font-size: 1.4rem; font-weight: 600; }
  .bar { height: 4px; background: var(--line); border-radius: 99px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--ac); border-radius: 99px; transition: width .5s ease; }
  .nota { display: block; margin-top: 12px; padding: 12px 16px; border-radius: 14px; background: var(--warn-bg); color: var(--warn); font-size: .9rem; text-decoration: none; font-weight: 500; }
  .nota :global(svg), summary :global(svg) { vertical-align: -3px; margin-right: 8px; }
  .nota summary { cursor: pointer; font-weight: 600; min-height: 24px; }
  .nota p, .nota ol { margin: 8px 0 0; color: var(--tx); } .nota ol { padding-left: 20px; }
  h2 { margin-top: 28px; }
  .lista { list-style: none; padding: 0; overflow: hidden; }
  .lista li + li { border-top: 1px solid var(--line); }
  .lista li { padding: 2px 8px 2px 4px; }
  .linha { display: flex; align-items: center; gap: 4px; }
  .txt { flex: 1; text-align: left; display: grid; padding: 8px 4px; min-height: 52px; align-content: center; }
  .tit { font-weight: 600; transition: color .18s; }
  .sub { color: var(--tx2); font-size: .85rem; }
  .feito .tit { text-decoration: line-through; text-decoration-thickness: 1px; color: var(--tx2); font-weight: 500; }
  .seta { color: var(--tx2); display: grid; width: 32px; place-items: center; transition: transform .2s; pointer-events: none; } .seta.aberta { transform: rotate(180deg); }
  .det { padding: 4px 12px 16px 52px; display: grid; gap: 8px; font-size: .9rem; }
  .det ul { padding-left: 18px; display: grid; gap: 4px; color: var(--tx2); } .det strong { font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; color: var(--ac); }
  .dica { background: var(--ac-bg); padding: 10px 12px; border-radius: 12px; display: flex; gap: 10px; align-items: flex-start; } .dica :global(svg) { flex: none; margin-top: 3px; color: var(--ac); }
  .det label { color: var(--tx2); font-size: .8rem; }
  input { width: 100%; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); }
  .lembrete { display: flex; gap: 8px; justify-content: center; align-items: center; color: var(--tx2); font-size: .8rem; margin: 28px 0 8px; text-align: center; }
</style>
