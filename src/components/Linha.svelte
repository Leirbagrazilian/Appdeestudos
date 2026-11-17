<script>
  import { slide } from 'svelte/transition';
  import Check from './Check.svelte';
  import Icon from './Icon.svelte';
  import { dur } from '../lib/prefs.js';

  // Linha genérica da lista de Hoje: marcar, título, resumo; os detalhes só ao tocar.
  let { feito = false, label, onToggle, aberto = false, onAbrir, icone, hora = '', titulo, sub = '', aviso = '', extra, acao, children } = $props();
</script>

<li class="lin" class:feito>
  <div class="linha">
    <Check {feito} {label} onclick={onToggle} />
    <button class="txt" aria-expanded={aberto} onclick={onAbrir}>
      <span class="tit">{titulo}</span>
      {@render extra?.()}
      <span class="sub"><span class="ic"><Icon nome={icone} size={14} /></span>{#if hora}<span class="hr">{hora}</span>{/if}{sub}</span>
      {#if aviso}<span class="av">{aviso}</span>{/if}
    </button>
    {@render acao?.()}
    <span class="seta" class:aberta={aberto}><Icon nome="down" size={16} /></span>
  </div>
  {#if aberto}
    <div class="det" transition:slide={{ duration: dur(220) }}>{@render children?.()}</div>
  {/if}
</li>

<style>
  .lin { border-top: 1px solid var(--line); }
  .linha { display: flex; align-items: center; gap: 2px; }
  .txt { flex: 1; min-width: 0; text-align: left; display: grid; gap: 1px; padding: 8px 4px; min-height: 56px; align-content: center; }
  .tit { font-weight: 600; overflow-wrap: anywhere; }
  .feito .tit { text-decoration: line-through; text-decoration-thickness: 1px; color: var(--tx2); font-weight: 500; }
  .sub { color: var(--tx2); font-size: .85rem; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .ic { display: inline-grid; color: var(--tx2); opacity: .85; }
  .hr { font-variant-numeric: tabular-nums; }
  .hr:not(:last-child)::after { content: ' ·'; }
  .av { color: var(--warn); font-size: .8125rem; font-weight: 600; }
  .seta { color: var(--tx2); display: grid; width: 24px; place-items: center; transition: transform .22s ease; pointer-events: none; }
  .seta.aberta { transform: rotate(180deg); }
  .det { padding: 2px 4px 18px 46px; display: grid; gap: 10px; font-size: .9rem; overflow: hidden; }
</style>
