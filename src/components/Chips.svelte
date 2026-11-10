<script>
  let { opcoes, valor = $bindable(), rotulo } = $props();
</script>
<div class="chips" role="radiogroup" aria-label={rotulo}>
  {#each opcoes as o}
    {@const id = o.id ?? o}
    <button type="button" role="radio" aria-checked={valor === id} class:on={valor === id} onclick={() => (valor = id)}>{o.nome ?? o}</button>
  {/each}
</div>
<style>
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  button { min-height: 44px; padding: 0 16px; border-radius: 99px; border: 1px solid var(--line); background: var(--card); font-weight: 500; transition: background .15s, color .15s; }
  button.on { background: var(--ac); color: var(--ac-tx); border-color: var(--ac); font-weight: 600; }
</style>
