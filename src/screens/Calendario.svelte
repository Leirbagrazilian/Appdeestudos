<script>
  import { app, fases } from '../stores/app.svelte.js';
  import { marcos, alertasInscricao } from '../lib/alerts.js';
  import { diffDays, fmtBR, fmtCurta, parse } from '../lib/dates.js';
  import { idadeOk } from '../lib/age.js';

  const INI = '2026-11-01', FIM = '2027-11-30', PX = 2;
  const W = diffDays(INI, FIM) * PX;
  const x = (d) => Math.max(0, diffDays(INI, d)) * PX;
  const CORES_FASE = ['#6b7280', '#0f766e', '#0b7285', '#1d4f91', '#9d2b5b'];
  const meses = Array.from({ length: 14 }, (_, i) => { const d = new Date(2026, 10 + i, 1); return { n: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), d: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }; });
  const fs = $derived(fases());
  const lista = $derived(marcos(app.cfg).filter((m) => m.data >= app.dia));
  const alertas = $derived(alertasInscricao(app.cfg, app.dia));
  const quando = (m) => { const d = diffDays(app.dia, m.data); return d === 0 ? 'hoje' : `em ${d} dias`; };
  const STATUS = ['estimada', 'edital publicado', 'confirmada'];
  const anosProva = (c) => [...new Set(c.eventos.filter((e) => e.tipo === 'prova').map((e) => +e.inicio.slice(0, 4)))];
  const idade = (c) => (c.idade ? [2027, 2028].map((a) => ({ a, ...idadeOk(app.cfg.perfil.nascimento, c.idade, a) })) : null);
  let scroller;
  
</script>

<h1>Calendário</h1>
<p class="muted">Nov/2026 a nov/2027 · datas de 2027 estimadas até sair o edital</p>

{#each alertas as a}
  <p class="card alerta" style="--c:{a.concurso.cor}"><strong>Inscrição {a.concurso.nome} fecha {a.dias === 0 ? 'hoje' : a.dias === 1 ? 'amanhã' : `em ${a.dias} dias`}</strong> ({fmtBR(a.evento.fim)})</p>
{/each}

<div class="card tl" bind:this={scroller} tabindex="0" role="group" aria-label="Linha do tempo, role para o lado">
  <div class="canvas" style="width:{W}px">
    {#each meses as m}<span class="mes" style="left:{x(m.d)}px">{m.n}</span>{/each}
    <div class="fases">
      {#each fs as f, i}<span style="left:{x(f.inicio)}px;width:{(diffDays(f.inicio, f.fim) + 1) * PX}px;background:{CORES_FASE[i]}" title={f.nome}>{f.nome.replace('Específica ', '')}</span>{/each}
    </div>
    {#each app.cfg.concursos as c, n}
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
<p class="muted leg">▬ inscrições · ■ provas e testes · cada concurso tem sua cor</p>

<h2>Próximos marcos</h2>
<ul class="lista">
  {#each lista as m}
    <li class="card marco" style="--c:{m.c.cor}">
      <span class="g">{m.glifo}</span>
      <span class="t"><strong>{m.c.nome} · {m.rotulo}</strong><span class="muted">{fmtBR(m.data)} · {quando(m)}</span></span>
      <span class="st {m.e.status === 'estimada' ? '' : 'ok'}">{m.e.status}</span>
    </li>
  {/each}
</ul>

<h2>Verificar edital e idade</h2>
<div class="verif">
  {#each app.cfg.concursos as c}
    <div class="card cc" style="--c:{c.cor}">
      <strong>{c.nome}</strong>
      <a class="btn" href={c.link} target="_blank" rel="noopener">Verificar edital ↗</a>
      {#if c.idade}
        <p class="muted">{c.idade.texto}</p>
        <p class="idades">{#each idade(c) as i}<span class:no={!i.ok}>Prova {i.a}: {i.ok ? 'dentro do limite' : 'fora do limite'} ({i.idade} anos)</span>{/each}</p>
      {:else}<p class="muted">Sem limite de idade.</p>{/if}
    </div>
  {/each}
</div>

<style>
  .alerta { padding: 12px 16px; margin-top: 12px; border-left: 6px solid var(--c); }
  .tl { margin-top: 16px; overflow-x: auto; padding: 8px 0 12px; scrollbar-width: thin; }
  .canvas { position: relative; height: 230px; }
  .mes { position: absolute; top: 0; font-size: .7rem; color: var(--tx2); padding-left: 4px; border-left: 1px solid var(--line); height: 100%; text-transform: uppercase; }
  .fases span { position: absolute; top: 26px; height: 30px; color: #fff; font-size: .72rem; font-weight: 600; line-height: 30px; padding: 0 6px; overflow: hidden; white-space: nowrap; border-radius: 8px; border: 1px solid var(--card); }
  .faixa { position: relative; height: 34px; margin-top: 0; }
  .faixa { position: absolute; left: 0; right: 0; }
  .faixa b { position: absolute; left: 6px; top: -2px; font-size: .7rem; color: var(--c); z-index: 2; background: var(--card); padding: 0 4px; border-radius: 4px; }
  .faixa i { position: absolute; top: 16px; height: 12px; border-radius: 6px; background: var(--c); }
  .insc { opacity: .45; } .evt { height: 18px !important; top: 13px !important; }
  .hoje { position: absolute; top: 20px; bottom: 0; width: 2px; background: var(--ac); z-index: 3; }
  .hoje span { position: absolute; bottom: -2px; left: 4px; font-size: .7rem; font-weight: 700; color: var(--ac); }
  .leg { margin: 8px 4px 0; font-size: .8rem; }
  .lista { list-style: none; padding: 0; display: grid; gap: 8px; }
  .marco { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-left: 6px solid var(--c); min-height: 56px; }
  .g { color: var(--c); font-size: 1.1rem; width: 1.2em; text-align: center; } .t { flex: 1; display: grid; }
  @media (prefers-color-scheme: dark) { .g { filter: brightness(1.7); } }
  .st { font-size: .75rem; padding: 4px 10px; border-radius: 99px; background: var(--warn-bg); color: var(--warn); white-space: nowrap; }
  .st.ok { background: var(--ac-bg); color: var(--ac); }
  .verif { display: grid; gap: 8px; } .cc { padding: 16px; border-top: 4px solid var(--c); display: grid; gap: 8px; }
  .btn { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 12px; background: var(--ac); color: var(--ac-tx); font-weight: 600; text-decoration: none; justify-self: start; }
  .idades { display: grid; gap: 2px; font-size: .875rem; } .idades .no { color: var(--warn); font-weight: 600; }
</style>
