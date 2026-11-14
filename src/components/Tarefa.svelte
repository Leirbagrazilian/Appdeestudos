<script>
  import { app, avisar } from '../stores/app.svelte.js';
  import { limitesCota, linksDoBloco } from '../lib/tarefas.js';
  import { fichaDoTopico } from '../lib/erros.js';
  let { tarefa, materia } = $props();
  const lim = $derived(limitesCota(app.cfg));
  // ficha de revisão rápida: seus últimos erros neste tópico, para reler antes de começar
  const ficha = $derived(tarefa?.topico ? fichaDoTopico(Object.values(app.errors), tarefa.materia ?? materia, tarefa.topico) : null);
  const TIPO = { conteudo: 'conteúdo', atencao: 'atenção', tempo: 'tempo' };
  const todos = $derived(linksDoBloco(tarefa));
  function abrirTudo() {
    for (const l of todos) window.open(l.url, '_blank', 'noopener');
    avisar(`Abrindo ${todos.length} links do bloco`, null, 'Se só um abrir, permita pop-ups deste site ou toque nos links, um por vez.');
  }
</script>

{#if tarefa && !tarefa.semTopico}
  {#if ficha?.total}
    <details class="ficha">
      <summary>Antes de começar: {ficha.total === 1 ? '1 erro seu' : `${ficha.total} erros seus`} neste tópico{ficha.abertos ? '' : ' (já dominados)'}</summary>
      <ul>
        {#each ficha.itens as e (e.id)}
          <li><strong>{e.assunto}</strong><span class="sub"> · {TIPO[e.tipo] ?? e.tipo}{e.status === 'dominado' ? ' · dominado' : ''}</span>{#if e.licao}<span class="licao">{e.licao}</span>{:else}<span class="sub licao">Sem lição escrita: diga em voz alta o que faria diferente.</span>{/if}</li>
        {/each}
      </ul>
      <a class="lk" href="#/erros">{ficha.abertos ? 'Treinar no caderno de erros' : 'Ver no caderno de erros'}</a>
    </details>
  {/if}
  <ol class="passos" aria-label="Tarefa deste bloco">
    {#if tarefa.video}<li><span class="tx"><strong>Vídeo · ~{tarefa.video.min} min</strong>{#if tarefa.video.rotulo}<span class="sub">{tarefa.video.rotulo}</span>{/if}
      {#each tarefa.video.buscas ?? [] as f}<a class="fonte" href={f.url} target="_blank" rel="noopener">{f.rotulo} ↗<small class="auto">busca automática</small></a>{/each}
    </span><a class="abrir" href={tarefa.video.url} target="_blank" rel="noopener">Abrir ↗</a></li>{/if}
    {#if tarefa.paginas}
      <li><span class="tx"><strong>{tarefa.paginas.livro}</strong><span class="sub">págs {tarefa.paginas.de}–{tarefa.paginas.ate} · ~{tarefa.paginas.min} min{tarefa.paginas.restante ? ` · faltam ${tarefa.paginas.restante} págs do tópico` : ''}</span></span></li>
      {#if tarefa.exercicios}<li><span class="tx"><strong>Exercícios nº {tarefa.exercicios.de}–{tarefa.exercicios.ate}</strong><span class="sub">sem consultar</span></span></li>{/if}
    {:else if tarefa.concluidoLivro}<li><span class="tx"><strong>Livro concluído neste tópico</strong><span class="sub">Faça os exercícios que faltaram ou passe o tópico para "domino" na Trilha.</span></span></li>
    {:else if tarefa.semPaginas && tarefa.temLivro}<li><span class="tx"><strong>Sem páginas cadastradas</strong><span class="sub">O bloco usa vídeo e questões.</span></span><a class="abrir" href="#/livros">Cadastrar páginas</a></li>{/if}
    <li><span class="tx"><strong>{tarefa.zero ? 'Exercícios' : 'Questões'} · {tarefa.questoes.n} do tópico</strong>
      <span class="sub">~{tarefa.questoes.min} min{tarefa.zero ? ' · sem consultar, com correção na hora' : ''}</span>
      {#if tarefa.zero}<span class="sub meta">Meta: 8 de 10 para liberar o próximo tópico{tarefa.repeticao ? `. Repetição ${tarefa.tentativa} de ${tarefa.maxTentativas}: exercícios novos, não os mesmos` : ''}.</span>{/if}
      {#if tarefa.questoes.semLinks && !tarefa.questoes.buscas?.length}<span class="sub">Cole os links das listas no tópico, na <a class="lk" href="#/trilha">Trilha</a>.</span>{/if}
      {#each tarefa.questoes.fontes as f}
        <a class="fonte" class:esg={f.esgotada} href={f.url} target="_blank" rel="noopener">{f.rotulo}{f.limite != null ? (f.esgotada ? ' · cota de hoje acabou' : ` · restam ${f.restante}`) : ''} ↗</a>
      {/each}
      {#each tarefa.questoes.buscas ?? [] as f}<a class="fonte" href={f.url} target="_blank" rel="noopener">{f.rotulo} ↗<small class="auto">busca automática</small></a>{/each}
      {#if tarefa.questoes.buscas?.length}<span class="sub">Achou uma lista boa? Cole o link no tópico, na <a class="lk" href="#/trilha">Trilha</a>, e ela passa a abrir direto.</span>{/if}
      {#if tarefa.questoes.cotaEsgotada && !tarefa.zero}<span class="aviso">A cota grátis de hoje acabou ({lim.qconcursos} QConcursos + {lim.estuda} Estuda.com). {tarefa.questoes.alternativa === 'pdf' ? 'Use a prova em PDF.' : 'Faça os exercícios do livro.'}</span>{/if}
    </span></li>
  </ol>
  {#if todos.length > 1}<button type="button" class="tudo" onclick={abrirTudo}>Abrir tudo do bloco ({todos.length} links) ↗</button>{/if}
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
  .fonte { gap: 8px; flex-wrap: wrap; }
  .auto { color: var(--tx2); font-weight: 500; font-size: .75rem; border: 1px solid var(--line); border-radius: 99px; padding: 1px 8px; }
  .tudo { width: 100%; min-height: 44px; margin-top: 8px; border: 1px solid var(--line); border-radius: 14px; color: var(--ac); font-weight: 700; }
  .ficha { border: 1px solid var(--line); border-radius: 14px; padding: 4px 12px; margin-bottom: 8px; }
  .ficha summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; color: var(--warn); font-weight: 600; font-size: .9rem; }
  .ficha ul { list-style: none; padding: 0; margin: 0 0 8px; display: grid; gap: 8px; }
  .ficha li { font-size: .9rem; color: var(--tx); }
  .licao { display: block; }
  .aviso { color: var(--warn); font-weight: 600; font-size: .85rem; }
  .lk { color: var(--ac); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
</style>
