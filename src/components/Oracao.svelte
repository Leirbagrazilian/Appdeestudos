<script>
  import { app, marcarOracao, marcadorCatecismo } from '../stores/app.svelte.js';
  import { progressoMes } from '../lib/oracao.js';
  import Linha from './Linha.svelte';

  // Uma linha de oração (item de oracoesDoDia).
  let { dia, it, aberto = false, onAbrir } = $props();
  const feito = $derived(!!app.oracoes[dia]?.[it.id]);
  const prog = $derived(progressoMes(app.cfg, app.oracoes, dia));
  const fim = (d) => d.split('-').reverse().slice(0, 2).join('/');
</script>

<Linha {feito} label={it.titulo} onToggle={() => marcarOracao(dia, it.id, !feito)} {aberto} {onAbrir} icone="cruz" hora={it.hora ?? ''}
  titulo={it.titulo} sub={`${it.sub ?? (it.min ? `~${it.min} min` : '')}${it.conta ? '' : `${it.sub || it.min ? ' · ' : ''}${it.bonus ? 'bônus' : 'extra'}`}`}>
  {#each it.partes as p}
    <p class="pn">{p.nome}{#if p.conferir}<span class="conf">conferir</span>{/if}</p>
    <p class="pt">{p.texto}</p>
  {/each}
  {#if it.marcador}
    <p class="pt">Hoje: perguntas {app.catecismo.proxima}, {app.catecismo.proxima + 1} e {app.catecismo.proxima + 2}. Ao marcar, o marcador avança 3.</p>
    <label class="mk">Marcador (próxima pergunta)<input type="number" min="1" inputmode="numeric" value={app.catecismo.proxima} onchange={(e) => marcadorCatecismo(+e.currentTarget.value)} /></label>
  {/if}
  {#if it.link}<a class="lk" href={it.link} target="_blank" rel="noopener">Abrir {it.id === 'catecismo' ? 'o Catecismo' : 'o Missal de 1962'} ↗</a>{/if}
  <p class="mut">Oração · nível {prog.nivel}: {prog.nome}. {prog.ok} de {prog.meta} dias completos neste mês (até {fim(prog.fim)}). Com {prog.meta} de {prog.de}, o próximo nível se abre; senão, o mês se repete sem perder nada.</p>
</Linha>

<style>
  .pn { font-weight: 700; font-size: .85rem; color: var(--tx2); margin: 4px 0 0; }
  .pt { margin: 0; white-space: pre-line; line-height: 1.5; font-size: .95rem; }
  .conf { margin-left: 8px; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--warn); border: 1px solid var(--warn); border-radius: 6px; padding: 1px 6px; }
  .lk { color: var(--ac); font-weight: 600; min-height: 44px; display: inline-flex; align-items: center; }
  .mut { color: var(--tx2); margin: 0; font-size: .85rem; }
  .mk { display: grid; gap: 4px; font-size: .85rem; color: var(--tx2); }
  .mk input { min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); max-width: 10rem; }
</style>
