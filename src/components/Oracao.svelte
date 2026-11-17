<script>
  import { slide } from 'svelte/transition';
  import { app, marcarOracao, marcadorCatecismo } from '../stores/app.svelte.js';
  import { oracoesDoDia, progressoMes } from '../lib/oracao.js';
  import { dur } from '../lib/prefs.js';

  let { dia, temProva = false } = $props();
  const itens = $derived(oracoesDoDia(app.cfg, dia, { oracoes: app.oracoes, temProva }));
  const marcas = $derived(app.oracoes[dia] ?? {});
  const prog = $derived(progressoMes(app.cfg, app.oracoes, dia));
  let aberto = $state(null);
  const fim = (d) => d.split('-').reverse().slice(0, 2).join('/');
</script>

{#if itens.length}
  <section class="card oracao" aria-label="Oração de hoje">
    <p class="data">Oração · nível {prog.nivel}: {prog.nome}</p>
    <p class="sub prog">{prog.ok} de {prog.meta} dias completos neste mês (até {fim(prog.fim)}). Com {prog.meta} de {prog.de}, o próximo nível se abre; senão, o mês se repete sem perder nada.</p>
    <ul>
      {#each itens as it (it.id)}
        {@const feito = !!marcas[it.id]}
        <li class:feito>
          <div class="lin">
            <button class="chk" role="checkbox" aria-checked={feito} aria-label={it.titulo} onclick={() => marcarOracao(dia, it.id, !feito)}>{feito ? '✓' : ''}</button>
            <button class="txt" aria-expanded={aberto === it.id} onclick={() => (aberto = aberto === it.id ? null : it.id)}>
              <span class="tit">{it.titulo}</span>
              <span class="sub">{it.hora ?? ''}{it.hora && (it.sub || it.min) ? ' · ' : ''}{it.sub ?? (it.min ? `~${it.min} min` : '')}{it.conta ? '' : ' · extra'}</span>
            </button>
          </div>
          {#if aberto === it.id}
            <div class="corpo" transition:slide={{ duration: dur(200) }}>
              {#each it.partes as p}
                <p class="pn">{p.nome}{#if p.conferir}<span class="conf">conferir</span>{/if}</p>
                <p class="pt">{p.texto}</p>
              {/each}
              {#if it.marcador}
                <p class="pt">Hoje: perguntas {app.catecismo.proxima}, {app.catecismo.proxima + 1} e {app.catecismo.proxima + 2}. Ao marcar, o marcador avança 3.</p>
                <label class="mk">Marcador (próxima pergunta)<input type="number" min="1" inputmode="numeric" value={app.catecismo.proxima} onchange={(e) => marcadorCatecismo(+e.currentTarget.value)} /></label>
              {/if}
              {#if it.link}<a class="lk" href={it.link} target="_blank" rel="noopener">Abrir {it.id === 'catecismo' ? 'o Catecismo' : 'o Missal de 1962'} ↗</a>{/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .oracao { padding: 14px 16px; margin-top: 16px; display: grid; gap: 8px; }
  .prog { margin: 0; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; }
  li { border-top: 1px solid var(--line); padding: 6px 0; }
  .lin { display: flex; gap: 12px; align-items: center; }
  .chk { width: 40px; height: 40px; flex: none; border-radius: 50%; border: 2px solid var(--ac); color: var(--ac-tx); font-weight: 800; }
  .feito .chk { background: var(--ac); }
  .txt { flex: 1; text-align: left; display: grid; gap: 2px; min-height: 44px; padding: 4px 0; }
  .tit { font-weight: 600; } .feito .tit { color: var(--tx2); text-decoration: line-through; }
  .corpo { padding: 4px 0 8px 52px; display: grid; gap: 6px; }
  .pn { font-weight: 700; font-size: .85rem; color: var(--ac2); margin: 6px 0 0; }
  .pt { margin: 0; white-space: pre-line; line-height: 1.5; font-size: .95rem; }
  .conf { margin-left: 8px; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--warn); border: 1px solid var(--warn); border-radius: 6px; padding: 1px 6px; }
  .lk { color: var(--ac); font-weight: 600; min-height: 44px; display: inline-flex; align-items: center; }
  .mk { display: grid; gap: 4px; font-size: .85rem; color: var(--tx2); }
  .mk input { min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); max-width: 10rem; }
</style>
