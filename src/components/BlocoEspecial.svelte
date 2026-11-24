<script>
  import { app, registrarProvaFeita } from '../stores/app.svelte.js';
  import { PASSOS_PROVA } from '../lib/provasantigas.js';
  import { sobraNoCaderno } from '../lib/erros.js';
  // Blocos especiais: prova antiga/correção (fluxo de 4 passos), resgate de sábado e revisão de domingo.
  let { b, nomeProva = '' } = $props();
  let lento = $state('');
  const abertos = $derived(sobraNoCaderno(Object.values(app.errors), 99).length);
  const agendado = $derived(Object.values(app.reviews).some((r) => r.origem === `prova:${b.id}`));
</script>
{#if b.cat === 'prova' || b.cat === 'corr'}
  <ol class="ps" aria-label="Fluxo da prova antiga">
    {#each PASSOS_PROVA as p (p.id)}<li><strong>{p.titulo}</strong><span class="sub">{p.detalhe}</span></li>{/each}
  </ol>
  <label class="cx">Onde foi lento (tipo de questão)<input bind:value={lento} placeholder="ex.: geometria analítica, termologia" /></label>
  <button type="button" class="pri" disabled={agendado} onclick={() => registrarProvaFeita(b, nomeProva || b.titulo, lento)}>{agendado ? 'Refazer já agendado' : 'Prova feita: agendar o refazer'}</button>
{:else if b.cat === 'resg'}
  <p class="sub">Resgate de 2 h: só tópicos que não passaram e erros. Sem matéria nova.</p>
{:else if b.cat === 'revl'}
  <ol class="ps">
    <li><strong>Revisão intercalada</strong><span class="sub">Misture 2 ou 3 tópicos da semana, alternando as matérias.</span></li>
    <li><strong>Caderno de erros refeito sem olhar a resolução</strong><span class="sub">{abertos} {abertos === 1 ? 'erro aberto' : 'erros abertos'}. Acertou 2 vezes, sai do caderno.</span></li>
  </ol>
  <a class="pri" href="#/erros">Treinar o caderno de erros</a>
{/if}
<style>
  .ps { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
  .ps li { display: grid; gap: 2px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 12px; }
  .sub { color: var(--tx2); font-size: .85rem; margin: 0; }
  .cx { display: grid; gap: 4px; font-size: .85rem; color: var(--tx2); }
  input { min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); }
  .pri { min-height: 48px; border-radius: 14px; font-weight: 700; background: var(--ac); color: var(--ac-tx); display: grid; place-items: center; text-decoration: none; }
  .pri:disabled { opacity: .6; }
</style>
