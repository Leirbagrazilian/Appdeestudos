<script>
  import { app, fases, alternarBloco, alternarRevisao } from '../stores/app.svelte.js';
  import { blocosDoDia } from '../lib/planner.js';
  import { faseDoDia, semanaDaFase, totalSemanas, proximaProva, revisaoLeve } from '../lib/phases.js';
  import { vencidas } from '../lib/spaced.js';
  import { diaNome, fmtCurta, fmtBR, fmtMin, weekday } from '../lib/dates.js';
  import { alertasInscricao } from '../lib/alerts.js';
  import Check from '../components/Check.svelte';

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
  const lembrete = $derived(weekday(app.dia) === 0 || weekday(app.dia) === 3 ? app.cfg.metodos.exercicio : app.cfg.metodos.sono);
</script>

<header>
  <p class="muted">{diaNome(app.dia)}, {fmtCurta(app.dia)}</p>
  <h1>{pct >= 1 ? 'Dia cumprido. Descanse!' : `Bora, ${app.cfg.perfil.nome}`}</h1>
  <p class="chip"><span class="dot"></span>Fase {fase.numero} · {fase.nome} <span class="muted">· semana {semanaDaFase(fase, app.dia)} de {totalSemanas(fase)}</span></p>
</header>

{#if prox}
  <a class="card prova" href="#/calendario" style="--c:{prox.concurso.cor}">
    <span class="num">{prox.dias}</span>
    <span><strong>dias para {prox.concurso.nome}{prox.evento.nome ? ` (${prox.evento.nome})` : ''}</strong><br />
      <span class="muted">{fmtBR(prox.evento.inicio)} · data {prox.evento.status}</span></span>
  </a>
{/if}

<section class="card prog" aria-label="Progresso do dia">
  <div class="topo"><strong>{Math.round(pct * 100)}%</strong><span class="muted">{fmtMin(feitoMin)} de {fmtMin(totalMin)}</span></div>
  <div class="bar" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin="0" aria-valuemax="100"><i style="width:{pct * 100}%"></i></div>
</section>

{#each alertas as a}<a class="card aviso" href="#/calendario">⏰ Inscrição {a.concurso.nome} fecha {a.dias === 0 ? 'hoje' : a.dias === 1 ? 'amanhã' : `em ${a.dias} dias`}</a>{/each}

{#if diag}
  <details class="card aviso">
    <summary>{app.cfg.diagnostico.titulo}: leia antes de começar</summary>
    <p>{app.cfg.diagnostico.intro}</p>
    <ol>{#each app.cfg.diagnostico.como as c}<li>{c}</li>{/each}</ol>
  </details>
{/if}
{#if leve}<p class="card aviso leve">Última semana antes da prova de {leve.nome}: revisão leve. Sem conteúdo novo, durma bem.</p>{/if}

<h2>Estudo de hoje</h2>
<ul class="lista">
  {#each blocos as b (b.id)}
    {@const feito = !!app.done[b.id]}
    <li class="card item" class:feito>
      <div class="linha">
        <Check {feito} label={`${b.titulo}, ${fmtMin(b.min)}`} onclick={() => alternarBloco(b, assuntos[b.id] ?? '')} />
        <button class="txt" aria-expanded={aberto === b.id} onclick={() => (aberto = aberto === b.id ? null : b.id)}>
          <span class="tit">{b.titulo}</span>
          <span class="muted">{fmtMin(b.min)}{app.done[b.id]?.assunto ? ` · ${app.done[b.id].assunto}` : ''}</span>
        </button>
      </div>
      {#if aberto === b.id}
        <div class="det">
          <p class="dica">💡 {b.dica}</p>
          {#if b.como}<strong>Como fazer</strong><ul>{#each b.como as c}<li>{c}</li>{/each}</ul>{/if}
          {#if b.onde}<strong>Onde achar</strong><ul>{#each b.onde as c}<li>{c}</li>{/each}</ul>{/if}
          {#if b.comAssunto && !feito}
            <label class="muted" for="a-{b.id}">Assunto estudado (agenda revisões em 1, 7 e 30 dias)</label>
            <input id="a-{b.id}" placeholder="ex.: funções do 2º grau" bind:value={assuntos[b.id]} />
          {/if}
        </div>
      {/if}
    </li>
  {/each}
</ul>

{#if pendRevs.length}
  <h2>Revisões vencidas ({pendRevs.filter((r) => !r.feita).length})</h2>
  <ul class="lista">
    {#each pendRevs as r (r.id)}
      <li class="card item" class:feito={r.feita}>
        <div class="linha">
          <Check feito={r.feita} label={`Revisão de ${r.assunto}`} onclick={() => alternarRevisao(r)} />
          <span class="txt"><span class="tit">{r.assunto}</span><span class="muted">{r.materia} · revisão de {r.intervalo} dia{r.intervalo > 1 ? 's' : ''} · {REV_MIN} min</span></span>
        </div>
      </li>
    {/each}
  </ul>
{/if}

<p class="muted lembrete">🌙 {lembrete}</p>

<style>
  header { padding: 8px 4px 16px; }
  .chip { display: inline-flex; gap: 8px; align-items: center; margin-top: 8px; font-weight: 500; font-size: .9rem; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--ac); }
  .prova { display: flex; gap: 16px; align-items: center; padding: 16px; text-decoration: none; color: inherit; border-left: 6px solid var(--c); margin-bottom: 12px; min-height: 44px; }
  .num { font-size: 2.25rem; font-weight: 700; color: var(--c); font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
  :global(:root[data-x]) .num { color: inherit; }
  @media (prefers-color-scheme: dark) { .num { filter: brightness(1.6); } }
  .prog { padding: 16px; }
  .topo { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
  .topo strong { font-size: 1.25rem; }
  .bar { height: 10px; background: var(--line); border-radius: 99px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--ac); border-radius: 99px; transition: width .5s ease; }
  a.aviso { display: block; text-decoration: none; font-weight: 600; }
  .aviso { padding: 12px 16px; margin-top: 12px; background: var(--warn-bg); color: var(--warn); border-color: transparent; font-size: .9rem; }
  .aviso summary { font-weight: 600; cursor: pointer; min-height: 24px; }
  .aviso p, .aviso ol { margin: 8px 0 0; } .aviso ol { padding-left: 20px; }
  .lista { list-style: none; padding: 0; display: grid; gap: 8px; }
  .item { padding: 4px 8px; }
  .linha { display: flex; align-items: center; gap: 4px; }
  .txt { flex: 1; text-align: left; display: grid; padding: 8px 4px; min-height: 48px; align-content: center; }
  .tit { font-weight: 600; transition: color .2s; }
  .feito .tit { text-decoration: line-through; color: var(--tx2); }
  .det { padding: 4px 12px 16px 52px; display: grid; gap: 8px; font-size: .9rem; }
  .det ul { padding-left: 18px; display: grid; gap: 4px; }
  .dica { background: var(--ac-bg); padding: 8px 12px; border-radius: 12px; }
  input { width: 100%; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); }
  .lembrete { text-align: center; margin: 24px 0 8px; }
</style>
