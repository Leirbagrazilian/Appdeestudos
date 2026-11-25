<script>
  import { passosDoBloco, tituloTarefa, cincoDoTimer, TIMER_MIN } from '../lib/bloco.js';
  import { fmtRelogio, estado } from '../lib/foco.js';
  import { app, iniciarCinco, cancelarFoco } from '../stores/app.svelte.js';
  import PedidoClaude from './PedidoClaude.svelte';
  // Destaque do bloco ATUAL (pelo horário): tarefa concreta, passos e o botão "Começar". O cronômetro vive em app.timer (IndexedDB, por timestamps): sair do app não o reinicia.
  let { info, tarefa, ctx = {}, faseId, onFoco } = $props();
  const b = $derived(info.bloco);
  const passos = $derived(passosDoBloco(tarefa, ctx));
  const titulo = $derived(tituloTarefa(b, tarefa));
  let agora = $state(Date.now());
  const timer = $derived(app.timer);
  const meu = $derived(timer?.id === b.id);
  $effect(() => {
    if (!timer) return;
    const tick = () => (agora = Date.now());
    tick();
    const i = setInterval(tick, 500);
    document.addEventListener('visibilitychange', tick); window.addEventListener('pageshow', tick);
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', tick); window.removeEventListener('pageshow', tick); };
  });
  const t5 = $derived(meu ? cincoDoTimer(timer, b.id, agora) : null);
  const est = $derived(meu ? estado(timer, agora) : null);
  const ROTULO = { agora: 'Bloco de agora', proximo: 'Próximo bloco', atrasado: 'Bloco que ficou para trás' };
  function comecar() { agora = Date.now(); iniciarCinco({ ...b, tarefa: tarefa ?? null }); }
</script>
<section class="card atual" aria-label={ROTULO[info.quando]}>
  <p class="data">{ROTULO[info.quando]} · {b.ini}–{b.fim}</p>
  <h2>{titulo}</h2>
  {#if tarefa?.topico}<p class="sub">{b.materia} · {tarefa.topico}</p>{:else}<p class="sub">{b.titulo}</p>{/if}
  {#if meu && est}
    <div class="t5" role="timer" aria-live="off">
      {#if t5 && !t5.acabou}
        <strong>{fmtRelogio(t5.restante * 1000)}</strong>
        <span>Só {TIMER_MIN} minutos. Depois você decide.</span>
      {:else}
        <strong>{est.acabou ? 'Tempo!' : fmtRelogio(est.restante)}</strong>
        <span>{t5?.acabou && !est.acabou ? `Os ${TIMER_MIN} minutos passaram. Agora é só seguir.` : timer.fase === 'pausa' ? 'Pausa.' : 'Tempo do bloco.'}</span>
      {/if}
    </div>
    <div class="bts">
      <button type="button" class="pri" onclick={onFoco}>Continuar no cronômetro do bloco</button>
      <button type="button" class="sec" onclick={cancelarFoco}>Parar</button>
    </div>
  {:else if timer}
    <p class="sub">Cronômetro rodando: {timer.titulo}</p>
    <a class="pri link" href="#/foco">Abrir o modo foco</a>
  {:else}
    <button type="button" class="pri grande" onclick={comecar}>Começar</button>
    <p class="sub">Celular em outro cômodo. A promessa é só {TIMER_MIN} minutos.</p>
  {/if}
  {#if passos.length}
    <ol class="passos" aria-label="Passos do bloco">
      {#each passos as p (p.id)}
        <li><strong>{p.titulo}</strong>{#if p.detalhe}<span class="sub">{p.detalhe}</span>{/if}
          {#if p.url}<a href={p.url} target="_blank" rel="noopener">Abrir a aula ↗</a>{/if}
          {#if p.id === 'questoes' && tarefa?.topico}<PedidoClaude topico={tarefa.topico} n={10} {faseId} />{/if}
        </li>
      {/each}
    </ol>
  {/if}
</section>
<style>
  .atual { margin-top: 16px; padding: 16px; display: grid; gap: 10px; border: 2px solid var(--ac); }
  .data { color: var(--ac); font-size: .8125rem; text-transform: uppercase; letter-spacing: .1em; font-weight: 700; margin: 0; }
  h2 { margin: 0; font-size: 1.25rem; line-height: 1.3; }
  .sub { color: var(--tx2); font-size: .85rem; margin: 0; }
  .pri, .sec { min-height: 48px; border-radius: 14px; font-weight: 700; padding: 0 16px; }
  .pri { background: var(--ac); color: var(--ac-tx); } .sec { border: 1px solid var(--line); color: var(--tx); }
  .link { display: grid; place-items: center; text-decoration: none; }
  .grande { min-height: 56px; font-size: 1.1rem; }
  .bts { display: grid; gap: 8px; }
  .t5 { display: grid; gap: 2px; text-align: center; padding: 8px; border-radius: 14px; background: var(--ac-bg); }
  .t5 strong { font-size: 2.2rem; font-variant-numeric: tabular-nums; color: var(--ac); }
  .t5 span { color: var(--tx2); font-size: .9rem; }
  .passos { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; counter-reset: p; }
  .passos li { counter-increment: p; display: grid; gap: 2px; padding: 8px 10px 8px 40px; border: 1px solid var(--line); border-radius: 12px; position: relative; font-size: .95rem; }
  .passos li::before { content: counter(p); position: absolute; left: 10px; top: 10px; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--ac); color: var(--ac-tx); font-size: .8125rem; font-weight: 700; }
  .passos a { color: var(--ac); font-weight: 700; min-height: 44px; display: inline-flex; align-items: center; text-decoration: none; }
</style>
