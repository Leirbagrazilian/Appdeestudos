<script>
  import { slide, fly } from 'svelte/transition';
  import { app, addErro, delErro, atualizarErro, treinarErro, pf } from '../stores/app.svelte.js';
  import Chips from '../components/Chips.svelte';
  import Icon from '../components/Icon.svelte';
  import { fmtCurta } from '../lib/dates.js';
  import { dur, vibrar } from '../lib/prefs.js';
  import { situacao, filaTreino, viloes, ACERTOS_PARA_DOMINAR } from '../lib/erros.js';

  // Vindo do cronômetro: #/erros?novo=1&materia=Matemática abre o formulário já preenchido.
  const params = new URLSearchParams(location.hash.split('?')[1] ?? '');
  let materia = $state(params.get('materia') ?? ''), tipo = $state(''), assunto = $state(''), licao = $state('');
  let form = $state(params.get('novo') === '1'), comFoto = $state(false);
  let foto = $state(null), lendo = $state(false), treme = $state(false), faltando = $state('');
  let aba = $state('treinar'), busca = $state(''), aberto = $state(null);

  const tipos = $derived(app.cfg.tiposErro), nomeTipo = (id) => tipos.find((t) => t.id === id)?.nome ?? id;
  const todos = $derived(Object.values(app.errors));
  const nTreinar = $derived(todos.filter((e) => situacao(e) !== 'dominado').length);
  const nDominados = $derived(todos.length - nTreinar);
  const vil = $derived(viloes(todos));
  const lista = $derived.by(() => {
    const q = busca.trim().toLowerCase();
    return todos
      .filter((e) => aba === 'todos' || (aba === 'dominados' ? situacao(e) === 'dominado' : situacao(e) !== 'dominado'))
      .filter((e) => !q || [e.assunto, e.licao, e.materia].some((x) => x?.toLowerCase().includes(q)))
      .sort((a, b) => b.id.localeCompare(a.id));
  });
  // Sugestões de assunto: tópicos da matéria + assuntos já usados (ajuda os vilões a se agruparem).
  const sugestoes = $derived([...new Set([...(app.cfg.topicos?.[materia] ?? []), ...todos.filter((e) => !materia || e.materia === materia).map((e) => e.assunto)])]);

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
    const falta = [!materia && 'matéria', !tipo && 'tipo de erro', !assunto.trim() && 'assunto'].filter(Boolean);
    if (falta.length) {
      faltando = `Falta: ${falta.join(', ')}.`; vibrar(pf(), 'erro');
      treme = false; requestAnimationFrame(() => (treme = true));
      return;
    }
    await addErro({ materia, assunto, tipo, licao, foto });
    assunto = ''; licao = ''; foto = null; comFoto = false; faltando = ''; form = false;
    if (params.get('novo') === '1') history.replaceState(null, '', '#/erros');
  }

  // ---------- treino tipo flashcard ----------
  let treino = $state(null); // { ids, i, revelado, acertos, dominados }
  const atual = $derived(treino ? app.errors[treino.ids[treino.i]] : null);
  function comecarTreino(ids) {
    const fila = ids ?? filaTreino(todos).map((e) => e.id);
    if (!fila.length) return;
    treino = { ids: fila, i: 0, revelado: false, acertos: 0, dominados: 0 };
    scrollTo(0, 0);
  }
  async function responder(acertou) {
    const e = await treinarErro(treino.ids[treino.i], acertou);
    treino.acertos += acertou ? 1 : 0;
    treino.dominados += e.status === 'dominado' ? 1 : 0;
    treino.i += 1; treino.revelado = false;
  }
</script>

{#if treino}
  <!-- ===================== MODO TREINO ===================== -->
  <header class="pg">
    <p class="data">Treinar erros{treino.i < treino.ids.length ? ` · ${treino.i + 1} de ${treino.ids.length}` : ''}</p>
    <div class="trilho" aria-hidden="true"><i style="width:{(treino.i / treino.ids.length) * 100}%"></i></div>
  </header>

  {#if atual && treino.i < treino.ids.length}
    {#key treino.i}
      <section class="card flash" in:fly={{ x: 40, duration: dur(260) }}>
        <p class="meta"><span class="tag">{atual.materia}</span><span class="tag t-{atual.tipo}">{nomeTipo(atual.tipo)}</span>
          {#if atual.acertosSeguidos}<span class="seq">{'✓'.repeat(atual.acertosSeguidos)} de {ACERTOS_PARA_DOMINAR}</span>{/if}</p>
        <h1 class="ass">{atual.assunto}</h1>
        {#if atual.foto}<img class="foto" src={atual.foto} alt="Foto da questão" />{/if}
        {#if !treino.revelado}
          <p class="sub">Refaça uma questão desse assunto no caderno, sem olhar nada. Depois revele a sua lição.</p>
          <button class="pri" onclick={() => (treino.revelado = true)}>Revelar a lição</button>
        {:else}
          <div class="licao" transition:slide={{ duration: dur(220) }}>
            <p class="data">Sua lição</p>
            {#if atual.licao}<p class="lt">{atual.licao}</p>
            {:else}
              <p class="sub">Você não escreveu a lição deste erro. Escreva agora, em uma frase:</p>
              <textarea rows="2" placeholder="O que eu devia ter lembrado?" onchange={(ev) => atualizarErro(atual.id, { licao: ev.currentTarget.value.trim() })}></textarea>
            {/if}
          </div>
          <div class="resp">
            <button class="er" onclick={() => responder(false)}>Errei de novo</button>
            <button class="ok" onclick={() => responder(true)}>Acertei agora</button>
          </div>
        {/if}
      </section>
    {/key}
  {:else}
    <section class="card fim entra">
      <p class="data">Treino concluído</p>
      <p class="grande">{treino.acertos} de {treino.ids.length}</p>
      <p>acertos nesta rodada{treino.dominados ? ` · ${treino.dominados} ${treino.dominados === 1 ? 'erro dominado' : 'erros dominados'}` : ''}.</p>
      <p class="sub">{treino.acertos === treino.ids.length ? 'Rodada limpa. A cidade agradece.' : 'Os que você errou voltam na próxima rodada. É assim que eles somem.'}</p>
      {#if nTreinar}<button class="pri" onclick={() => comecarTreino()}>Treinar mais {Math.min(10, nTreinar)}</button>{/if}
    </section>
  {/if}
  <p class="sair"><button class="lk" onclick={() => (treino = null)}>Sair do treino</button></p>

{:else}
  <!-- ===================== CADERNO ===================== -->
  <header class="pg"><p class="data">Caderno</p><h1>Erros</h1>
    <p class="sub">{todos.length ? `${nTreinar} para treinar · ${nDominados} ${nDominados === 1 ? 'dominado' : 'dominados'}` : 'Registre o assunto e a lição de cada erro. Depois, treine até dominar.'}</p></header>

  {#if nTreinar}
    <button class="pri treinar" onclick={() => comecarTreino()}><Icon nome="bulb" />Treinar erros · {Math.min(10, nTreinar)} agora</button>
  {/if}
  {#if !form}<button class="sec novo" onclick={() => (form = true)}>＋ Registrar erro</button>{/if}

  {#if form}
    <form class="card f" class:treme onsubmit={salvar} onanimationend={() => (treme = false)} transition:slide={{ duration: dur(220) }}>
      <strong>Matéria</strong><Chips opcoes={app.cfg.materias} bind:valor={materia} rotulo="Matéria" />
      <strong>Tipo de erro</strong><Chips opcoes={tipos} bind:valor={tipo} rotulo="Tipo de erro" />
      <label for="ass"><strong>Assunto</strong></label>
      <input id="ass" list="sug-ass" placeholder="ex.: Trigonometria" bind:value={assunto} autocomplete="off" />
      <datalist id="sug-ass">{#each sugestoes as s}<option value={s}></option>{/each}</datalist>
      <label for="lic"><strong>Lição</strong> <span class="sub">O que eu devia ter lembrado? (uma frase)</span></label>
      <textarea id="lic" rows="2" placeholder="ex.: seno é cateto oposto sobre hipotenusa" bind:value={licao}></textarea>
      {#if foto}
        <div class="prev"><img src={foto} alt="Prévia da foto" /><button type="button" class="sec" onclick={() => (foto = null)}>Remover foto</button></div>
      {:else if comFoto}
        <label class="sec cam"><span class="ci"><Icon nome="cam" />{lendo ? 'Lendo a foto…' : 'Fotografar a questão'}</span><input type="file" accept="image/*" capture="environment" onchange={lerFoto} hidden /></label>
      {:else}
        <button type="button" class="lk" onclick={() => (comFoto = true)}>Adicionar foto (opcional)</button>
      {/if}
      {#if faltando}<p class="falta" role="alert">{faltando}</p>{/if}
      <div class="acoes"><button type="button" class="sec" onclick={() => { form = false; faltando = ''; }}>Cancelar</button><button class="pri">Salvar</button></div>
    </form>
  {/if}

  {#if vil.total >= 3 || vil.top.length}
    <section class="card vil">
      <p class="data">Seus vilões</p>
      {#if vil.top.length}
        <ol>{#each vil.top as v}<li><strong>{v.assunto}</strong><span class="sub">&nbsp;· {v.materia} · {v.n} erros</span></li>{/each}</ol>
      {/if}
      {#if vil.total}
        <div class="tipos" role="img" aria-label="Tipos de erro: conteúdo {vil.tipos.conteudo}, atenção {vil.tipos.atencao}, tempo {vil.tipos.tempo}">
          {#each ['conteudo', 'atencao', 'tempo'] as t}{#if vil.tipos[t]}<i class="t-{t}" style="flex:{vil.tipos[t]}"></i>{/if}{/each}
        </div>
        <p class="leg">{#each ['conteudo', 'atencao', 'tempo'] as t}<span><i class="t-{t}"></i>{nomeTipo(t)} {vil.tipos[t]}</span>{/each}</p>
      {/if}
      {#if vil.dica}<p class="dica">{vil.dica}</p>{/if}
    </section>
  {/if}

  {#if todos.length}
    <div class="abas" role="tablist" aria-label="Filtrar erros">
      {#each [['treinar', `Para treinar (${nTreinar})`], ['dominados', `Dominados (${nDominados})`], ['todos', 'Todos']] as [id, nome]}
        <button role="tab" aria-selected={aba === id} class:on={aba === id} onclick={() => (aba = id)}>{nome}</button>
      {/each}
    </div>
    <input class="busca" type="search" placeholder="Buscar assunto, lição ou matéria" aria-label="Buscar erros" bind:value={busca} />
    <ul class="grupo card">
      {#each lista as e (e.id)}
        {@const st = situacao(e)}
        <li>
          <button class="it" aria-expanded={aberto === e.id} onclick={() => (aberto = aberto === e.id ? null : e.id)}>
            <span class="pt st-{st}" aria-hidden="true"></span>
            <span class="t"><strong>{e.assunto}</strong><span class="sub">{e.materia} · {nomeTipo(e.tipo)} · {fmtCurta(e.dia)}{st === 'dominado' ? ' · dominado' : e.acertosSeguidos ? ` · ${e.acertosSeguidos}/${ACERTOS_PARA_DOMINAR} acertos` : ''}</span></span>
            <span class="seta" class:ab={aberto === e.id}><Icon nome="down" /></span>
          </button>
          {#if aberto === e.id}
            <div class="det" transition:slide={{ duration: dur(220) }}>
              <label for="l-{e.id}" class="sub">Lição</label>
              <textarea id="l-{e.id}" rows="2" placeholder="O que eu devia ter lembrado?" value={e.licao ?? ''} onchange={(ev) => atualizarErro(e.id, { licao: ev.currentTarget.value.trim() })}></textarea>
              {#if e.foto}<img class="foto" src={e.foto} alt="Foto da questão: {e.assunto}" />{/if}
              <div class="acoes3">
                {#if st !== 'dominado'}<button class="sec" onclick={() => comecarTreino([e.id])}>Treinar este</button>
                  <button class="sec" onclick={() => atualizarErro(e.id, { status: 'dominado' })}>Já domino</button>
                {:else}<button class="sec" onclick={() => atualizarErro(e.id, { status: 'treinando', acertosSeguidos: 0 })}>Voltar a treinar</button>{/if}
                <button class="sec apagar" onclick={() => confirm(`Apagar o erro "${e.assunto}"?`) && delErro(e.id)}>Apagar</button>
              </div>
            </div>
          {/if}
        </li>
      {:else}<li class="vazio sub">{aba === 'dominados' ? 'Nenhum erro dominado ainda. Treine para chegar lá.' : busca ? 'Nada encontrado.' : 'Nenhum erro para treinar. Bom sinal.'}</li>{/each}
    </ul>
  {/if}
{/if}

<style>
  .pri, .sec { min-height: 48px; border-radius: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; cursor: pointer; }
  .pri { background: var(--ac); color: var(--ac-tx); }
  .sec { border: 1px solid var(--line); color: var(--tx); font-weight: 600; }
  .treinar { min-height: 56px; margin-top: 12px; font-size: 1.05rem; box-shadow: 0 6px 20px color-mix(in srgb, var(--ac) 28%, transparent); }
  .novo { margin-top: 10px; }
  .lk { color: var(--ac); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; min-height: 44px; justify-self: start; }
  .f { padding: 16px; display: grid; gap: 12px; margin-top: 12px; }
  input, textarea { width: 100%; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); resize: vertical; }
  .acoes { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; }
  .cam { border-style: dashed; border-color: var(--ac); color: var(--ac); }
  .ci { display: inline-flex; align-items: center; gap: 8px; }
  .prev { display: grid; grid-template-columns: 96px 1fr; gap: 10px; align-items: center; }
  .prev img { width: 96px; height: 96px; object-fit: cover; border-radius: 12px; }
  .falta { color: var(--warn); font-weight: 600; font-size: .9rem; }

  .vil { padding: 16px; margin-top: 16px; display: grid; gap: 10px; }
  .vil ol { padding-left: 20px; display: grid; gap: 4px; }
  .tipos { display: flex; height: 10px; border-radius: 99px; overflow: hidden; gap: 2px; }
  .leg { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: .85rem; color: var(--tx2); }
  .leg i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
  .t-conteudo { background: var(--ac2); } .t-atencao { background: var(--ac); } .t-tempo { background: #ff8a8a; }
  .dica { background: var(--ac-bg); padding: 10px 12px; border-radius: 12px; font-size: .9rem; }

  .abas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 20px; }
  .abas button { min-height: 44px; border-radius: 12px; border: 1px solid var(--line); font-size: .85rem; font-weight: 600; color: var(--tx2); }
  .abas .on { background: var(--ac); color: var(--ac-tx); border-color: var(--ac); }
  .busca { margin: 8px 0; }
  .it { width: 100%; display: flex; align-items: center; gap: 12px; padding: 8px 12px 8px 16px; min-height: 60px; text-align: left; }
  .t { flex: 1; display: grid; }
  .pt { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .st-novo { background: var(--ac2); } .st-treinando { background: var(--ac); } .st-dominado { background: var(--tx2); }
  .seta { color: var(--tx2); display: grid; transition: transform .22s ease; } .seta.ab { transform: rotate(180deg); }
  .det { padding: 0 16px 16px; display: grid; gap: 8px; overflow: hidden; }
  .acoes3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
  .apagar { color: var(--tx2); }
  .foto { width: 100%; border-radius: 12px; }
  .vazio { padding: 16px; }

  .trilho { height: 4px; background: var(--line); border-radius: 99px; overflow: hidden; margin-top: 10px; }
  .trilho i { display: block; height: 100%; background: var(--ac); transition: width .3s ease; }
  .flash { padding: 20px 16px; display: grid; gap: 14px; margin-top: 8px; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .tag { font-size: .8125rem; padding: 3px 10px; border-radius: 99px; border: 1px solid var(--line); color: var(--tx2); }
  .tag.t-conteudo, .tag.t-atencao, .tag.t-tempo { background: none; }
  .seq { color: var(--ac); font-size: .85rem; font-weight: 700; }
  .ass { font-size: 1.6rem; letter-spacing: -.02em; }
  .licao { background: var(--ac-bg); border-left: 3px solid var(--ac); padding: 12px 14px; border-radius: 0 12px 12px 0; display: grid; gap: 6px; }
  .lt { font-size: 1.1rem; font-weight: 600; }
  .resp { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .resp button { min-height: 64px; border-radius: 16px; font-weight: 700; font-size: 1rem; border: 1.5px solid var(--line); }
  .resp .ok { background: var(--ac); color: var(--ac-tx); border-color: var(--ac); }
  .resp .er { color: #ff8a8a; border-color: color-mix(in srgb, #ff6b6b 45%, var(--line)); }
  :global(:root[data-theme=claro]) .resp .er, :global(:root[data-theme=auto]) .resp .er { color: #b42318; }
  .fim { padding: 24px 16px; display: grid; gap: 8px; text-align: center; margin-top: 8px; }
  .grande { font-size: 2.6rem; font-weight: 300; color: var(--ac); }
  .sair { text-align: center; margin-top: 12px; }
  .sair .lk { color: var(--tx2); }
</style>
