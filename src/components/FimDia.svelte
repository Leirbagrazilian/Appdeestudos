<script>
  import { app, salvarFimDia } from '../stores/app.svelte.js';
  import { PASSOS_FIM_DIA, horaFimDia, passosFeitos, tipoQuestaoDificil } from '../lib/fimdia.js';
  import { weekday } from '../lib/dates.js';
  import Linha from './Linha.svelte';
  // Fim do dia (20h40; quinta logo ao chegar): 4 passos, a questão difícil de amanhã e as tarefas de amanhã.
  let { dia, faseId, aberto = false, onAbrir } = $props();
  const r = $derived(app.fimDia[dia] ?? {});
  const n = $derived(passosFeitos(r));
  const marcar = (id, v) => salvarFimDia(dia, { passos: { [id]: v } });
</script>
<Linha feito={n === PASSOS_FIM_DIA.length} label="Fim do dia completo" onToggle={() => { const todos = n !== PASSOS_FIM_DIA.length; salvarFimDia(dia, { passos: Object.fromEntries(PASSOS_FIM_DIA.map((p) => [p.id, todos])) }); }}
  {aberto} {onAbrir} icone="moon" hora={horaFimDia(weekday(dia))} titulo="Fim do dia" sub={`${n} de ${PASSOS_FIM_DIA.length} passos · depois terço, oração da noite e cama às 22h`}>
  <ol class="ps">
    {#each PASSOS_FIM_DIA as p (p.id)}
      <li>
        <label class="ck"><input type="checkbox" checked={!!r.passos?.[p.id]} onchange={(e) => marcar(p.id, e.currentTarget.checked)} /><span><strong>{p.titulo}</strong><span class="sub">{p.detalhe}</span></span></label>
        {#if p.id === 'questao'}
          <label class="cx">Questão difícil de amanhã ({tipoQuestaoDificil(faseId)})
            <textarea rows="3" placeholder="Cole ou escreva a questão (ou onde ela está: livro, página, número)" value={r.questao ?? ''} onchange={(e) => salvarFimDia(dia, { questao: e.currentTarget.value })}></textarea></label>
        {:else if p.id === 'tarefas'}
          <label class="cx">Tarefas de amanhã
            <textarea rows="3" placeholder="Uma linha por tarefa" value={r.tarefas ?? ''} onchange={(e) => salvarFimDia(dia, { tarefas: e.currentTarget.value })}></textarea></label>
        {/if}
      </li>
    {/each}
  </ol>
</Linha>
<style>
  .ps { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
  .ck { display: flex; gap: 10px; align-items: flex-start; min-height: 44px; }
  .ck input { width: 24px; height: 24px; accent-color: var(--ac); flex: none; margin-top: 2px; }
  .ck span { display: grid; gap: 1px; } .sub { color: var(--tx2); font-size: .85rem; }
  .cx { display: grid; gap: 4px; font-size: .85rem; color: var(--tx2); margin-top: 6px; }
  textarea { width: 100%; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); font: inherit; }
</style>
