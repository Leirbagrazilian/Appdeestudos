<script>
  import { slide } from 'svelte/transition';
  import { app, addErro, delErro, pf } from '../stores/app.svelte.js';
  import Chips from '../components/Chips.svelte';
  import Icon from '../components/Icon.svelte';
  import { fmtCurta } from '../lib/dates.js';
  import { dur, vibrar } from '../lib/prefs.js';

  // Vindo do cronômetro: #/erros?novo=1&materia=Matemática abre o formulário já preenchido.
  const params = new URLSearchParams(location.hash.split('?')[1] ?? '');
  let materia = $state(params.get('materia') ?? ''), tipo = $state(''), assunto = $state(''), form = $state(params.get('novo') === '1');
  let foto = $state(null), lendo = $state(false), treme = $state(false), faltando = $state('');
  let fMat = $state(''), fTipo = $state(''), aberta = $state(null);
  const tipos = $derived(app.cfg.tiposErro), nomeTipo = (id) => tipos.find((t) => t.id === id)?.nome ?? id;
  const lista = $derived(Object.values(app.errors).filter((e) => (!fMat || e.materia === fMat) && (!fTipo || e.tipo === fTipo)).sort((a, b) => b.id.localeCompare(a.id)));
  const todos = $derived(Object.values(app.errors));
  const resumo = $derived.by(() => {
    if (!todos.length) return '';
    const n = {}; todos.forEach((e) => (n[e.tipo] = (n[e.tipo] ?? 0) + 1));
    const [t, q] = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
    return `${Math.round((q / todos.length) * 100)}% dos seus erros são de ${nomeTipo(t).toLowerCase()}.`;
  });

  /** Reduz a foto (no máx. 1200 px, JPEG) para caber bem no aparelho e no backup. */
  async function lerFoto(ev) {
    const f = ev.currentTarget.files?.[0]; if (!f) return;
    lendo = true;
    try {
      const img = await createImageBitmap(f);
      const k = Math.min(1, 1200 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      foto = c.toDataURL('image/jpeg', 0.72);
    } catch { faltando = 'Não consegui ler essa foto. Tente de novo.'; }
    lendo = false; ev.currentTarget.value = '';
  }

  async function salvar(ev) {
    ev.preventDefault();
    const falta = [!materia && 'matéria', !tipo && 'tipo de erro', !assunto.trim() && !foto && 'assunto ou foto'].filter(Boolean);
    if (falta.length) {
      faltando = `Falta: ${falta.join(', ')}.`; vibrar(pf(), 'erro');
      treme = false; requestAnimationFrame(() => (treme = true));
      return;
    }
    await addErro({ materia, assunto: assunto.trim() || 'Questão fotografada', tipo, foto });
    assunto = ''; foto = null; faltando = ''; form = false;
    if (params.get('novo') === '1') history.replaceState(null, '', '#/erros');
  }
</script>

<header class="pg"><p class="data">Caderno</p><h1>Erros</h1>
  <p class="sub">{todos.length ? `${todos.length} registrados. ${resumo}` : 'Registre cada erro em poucos toques, com foto do caderno se quiser. Ele volta como revisão em 1, 7 e 30 dias.'}</p></header>

{#if !form}
  <button class="novo" onclick={() => (form = true)}>＋ Registrar erro</button>
{:else}
  <form class="card f" class:treme onsubmit={salvar} onanimationend={() => (treme = false)} transition:slide={{ duration: dur(220) }}>
    <strong>Matéria</strong><Chips opcoes={app.cfg.materias} bind:valor={materia} rotulo="Matéria" />
    <strong>Tipo de erro</strong><Chips opcoes={tipos} bind:valor={tipo} rotulo="Tipo de erro" />
    <strong>Foto da questão no caderno (opcional)</strong>
    {#if foto}
      <div class="prev"><img src={foto} alt="Prévia da foto" /><button type="button" class="sec" onclick={() => (foto = null)}>Tirar foto de novo</button></div>
    {:else}
      <label class="sec cam"><span class="ci"><Icon nome="cam" />{lendo ? 'Lendo a foto…' : 'Fotografar a questão'}</span><input type="file" accept="image/*" capture="environment" onchange={lerFoto} hidden /></label>
    {/if}
    <label for="ass"><strong>Assunto</strong></label>
    <input id="ass" placeholder="ex.: função do 2º grau" bind:value={assunto} autocomplete="off" />
    {#if faltando}<p class="falta" role="alert">{faltando}</p>{/if}
    <div class="acoes"><button type="button" class="sec" onclick={() => { form = false; faltando = ''; }}>Cancelar</button><button class="novo">Salvar</button></div>
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
      <li>
        <div class="it">
          {#if e.foto}<button class="mini" aria-label="Ver foto de {e.assunto}" onclick={() => (aberta = aberta === e.id ? null : e.id)}><img src={e.foto} alt="" /></button>{/if}
          <span class="t"><strong>{e.assunto}</strong><span class="muted">{e.materia} · {nomeTipo(e.tipo)} · {fmtCurta(e.dia)}</span></span>
          <button aria-label="Apagar {e.assunto}" class="x" onclick={() => confirm(`Apagar o erro "${e.assunto}"?`) && delErro(e.id)}>✕</button>
        </div>
        {#if aberta === e.id && e.foto}<img class="grande" src={e.foto} alt="Foto da questão: {e.assunto}" transition:slide={{ duration: dur(220) }} />{/if}
      </li>
    {:else}<li class="muted vazio">Nenhum erro com esse filtro.</li>{/each}
  </ul>
{/if}

<style>
  .novo { width: 100%; min-height: 48px; border-radius: 14px; background: var(--ac); color: var(--ac-tx); font-weight: 700; margin-top: 12px; }
  .f { padding: 16px; display: grid; gap: 12px; margin-top: 12px; }
  input { width: 100%; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); }
  .acoes { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; } .acoes .novo { margin: 0; }
  .sec { min-height: 48px; border-radius: 14px; border: 1px solid var(--line); font-weight: 600; display: grid; place-items: center; cursor: pointer; }
  .ci { display: inline-flex; align-items: center; gap: 8px; }
  .cam { border-style: dashed; border-color: var(--ac); color: var(--ac); }
  .prev { display: grid; grid-template-columns: 96px 1fr; gap: 10px; align-items: center; }
  .prev img { width: 96px; height: 96px; object-fit: cover; border-radius: 12px; }
  .falta { color: var(--warn); font-weight: 600; font-size: .9rem; }
  .filtros { display: grid; gap: 8px; }
  .it { display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 16px; min-height: 60px; } .t { flex: 1; display: grid; } .t .muted { font-size: .85rem; }
  .mini { width: 48px; height: 48px; flex: none; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); }
  .mini img { width: 100%; height: 100%; object-fit: cover; }
  .grande { display: block; width: calc(100% - 32px); margin: 0 16px 12px; border-radius: 12px; }
  .vazio { padding: 16px; }
  .x { width: 44px; height: 44px; color: var(--tx2); font-size: 1.1rem; }
</style>
