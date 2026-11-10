<script>
  import { app, addExame, delExame } from '../stores/app.svelte.js';
  import Chips from '../components/Chips.svelte';
  import { fmtBR } from '../lib/dates.js';

  const CORES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)'];
  let form = $state(false), data = $state(app.dia), concurso = $state('efomm'), notas = $state({});
  const exs = $derived(Object.values(app.exams).sort((a, b) => a.data.localeCompare(b.data)));
  const media = (e) => { const v = Object.values(e.notas); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const W = 340, H = 170, P = { l: 30, r: 18, t: 10, b: 24 };
  const X = (i) => P.l + (exs.length < 2 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (exs.length - 1));
  const Y = (v) => P.t + (1 - v / 100) * (H - P.t - P.b);
  const series = $derived([...app.cfg.materias.map((m, i) => ({ nome: m, cor: CORES[i], pts: exs.map((e, k) => (e.notas[m] != null ? [k, e.notas[m]] : null)).filter(Boolean) })).filter((s) => s.pts.length),
    { nome: 'Média', cor: 'var(--tx)', pts: exs.map((e, k) => [k, media(e)]).filter((p) => p[1] != null), media: true }]);
  const linha = (s) => s.pts.map(([k, v], i) => `${i ? 'L' : 'M'}${X(k)},${Y(v)}`).join(' ');
  const nomeC = (id) => app.cfg.concursos.find((c) => c.id === id)?.nome ?? id;
  async function salvar(ev) {
    ev.preventDefault();
    const n = Object.fromEntries(Object.entries(notas).filter(([, v]) => v !== '' && v != null && !isNaN(+v)).map(([k, v]) => [k, Math.max(0, Math.min(100, +v))]));
    if (!Object.keys(n).length) return;
    await addExame({ data, concurso, notas: n }); notas = {}; form = false;
  }
</script>

<header class="pg"><p class="data">Desempenho</p><h1>Simulados</h1><p class="sub">Nota em % por matéria. O gráfico mostra a evolução.</p></header>

{#if !form}<button class="novo" onclick={() => (form = true)}>＋ Registrar simulado</button>
{:else}
  <form class="card f" onsubmit={salvar}>
    <label for="dt"><strong>Data</strong></label><input id="dt" type="date" bind:value={data} />
    <strong>Prova</strong><Chips opcoes={app.cfg.concursos.map((c) => ({ id: c.id, nome: c.sigla }))} bind:valor={concurso} rotulo="Prova" />
    <strong>Nota por matéria (0 a 100)</strong>
    <div class="grid">{#each app.cfg.materias as m}<label>{m}<input type="number" inputmode="numeric" min="0" max="100" bind:value={notas[m]} /></label>{/each}</div>
    <div class="acoes"><button type="button" class="sec" onclick={() => (form = false)}>Cancelar</button><button class="novo">Salvar</button></div>
  </form>
{/if}

{#if exs.length}
  <h2>Evolução</h2>
  <section class="card g">
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Gráfico de evolução das notas por simulado">
      {#each [0, 25, 50, 75, 100] as v}<line x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} stroke="var(--line)" /><text x={P.l - 6} y={Y(v) + 4} text-anchor="end" font-size="10" fill="var(--tx2)">{v}</text>{/each}
      {#each series as s}
        <path d={linha(s)} fill="none" stroke={s.cor} stroke-width={s.media ? 3 : 2} stroke-dasharray={s.media ? '' : '0'} stroke-linecap="round" stroke-linejoin="round" />
        {#each s.pts as [k, v]}<circle cx={X(k)} cy={Y(v)} r={s.media ? 4 : 3} fill={s.cor} />{/each}
      {/each}
      {#each exs as e, k}<text x={X(k)} y={H - 6} text-anchor="middle" font-size="10" fill="var(--tx2)">{e.data.slice(8)}/{e.data.slice(5, 7)}</text>{/each}
    </svg>
    <ul class="leg">{#each series as s}<li><i style="background:{s.cor}"></i>{s.nome}</li>{/each}</ul>
  </section>
  <h2>Histórico</h2>
  <ul class="grupo card">
    {#each [...exs].reverse() as e}
      <li class="it"><span class="t"><strong>{nomeC(e.concurso)} · {Math.round(media(e))}% de média</strong>
        <span class="muted">{fmtBR(e.data)} · {Object.entries(e.notas).map(([m, v]) => `${m} ${v}`).join(' · ')}</span></span>
        <button class="x" aria-label="Apagar simulado de {fmtBR(e.data)}" onclick={() => delExame(e.id)}>✕</button></li>
    {/each}
  </ul>
{/if}

<style>
  .novo { width: 100%; min-height: 48px; border-radius: 14px; background: var(--ac); color: var(--ac-tx); font-weight: 700; margin-top: 12px; }
  .f { padding: 16px; display: grid; gap: 12px; margin-top: 12px; }
  input { width: 100%; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } .grid label { display: grid; gap: 4px; font-size: .9rem; }
  .acoes { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; } .acoes .novo { margin: 0; }
  .sec { min-height: 48px; border-radius: 14px; border: 1px solid var(--line); font-weight: 600; }
  .g { padding: 12px; } svg { width: 100%; height: auto; }
  .leg { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: .8rem; margin-top: 8px; } .leg i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
  .it { display: flex; align-items: center; padding: 8px 8px 8px 16px; min-height: 60px; } .t { flex: 1; display: grid; } .t .muted { font-size: .85rem; }
  .x { width: 44px; height: 44px; color: var(--tx2); }
</style>
