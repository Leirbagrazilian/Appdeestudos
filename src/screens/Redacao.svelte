<script>
  import { slide } from 'svelte/transition';
  import { app, addRedacao, delRedacao, pf } from '../stores/app.svelte.js';
  import { COMPETENCIAS, NIVEIS_RED, totalRedacao } from '../lib/erros.js';
  import { fmtBR } from '../lib/dates.js';
  import { dur, vibrar } from '../lib/prefs.js';

  const CHECK = [
    'Tese clara já na introdução',
    'Dois argumentos, cada um com repertório (dado, lei, autor, fato histórico)',
    'Conectivos ligando parágrafos e frases',
    'Proposta de intervenção completa: agente, ação, meio/modo, finalidade e detalhamento',
    'Respeito aos direitos humanos',
    'Entre 7 e 30 linhas, sem fugir do tema',
  ];
  let feitos = $state({});
  let form = $state(false), data = $state(app.dia), tema = $state(''), notas = $state([null, null, null, null, null]), obs = $state('');
  let treme = $state(false), falta = $state('');

  const lista = $derived(Object.values(app.redacoes ?? {}).sort((a, b) => a.data.localeCompare(b.data)));
  const parcial = $derived(notas.reduce((a, b) => a + (b ?? 0), 0));
  const medias = $derived(COMPETENCIAS.map((_, i) => (lista.length ? lista.reduce((s, r) => s + (r.notas[i] ?? 0), 0) / lista.length : 0)));
  const pior = $derived(lista.length ? medias.indexOf(Math.min(...medias)) : -1);

  async function salvar(ev) {
    ev.preventDefault();
    if (notas.some((n) => n == null)) {
      falta = 'Escolha a nota das 5 competências.'; vibrar(pf(), 'erro');
      treme = false; requestAnimationFrame(() => (treme = true)); return;
    }
    await addRedacao({ data, tema: tema.trim(), notas: [...notas], obs: obs.trim() });
    tema = ''; obs = ''; notas = [null, null, null, null, null]; falta = ''; form = false;
  }

  const W = 340, H = 170, P = { l: 40, r: 16, t: 14, b: 26 };
  const X = (i) => P.l + (lista.length < 2 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (lista.length - 1));
  const Y = (v) => P.t + (1 - v / 1000) * (H - P.t - P.b);
  const linha = $derived(lista.map((r, i) => `${i ? 'L' : 'M'}${X(i)},${Y(totalRedacao(r))}`).join(' '));
</script>

<header class="pg"><p class="data">Toda semana</p><h1>Redação</h1>
  <p class="sub">Correção no modelo do ENEM (5 competências, até 1000). Para a Escola Naval, acompanhe o total e as observações.</p></header>

<details class="card check">
  <summary>Antes de entregar: checklist ({Object.values(feitos).filter(Boolean).length}/{CHECK.length})</summary>
  <ul>
    {#each CHECK as c, i}
      <li><label><input type="checkbox" bind:checked={feitos[i]} /> {c}</label></li>
    {/each}
  </ul>
</details>

{#if !form}<button class="pri" onclick={() => (form = true)}>＋ Registrar redação corrigida</button>
{:else}
  <form class="card f" class:treme onsubmit={salvar} onanimationend={() => (treme = false)} transition:slide={{ duration: dur(220) }}>
    <div class="duas">
      <label>Data<input type="date" bind:value={data} /></label>
      <label>Tema<input placeholder="ex.: desafios da mobilidade urbana" bind:value={tema} /></label>
    </div>
    {#each COMPETENCIAS as [c, nome], i}
      <fieldset>
        <legend><strong>{c}</strong> <span class="sub">{nome}</span></legend>
        <div class="seg" role="radiogroup" aria-label="Nota de {c}">
          {#each NIVEIS_RED as n}<button type="button" role="radio" aria-checked={notas[i] === n} class:on={notas[i] === n} onclick={() => { notas[i] = n; vibrar(pf(), 'toque'); }}>{n}</button>{/each}
        </div>
      </fieldset>
    {/each}
    <p class="total">Total: <strong>{parcial}</strong> / 1000</p>
    <label>O que melhorar na próxima<textarea rows="2" placeholder="ex.: proposta sem detalhamento; repertório genérico" bind:value={obs}></textarea></label>
    {#if falta}<p class="falta" role="alert">{falta}</p>{/if}
    <div class="acoes"><button type="button" class="sec" onclick={() => { form = false; falta = ''; }}>Cancelar</button><button class="pri">Salvar</button></div>
  </form>
{/if}

{#if lista.length}
  <h2>Evolução</h2>
  <section class="card g">
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Evolução da nota total das redações">
      {#each [0, 250, 500, 750, 1000] as v}<line x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} stroke="var(--line)" /><text x={P.l - 6} y={Y(v) + 4} text-anchor="end" font-size="12" fill="var(--tx2)">{v}</text>{/each}
      <path d={linha} fill="none" stroke="var(--ac)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      {#each lista as r, i}<circle cx={X(i)} cy={Y(totalRedacao(r))} r="4" fill="var(--ac)" /><text x={X(i)} y={H - 6} text-anchor="middle" font-size="12" fill="var(--tx2)">{r.data.slice(8)}/{r.data.slice(5, 7)}</text>{/each}
    </svg>
  </section>

  <h2>Média por competência</h2>
  <section class="card comp">
    {#each COMPETENCIAS as [c, nome], i}
      <div class="lin" class:pior={i === pior}><span title={nome}>{c}</span><div class="b"><i style="width:{medias[i] / 2}%"></i></div><span class="sub">{Math.round(medias[i])}</span></div>
    {/each}
    {#if pior >= 0}<p class="dica">Foco da próxima: <strong>{COMPETENCIAS[pior][0]}</strong>, {COMPETENCIAS[pior][1].toLowerCase()}.</p>{/if}
  </section>

  <h2>Histórico</h2>
  <ul class="grupo card">
    {#each [...lista].reverse() as r (r.id)}
      <li class="it"><span class="t"><strong>{totalRedacao(r)} · {r.tema || 'Sem tema'}</strong>
        <span class="sub">{fmtBR(r.data)} · {r.notas.join(' / ')}{r.obs ? ` · ${r.obs}` : ''}</span></span>
        <button class="x" aria-label="Apagar redação de {fmtBR(r.data)}" onclick={() => confirm('Apagar esta redação?') && delRedacao(r.id)}>✕</button></li>
    {/each}
  </ul>
{/if}

<style>
  .pri, .sec { min-height: 48px; border-radius: 14px; font-weight: 700; width: 100%; }
  .pri { background: var(--ac); color: var(--ac-tx); margin-top: 12px; } .sec { border: 1px solid var(--line); font-weight: 600; }
  .check { padding: 12px 16px; margin-top: 8px; }
  .check summary { cursor: pointer; font-weight: 600; min-height: 32px; display: flex; align-items: center; }
  .check ul { list-style: none; padding: 0; display: grid; gap: 4px; margin-top: 8px; }
  .check label { display: flex; gap: 10px; align-items: flex-start; min-height: 44px; padding-top: 10px; }
  .check input { width: 20px; height: 20px; accent-color: var(--ac); flex: none; margin-top: 2px; }
  .f { padding: 16px; display: grid; gap: 14px; margin-top: 12px; }
  .duas { display: grid; grid-template-columns: 1fr 1.6fr; gap: 8px; }
  label { display: grid; gap: 4px; font-size: .9rem; color: var(--tx2); }
  input:not([type=checkbox]), textarea { width: 100%; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); }
  fieldset { border: 0; padding: 0; display: grid; gap: 6px; }
  legend { margin-bottom: 6px; }
  .seg { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; }
  .seg button { min-height: 44px; border-radius: 10px; border: 1px solid var(--line); font-weight: 700; font-size: .85rem; color: var(--tx2); }
  .seg .on { background: var(--ac); color: var(--ac-tx); border-color: var(--ac); }
  .total { font-size: 1.05rem; } .total strong { color: var(--ac); font-size: 1.4rem; }
  .acoes { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; } .acoes .pri { margin: 0; }
  .falta { color: var(--warn); font-weight: 600; }
  .g { padding: 12px; } svg { width: 100%; height: auto; }
  .comp { padding: 16px; display: grid; gap: 12px; }
  .lin { display: grid; grid-template-columns: 2.5rem 1fr 2.5rem; gap: 12px; align-items: center; font-variant-numeric: tabular-nums; }
  .b { height: 6px; background: var(--line); border-radius: 99px; overflow: hidden; } .b i { display: block; height: 100%; background: var(--ac2); }
  .pior .b i { background: var(--ac); } .pior span:first-child { color: var(--ac); font-weight: 700; }
  .dica { background: var(--ac-bg); padding: 10px 12px; border-radius: 12px; }
  .it { display: flex; align-items: center; padding: 8px 8px 8px 16px; min-height: 60px; } .t { flex: 1; display: grid; }
  .x { width: 44px; height: 44px; color: var(--tx2); }
</style>
