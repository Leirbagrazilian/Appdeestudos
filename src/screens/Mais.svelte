<script>
  import { app, listaConquistas, fazerBackup } from '../stores/app.svelte.js';
  import { situacao, totalRedacao } from '../lib/erros.js';
  import { diffDays } from '../lib/dates.js';
  import { coberturaGeral } from '../lib/trilha.js';
  import Icon from '../components/Icon.svelte';
  import Ring from '../components/Ring.svelte';

  const media = (e) => { const v = Object.values(e.notas ?? {}); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
  const sims = $derived(Object.values(app.exams).sort((a, b) => a.data.localeCompare(b.data)));
  const ultSim = $derived(sims.at(-1));
  const deltaSim = $derived(sims.length > 1 ? Math.round(media(sims.at(-1)) - media(sims.at(-2))) : null);
  const reds = $derived(Object.values(app.redacoes ?? {}).sort((a, b) => a.data.localeCompare(b.data)));
  const lacunasPct = $derived(coberturaGeral(app.cfg, app.lacunas));
  const ins = $derived(listaConquistas());
  const insOk = $derived(ins.filter((c) => c.ok).length);
  const paraTreinar = $derived(Object.values(app.errors).filter((e) => situacao(e) !== 'dominado').length);
  const diasBackup = $derived(app.ultimoBackup ? diffDays(app.ultimoBackup, app.dia) : null);
  const backupAtrasado = $derived(diasBackup == null || diasBackup >= 7);
  let fazendo = $state(false);
  async function backup() { fazendo = true; try { await fazerBackup(); } finally { fazendo = false; } }
</script>

<header class="pg"><p class="data">Quartel-general</p><h1>QG</h1>
  <p class="sub">Seu painel: desempenho, ferramentas e a segurança dos seus dados.</p></header>

<div class="cards">
  <a class="card c" href="#/simulados">
    <span class="rot">Último simulado</span>
    {#if ultSim}<strong>{Math.round(media(ultSim))}%</strong>
      <span class="sub">{deltaSim == null ? 'primeiro registro' : deltaSim >= 0 ? `▲ ${deltaSim} pontos` : `▼ ${-deltaSim} pontos`}</span>
    {:else}<strong>–</strong><span class="sub">nenhum ainda</span>{/if}
  </a>
  <a class="card c" href="#/redacao">
    <span class="rot">Última redação</span>
    {#if reds.length}<strong>{totalRedacao(reds.at(-1))}</strong><span class="sub">de 1000</span>
    {:else}<strong>–</strong><span class="sub">registre a de domingo</span>{/if}
  </a>
  <a class="card c anel" href="#/trilha">
    <span class="rot">Trilha</span>
    <span class="r"><Ring pct={lacunasPct} size={48} stroke={5} /><strong>{Math.round(lacunasPct * 100)}%</strong></span>
  </a>
  <a class="card c" href="#/erros">
    <span class="rot">Erros para treinar</span>
    <strong>{paraTreinar}</strong><span class="sub">{paraTreinar ? 'toque para treinar' : 'nenhum pendente'}</span>
  </a>
  <a class="card c" href="#/conquistas">
    <span class="rot">Condecorações</span>
    <strong>{insOk}<small> / {ins.length}</small></strong>
  </a>
  <div class="card c backup" class:atrasado={backupAtrasado}>
    <span class="rot">Backup</span>
    <strong class="bk">{diasBackup == null ? 'Nunca feito' : diasBackup === 0 ? 'Feito hoje' : `Há ${diasBackup} ${diasBackup === 1 ? 'dia' : 'dias'}`}</strong>
    <button class="mini" onclick={backup} disabled={fazendo}>{fazendo ? 'Gerando…' : 'Fazer agora'}</button>
  </div>
</div>

<p class="protecao" class:ok={app.persistente}>
  <span class="ponto" aria-hidden="true"></span>
  {#if app.persistente}Dados protegidos: o navegador não vai apagá-los na limpeza automática.
  {:else if app.persistente === false}O navegador não garantiu a proteção dos dados. Instale o app na tela inicial e mantenha o backup em dia.
  {:else}Verificando a proteção dos dados…{/if}
</p>

<h2>Desempenho</h2>
<ul class="grupo card">
  <li><a href="#/progresso"><span class="t"><strong>Progresso</strong><span class="sub">Checkpoint mensal de Matemática e o portão da Fase 0</span></span><Icon nome="ext" size={18} /></a></li>
  <li><a href="#/simulados"><span class="t"><strong>Simulados</strong><span class="sub">Notas por matéria, nota de corte e evolução</span></span><Icon nome="ext" size={18} /></a></li>
  <li><a href="#/revisao"><span class="t"><strong>Revisão da semana</strong><span class="sub">3 perguntas de domingo, resumo e o foco da próxima semana</span></span><Icon nome="clock" size={18} /></a></li>
  <li><a href="#/redacao"><span class="t"><strong>Redação</strong><span class="sub">Nota por competência, checklist e evolução</span></span><Icon nome="ext" size={18} /></a></li>
  <li><a href="#/trilha"><span class="t"><strong>Trilha</strong><span class="sub">Tópicos de cada matéria, seu domínio e o que estudar a seguir</span></span><Icon nome="mapa" size={18} /></a></li>
  <li><a href="#/conquistas"><span class="t"><strong>Condecorações e campanhas</strong><span class="sub">Suas medalhas e as fases concluídas</span></span><Icon nome="trofeu" size={18} /></a></li>
</ul>

<h2>Recursos</h2>
<ul class="grupo card">
  <li><a href="#/livros"><span class="t"><strong>Meus livros</strong><span class="sub">Livros, vídeos e sites por matéria; páginas e ritmo de leitura</span></span><Icon nome="mapa" size={18} /></a></li>
  <li><a href="#/questoes"><span class="t"><strong>Onde achar questões</strong><span class="sub">Provas e gabaritos: Escola Naval, EFOMM, ITA e ENEM</span></span><Icon nome="ext" size={18} /></a></li>
</ul>

<h2>Sistema</h2>
<ul class="grupo card">
  <li><a href="#/ajustes"><span class="t"><strong>Ajustes</strong><span class="sub">Animações, texto, vibração, sons, carta, datas, metas e backup</span></span><Icon nome="ext" size={18} /></a></li>
</ul>

<style>
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 8px; }
  .c { padding: 14px; display: grid; gap: 2px; align-content: start; text-decoration: none; color: inherit; min-height: 104px; }
  .rot { font-size: .8125rem; color: var(--ac2); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
  .c strong { font-size: 1.8rem; font-weight: 600; color: var(--ac); line-height: 1.2; }
  .c strong small { font-size: 1rem; color: var(--tx2); }
  .anel .r { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
  .anel strong { font-size: 1.4rem; }
  .backup .bk { font-size: 1.1rem; color: var(--tx); }
  .backup.atrasado { border-color: var(--warn); } .backup.atrasado .bk { color: var(--warn); }
  .mini { margin-top: 8px; min-height: 44px; border-radius: 12px; background: var(--ac); color: var(--ac-tx); font-weight: 700; }
  .mini:disabled { opacity: .6; }
  .protecao { display: flex; gap: 10px; align-items: flex-start; margin: 14px 4px 0; font-size: .85rem; color: var(--warn); }
  .protecao.ok { color: var(--tx2); }
  .ponto { width: 10px; height: 10px; border-radius: 50%; background: currentColor; flex: none; margin-top: 5px; }
  .protecao.ok .ponto { background: #36e0b4; }
  a { display: flex; align-items: center; gap: 12px; padding: 16px; min-height: 72px; text-decoration: none; color: inherit; }
  li a :global(svg) { color: var(--ac); flex: none; }
  .t { flex: 1; display: grid; gap: 2px; }
</style>
