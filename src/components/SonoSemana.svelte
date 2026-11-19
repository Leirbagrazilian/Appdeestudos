<script>
  import { app } from '../stores/app.svelte.js';
  import { resumoSono, alertaSono, fmtH } from '../lib/sono.js';
  import { fmtBR } from '../lib/dates.js';

  // Horas por noite da semana que começa em `seg`, média e noites abaixo de 7 h em destaque; alerta se a média ficar abaixo de 7 h por 2 semanas.
  let { seg } = $props();
  const r = $derived(resumoSono(app.cfg, app.sono, seg));
  const alerta = $derived(alertaSono(app.cfg, app.sono, seg));
</script>

<section class="card sono" aria-label="Sono da semana">
  <div class="topo"><p class="big">{r.media == null ? '-' : fmtH(r.media)}</p>
    <p class="sub">média de sono ({r.registradas} de 7 noites registradas){r.abaixo7 ? ` · ${r.abaixo7} ${r.abaixo7 === 1 ? 'noite' : 'noites'} abaixo de 7 h` : ''}</p></div>
  <ul class="noites">
    {#each r.noites as n (n.dia)}
      <li class:baixa={n.abaixo7} class:vazia={n.horas == null}>
        <span class="d">{n.nome}</span>
        <strong>{n.horas == null ? '-' : fmtH(n.horas)}</strong>
        <span class="sub">{n.q ? `q ${n.q}` : n.horas == null ? 'sem registro' : ''}</span>
      </li>
    {/each}
  </ul>
  {#if alerta.alerta}<p class="alerta" role="alert">{alerta.texto}</p>{/if}
  <p class="sub">O sono não entra na sequência de constância. Noites registradas na tela Hoje, de manhã.</p>
</section>

<style>
  .sono { padding: 14px 16px; display: grid; gap: 10px; }
  .topo { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
  .big { margin: 0; font-size: 1.6rem; font-weight: 600; color: var(--ac); font-variant-numeric: tabular-nums; }
  .noites { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .noites li { display: grid; gap: 2px; justify-items: center; padding: 8px 2px; border-radius: 10px; border: 1px solid var(--line); min-height: 64px; align-content: center; text-align: center; }
  .noites li.baixa { background: var(--al-bg); border-color: var(--al); color: var(--al); }
  .noites li.baixa .sub { color: var(--al); }
  .d { font-size: .8125rem; font-weight: 600; text-transform: uppercase; color: var(--tx2); }
  .baixa .d { color: var(--al); }
  .noites strong { font-size: .9rem; font-variant-numeric: tabular-nums; }
  .vazia strong { color: var(--tx2); font-weight: 500; }
  .sub { color: var(--tx2); font-size: .8125rem; }
  .alerta { margin: 0; background: var(--al-bg); color: var(--al); border-radius: 12px; padding: 10px 12px; font-size: .9rem; font-weight: 600; }
</style>
