<script>
  import { flushSync } from 'svelte';
  import { app, iniciar, pf } from './stores/app.svelte.js';
  import { estado, fmtRelogio } from './lib/foco.js';
  import { movimentoReduzido } from './lib/prefs.js';
  import Enxame from './components/Enxame.svelte';
  import Bat from './components/Bat.svelte';
  import Hoje from './screens/Hoje.svelte';
  import Semana from './screens/Semana.svelte';
  import Calendario from './screens/Calendario.svelte';
  import Erros from './screens/Erros.svelte';
  import Mais from './screens/Mais.svelte';
  import Simulados from './screens/Simulados.svelte';
  import Ajustes from './screens/Ajustes.svelte';
  import Questoes from './screens/Questoes.svelte';
  import Foco from './screens/Foco.svelte';
  import Trilha from './screens/Trilha.svelte';
  import Conquistas from './screens/Conquistas.svelte';
  import Redacao from './screens/Redacao.svelte';

  const abas = [
    { id: 'hoje', nome: 'Hoje', d: 'M5 12.5l4.5 4.5L19 7.5' },
    { id: 'semana', nome: 'Semana', d: 'M4 6h16M4 12h16M4 18h10' },
    { id: 'calendario', nome: 'Calendário', d: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4' },
    { id: 'erros', nome: 'Erros', d: 'M12 8v5M12 17h.01M12 3l9 16H3z' },
    { id: 'mais', nome: 'QG', d: 'M4 20V10l8-6 8 6v10h-5v-6H9v6z' },
  ];
  // Ordem das telas: define se a transição desliza para a esquerda ou para a direita.
  const ORDEM = ['hoje', 'foco', 'semana', 'calendario', 'erros', 'mais', 'simulados', 'redacao', 'trilha', 'conquistas', 'questoes', 'ajustes'];
  const SUB_MAIS = ['simulados', 'ajustes', 'questoes', 'trilha', 'conquistas', 'redacao'];
  const ler = () => { const r = location.hash.replace('#/', '').split('?')[0] || 'hoje'; return r === 'lacunas' ? 'trilha' : r; }; // links antigos do mapa de lacunas
  let rota = $state(ler());

  function navegar() {
    const nova = ler();
    if (nova === rota) return;
    const trocar = () => { rota = nova; scrollTo(0, 0); };
    if (!document.startViewTransition || movimentoReduzido()) return trocar();
    document.documentElement.dataset.dir = ORDEM.indexOf(nova) >= ORDEM.indexOf(rota) ? 'frente' : 'tras';
    document.startViewTransition(() => flushSync(trocar));
  }
  $effect(() => { addEventListener('hashchange', navegar); return () => removeEventListener('hashchange', navegar); });
  $effect(() => { const t = app.cfg.tema ?? 'noir'; document.documentElement.dataset.theme = t; document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'noir' ? '#08080b' : '#ffffff'); });

  // Relógio da barrinha do cronômetro (fora da tela Foco).
  let agora = $state(Date.now());
  $effect(() => { const i = setInterval(() => (agora = Date.now()), 1000); return () => clearInterval(i); });
  const est = $derived(app.timer ? estado(app.timer, agora) : null);
  const mostrarEnxame = $derived(pf().animacoes === 'completas');
  iniciar();
</script>

{#if mostrarEnxame}<Enxame />{/if}
<main>
  {#if !app.pronto}
    <p class="muted">Carregando…</p>
  {:else if rota === 'hoje'}<Hoje />
  {:else if rota === 'foco'}<Foco />
  {:else if rota === 'semana'}<Semana />
  {:else if rota === 'calendario'}<Calendario />
  {:else if rota === 'erros'}<Erros />
  {:else if rota === 'simulados'}<Simulados />
  {:else if rota === 'ajustes'}<Ajustes />
  {:else if rota === 'questoes'}<Questoes />
  {:else if rota === 'trilha'}<Trilha />
  {:else if rota === 'conquistas'}<Conquistas />
  {:else if rota === 'redacao'}<Redacao />
  {:else}<Mais />{/if}
</main>

{#if app.timer && est && rota !== 'foco'}
  <a class="cron" href="#/foco" class:alto={!!app.toast} class:fim={est.acabou || app.timer.fase === 'fim'} aria-label="Abrir cronômetro de {app.timer.titulo}">
    <span class="pulso" aria-hidden="true"></span>
    <span class="ct">{app.timer.fase === 'pausa' ? 'Pausa' : app.timer.fase === 'fim' ? 'Registrar' : app.timer.materia}</span>
    <strong>{app.timer.fase === 'fim' ? 'bloco' : est.acabou ? 'Tempo!' : fmtRelogio(est.restante)}</strong>
  </a>
{/if}

{#if app.insignia}
  <div class="insignia" role="status">
    <span class="selo" aria-hidden="true"><Bat size={26} /></span>
    <span><small>Insígnia desbloqueada</small><strong>{app.insignia.nome}</strong><em>{app.insignia.desc}</em></span>
  </div>
{/if}

{#if app.toast}
  <div class="toast" role="status">
    <span class="tx"><strong>{app.toast.msg}</strong><em>{app.toast.sub}</em></span>
    {#if app.toast.desfazer}<button onclick={app.toast.desfazer}>Desfazer</button>{/if}
  </div>
{/if}

<nav aria-label="Principal">
  {#each abas as a}
    {@const ativa = rota === a.id || (a.id === 'mais' && SUB_MAIS.includes(rota)) || (a.id === 'hoje' && rota === 'foco')}
    <a href="#/{a.id}" class:ativa aria-current={ativa ? 'page' : undefined}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d={a.d} /></svg>
      <span>{a.nome}</span>
    </a>
  {/each}
</nav>

<style>
  main { position: relative; z-index: 1; max-width: 640px; margin: 0 auto; padding: 16px 16px calc(100px + env(safe-area-inset-bottom)); view-transition-name: tela; }
  nav { z-index: 5; position: fixed; inset: auto 0 0; display: flex; justify-content: center; background: var(--card); border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom); view-transition-name: nav; }
  nav a { flex: 1; max-width: 128px; min-height: 64px; display: grid; place-items: center; align-content: center; gap: 2px; text-decoration: none; color: var(--tx2); font-size: .8125rem; font-weight: 500; }
  nav a svg { transition: transform .25s cubic-bezier(.3,1.6,.5,1); }
  nav a.ativa { color: var(--ac); font-weight: 700; }
  nav a.ativa svg { transform: translateY(-2px) scale(1.1); }
  nav svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

  .cron { z-index: 5; position: fixed; right: 12px; bottom: calc(76px + env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px; border-radius: 99px; background: var(--ac); color: var(--ac-tx); text-decoration: none; font-weight: 600; font-size: .9rem; box-shadow: 0 6px 20px rgba(0,0,0,.35); view-transition-name: cron; }
  .cron.alto { bottom: calc(150px + env(safe-area-inset-bottom)); }
  .cron strong { font-variant-numeric: tabular-nums; }
  .pulso { width: 8px; height: 8px; border-radius: 50%; background: var(--ac-tx); animation: pisca 1.2s ease-in-out infinite; }
  .cron.fim { animation: chama .9s ease-in-out infinite alternate; }
  @keyframes pisca { 50% { opacity: .25; } }
  @keyframes chama { to { transform: scale(1.06); } }

  .insignia { z-index: 7; position: fixed; left: 50%; top: calc(12px + env(safe-area-inset-top)); transform: translateX(-50%); width: min(92vw, 420px); display: flex; gap: 12px; align-items: center; padding: 12px 16px; border-radius: 16px; background: var(--card); border: 1px solid var(--ac); box-shadow: 0 10px 30px rgba(0,0,0,.4); animation: desce .45s cubic-bezier(.3,1.4,.5,1); }
  .insignia span:last-child { display: grid; }
  .insignia small { color: var(--ac2); font-size: .8125rem; text-transform: uppercase; letter-spacing: .08em; font-weight: 600; }
  .insignia em { color: var(--tx2); font-size: .85rem; font-style: normal; }
  .selo { width: 48px; height: 48px; flex: none; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 50% 40%, #f4d675, var(--ac) 70%); color: #0a0a0c; }
  @keyframes desce { from { opacity: 0; transform: translate(-50%, -16px) scale(.96); } }

  .toast { z-index: 6; position: fixed; left: 50%; bottom: calc(80px + env(safe-area-inset-bottom)); transform: translateX(-50%); width: min(92vw, 420px); display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 4px 8px 4px 16px; border-radius: 14px; background: var(--card); color: var(--tx); border: 1px solid var(--ac); box-shadow: 0 8px 24px rgba(0,0,0,.35); animation: sobe .25s ease; view-transition-name: toast; }
  .tx { display: grid; padding: 6px 0; } .tx em { color: var(--ac2); font-size: .85rem; font-style: normal; }
  .toast button { min-height: 44px; padding: 0 12px; font-weight: 700; color: var(--ac); }
  @keyframes sobe { from { opacity: 0; transform: translate(-50%, 12px); } }
</style>
