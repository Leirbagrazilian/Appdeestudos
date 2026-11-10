<script>
  import seed from '../data/seed.json';
  import { app } from '../stores/app.svelte.js';
  const cor = (id) => app.cfg.concursos.find((c) => c.id === id)?.cor ?? 'var(--ac)';
</script>

<header class="pg"><p class="data">Provas e gabaritos</p><h1>Onde achar questões</h1>
  <p class="sub">Comece pelo link oficial. Os de terceiros ajudam a achar provas antigas, mas confira sempre com o gabarito oficial.</p></header>

{#each seed.questoes as c}
  <h2><i class="pt" style="--c:{cor(c.id)}"></i>{c.nome}</h2>
  <ul class="grupo card">
    {#each c.oficial as l}<li><a href={l.url} target="_blank" rel="noopener"><span class="t">{l.nome}</span><span class="tag of">oficial</span></a></li>{/each}
    {#each c.terceiros as l}<li><a href={l.url} target="_blank" rel="noopener"><span class="t">{l.nome}</span><span class="tag">terceiros</span></a></li>{/each}
  </ul>
{/each}
<p class="aviso sub">Os links de terceiros vieram de uma busca na web e eu não abri os arquivos. Se algum estiver fora do ar, use a busca do site oficial.</p>

<style>
  .pt { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--c); margin-right: 10px; filter: brightness(var(--cc)); }
  a { display: flex; align-items: center; gap: 12px; padding: 14px 16px; min-height: 56px; text-decoration: none; color: var(--tx); }
  .t { flex: 1; font-size: .92rem; }
  .tag { font-size: .8125rem; padding: 3px 10px; border: 1px solid var(--line); border-radius: 99px; color: var(--tx2); white-space: nowrap; }
  .tag.of { border-color: var(--ac); color: var(--ac); font-weight: 600; }
  .aviso { margin: 16px 4px 0; }
</style>
