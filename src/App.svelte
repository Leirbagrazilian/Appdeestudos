<script>
  import { app, iniciar } from './stores/app.svelte.js';
  import Hoje from './screens/Hoje.svelte';
  import EmBreve from './screens/EmBreve.svelte';

  const abas = [
    { id: 'hoje', nome: 'Hoje', d: 'M5 12.5l4.5 4.5L19 7.5' },
    { id: 'semana', nome: 'Semana', d: 'M4 6h16M4 12h16M4 18h10' },
    { id: 'calendario', nome: 'Calendário', d: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4' },
    { id: 'erros', nome: 'Erros', d: 'M12 8v5M12 17h.01M12 3l9 16H3z' },
    { id: 'mais', nome: 'Mais', d: 'M5 12h.01M12 12h.01M19 12h.01' },
  ];
  const ler = () => location.hash.replace('#/', '') || 'hoje';
  let rota = $state(ler());
  $effect(() => { const f = () => (rota = ler()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); });
  iniciar();
</script>

<main>
  {#if !app.pronto}
    <p class="muted">Carregando…</p>
  {:else if rota === 'hoje'}<Hoje />
  {:else if rota === 'semana'}<EmBreve titulo="Semana" etapa="Semana" />
  {:else if rota === 'calendario'}<EmBreve titulo="Calendário" etapa="Calendário" />
  {:else if rota === 'erros'}<EmBreve titulo="Caderno de erros" etapa="Caderno de erros" />
  {:else}<EmBreve titulo="Mais" etapa="Simulados e Ajustes" />{/if}
</main>

{#if app.toast}
  <div class="toast" role="status">
    <span>{app.toast.msg}</span>
    <button onclick={app.toast.desfazer}>Desfazer</button>
  </div>
{/if}

<nav aria-label="Principal">
  {#each abas as a}
    <a href="#/{a.id}" class:ativa={rota === a.id} aria-current={rota === a.id ? 'page' : undefined}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d={a.d} /></svg>
      <span>{a.nome}</span>
    </a>
  {/each}
</nav>

<style>
  main { max-width: 640px; margin: 0 auto; padding: 16px 16px calc(100px + env(safe-area-inset-bottom)); }
  nav { position: fixed; inset: auto 0 0; display: flex; justify-content: center; background: var(--card); border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom); }
  nav a { flex: 1; max-width: 128px; min-height: 64px; display: grid; place-items: center; align-content: center; gap: 2px; text-decoration: none; color: var(--tx2); font-size: .75rem; font-weight: 500; }
  nav a.ativa { color: var(--ac); font-weight: 700; }
  nav svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .toast { position: fixed; left: 50%; bottom: calc(80px + env(safe-area-inset-bottom)); transform: translateX(-50%); width: min(92vw, 420px); display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 4px 8px 4px 16px; border-radius: 14px; background: #1f2937; color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.25); animation: sobe .25s ease; }
  .toast button { min-height: 44px; padding: 0 12px; font-weight: 700; color: #5eead4; }
  @keyframes sobe { from { opacity: 0; transform: translate(-50%, 12px); } }
</style>
