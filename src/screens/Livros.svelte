<script>
  import { slide } from 'svelte/transition';
  import { app, salvarCfg, salvarKV } from '../stores/app.svelte.js';
  import Chips from '../components/Chips.svelte';
  import { MATERIAS_TRILHA, topicosDe } from '../lib/trilha.js';
  import { dur } from '../lib/prefs.js';
  import { TIPOS, series, principalDe, recursosAtivos, temPaginas, ritmoDe, cotaPaginas, proximaPagina, progresso, registrarLeitura, pararNaPagina, novoRecurso, idVinculo } from '../lib/livros.js';

  const materias = $derived(MATERIAS_TRILHA(app.cfg));
  let materia = $state('Matemática'), aberto = $state(null), novo = $state(false);
  let f = $state({ tipo: 'livro', titulo: '', autor: '', volume: '', link: '' }), falta = $state('');
  let reg = $state({});

  const bib = $derived(app.cfg.biblioteca);
  const colecoes = $derived(series(app.cfg, materia));
  const principal = $derived(principalDe(app.cfg, materia));
  const colecao = $derived(colecoes.find((s) => s.id === principal));
  const outros = $derived(recursosAtivos(app.cfg, materia).filter((r) => r.tipo !== 'livro'));
  const topicos = $derived(topicosDe(app.cfg, materia));
  const salvar = () => salvarCfg();
  const vinculosDe = (rid) => bib.vinculos.filter((v) => v.recurso === rid);
  const leit = (v) => app.leitura[v.id];
  const registros = (v) => leit(v)?.registros ?? [];

  async function usarComoPrincipal(id) { bib.principal[materia] = id; salvar(); }
  async function vincular(r, topico) {
    if (!topico) return;
    const id = idVinculo(r.id, topico);
    if (bib.vinculos.some((v) => v.id === id)) return;
    bib.vinculos.push({ id, recurso: r.id, materia, topico, cap: null, pagIni: null, pagFim: null, exIni: null, exFim: null });
    salvar();
  }
  function desvincular(v) { bib.vinculos = bib.vinculos.filter((x) => x.id !== v.id); bib.removidos = [...new Set([...(bib.removidos ?? []), v.id])]; salvar(); }
  function removerRecurso(r) {
    if (!confirm(`Remover "${r.titulo}${r.volume ? ' v.' + r.volume : ''}" e os vínculos dele?`)) return;
    bib.recursos = bib.recursos.filter((x) => x.id !== r.id);
    bib.vinculos = bib.vinculos.filter((x) => x.recurso !== r.id);
    bib.removidos = [...new Set([...(bib.removidos ?? []), r.id])];
    if (bib.principal[materia] && !series(app.cfg, materia).some((s) => s.id === bib.principal[materia])) bib.principal[materia] = null;
    salvar();
  }
  function editarLink(r, valor) { r.link = valor.trim(); r.linkStatus = r.link ? 'informado por você' : 'a confirmar'; salvar(); }
  function numero(v, campo, valor) { v[campo] = valor === '' ? null : Math.max(0, Math.round(+valor)); salvar(); }
  async function registrar(v) {
    const r = reg[v.id] ?? {}; const pags = +r.pags, min = +r.min;
    if (!(pags > 0)) return;
    app.leitura[v.id] = registrarLeitura(leit(v), v, pags, min > 0 ? min : 0, app.dia);
    reg[v.id] = {}; await salvarKV('leitura');
  }
  async function parei(v, pagina) { if (!(+pagina > 0)) return; app.leitura[v.id] = pararNaPagina(leit(v), v, +pagina); await salvarKV('leitura'); }

  function adicionar(ev) {
    ev.preventDefault();
    if (!f.titulo.trim()) { falta = 'Dê um título ao recurso.'; return; }
    const r = novoRecurso(app.cfg, { ...f, materia });
    bib.recursos.push(r);
    if (r.tipo === 'livro' && !principalDe(app.cfg, materia)) bib.principal[materia] = r.serie;
    salvar(); f = { tipo: 'livro', titulo: '', autor: '', volume: '', link: '' }; falta = ''; novo = false;
  }
  const rotuloStatus = (s) => (s === 'visto na busca' ? 'link visto na busca' : s === 'informado por você' ? 'link seu' : 'link a confirmar');
</script>

<header class="pg"><p class="data">Sua biblioteca</p><h1>Meus livros</h1>
  <p class="sub">Livros, vídeos e sites de cada matéria. Cadastre as páginas uma vez: o planner divide em cotas diárias e continua de onde você parou.</p></header>

<Chips opcoes={materias.map((m) => ({ id: m, nome: m }))} bind:valor={materia} rotulo="Matéria" />

<h2>Livro principal de {materia}</h2>
{#if colecoes.length}
  <div class="seg2" role="radiogroup" aria-label="Livro principal de {materia}">
    {#each colecoes as s}
      <button role="radio" aria-checked={principal === s.id} class:on={principal === s.id} onclick={() => usarComoPrincipal(s.id)}>{s.titulo}<small>{s.autor}</small></button>
    {/each}
  </div>
{:else}<p class="sub">Nenhum livro cadastrado nesta matéria. Adicione um abaixo.</p>{/if}

{#if colecao}
  <h2>Volumes</h2>
  <ul class="grupo card">
    {#each colecao.volumes as r (r.id)}
      {@const vs = vinculosDe(r.id)}
      {@const ritmo = ritmoDe(app.cfg, r, vs.flatMap(registros))}
      <li>
        <button class="cab" aria-expanded={aberto === r.id} onclick={() => (aberto = aberto === r.id ? null : r.id)}>
          <span class="t"><strong>{r.volume ? `Vol. ${r.volume}` : r.titulo}{r.assunto ? ` · ${r.assunto}` : ''}</strong>
            <span class="sub">{vs.length ? `${vs.length} ${vs.length === 1 ? 'tópico' : 'tópicos'}` : 'sem tópicos'} · {vs.some(temPaginas) ? `${vs.filter(temPaginas).length} com páginas` : 'sem páginas cadastradas'}</span></span>
          <span class="st">{rotuloStatus(r.linkStatus)}</span>
        </button>
        {#if aberto === r.id}
          <div class="det" transition:slide={{ duration: dur(220) }}>
            {#if r.obs}<p class="sub obs">{r.obs}</p>{/if}
            <label class="lk">Link
              <input type="url" inputmode="url" placeholder="cole o link" value={r.link} onchange={(e) => editarLink(r, e.currentTarget.value)} /></label>
            {#if r.link}<a class="abrir" href={r.link} target="_blank" rel="noopener">Abrir ↗</a>{/if}
            <p class="sub">Ritmo: <strong>{ritmo.ritmo.toFixed(1).replace('.', ',')} pág/h</strong>{ritmo.ajustado ? ' (ajustado pelo que você registrou)' : ` (padrão do tipo de conteúdo)`}</p>

            {#each vs as v (v.id)}
              {@const prox = temPaginas(v) ? cotaPaginas(v, leit(v), 100, ritmo.ritmo) : null}
              <div class="vin">
                <div class="vt"><strong>{v.topico}</strong>
                  <button class="x" aria-label="Desvincular {v.topico}" onclick={() => desvincular(v)}>✕</button></div>
                <div class="campos">
                  <label>Cap.<input inputmode="numeric" value={v.cap ?? ''} onchange={(e) => { v.cap = e.currentTarget.value || null; salvar(); }} /></label>
                  <label>Pág. início<input type="number" inputmode="numeric" min="0" value={v.pagIni ?? ''} onchange={(e) => numero(v, 'pagIni', e.currentTarget.value)} /></label>
                  <label>Pág. fim<input type="number" inputmode="numeric" min="0" value={v.pagFim ?? ''} onchange={(e) => numero(v, 'pagFim', e.currentTarget.value)} /></label>
                  <label>Ex. início<input type="number" inputmode="numeric" min="0" value={v.exIni ?? ''} onchange={(e) => numero(v, 'exIni', e.currentTarget.value)} /></label>
                  <label>Ex. fim<input type="number" inputmode="numeric" min="0" value={v.exFim ?? ''} onchange={(e) => numero(v, 'exFim', e.currentTarget.value)} /></label>
                </div>
                {#if temPaginas(v)}
                  <div class="barra" role="progressbar" aria-label="Progresso em {v.topico}" aria-valuenow={Math.round(progresso(v, leit(v)) * 100)} aria-valuemin="0" aria-valuemax="100"><i style="width:{progresso(v, leit(v)) * 100}%"></i></div>
                  <p class="sub">{prox?.concluido ? 'Tópico concluído neste livro.' : `Próxima página: ${proximaPagina(v, leit(v))}. Um bloco de 2 sessões cobre as págs ${prox.de}–${prox.ate}${prox.ex ? ` e os ex. ${prox.ex.de}–${prox.ex.ate}` : ''}.`}</p>
                  <div class="reg">
                    <label>Li (págs)<input type="number" inputmode="numeric" min="0" placeholder="12" value={reg[v.id]?.pags ?? ''} oninput={(e) => (reg[v.id] = { ...(reg[v.id] ?? {}), pags: e.currentTarget.value })} /></label>
                    <label>em (min)<input type="number" inputmode="numeric" min="0" placeholder="60" value={reg[v.id]?.min ?? ''} oninput={(e) => (reg[v.id] = { ...(reg[v.id] ?? {}), min: e.currentTarget.value })} /></label>
                    <button class="sec" onclick={() => registrar(v)}>Registrar</button>
                  </div>
                  <label class="parei">Parei na página
                    <input type="number" inputmode="numeric" min="0" placeholder={String(proximaPagina(v, leit(v)) - 1)} onchange={(e) => { parei(v, e.currentTarget.value); e.currentTarget.value = ''; }} /></label>
                {:else}
                  <p class="sub aviso">Sem páginas cadastradas: o bloco vai mostrar vídeos e questões e um botão para cadastrar as páginas.</p>
                {/if}
              </div>
            {/each}

            <label class="lk">Vincular a um tópico
              <select onchange={(e) => { vincular(r, e.currentTarget.value); e.currentTarget.value = ''; }}>
                <option value="">Escolha o tópico…</option>
                {#each topicos as t}<option value={t.nome}>{t.nome}</option>{/each}
              </select></label>
            <button class="sec apagar" onclick={() => removerRecurso(r)}>Remover este volume</button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

{#if colecoes.some((s) => s.id !== principal)}
  <p class="sub outras">Outros livros de {materia}: {colecoes.filter((s) => s.id !== principal).map((s) => s.titulo).join(', ')}. Escolha acima para usar como principal.</p>
{/if}

<h2>Vídeos, sites e listas</h2>
<ul class="grupo card">
  {#each outros as r (r.id)}
    <li class="out">
      <div class="oc"><strong>{r.titulo}</strong><span class="sub">{r.assunto ?? ''}</span>
        <span class="st">{rotuloStatus(r.linkStatus)}</span></div>
      <div class="lin">
        <input type="url" inputmode="url" aria-label="Link de {r.titulo}" placeholder="cole o link" value={r.link} onchange={(e) => editarLink(r, e.currentTarget.value)} />
        {#if r.link}<a class="abrir" href={r.link} target="_blank" rel="noopener">Abrir ↗</a>{/if}
        <button class="x" aria-label="Remover {r.titulo}" onclick={() => removerRecurso(r)}>✕</button>
      </div>
    </li>
  {:else}<li class="vazio sub">Nenhum vídeo ou site cadastrado.</li>{/each}
</ul>

{#if !novo}<button class="pri" onclick={() => (novo = true)}>＋ Adicionar recurso em {materia}</button>
{:else}
  <form class="card f" onsubmit={adicionar} transition:slide={{ duration: dur(220) }}>
    <label>Tipo<select bind:value={f.tipo}>{#each TIPOS as [id, nome]}<option value={id}>{nome}</option>{/each}</select></label>
    <label>Título<input bind:value={f.titulo} placeholder="ex.: Física Clássica" /></label>
    <label>Autor (opcional)<input bind:value={f.autor} /></label>
    {#if f.tipo === 'livro'}<label>Volume (opcional: use para cada volume do mesmo livro)<input bind:value={f.volume} inputmode="numeric" placeholder="3" /></label>{/if}
    <label>Link (opcional)<input type="url" inputmode="url" bind:value={f.link} placeholder="https://" /></label>
    {#if falta}<p class="falta" role="alert">{falta}</p>{/if}
    <div class="acoes"><button type="button" class="sec" onclick={() => { novo = false; falta = ''; }}>Cancelar</button><button class="pri">Salvar</button></div>
  </form>
{/if}
<p class="sub rodape">Os links de “visto na busca” apareceram em resultados de pesquisa, mas eu não abri as páginas. “A confirmar” significa que eu não achei um endereço confiável: cole o seu.</p>

<style>
  h2 { margin-top: 24px; }
  .seg2 { display: grid; gap: 8px; margin-top: 4px; }
  .seg2 button { min-height: 56px; border-radius: 14px; border: 1px solid var(--line); text-align: left; padding: 8px 14px; font-weight: 600; display: grid; }
  .seg2 small { color: var(--tx2); font-weight: 400; font-size: .8125rem; }
  .seg2 .on { border-color: var(--ac); background: var(--ac-bg); color: var(--ac); }
  .cab { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 14px; min-height: 60px; text-align: left; }
  .t { flex: 1; display: grid; }
  .st { font-size: .8125rem; color: var(--tx2); border: 1px solid var(--line); border-radius: 99px; padding: 2px 10px; white-space: nowrap; }
  .det { padding: 0 14px 16px; display: grid; gap: 10px; overflow: hidden; }
  .obs { background: var(--ac-bg); padding: 8px 12px; border-radius: 10px; color: var(--tx); }
  label { display: grid; gap: 4px; font-size: .85rem; color: var(--tx2); }
  input, select { width: 100%; min-height: 44px; padding: 8px 10px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); }
  .abrir { color: var(--ac); font-weight: 700; text-decoration: none; min-height: 44px; display: inline-flex; align-items: center; justify-self: start; }
  .vin { border: 1px solid var(--line); border-radius: 14px; padding: 12px; display: grid; gap: 8px; }
  .vt { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .campos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .campos label { font-size: .8125rem; }
  .barra { height: 6px; background: var(--line); border-radius: 99px; overflow: hidden; } .barra i { display: block; height: 100%; background: var(--ac); }
  .reg { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: end; }
  .parei { max-width: 12rem; }
  .aviso { color: var(--warn); }
  .sec, .pri { min-height: 48px; border-radius: 14px; font-weight: 700; padding: 0 14px; }
  .sec { border: 1px solid var(--line); color: var(--tx); font-weight: 600; } .pri { background: var(--ac); color: var(--ac-tx); width: 100%; margin-top: 12px; }
  .apagar { color: var(--tx2); }
  .x { width: 44px; height: 44px; color: var(--tx2); flex: none; }
  .out { padding: 10px 12px; display: grid; gap: 6px; }
  .oc { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; } .oc strong { flex: 1 1 100%; }
  .lin { display: flex; gap: 8px; align-items: center; }
  .vazio { padding: 14px; }
  .outras, .rodape { margin: 10px 4px 0; }
  .f { padding: 16px; display: grid; gap: 12px; margin-top: 12px; }
  .acoes { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; } .acoes .pri { margin: 0; }
  .falta { color: var(--warn); font-weight: 600; }
</style>
