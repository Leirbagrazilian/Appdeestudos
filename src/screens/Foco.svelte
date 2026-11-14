<script>
  import { app, pf, encerrarSessao, proximaSessao, concluirFoco, cancelarFoco, atualizarTimer } from '../stores/app.svelte.js';
  import { estado, fmtRelogio, minutosFoco } from '../lib/foco.js';
  import { vibrar } from '../lib/prefs.js';
  import { sino, ambiente, ambienteLigado } from '../lib/audio.js';
  import Icon from '../components/Icon.svelte';
  import Emblema from '../components/Emblema.svelte';
  import Tarefa from '../components/Tarefa.svelte';
  import Chips from '../components/Chips.svelte';
  import { limitesCota } from '../lib/tarefas.js';

  let agora = $state(Date.now());
  $effect(() => {
    const tick = () => (agora = Date.now());
    const i = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', tick); };
  });
  const t = $derived(app.timer);
  const est = $derived(t ? estado(t, agora) : null);

  // Aviso (vibração e som) uma única vez quando a fase termina com o app aberto.
  $effect(() => {
    if (t && est?.acabou && !t.avisado) { vibrar(pf(), 'fim'); if (pf().sons) sino(); atualizarTimer((x) => ({ ...x, avisado: true })); }
  });
  // Mantém a tela acesa enquanto esta tela estiver aberta.
  $effect(() => {
    let lock;
    const pedir = async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch { /* sem suporte */ } };
    const vis = () => { if (!document.hidden) pedir(); };
    pedir(); document.addEventListener('visibilitychange', vis);
    return () => { lock?.release?.(); document.removeEventListener('visibilitychange', vis); };
  });

  let som = $state(ambienteLigado());
  function alternarSom() { som = !som; ambiente(som); vibrar(pf(), 'toque'); }

  const reg = (f) => atualizarTimer((x) => ({ ...x, registro: f({ ...x.registro }) }));
  const acertei = () => { vibrar(pf(), 'toque'); reg((r) => ({ ...r, feitas: r.feitas + 1, acertos: r.acertos + 1 })); };
  const errei = () => { vibrar(pf(), 'toque'); reg((r) => ({ ...r, feitas: r.feitas + 1 })); };
  const desfazerQ = () => reg((r) => (r.feitas ? { ...r, feitas: r.feitas - 1, acertos: Math.min(r.acertos, r.feitas - 1) } : r));
  const erros = $derived(t ? t.registro.feitas - t.registro.acertos : 0);

  const opcoesSite = $derived([...(app.cfg.sitesQuestoes ?? []).map((s) => ({ id: s.id, nome: s.nome })), { id: 'livro', nome: 'Livro' }]);
  const cotaFim = $derived.by(() => {
    const s = t?.registro?.site, lim = limitesCota(app.cfg);
    return (s === 'qconcursos' || s === 'estuda') && (app.cotas[app.dia]?.[s] ?? 0) + (t.registro.feitas ?? 0) >= lim[s];
  });
  const pausas = $derived(app.cfg.pausasAtivas ?? []);
  const exercicio = $derived(t && pausas.length ? pausas[(t.sessao + new Date().getDate()) % pausas.length] : '');
  const android = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  const intentTimer = $derived(t && est ? `intent:#Intent;action=android.intent.action.SET_TIMER;i.android.intent.extra.alarm.LENGTH=${Math.max(60, Math.round(est.restante / 1000))};B.android.intent.extra.alarm.SKIP_UI=true;S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(t.fase === 'pausa' ? 'Fim da pausa' : `Fim da sessão: ${t.materia}`)};end` : '');

  const R = 96, C = 2 * Math.PI * R;
  async function concluir() { await concluirFoco(); location.hash = '#/hoje'; }
  async function cancelar() { if (confirm('Cancelar o cronômetro? O tempo desta sessão não será registrado.')) { await cancelarFoco(); ambiente(false); location.hash = '#/hoje'; } }
</script>

{#if !t || !est}
  <header class="pg"><p class="data">Modo foco</p><h1>Nenhum cronômetro</h1>
    <p class="sub">Na tela Hoje, toque no ▶ ao lado de um bloco para começar.</p></header>
  <a class="pri bloco" href="#/hoje">Ir para Hoje</a>
{:else}
  <header class="pg">
    <p class="data">Modo foco · {t.fase === 'pausa' ? 'pausa' : t.fase === 'fim' ? 'registro final' : `sessão ${t.sessao} de ${t.sessoes}`}</p>
    <h1>{t.titulo}</h1>
    <p class="sub">{minutosFoco(t, agora)} min de foco até agora{t.registro.feitas ? ` · ${t.registro.acertos}/${t.registro.feitas} questões` : ''}</p>
  </header>

  {#if t.tarefa && t.fase !== 'fim'}<div class="tarefa"><Tarefa tarefa={t.tarefa} materia={t.materia} /></div>{/if}

  {#if t.fase !== 'fim'}
    <div class="relogio" class:pausa={t.fase === 'pausa'} class:acabou={est.acabou}>
      <svg viewBox="0 0 220 220" aria-hidden="true">
        <circle cx="110" cy="110" r={R} class="trilho" />
        <circle cx="110" cy="110" r={R} class="arco" stroke-dasharray={C} stroke-dashoffset={C * (1 - est.pct)} transform="rotate(-90 110 110)" />
      </svg>
      <div class="centro" role="timer" aria-live="off" aria-label="Tempo restante">
        <span class="tempo">{est.acabou ? 'Tempo!' : fmtRelogio(est.restante)}</span>
        <span class="fase">{t.fase === 'pausa' ? 'pausa' : 'foco'}</span>
      </div>
      {#if est.acabou}<span class="fim-emb" aria-hidden="true"><Emblema nome="estrela" size={34} /></span>{/if}
    </div>
  {/if}

  {#if t.fase === 'foco'}
    {#if est.acabou}<p class="aviso entra" role="status">Sessão completa. {t.sessao < t.sessoes ? 'Hora da pausa: registre o que fez e alongue.' : 'Último trecho feito: registre e conclua o bloco.'}</p>{/if}
    <button class="pri bloco" onclick={encerrarSessao}>{t.sessao < t.sessoes ? (est.acabou ? 'Ir para a pausa' : 'Fazer a pausa agora') : 'Encerrar e registrar'}</button>
    <p class="sub dica">Pode fechar o app e ir para o caderno e os vídeos: o tempo continua contando. Ao voltar, ele estará certo.</p>
    {#if android}<a class="sec bloco" href={intentTimer}>Avisar também no relógio do Android (experimental)</a>{/if}
  {/if}

  {#if t.fase === 'pausa' || t.fase === 'fim' || (t.fase === 'foco' && est.acabou)}
    <section class="card reg entra" aria-label="Registro">
      <h2>{t.fase === 'pausa' ? 'Registro rápido' : 'Registro do bloco'}</h2>
      <p class="sub">Tudo opcional. Questões resolvidas neste bloco:</p>
      <div class="qs">
        <button class="q ok" onclick={acertei}><span>+1</span>acertei</button>
        <button class="q er" onclick={errei}><span>+1</span>errei</button>
      </div>
      <p class="placar" aria-live="polite"><strong>{t.registro.feitas}</strong> feitas · <strong>{t.registro.acertos}</strong> certas{t.registro.feitas ? ` · ${Math.round((t.registro.acertos / t.registro.feitas) * 100)}%` : ''}
        {#if t.registro.feitas}<button class="lk" onclick={desfazerQ}>desfazer a última</button>{/if}</p>
      {#if t.registro.feitas}
        <p class="sub">Onde você fez</p>
        <Chips opcoes={opcoesSite} valor={t.registro.site} rotulo="Onde você fez as questões" aoMudar={(v) => reg((r) => ({ ...r, site: v }))} />
        {#if cotaFim}<p class="sub fimcota">A cota grátis de hoje acabou: use a prova em PDF ou os exercícios do livro.</p>{/if}
      {/if}
      {#if t.registro.vinculoId}
        <label class="pagl" for="pags">Páginas lidas</label>
        <input id="pags" type="number" inputmode="numeric" min="0" value={t.registro.paginas ?? 0} onchange={(e) => reg((r) => ({ ...r, paginas: Math.max(0, +e.currentTarget.value || 0) }))} />
      {/if}
      {#if erros > 0}<p class="sub">Ao concluir, o app abre os {erros} {erros === 1 ? 'erro' : 'erros'} para você registrar o assunto e o tipo (vão para o caderno de erros).</p>{/if}

      <p class="sub">Refez alguma questão sem olhar a resolução do vídeo?</p>
      <div class="sn" role="radiogroup" aria-label="Refez sem olhar">
        <button role="radio" aria-checked={t.registro.sozinho === true} class:on={t.registro.sozinho === true} onclick={() => reg((r) => ({ ...r, sozinho: true }))}>Sim</button>
        <button role="radio" aria-checked={t.registro.sozinho === false} class:on={t.registro.sozinho === false} onclick={() => reg((r) => ({ ...r, sozinho: false }))}>Ainda não</button>
      </div>
      {#if t.registro.sozinho === false}<p class="sub">Feche o vídeo e tente uma no caderno: é aí que a memória fixa.</p>{/if}

      {#if t.comAssunto}
        <label for="ass" class="sub">Assunto estudado (agenda revisões em 1, 7 e 30 dias)</label>
        <input id="ass" placeholder="ex.: funções do 2º grau" value={t.registro.assunto} onchange={(e) => reg((r) => ({ ...r, assunto: e.currentTarget.value }))} />
      {/if}
    </section>
  {/if}

  {#if t.fase === 'pausa'}
    <section class="card ativa entra">
      <p class="data">Pausa ativa · 2 minutos</p>
      <p class="ex">{exercicio}</p>
    </section>
    <button class="pri bloco" onclick={proximaSessao}>Voltar ao foco · sessão {t.sessao + 1} de {t.sessoes}</button>
    {#if android}<a class="sec bloco" href={intentTimer}>Avisar o fim da pausa no relógio do Android (experimental)</a>{/if}
  {/if}

  {#if t.fase === 'fim'}
    <button class="pri bloco grande" onclick={concluir}>Concluir bloco · {minutosFoco(t, agora)} min</button>
  {/if}

  <div class="extras">
    <button class="sec" class:on={som} aria-pressed={som} onclick={alternarSom}><Icon nome="moon" size={16} />{som ? 'Desligar som de chuva' : 'Som de chuva no fone'}</button>
    {#if app.cfg.links?.[t.materia]}<a class="sec" href={app.cfg.links[t.materia]} target="_blank" rel="noopener">Abrir aula <Icon nome="ext" size={14} /></a>{/if}
  </div>
  <p class="cancelar"><button class="lk" onclick={cancelar}>Cancelar cronômetro</button></p>
{/if}

<style>
  .relogio { position: relative; width: min(72vw, 260px); aspect-ratio: 1; margin: 8px auto 16px; }
  .relogio svg { width: 100%; height: 100%; }
  .trilho { fill: none; stroke: var(--line); stroke-width: 10; }
  .arco { fill: none; stroke: var(--ac); stroke-width: 10; stroke-linecap: round; transition: stroke-dashoffset 1s linear; filter: drop-shadow(0 0 6px var(--ac)); }
  .pausa .arco { stroke: var(--ac2); filter: drop-shadow(0 0 6px var(--ac2)); }
  .centro { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
  .tempo { font-size: clamp(2.4rem, 12vw, 3.4rem); font-weight: 300; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
  .fase { color: var(--tx2); text-transform: uppercase; letter-spacing: .14em; font-size: .8125rem; }
  .acabou .tempo { color: var(--ac); font-weight: 600; }
  .fim-emb { position: absolute; top: 12%; left: 50%; transform: translateX(-50%); color: var(--ac); animation: voa 1.6s ease-in-out infinite alternate; }
  @keyframes voa { to { transform: translate(-50%, -8px); } }
  .aviso { text-align: center; color: var(--ac); font-weight: 600; margin-bottom: 12px; }
  .bloco { display: flex; width: 100%; margin-top: 10px; }
  .pri, .sec { min-height: 52px; border-radius: 14px; font-weight: 700; align-items: center; justify-content: center; gap: 8px; text-decoration: none; padding: 0 16px; text-align: center; }
  .pri { background: var(--ac); color: var(--ac-tx); box-shadow: 0 6px 20px color-mix(in srgb, var(--ac) 30%, transparent); }
  .sec { display: inline-flex; border: 1px solid var(--line); color: var(--tx); }
  .sec.on { border-color: var(--ac2); color: var(--ac2); }
  .grande { min-height: 60px; font-size: 1.05rem; }
  .dica { text-align: center; margin-top: 10px; }
  .reg { padding: 16px; display: grid; gap: 10px; margin-top: 16px; }
  .reg h2 { margin: 0; }
  .qs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .q { min-height: 76px; border-radius: 16px; display: grid; place-content: center; font-weight: 600; border: 1.5px solid var(--line); }
  .q span { font-size: 1.6rem; font-weight: 700; line-height: 1; }
  .q.ok { color: var(--ac); border-color: color-mix(in srgb, var(--ac) 55%, var(--line)); }
  .q.er { color: #ff8a8a; border-color: color-mix(in srgb, #ff6b6b 45%, var(--line)); }
  :global(:root[data-theme=claro]) .q.er, :global(:root[data-theme=auto]) .q.er { color: #b42318; }
  .q:active { background: color-mix(in srgb, currentColor 14%, transparent); }
  .placar { font-variant-numeric: tabular-nums; display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; }
  .placar strong { color: var(--ac); }
  .lk { color: var(--ac); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; min-height: 44px; font-size: .85rem; }
  .sn { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .sn button { min-height: 48px; border-radius: 14px; border: 1px solid var(--line); font-weight: 600; }
  .sn .on { background: var(--ac); color: var(--ac-tx); border-color: var(--ac); }
  input { width: 100%; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); }
  .ativa { padding: 16px; margin-top: 12px; border-color: var(--ac2); display: grid; gap: 6px; }
  .ex { font-size: 1.05rem; font-weight: 600; }
  .tarefa { margin-bottom: 12px; }
  .pagl { color: var(--tx2); font-size: .85rem; }
  .fimcota { color: var(--warn); font-weight: 600; }
  .extras { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 20px; }
  .extras .sec { min-height: 44px; font-size: .9rem; font-weight: 600; }
  .cancelar { text-align: center; margin-top: 8px; }
  .cancelar .lk { color: var(--tx2); }
</style>
