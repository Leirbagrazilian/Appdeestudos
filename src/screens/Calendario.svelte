<script>
  import { app, fases } from '../stores/app.svelte.js';
  import { marcos, alertasInscricao, conflitosProvas } from '../lib/alerts.js';
  import { diffDays, fmtBR, fmtCurta, parse } from '../lib/dates.js';
  import { idadeOk } from '../lib/age.js';
  import Icon from '../components/Icon.svelte';
  import { faseDoDia } from '../lib/phases.js';

  const INI = '2026-11-01', FIM = '2027-11-30', PX = 2;
  const W = diffDays(INI, FIM) * PX;
  const x = (d) => Math.max(0, diffDays(INI, d)) * PX;
  const meses = Array.from({ length: 14 }, (_, i) => { const d = new Date(2026, 10 + i, 1); return { n: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), d: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }; });
  const fs = $derived(fases());
  const atual = $derived(faseDoDia(fs, app.dia).id);
  const lista = $derived(marcos(app.cfg).filter((m) => m.data >= app.dia));
  const alertas = $derived(alertasInscricao(app.cfg, app.dia));
  const quando = (m) => { const d = diffDays(app.dia, m.data); return d === 0 ? 'hoje' : `em ${d} dias`; };
  const STATUS = ['estimada', 'edital publicado', 'confirmada'];
  const anosProva = (c) => [...new Set(c.eventos.filter((e) => e.tipo === 'prova').map((e) => +e.inicio.slice(0, 4)))];
  const idade = (c) => (c.idade ? [2027, 2028].map((a) => ({ a, ...idadeOk(app.cfg.perfil.nascimento, c.idade, a) })) : null);
  const comPlano = $derived(app.cfg.concursos.filter((c) => c.plano !== false && c.eventos.length));
  const conflitos = $derived(conflitosProvas(app.cfg));
  let scroller;
  
</script>

<header>
  <p class="data">Nov/2026 a nov/2027</p>
  <h1>Calendário</h1>
  <p class="sub">Datas de 2027 estimadas até sair o edital.</p>
</header>

{#each conflitos as c}
  <p class="nota conflito"><Icon nome="clock" />Conflito: {c.a.sigla} e {c.b.sigla} caem {c.de === c.ate ? `em ${fmtBR(c.de)}` : `de ${fmtBR(c.de)} a ${fmtBR(c.ate)}`}. Prioridade: <strong>{c.vence.sigla}</strong>.</p>
{/each}
{#each alertas as a}
  <a class="nota" href="#/calendario"><Icon nome="clock" />Inscrição {a.concurso.nome} fecha {a.dias === 0 ? 'hoje' : a.dias === 1 ? 'amanhã' : `em ${a.dias} dias`} · {fmtBR(a.evento.fim)}</a>
{/each}

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="card tl" bind:this={scroller} tabindex="0" role="group" aria-label="Linha do tempo, role para o lado">
  <div class="canvas" style="width:{W}px;height:{86 + comPlano.length * 38}px">
    {#each meses as m}<span class="mes" style="left:{x(m.d)}px">{m.n}</span>{/each}
    <div class="fases">
      {#each fs as f}<span class:atual={f.id === atual} style="left:{x(f.inicio)}px;width:{(diffDays(f.inicio, f.fim) + 1) * PX}px" title={f.nome}>{f.nome.replace('Específica ', '')}</span>{/each}
    </div>
    {#each comPlano as c, n}
      <div class="faixa" style="--c:{c.cor};top:{70 + n * 38}px">
        {#each c.eventos as e}
          {#if e.tipo === 'inscricao'}<i class="insc" style="left:{x(e.inicio)}px;width:{(diffDays(e.inicio, e.fim) + 1) * PX}px"></i>
          {:else}<i class="evt" style="left:{x(e.inicio)}px;width:{Math.max(10, (diffDays(e.inicio, e.fim) + 1) * PX)}px"></i>{/if}
        {/each}
        <b>{c.sigla}</b>
      </div>
    {/each}
    <div class="hoje" style="left:{x(app.dia)}px"><span>hoje</span></div>
  </div>
</div>
<p class="leg">Faixa clara: inscrições · bloco sólido: provas e testes · deslize para o lado</p>

<h2>Próximos marcos</h2>
<ul class="lista card">
  {#each lista as m}
    <li style="--c:{m.c.cor}">
      <span class="g" aria-hidden="true">{m.glifo}</span>
      <span class="t"><strong>{m.c.nome} · {m.rotulo}</strong><span class="sub">{fmtBR(m.data)} · {quando(m)}{m.e.obs ? ` · ${m.e.obs}` : ''}</span></span>
      <span class="st" class:ok={m.e.status !== 'estimada'}>{m.e.status}</span>
    </li>
  {/each}
</ul>

<h2>Editais e idade</h2>
<ul class="lista card">
  {#each app.cfg.concursos as c}
    <li class="cc" style="--c:{c.cor}">
      <div class="cab"><strong><i class="pt"></i>{c.nome}</strong>
        <a class="btn" href={c.link} target="_blank" rel="noopener">Verificar edital <Icon nome="ext" size={16} /></a></div>
      {#if c.idade}
        <p class="sub">{c.idade.texto}</p>
        <p class="idades">{#if c.plano === false}<span class="sub">Sem plano: só para você ver o limite.</span>{/if}{#each idade(c) as i}<span class:no={!i.ok}>Prova {i.a} (matrícula {i.anoMat}): {i.ok ? 'dentro do limite' : 'fora do limite'}, {i.idade} anos em {i.ref.slice(8)}/{i.ref.slice(5, 7)}</span>{/each}</p>
      {:else}<p class="sub">Sem limite de idade.</p>{/if}
    </li>
  {/each}
</ul>

<style>
  header { padding: 20px 4px 8px; }
  .data { color: var(--ac2); font-size: .8rem; text-transform: uppercase; letter-spacing: .12em; font-weight: 500; }
  h1 { margin-top: 4px; font-size: 1.9rem; font-weight: 700; letter-spacing: -.03em; }
  .sub { color: var(--tx2); font-size: .85rem; }
  header .sub { margin-top: 4px; }
  .nota { display: block; margin-top: 12px; padding: 12px 16px; border-radius: 14px; background: var(--warn-bg); color: var(--warn); font-size: .9rem; text-decoration: none; font-weight: 600; }
  .nota :global(svg) { vertical-align: -3px; margin-right: 8px; }
  .conflito { background: var(--ac-bg); color: var(--tx); border: 1px solid var(--ac); } .conflito :global(svg) { color: var(--ac); }
  .tl { margin-top: 16px; overflow-x: auto; padding: 8px 0 12px; scrollbar-width: thin; }
  .canvas { position: relative; }
  .mes { position: absolute; top: 0; font-size: .8125rem; color: var(--tx2); padding-left: 4px; border-left: 1px solid var(--line); height: 100%; text-transform: uppercase; letter-spacing: .08em; }
  .fases span { position: absolute; top: 26px; height: 28px; background: var(--line); color: var(--tx); font-size: .8125rem; font-weight: 600; line-height: 28px; padding: 0 8px; overflow: hidden; white-space: nowrap; border-radius: 8px; border: 1px solid var(--card); }
  .fases span.atual { background: var(--ac); color: var(--ac-tx); }
  .faixa { position: absolute; left: 0; right: 0; height: 34px; }
  .faixa b { position: absolute; left: 6px; top: -2px; font-size: .8125rem; color: var(--tx); z-index: 2; background: var(--card); padding: 0 6px; border-left: 3px solid var(--c); border-radius: 2px; }
  .faixa i { position: absolute; top: 16px; height: 10px; border-radius: 5px; background: var(--c); filter: brightness(var(--cc)); }
  .insc { opacity: .4; } .evt { height: 16px !important; top: 13px !important; border-radius: 4px !important; }
  .hoje { position: absolute; top: 20px; bottom: 0; width: 1px; background: var(--ac); z-index: 3; }
  .hoje span { position: absolute; bottom: -2px; left: 4px; font-size: .8125rem; font-weight: 700; color: var(--ac); text-transform: uppercase; letter-spacing: .08em; }
  .leg { margin: 8px 4px 0; font-size: .8125rem; color: var(--tx2); }
  h2 { margin-top: 28px; }
  .lista { list-style: none; padding: 0; overflow: hidden; }
  .lista li + li { border-top: 1px solid var(--line); }
  .lista li { display: flex; align-items: center; gap: 12px; padding: 12px 16px; min-height: 56px; }
  .g { color: var(--c); width: 1.2em; text-align: center; filter: brightness(var(--cc)); }
  .t { flex: 1; display: grid; }
  .st { font-size: .8125rem; padding: 3px 10px; border: 1px solid var(--line); border-radius: 99px; color: var(--tx2); white-space: nowrap; }
  .st.ok { border-color: var(--ac); color: var(--ac); }
  .cc { display: grid !important; gap: 6px; align-items: start; }
  .cab { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .pt { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--c); margin-right: 10px; filter: brightness(var(--cc)); }
  .btn { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--ac); color: var(--ac); font-weight: 600; font-size: .85rem; text-decoration: none; }
  .idades { display: grid; gap: 2px; font-size: .85rem; } .idades .no { color: var(--warn); font-weight: 600; }
</style>
