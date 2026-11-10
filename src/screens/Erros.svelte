<script>
  import { app, addErro, delErro } from '../stores/app.svelte.js';
  import Chips from '../components/Chips.svelte';
  import { fmtCurta } from '../lib/dates.js';

  let materia = $state(''), tipo = $state(''), assunto = $state(''), form = $state(false);
  let fMat = $state(''), fTipo = $state('');
  const tipos = $derived(app.cfg.tiposErro), nomeTipo = (id) => tipos.find((t) => t.id === id)?.nome ?? id;
  const lista = $derived(Object.values(app.errors).filter((e) => (!fMat || e.materia === fMat) && (!fTipo || e.tipo === fTipo)).sort((a, b) => b.id.localeCompare(a.id)));
  const todos = $derived(Object.values(app.errors));
  const resumo = $derived.by(() => {
    if (!todos.length) return '';
    const n = {}; todos.forEach((e) => (n[e.tipo] = (n[e.tipo] ?? 0) + 1));
    const [t, q] = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
    return `${Math.round((q / todos.length) * 100)}% dos seus erros são de ${nomeTipo(t).toLowerCase()}.`;
  });
  const pode = $derived(materia && tipo && assunto.trim());
  async function salvar(ev) { ev.preventDefault(); if (!pode) return; await addErro({ materia, assunto, tipo }); assunto = ''; form = false; }
</script>

<header class="pg"><p class="data">Caderno</p><h1>Erros</h1>
  <p class="sub">{todos.length ? `${todos.length} registrados. ${resumo}` : 'Registre cada erro em 3 toques. Ele volta como revisão em 1, 7 e 30 dias.'}</p></header>

{#if !form}
  <button class="novo" onclick={() => (form = true)}>＋ Registrar erro</button>
{:else}
  <form class="card f" onsubmit={salvar}>
    <strong>Matéria</strong><Chips opcoes={app.cfg.materias} bind:valor={materia} rotulo="Matéria" />
    <strong>Tipo de erro</strong><Chips opcoes={tipos} bind:valor={tipo} rotulo="Tipo de erro" />
    <label for="ass"><strong>Assunto</strong></label>
    <input id="ass" placeholder="ex.: função do 2º grau" bind:value={assunto} autocomplete="off" />
    <div class="acoes"><button type="button" class="sec" onclick={() => (form = false)}>Cancelar</button><button class="novo" disabled={!pode}>Salvar</button></div>
  </form>
{/if}

{#if todos.length}
  <h2>Filtros</h2>
  <div class="filtros">
    <Chips opcoes={['', ...app.cfg.materias].map((m) => (m ? m : { id: '', nome: 'Todas' }))} bind:valor={fMat} rotulo="Filtrar por matéria" />
    <Chips opcoes={[{ id: '', nome: 'Todos os tipos' }, ...tipos]} bind:valor={fTipo} rotulo="Filtrar por tipo" />
  </div>
  <h2>Registros</h2>
  <ul class="grupo card">
    {#each lista as e (e.id)}
      <li class="it"><span class="t"><strong>{e.assunto}</strong><span class="muted">{e.materia} · {nomeTipo(e.tipo)} · {fmtCurta(e.dia)}</span></span>
        <button aria-label="Apagar {e.assunto}" class="x" onclick={() => delErro(e.id)}>✕</button></li>
    {:else}<li class="muted">Nenhum erro com esse filtro.</li>{/each}
  </ul>
{/if}

<style>
  .novo { width: 100%; min-height: 48px; border-radius: 14px; background: var(--ac); color: var(--ac-tx); font-weight: 700; margin-top: 12px; }
  .novo:disabled { opacity: .45; }
  .f { padding: 16px; display: grid; gap: 12px; margin-top: 12px; }
  input { width: 100%; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); }
  .acoes { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; } .acoes .novo { margin: 0; }
  .sec { min-height: 48px; border-radius: 14px; border: 1px solid var(--line); font-weight: 600; }
  .filtros { display: grid; gap: 8px; }
  .it { display: flex; align-items: center; padding: 8px 8px 8px 16px; min-height: 60px; } .t { flex: 1; display: grid; } .t .muted { font-size: .85rem; }
  .x { width: 44px; height: 44px; color: var(--tx2); font-size: 1.1rem; }
</style>
