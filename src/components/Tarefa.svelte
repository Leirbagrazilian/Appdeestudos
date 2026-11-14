<script>
  import { app } from '../stores/app.svelte.js';
  import { limitesCota } from '../lib/tarefas.js';
  let { tarefa, materia } = $props();
  const lim = $derived(limitesCota(app.cfg));
</script>

{#if tarefa && !tarefa.semTopico}
  <ol class="passos" aria-label="Tarefa deste bloco">
    {#if tarefa.video}<li><span class="tx"><strong>Vídeo · ~{tarefa.video.min} min</strong>{#if tarefa.video.rotulo}<span class="sub">{tarefa.video.rotulo}</span>{/if}</span><a class="abrir" href={tarefa.video.url} target="_blank" rel="noopener">Abrir ↗</a></li>{/if}
    {#if tarefa.paginas}
      <li><span class="tx"><strong>{tarefa.paginas.livro}</strong><span class="sub">págs {tarefa.paginas.de}–{tarefa.paginas.ate} · ~{tarefa.paginas.min} min{tarefa.paginas.restante ? ` · faltam ${tarefa.paginas.restante} págs do tópico` : ''}</span></span></li>
      {#if tarefa.exercicios}<li><span class="tx"><strong>Exercícios nº {tarefa.exercicios.de}–{tarefa.exercicios.ate}</strong><span class="sub">sem consultar</span></span></li>{/if}
    {:else if tarefa.concluidoLivro}<li><span class="tx"><strong>Livro concluído neste tópico</strong><span class="sub">Faça os exercícios que faltaram ou passe o tópico para "domino" na Trilha.</span></span></li>
    {:else if tarefa.semPaginas && tarefa.temLivro}<li><span class="tx"><strong>Sem páginas cadastradas</strong><span class="sub">O bloco usa vídeo e questões.</span></span><a class="abrir" href="#/livros">Cadastrar páginas</a></li>{/if}
    <li><span class="tx"><strong>{tarefa.zero ? 'Exercícios' : 'Questões'} · {tarefa.questoes.n} do tópico</strong>
      <span class="sub">~{tarefa.questoes.min} min{tarefa.zero ? ' · sem consultar, com correção na hora' : ''}</span>
      {#if tarefa.zero}<span class="sub meta">Meta: 8 de 10 para liberar o próximo tópico{tarefa.repeticao ? `. Repetição ${tarefa.tentativa} de ${tarefa.maxTentativas}: exercícios novos, não os mesmos` : ''}.</span>{/if}
      {#if tarefa.questoes.semLinks}<span class="sub">Cole os links das listas no tópico, na <a class="lk" href="#/trilha">Trilha</a>.</span>{/if}
      {#each tarefa.questoes.fontes as f}
        <a class="fonte" class:esg={f.esgotada} href={f.url} target="_blank" rel="noopener">{f.rotulo}{f.limite != null ? (f.esgotada ? ' · cota de hoje acabou' : ` · restam ${f.restante}`) : ''} ↗</a>
      {/each}
      {#if tarefa.questoes.cotaEsgotada && !tarefa.zero}<span class="aviso">A cota grátis de hoje acabou ({lim.qconcursos} QConcursos + {lim.estuda} Estuda.com). {tarefa.questoes.alternativa === 'pdf' ? 'Use a prova em PDF.' : 'Faça os exercícios do livro.'}</span>{/if}
    </span></li>
  </ol>
{:else if tarefa?.semTopico}<p class="sub">Todos os tópicos de {materia} estão dominados na Trilha. Revise com questões e provas antigas.</p>{/if}

<style>
  .meta { color: var(--ac); }
  .passos { list-style: none; padding: 0; display: grid; gap: 8px; counter-reset: passo; margin: 0; }
  .passos li { counter-increment: passo; display: flex; gap: 10px; align-items: center; border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; }
  .passos li::before { content: counter(passo); width: 26px; height: 26px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--ac); color: var(--ac-tx); font-weight: 700; font-size: .85rem; }
  .tx { flex: 1; display: grid; gap: 2px; } .tx strong { color: var(--tx); font-size: .95rem; }
  .sub { color: var(--tx2); font-size: .85rem; }
  .abrir { color: var(--ac); font-weight: 700; text-decoration: none; min-height: 44px; display: inline-flex; align-items: center; }
  .fonte { color: var(--ac); font-weight: 600; min-height: 36px; display: inline-flex; align-items: center; text-decoration: none; }
  .fonte.esg { color: var(--tx2); text-decoration: line-through; }
  .aviso { color: var(--warn); font-weight: 600; font-size: .85rem; }
  .lk { color: var(--ac); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
</style>
