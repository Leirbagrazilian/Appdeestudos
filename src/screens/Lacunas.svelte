<script>
  import { app, setLacuna } from '../stores/app.svelte.js';
  // Nota de 0 a 3 por tópico: 0 = nunca vi, 3 = domino.
  const NIVEIS = [['0', 'nunca vi'], ['1', 'vi pouco'], ['2', 'quase lá'], ['3', 'domino']];
  const nota = (m, t) => app.lacunas[m]?.[t];
  const materias = $derived(Object.entries(app.cfg.topicos ?? {}));
  const media = (m, ts) => { const v = ts.map((t) => nota(m, t)).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / (3 * ts.length) : 0; };
  const prioridades = $derived(materias.flatMap(([m, ts]) => ts.map((t) => ({ m, t, n: nota(m, t) }))).filter((x) => x.n != null && x.n <= 1).sort((a, b) => a.n - b.n).slice(0, 5));
  const marcados = $derived(materias.reduce((s, [m, ts]) => s + ts.filter((t) => nota(m, t) != null).length, 0));
</script>

<header class="pg"><p class="data">Diagnóstico contínuo</p><h1>Mapa de lacunas</h1>
  <p class="sub">Dê uma nota de 0 a 3 para cada tópico. Atualize quando melhorar: o mapa vai ficando dourado ao longo dos meses.</p></header>

{#if prioridades.length}
  <h2>Prioridades agora</h2>
  <ul class="grupo card pri">{#each prioridades as p}<li><span class="n n{p.n}">{p.n}</span><span><strong>{p.t}</strong><span class="sub"> · {p.m}</span></span></li>{/each}</ul>
{:else if !marcados}
  <p class="card vazio">Comece pela semana diagnóstica: depois de fazer as questões de cada tópico, marque aqui a sua nota.</p>
{/if}

{#each materias as [m, ts]}
  <h2>{m} <span class="pct">{Math.round(media(m, ts) * 100)}%</span></h2>
  <div class="barra" aria-hidden="true"><i style="width:{media(m, ts) * 100}%"></i></div>
  <ul class="grupo card">
    {#each ts as t}
      {@const n = nota(m, t)}
      <li class="top">
        <span class="nome">{t}</span>
        <div class="seg" role="radiogroup" aria-label="Nota de {t}">
          {#each NIVEIS as [v, desc]}
            <button role="radio" aria-checked={n === +v} aria-label="{v}: {desc}" class="b{v}" class:on={n === +v} onclick={() => setLacuna(m, t, +v)}>{v}</button>
          {/each}
        </div>
      </li>
    {/each}
  </ul>
{/each}
<p class="sub leg">0 nunca vi · 1 vi pouco · 2 quase lá · 3 domino</p>

<style>
  h2 { display: flex; justify-content: space-between; align-items: baseline; }
  .pct { color: var(--tx2); font-weight: 600; letter-spacing: 0; }
  .barra { height: 4px; background: var(--line); border-radius: 99px; overflow: hidden; margin: 0 4px 8px; }
  .barra i { display: block; height: 100%; background: var(--ac); transition: width .5s ease; }
  .top { display: flex; align-items: center; gap: 8px; padding: 6px 8px 6px 16px; min-height: 56px; }
  .nome { flex: 1; font-size: .95rem; }
  .seg { display: grid; grid-template-columns: repeat(4, 40px); gap: 4px; }
  .seg button { height: 44px; border-radius: 10px; border: 1px solid var(--line); font-weight: 700; color: var(--tx2); }
  .seg .on.b0 { background: #ff6b6b; color: #1a0606; border-color: #ff6b6b; }
  .seg .on.b1 { background: #ff9f43; color: #1a0f04; border-color: #ff9f43; }
  .seg .on.b2 { background: var(--ac2); color: #04161c; border-color: var(--ac2); }
  .seg .on.b3 { background: var(--ac); color: var(--ac-tx); border-color: var(--ac); }
  .pri li { display: flex; gap: 12px; align-items: center; padding: 12px 16px; }
  .n { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-weight: 700; }
  .n0 { background: #ff6b6b; color: #1a0606; } .n1 { background: #ff9f43; color: #1a0f04; }
  .vazio { padding: 16px; margin-top: 12px; color: var(--tx2); }
  .leg { text-align: center; margin-top: 16px; }
</style>
