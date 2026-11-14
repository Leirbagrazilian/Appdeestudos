<script>
  import { slide } from 'svelte/transition';
  import { app, fases, registrarCheckpoint, apagarCheckpoint, salvarKhan, prorrogarZero } from '../stores/app.svelte.js';
  import { serieCheckpoints, checkpointPendente, portaoZero, primeiroSabado } from '../lib/portao.js';
  import { faseDoDia } from '../lib/phases.js';
  import { semanaZero } from '../lib/trilha.js';
  import { fmtBR, addDays } from '../lib/dates.js';
  import { dur, vibrar } from '../lib/prefs.js';
  import { pf } from '../stores/app.svelte.js';

  const c = $derived(app.cfg.checkpoint ?? { questoes: 10, minutos: 30 });
  const serie = $derived(serieCheckpoints(app.cfg, app.checkpoints));
  const pendente = $derived(checkpointPendente(app.cfg, app.checkpoints, app.dia));
  const emZero = $derived(faseDoDia(fases(), app.dia).id === 'zero');
  const semZ = $derived(semanaZero(fases(), app.dia));
  const p = $derived(portaoZero(app.cfg, app.portao, app.checkpoints, app.lacunas));
  const proximoAviso = $derived.by(() => {
    const m = primeiroSabado(app.dia);
    return m >= app.dia ? m : primeiroSabado(addDays(app.dia.slice(0, 7) + '-28', 7));
  });
  const ultimaSemana = $derived(semZ >= 8 || !emZero);

  let form = $state(false), data = $state(app.dia), acertos = $state(null), minutos = $state(c.minutos ?? 30), falta = $state('');
  let khan = $state(app.portao?.khan?.pct ?? '');
  async function salvar(ev) {
    ev.preventDefault();
    if (acertos == null) { falta = 'Diga quantas você acertou.'; vibrar(pf(), 'erro'); return; }
    await registrarCheckpoint({ data, acertos, minutos }); form = false; acertos = null; falta = '';
  }
  const mexer = (n) => { acertos = Math.min(c.questoes, Math.max(0, (acertos ?? 0) + n)); vibrar(pf(), 'toque'); };

  const W = 340, H = 170, P = { l: 34, r: 16, t: 14, b: 26 };
  const X = (i) => P.l + (serie.length < 2 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (serie.length - 1));
  const Y = (v) => P.t + (1 - v / c.questoes) * (H - P.t - P.b);
  const linha = $derived(serie.map((r, i) => `${i ? 'L' : 'M'}${X(i)},${Y(r.acertos)}`).join(' '));
</script>

<header class="pg"><p class="data">Sua evolução</p><h1>Progresso</h1>
  <p class="sub">Todo mês, as mesmas {c.questoes} questões de Matemática da EFOMM do diagnóstico, cronometradas ({c.minutos} min). É a régua do quanto você já avançou.</p></header>

{#if pendente}
  <p class="aviso" role="status"><strong>Checkpoint do mês.</strong> Faça as {c.questoes} questões em {c.minutos} min, sem consulta, e registre o resultado.</p>
{/if}

{#if !form}<button class="pri" onclick={() => (form = true)}>＋ Registrar checkpoint</button>
{:else}
  <form class="card f" onsubmit={salvar} transition:slide={{ duration: dur(220) }}>
    <label>Data<input type="date" bind:value={data} /></label>
    <div class="lin"><span>Acertei (de {c.questoes})</span>
      <span class="step"><button type="button" aria-label="Menos um acerto" onclick={() => mexer(-1)}>−</button><strong>{acertos ?? '–'}</strong><button type="button" aria-label="Mais um acerto" onclick={() => mexer(1)}>+</button></span></div>
    <label>Tempo gasto (min)<input type="number" inputmode="numeric" min="0" bind:value={minutos} /></label>
    {#if falta}<p class="falta" role="alert">{falta}</p>{/if}
    <div class="acoes"><button type="button" class="sec" onclick={() => { form = false; falta = ''; }}>Cancelar</button><button class="pri">Salvar</button></div>
  </form>
{/if}

<h2>Evolução em Matemática</h2>
<section class="card g">
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Acertos no checkpoint de Matemática: {serie.map((r) => `${fmtBR(r.data)}: ${r.acertos} de ${r.feitas}`).join('; ')}">
    {#each [0, 5, 10] as v}<line x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} stroke="var(--line)" /><text x={P.l - 6} y={Y(v) + 4} text-anchor="end" font-size="12" fill="var(--tx2)">{v}</text>{/each}
    <path d={linha} fill="none" stroke="var(--ac)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    {#each serie as r, i}<circle cx={X(i)} cy={Y(r.acertos)} r="4" fill="var(--ac)" /><text x={X(i)} y={H - 6} text-anchor="middle" font-size="12" fill="var(--tx2)">{r.data.slice(8)}/{r.data.slice(5, 7)}</text>{/each}
  </svg>
</section>
<ul class="grupo card">
  {#each [...serie].reverse() as r (r.data)}
    <li class="it"><span class="t"><strong>{r.acertos} de {r.feitas}{r.base ? ' · diagnóstico' : ''}</strong>
      <span class="sub">{fmtBR(r.data)}{r.minutos ? ` · ${r.minutos} min` : ''}</span></span>
      {#if !r.base}<button class="x" aria-label="Apagar checkpoint de {fmtBR(r.data)}" onclick={() => confirm('Apagar este checkpoint?') && apagarCheckpoint(r.data)}>✕</button>{/if}</li>
  {/each}
</ul>
<p class="sub leg">Próximo aviso: {fmtBR(proximoAviso)} (primeiro sábado do mês).</p>

{#if emZero || app.cfg.perfil.extraZero}
  <h2>Portão da Fase 0</h2>
  <section class="card pt">
    <p class="sub">Para passar para a Fase 1 (ensino médio) você precisa das duas coisas:</p>
    <p class="cond" class:ok={p.khan.ok}><span aria-hidden="true">{p.khan.ok ? '✓' : '○'}</span>
      <span>Teste de saída do Khan (9º ano) com {p.khan.min}% ou mais{p.khan.valor != null ? `: você fez ${p.khan.valor}%` : ''}</span></p>
    <label>Seu resultado no teste de saída (%)
      <input type="number" inputmode="numeric" min="0" max="100" bind:value={khan} onchange={() => salvarKhan(khan === '' ? null : +khan)} /></label>
    <p class="cond" class:ok={p.checkpoint.ok}><span aria-hidden="true">{p.checkpoint.ok ? '✓' : '○'}</span>
      <span>Checkpoint de Matemática melhor que o diagnóstico ({p.checkpoint.base?.acertos ?? 0} de {c.questoes}) e com pelo menos {p.checkpoint.min} acertos{p.checkpoint.ultimo ? `: último ${p.checkpoint.ultimo.acertos} de ${p.checkpoint.ultimo.feitas}` : ''}</span></p>
    {#if p.ok}
      <p class="aviso ok" role="status"><strong>Portão aberto.</strong> Quando a Fase 0 terminar, a Fase 1 começa sozinha.</p>
    {:else if ultimaSemana}
      <p class="aviso" role="status"><strong>Ainda não passou.</strong> Dá para prorrogar a Fase 0 em {p.extras} semanas, só com os tópicos fracos{p.fracos.length ? ` (${p.fracos.length} agora)` : ''}.</p>
      <button class="sec" onclick={() => confirm(`Prorrogar a Fase 0 em ${p.extras} semanas?`) && prorrogarZero()}>Prorrogar a Fase 0 em {p.extras} semanas</button>
    {:else}
      <p class="sub">Você decide na semana 8, quando o teste de saída e o último checkpoint estiverem feitos.</p>
    {/if}
  </section>
{/if}

<style>
  .pri, .sec { min-height: 48px; border-radius: 14px; font-weight: 700; width: 100%; }
  .pri { background: var(--ac); color: var(--ac-tx); margin-top: 12px; } .sec { border: 1px solid var(--line); font-weight: 600; margin-top: 4px; }
  .aviso { margin-top: 12px; padding: 12px 16px; border-radius: 14px; background: var(--warn-bg); color: var(--warn); font-size: .9rem; }
  .aviso.ok { background: var(--ac-bg); color: var(--tx); }
  .f { padding: 16px; display: grid; gap: 14px; margin-top: 12px; }
  label { display: grid; gap: 4px; font-size: .9rem; color: var(--tx2); }
  input { width: 100%; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); }
  .lin { display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 52px; }
  .step { display: inline-flex; align-items: center; gap: 10px; }
  .step button { width: 48px; height: 48px; border-radius: 14px; border: 1px solid var(--line); font-size: 1.4rem; font-weight: 700; }
  .step strong { min-width: 2.2ch; text-align: center; font-size: 1.5rem; font-variant-numeric: tabular-nums; color: var(--ac); }
  .acoes { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; } .acoes .pri { margin: 0; }
  .falta { color: var(--warn); font-weight: 600; }
  h2 { margin-top: 24px; }
  .g { padding: 12px; } svg { width: 100%; height: auto; }
  .grupo { margin-top: 12px; }
  .it { display: flex; align-items: center; padding: 8px 8px 8px 16px; min-height: 60px; } .t { flex: 1; display: grid; }
  .x { width: 44px; height: 44px; color: var(--tx2); }
  .leg { margin: 8px 4px 0; }
  .pt { padding: 16px; display: grid; gap: 12px; margin-top: 12px; }
  .cond { display: flex; gap: 10px; align-items: flex-start; } .cond span:first-child { color: var(--tx2); font-weight: 700; } .cond.ok span:first-child { color: var(--ac); }
</style>
