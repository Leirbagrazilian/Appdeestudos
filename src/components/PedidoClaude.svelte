<script>
  import { avisar } from '../stores/app.svelte.js';
  import { pedidoClaude, AVISO_IA, fonteDasQuestoes } from '../lib/questoesIA.js';
  let { topico, n = 10, faseId } = $props();
  const texto = $derived(pedidoClaude({ topico, n, faseId }));
  const base = $derived(fonteDasQuestoes(faseId) === 'claude');
  let verTexto = $state(false);
  async function copiar() {
    try { await navigator.clipboard.writeText(texto); avisar('Pedido copiado', null, 'Cole na conversa com o Claude.'); verTexto = false; }
    catch { verTexto = true; avisar('Não consegui copiar', null, 'Selecione o texto abaixo e copie.'); }
  }
</script>
<div class="pc">
  <button type="button" class="bt" onclick={copiar}>Copiar pedido para o Claude</button>
  <span class="sub">{base ? 'Base: questões geradas no Claude e listas grátis.' : 'O Claude só completa: as questões vêm do QConcursos e de provas antigas.'}</span>
  {#if verTexto}<textarea readonly rows="4" aria-label="Pedido para o Claude">{texto}</textarea>{/if}
  <span class="aviso">{AVISO_IA}</span>
</div>
<style>
  .pc { display: grid; gap: 4px; margin-top: 4px; }
  .bt { min-height: 44px; border: 1px solid var(--line); border-radius: 12px; color: var(--ac); font-weight: 700; }
  .sub { color: var(--tx2); font-size: .85rem; }
  .aviso { color: var(--warn); font-size: .8125rem; font-weight: 600; }
  textarea { width: 100%; border: 1px solid var(--line); border-radius: 12px; padding: 8px; background: var(--bg); color: var(--tx); font: inherit; font-size: .85rem; }
</style>
