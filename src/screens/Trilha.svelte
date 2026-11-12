<script>
  import { slide } from 'svelte/transition';
  import { app, setLacuna, salvarCfg } from '../stores/app.svelte.js';
  import { dur } from '../lib/prefs.js';
  import { linksDe, acertoPorTopico } from '../lib/tarefas.js';
  import { coberturaPaginas } from '../lib/livros.js';
  import Chips from '../components/Chips.svelte';
  import Ring from '../components/Ring.svelte';
  import { NIVEIS, MATERIAS_TRILHA, topicosDe, dominio, status, proximoTopico, cobertura } from '../lib/trilha.js';

  const materias = $derived(MATERIAS_TRILHA(app.cfg));
  let materia = $state('Matemática');
  const info = $derived(app.cfg.materiasInfo?.[materia] ?? {});
  const lista = $derived(topicosDe(app.cfg, materia));
  const proximo = $derived(proximoTopico(app.cfg, app.lacunas, materia));
  const pct = $derived(cobertura(app.cfg, app.lacunas, materia));
  const dominados = $derived(lista.filter((t) => dominio(app.lacunas, materia, t.nome) >= 3).length);
  const proximos = $derived(materias.map((m) => ({ m, t: proximoTopico(app.cfg, app.lacunas, m) })).filter((x) => x.t));
  const sigla = (id) => app.cfg.concursos.find((c) => c.id === id)?.sigla ?? id;
  const cor = (id) => app.cfg.concursos.find((c) => c.id === id)?.cor ?? 'var(--ac)';
  const en = $derived(app.cfg.regras?.en);
  let painel = $state(null);
  // cobertura do conteúdo: tópicos dominados e páginas lidas dos livros, por matéria
  const cobertas = $derived(materias.map((m) => {
    const l = topicosDe(app.cfg, m);
    return { m, total: l.length, dom: l.filter((t) => dominio(app.lacunas, m, t.nome) >= 3).length, pct: cobertura(app.cfg, app.lacunas, m), pag: coberturaPaginas(app.cfg, app.leitura, m) };
  }));
  const acerto = $derived(acertoPorTopico(app.done));
  const ROTULOS = [['video', 'Vídeo ou aula do tópico'], ['qconcursos', 'QConcursos (lista filtrada)'], ['estuda', 'Estuda.com (lista)'], ['pdf', 'Prova em PDF'], ['outro', 'Outro (ex.: ENEM, enem.dev)']];
  const nLinks = (t) => Object.values(linksDe(app.cfg, materia, t.nome)).filter(Boolean).length;
  function colar(t, campo, valor) {
    app.cfg.questoesLinks ??= {};
    ((app.cfg.questoesLinks[materia] ??= {})[t.nome] ??= {})[campo] = valor.trim();
    salvarCfg();
  }
  const nomeCompleto = (m) => app.cfg.materiasInfo?.[m]?.nome ?? m;
</script>

<header class="pg"><p class="data">Seu caminho</p><h1>Trilha</h1>
  <p class="sub">Os tópicos de cada matéria, na ordem de estudo. Dê uma nota de 0 a 3 conforme você domina: ela vira o seu progresso e guia o que vem a seguir.</p></header>

{#if en}
  <p class="nota"><strong>Escola Naval elimina:</strong> menos de {en.minPorMateriaPct}% em qualquer matéria, ou redação abaixo de {en.minRedacaoDe100}/100.</p>
{/if}

<h2>Cobertura do conteúdo</h2>
<ul class="grupo card cob">
  {#each cobertas as c (c.m)}
    <li><button class="cl" onclick={() => (materia = c.m)}>
      <span class="cn">{c.m}</span>
      <span class="cb" role="img" aria-label="{c.m}: {Math.round(c.pct * 100)}% dos tópicos dominados{c.pag.pct != null ? `, ${Math.round(c.pag.pct * 100)}% das páginas lidas` : ''}">
        <i class="t" style="--w:{c.pct * 100}%"></i>{#if c.pag.pct != null}<i class="p" style="--w:{c.pag.pct * 100}%"></i>{/if}
      </span>
      <span class="ct">{c.dom} de {c.total} tópicos{c.pag.pct != null ? ` · ${Math.round(c.pag.pct * 100)}% das págs` : ''}</span>
    </button></li>
  {/each}
</ul>
<p class="sub leg">Barra dourada: tópicos dominados. Barra azul: páginas lidas dos livros (só onde você cadastrou as páginas).</p>

<h2>O que estudar a seguir</h2>
<ul class="grupo card prox">
  {#each proximos as p (p.m)}
    <li><button class="ln" onclick={() => (materia = p.m)}>
      <span class="m">{p.m}</span><span class="tp">{p.t.nome}</span>
      <span class="cs">{#each p.t.concursos as id}<i style="--c:{cor(id)}" title={sigla(id)}></i>{/each}<small>{p.t.concursos.length}</small><span class="sr"> concursos</span></span>
    </button></li>
  {:else}<li class="vazio sub">Tudo dominado. A cidade está em ordem.</li>{/each}
</ul>
<p class="sub leg">Os pontos coloridos mostram a quantos concursos o tópico serve. Dentro da janela dos próximos 3 tópicos, vale primeiro o que serve a mais concursos.</p>

<h2>Matéria</h2>
<Chips opcoes={materias.map((m) => ({ id: m, nome: m }))} bind:valor={materia} rotulo="Matéria da trilha" />

<section class="card res">
  <span class="r"><Ring pct={pct} size={56} stroke={6} /><strong>{Math.round(pct * 100)}%</strong></span>
  <span class="tx">
    <strong>{nomeCompleto(materia)}</strong>
    <span class="sub">{dominados} de {lista.length} tópicos dominados</span>
    <span class="sub">Serve a: {(info.concursos ?? []).map(sigla).join(', ')}{info.esaQuestoes ? ` · ESA: ${info.esaQuestoes} questões` : ''}</span>
  </span>
</section>
{#if info.obs}<p class="sub obs">{info.obs}</p>{/if}

<ul class="grupo card">
  {#each lista as t, i (t.nome)}
    {@const n = dominio(app.lacunas, materia, t.nome)}
    <li class="top" class:prox={proximo?.nome === t.nome}>
      <div class="cab">
        <span class="num" class:ok={n >= 3}>{i + 1}</span>
        <span class="nm">
          <strong>{t.nome}</strong>
          <span class="sub"><span class="cs">{#each t.concursos as id}<i style="--c:{cor(id)}" aria-hidden="true"></i>{/each}</span>{t.concursos.map(sigla).join(' · ')} · {status(n)}{proximo?.nome === t.nome ? ' · próximo' : ''}</span>
        </span>
      </div>
      {#if acerto[`${materia}|${t.nome}`]}
        {@const a = acerto[`${materia}|${t.nome}`]}
        <p class="sub ac">Acerto neste tópico: <strong>{Math.round((a.acertos / a.feitas) * 100)}%</strong> · {a.acertos} de {a.feitas} questões</p>
      {/if}
      <div class="seg" role="radiogroup" aria-label="Domínio de {t.nome}">
        {#each NIVEIS as [v, desc]}
          <button role="radio" aria-checked={n === +v && app.lacunas[materia]?.[t.nome] != null} aria-label="{v}: {desc}" class="b{v}" class:on={app.lacunas[materia]?.[t.nome] === +v} onclick={() => setLacuna(materia, t.nome, +v)}>{v}</button>
        {/each}
      </div>
      <button class="lbtn" aria-expanded={painel === t.nome} onclick={() => (painel = painel === t.nome ? null : t.nome)}>Links de questões e vídeo{nLinks(t) ? ` · ${nLinks(t)} colados` : ''}</button>
      {#if painel === t.nome}
        <div class="links" transition:slide={{ duration: dur(220) }}>
          {#each ROTULOS as [campo, rot]}
            <label>{rot}<input type="url" inputmode="url" placeholder="cole o link" value={linksDe(app.cfg, materia, t.nome)[campo]} onchange={(e) => colar(t, campo, e.currentTarget.value)} /></label>
          {/each}
          <p class="sub">O app não guarda questões: cole aqui o link de uma lista já filtrada por este tópico. Ela aparece no bloco do dia.</p>
        </div>
      {/if}
    </li>
  {/each}
</ul>
<p class="sub leg">0 nunca vi · 1 vi pouco · 2 quase lá · 3 domino</p>

<style>
  .nota { margin-top: 12px; padding: 12px 16px; border-radius: 14px; background: var(--warn-bg); color: var(--warn); font-size: .9rem; }
  .prox .ln { width: 100%; display: grid; grid-template-columns: 6.2rem 1fr auto; gap: 10px; align-items: center; padding: 10px 14px; min-height: 52px; text-align: left; }
  .m { color: var(--ac2); font-size: .8125rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
  .tp { font-weight: 600; font-size: .92rem; }
  .cs { display: inline-flex; align-items: center; gap: 3px; margin-right: 6px; }
  .cs i { width: 9px; height: 9px; border-radius: 50%; background: var(--c); filter: brightness(var(--cc)); }
  .cs small { color: var(--tx2); margin-left: 4px; font-size: .8125rem; }
  .vazio { padding: 14px; }
  .leg { margin: 8px 4px 0; }
  h2 { margin-top: 24px; }
  .res { display: flex; gap: 14px; align-items: center; padding: 14px 16px; margin-top: 12px; }
  .r { position: relative; display: inline-grid; place-items: center; }
  .r strong { position: absolute; font-size: .85rem; color: var(--ac); }
  .tx { display: grid; gap: 2px; }
  .obs { margin: 8px 4px 0; }
  .top { padding: 12px 12px 10px 16px; display: grid; gap: 10px; }
  .top.prox { background: var(--ac-bg); box-shadow: inset 3px 0 0 var(--ac); }
  .cab { display: flex; gap: 12px; align-items: center; }
  .num { width: 30px; height: 30px; flex: none; border-radius: 50%; display: grid; place-items: center; border: 1.5px solid var(--line); font-weight: 700; color: var(--tx2); font-size: .85rem; }
  .num.ok { background: var(--ac); border-color: var(--ac); color: var(--ac-tx); }
  .nm { display: grid; gap: 2px; }
  .nm .sub { display: flex; flex-wrap: wrap; align-items: center; }
  .cl { width: 100%; display: grid; grid-template-columns: 6.2rem 1fr; gap: 4px 12px; padding: 10px 14px; min-height: 56px; text-align: left; align-items: center; }
  .cn { font-weight: 600; font-size: .92rem; }
  .cb { display: grid; gap: 3px; } .cb i { display: block; height: 5px; border-radius: 99px; }
  .cb .t { background: linear-gradient(to right, var(--ac) var(--w), var(--line) var(--w)); } .cb .p { background: linear-gradient(to right, var(--ac2) var(--w), var(--line) var(--w)); }
  .cb { background: none; } .ct { grid-column: 2; color: var(--tx2); font-size: .8125rem; }
  .ac strong { color: var(--ac); }
  .lbtn { min-height: 44px; text-align: left; color: var(--ac); font-weight: 600; font-size: .85rem; }
  .links { display: grid; gap: 8px; }
  .links label { display: grid; gap: 4px; font-size: .85rem; color: var(--tx2); }
  .links input { width: 100%; min-height: 44px; padding: 8px 10px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); }
  .seg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .seg button { min-height: 44px; border-radius: 10px; border: 1px solid var(--line); font-weight: 700; color: var(--tx2); }
  .seg .on.b0 { background: #ff6b6b; color: #1a0606; border-color: #ff6b6b; }
  .seg .on.b1 { background: #ff9f43; color: #1a0f04; border-color: #ff9f43; }
  .seg .on.b2 { background: var(--ac2); color: #04161c; border-color: var(--ac2); }
  .seg .on.b3 { background: var(--ac); color: var(--ac-tx); border-color: var(--ac); }
</style>
