<script>
  import { app, salvarCfg, importar, restaurarSeed, pf, fazerBackup } from '../stores/app.svelte.js';
  import { vibrar } from '../lib/prefs.js';
  import { sino } from '../lib/audio.js';
  import { gerarICS } from '../lib/ics.js';
  import { baixar, validar } from '../lib/backup.js';
  import { pedir, suportado } from '../lib/notify.js';
  import { fmtBR } from '../lib/dates.js';
  import { slotsDaJanela, janelasValidas, toHHMM } from '../lib/semana.js';
  import { series, principalDe } from '../lib/livros.js';

  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const ordem = [1, 2, 3, 4, 5, 6, 0];
  const STATUS = ['estimada', 'edital publicado', 'confirmada'];
  let msg = $state(''), notif = $state(suportado() ? Notification.permission : 'unsupported');
  const salvar = () => { salvarCfg(); msg = 'Salvo.'; };
  const nomeEv = (e) => (e.tipo === 'inscricao' ? 'Inscrições' : e.nome ?? 'Prova');
  async function arquivo(ev) {
    const f = ev.target.files[0]; if (!f) return;
    try { await importar(validar(await f.text())); msg = 'Backup importado.'; } catch (e) { msg = e.message; }
    ev.target.value = '';
  }
  async function ativarNotif() {
    notif = await pedir();
    app.cfg.notificacoes = notif === 'granted'; salvar();
    if (notif !== 'granted') msg = 'O navegador não permitiu notificações. Os alertas continuam na tela Hoje e no arquivo .ics.';
  }
  async function resetar() { if (confirm('Voltar as datas, horários e metas para o padrão? Seu histórico de estudo é mantido.')) { await restaurarSeed(); msg = 'Padrão restaurado.'; } }
  const setPref = (k, v) => { app.cfg.prefs = { ...pf(), [k]: v }; salvar(); if (k === 'vibracao' && v) vibrar(pf(), 'ok'); if (k === 'sons' && v) sino(); };
  const OPCOES = {
    animacoes: [['completas', 'Completas'], ['discretas', 'Discretas'], ['nenhuma', 'Nenhuma']],
    texto: [['normal', 'Normal'], ['grande', 'Grande'], ['muito', 'Muito grande']],
  };
  const materiasLivro = $derived(app.cfg.materias.map((nome) => ({ nome, series: series(app.cfg, nome) })).filter((m) => m.series.length));
  const capacidade = (d) => {
    const bruto = app.cfg.rotina.janelas[d] ?? [];
    const js = janelasValidas(bruto);
    if (!bruto.length) return 'sem estudo';
    const ignoradas = bruto.length - js.length;
    const n = js.filter((j) => !j.tipo).reduce((a, j) => a + slotsDaJanela(j.fim - j.ini, app.cfg.foco.sessaoMin, app.cfg.foco.pausaMin), 0);
    const nome = (j) => `${toHHMM(j.ini)}–${toHHMM(j.fim)}${j.tipo === 'prova' ? ' (prova antiga e correção)' : j.tipo === 'domingo' ? ' (redação e planejamento)' : ''}`;
    return `${js.map(nome).join(' · ') || 'nenhuma janela válida'}${n ? ` · ${n} sessões` : ''}${ignoradas > 0 ? ` · ${ignoradas} ignorada(s): horário vazio, inválido ou sobreposto` : ''}`;
  };
  const addJanela = (d) => { (app.cfg.rotina.janelas[d] ??= []).push({ ini: '19:00', fim: '20:00' }); salvar(); };
  const delJanela = (d, i) => { app.cfg.rotina.janelas[d].splice(i, 1); salvar(); };
  
  const addAula = () => { app.cfg.rotina.aulas.push({ dia: 1, inicio: '08:00', fim: '10:00', nome: 'Compromisso' }); salvar(); };
  const delAula = (i) => { app.cfg.rotina.aulas.splice(i, 1); salvar(); };
</script>

<header class="pg"><p class="data">Preferências</p><h1>Ajustes</h1></header>
<p class="msg sub" role="status">{msg}</p>

<h2>Sensação e acessibilidade</h2>
<section class="card bloco">
  <span class="rot">Animações</span>
  <div class="temas" role="radiogroup" aria-label="Animações">
    {#each OPCOES.animacoes as [id, nome]}<button role="radio" aria-checked={pf().animacoes === id} class:on={pf().animacoes === id} onclick={() => setPref('animacoes', id)}>{nome}</button>{/each}
  </div>
  <p class="muted">Discretas tira os morcegos voando e os efeitos contínuos. Nenhuma desliga tudo.</p>
  <span class="rot">Tamanho do texto</span>
  <div class="temas" role="radiogroup" aria-label="Tamanho do texto">
    {#each OPCOES.texto as [id, nome]}<button role="radio" aria-checked={pf().texto === id} class:on={pf().texto === id} onclick={() => setPref('texto', id)}>{nome}</button>{/each}
  </div>
  <div class="tg"><span><strong>Vibração</strong><span class="muted">Ao concluir tarefas e quando o tempo do cronômetro acaba.</span></span>
    <button role="switch" aria-checked={pf().vibracao} aria-label="Vibração" class="sw" class:on={pf().vibracao} onclick={() => setPref('vibracao', !pf().vibracao)}><i></i></button></div>
  <div class="tg"><span><strong>Sons</strong><span class="muted">Um sininho ao concluir e ao fim de cada sessão. Desligado por padrão (biblioteca).</span></span>
    <button role="switch" aria-checked={pf().sons} aria-label="Sons" class="sw" class:on={pf().sons} onclick={() => setPref('sons', !pf().sons)}><i></i></button></div>
</section>

<h2>Modo foco</h2>
<section class="card bloco duas">
  <label>Sessão de foco (min)<input type="number" min="15" max="90" step="5" bind:value={app.cfg.foco.sessaoMin} onchange={salvar} /></label>
  <label>Pausa (min)<input type="number" min="3" max="30" bind:value={app.cfg.foco.pausaMin} onchange={salvar} /></label>
</section>

<h2>Sua carta</h2>
<section class="card bloco">
  <label for="carta">Por que você quer a Escola Naval? Escreva para o você dos dias difíceis.</label>
  <textarea id="carta" rows="5" placeholder="Eu quero isso porque…" bind:value={app.cfg.carta} onchange={salvar}></textarea>
  <p class="muted">Ela aparece na tela Hoje quando você ativa o "dia mínimo" ou quando o dia está pesado.</p>
</section>

<h2>Tema</h2>
<section class="card bloco">
  <div class="temas" role="radiogroup" aria-label="Tema">
    {#each [['noir', 'Noir'], ['claro', 'Claro'], ['auto', 'Automático']] as [id, nome]}
      <button role="radio" aria-checked={(app.cfg.tema ?? 'noir') === id} class:on={(app.cfg.tema ?? 'noir') === id} onclick={() => { app.cfg.tema = id; salvar(); }}>{nome}</button>
    {/each}
  </div>
</section>

<h2>Datas e status</h2>
<p class="muted">Quando o edital sair, mude a data e o status. As fases se reajustam sozinhas.</p>
{#each app.cfg.concursos.filter((c) => c.eventos.length) as c}
  <section class="card bloco" style="--c:{c.cor}">
    <strong>{c.nome}</strong>
    {#each c.eventos as e}
      <div class="ev">
        <span>{nomeEv(e)}</span>
        <label>Início<input type="date" bind:value={e.inicio} onchange={() => { if (e.fim < e.inicio) e.fim = e.inicio; salvar(); }} /></label>
        <label>Fim<input type="date" min={e.inicio} bind:value={e.fim} onchange={salvar} /></label>
        <label>Status<select bind:value={e.status} onchange={salvar}>{#each STATUS as s}<option>{s}</option>{/each}</select></label>
      </div>
    {/each}
  </section>
{/each}
<section class="card bloco">
  <label>Data de nascimento<input type="date" bind:value={app.cfg.perfil.nascimento} onchange={salvar} /></label>
  <label>Semanas da fase específica (6 a 8)<input type="number" min="6" max="8" bind:value={app.cfg.perfil.semanasEspecifica} onchange={salvar} /></label>
</section>

<h2>Rotina de estudo</h2>
<section class="card bloco">
  <label>Meta líquida por semana (horas de foco, sem as pausas)
    <input type="number" min="10" max="60" step="1" bind:value={app.cfg.rotina.metaLiquida} onchange={salvar} /></label>
  <p class="muted">As horas de cada matéria vêm da tabela da fase (43 h líquidas), escaladas para essa meta. Hoje: fator {(app.cfg.rotina.metaLiquida / app.cfg.rotina.metaNominal).toFixed(2).replace('.', ',')}. Quer mais volume? Suba a meta; as janelas precisam comportar.</p>
  <label>Peso do fim de semana (1 = igual aos outros dias)
    <input type="number" min="1" max="2" step="0.1" bind:value={app.cfg.rotina.pesoFimDeSemana} onchange={salvar} /></label>
  <p class="muted">Acima de 1, sábado e domingo recebem uma fatia maior das horas da semana.</p>
  <div class="tg"><span><strong>Rampa de 75%</strong><span class="muted">Nas {app.cfg.rotina.rampa.semanas} primeiras semanas do plano, 75% das horas.</span></span>
    <button role="switch" aria-checked={app.cfg.rotina.rampa.ativa} aria-label="Rampa de 75%" class="sw" class:on={app.cfg.rotina.rampa.ativa} onclick={() => { app.cfg.rotina.rampa.ativa = !app.cfg.rotina.rampa.ativa; salvar(); }}><i></i></button></div>
</section>

<h2>Livros principais</h2>
<section class="card bloco">
  <p class="muted">Cada matéria usa os volumes do livro principal nos blocos. Cadastre páginas e outros livros em QG → Meus livros.</p>
  {#each materiasLivro as m}
    <label>{m.nome}
      <select value={principalDe(app.cfg, m.nome) ?? ''} onchange={(e) => { app.cfg.biblioteca.principal[m.nome] = e.currentTarget.value || null; salvar(); }}>
        <option value="">Nenhum</option>
        {#each m.series as s}<option value={s.id}>{s.titulo}{s.autor ? ` (${s.autor})` : ''}</option>{/each}
      </select></label>
  {/each}
</section>

<h2>Questões grátis por dia</h2>
<section class="card bloco duas">
  <label>QConcursos<input type="number" min="0" max="200" bind:value={app.cfg.cotasGratis.qconcursos} onchange={salvar} /></label>
  <label>Estuda.com<input type="number" min="0" max="200" bind:value={app.cfg.cotasGratis.estuda} onchange={salvar} /></label>
  <p class="muted cheia">Quando a cota do dia acaba, o bloco avisa e sugere a prova em PDF ou os exercícios do livro. Cole os links das listas em cada tópico, na Trilha.</p>
</section>

<h2>Janelas de estudo</h2>
<p class="muted">Os blocos do dia são encaixados nestas janelas, com 50 min de foco e 10 de pausa. Sábado e domingo têm janela própria: prova antiga e correção no sábado, redação e planejamento no domingo.</p>
{#each ordem as d}
  <section class="card bloco">
    <div class="cj"><strong>{DIAS[d]}</strong><span class="muted">{capacidade(d)}</span></div>
    {#each app.cfg.rotina.janelas[d] ?? [] as j, i}
      <div class="jan">
        <input type="time" aria-label="Início da janela {i + 1} de {DIAS[d]}" bind:value={j.ini} onchange={salvar} />
        <input type="time" aria-label="Fim da janela {i + 1} de {DIAS[d]}" bind:value={j.fim} onchange={salvar} />
        <button class="x" aria-label="Remover janela {i + 1} de {DIAS[d]}" onclick={() => delJanela(d, i)}>✕</button>
      </div>
    {/each}
    <button class="sec" onclick={() => addJanela(d)}>＋ Adicionar janela</button>
  </section>
{/each}

<h2>Aulas e compromissos fixos</h2>
<section class="card bloco">
  {#each app.cfg.rotina.aulas as a, i}
    <div class="aula">
      <input class="nome" aria-label="Nome do compromisso" placeholder="Nome" bind:value={a.nome} onchange={salvar} />
      <select aria-label="Dia" bind:value={a.dia} onchange={salvar}>{#each ordem as d}<option value={d}>{DIAS[d]}</option>{/each}</select>
      <input type="time" aria-label="Início" bind:value={a.inicio} onchange={salvar} />
      <input type="time" aria-label="Fim" bind:value={a.fim} onchange={salvar} />
      <button class="x" aria-label="Remover aula" onclick={() => delAula(i)}>✕</button>
    </div>
  {/each}
  <button class="sec" onclick={addAula}>＋ Adicionar compromisso</button>
</section>

<h2>Notificações</h2>
<section class="card bloco">
  {#if notif === 'unsupported'}<p class="muted">Este navegador não oferece notificações. Use o arquivo .ics.</p>
  {:else if app.cfg.notificacoes && notif === 'granted'}<p>Ativadas: avisos de inscrição (14, 7 e 1 dia) e de revisões, ao abrir o app.</p><button class="sec" onclick={() => { app.cfg.notificacoes = false; salvar(); }}>Desativar</button>
  {:else}<p class="muted">Funcionam quando você abre o app. Para avisos garantidos, importe o .ics na Google Agenda.</p><button class="pri" onclick={ativarNotif}>Ativar notificações</button>{/if}
</section>

<h2>Backup e agenda</h2>
<section class="card bloco">
  <button class="pri" onclick={fazerBackup}>Fazer backup (salvar ou compartilhar)</button>
  <p class="muted">{app.ultimoBackup ? `Último backup: ${fmtBR(app.ultimoBackup)}.` : 'Nenhum backup feito ainda.'} {app.persistente ? 'Os dados estão protegidos contra a limpeza automática do navegador.' : 'O navegador não garantiu proteção contra limpeza automática: mantenha o backup semanal.'}</p>
  <label class="sec file">Importar backup<input type="file" accept="application/json,.json" onchange={arquivo} hidden /></label>
  <button class="pri" onclick={() => baixar('estuda-gabriel.ics', gerarICS(app.cfg), 'text/calendar')}>Exportar .ics (Google Agenda)</button>
  <p class="muted">Na Google Agenda: Configurações → Importar e exportar → Importar. Os alarmes de 14, 7 e 1 dia já vão no arquivo.</p>
  <button class="sec" onclick={resetar}>Restaurar datas e metas padrão</button>
</section>

<style>
  .temas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; } .temas button { min-height: 48px; border-radius: 14px; border: 1px solid var(--line); font-weight: 600; } .temas .on { background: var(--ac); color: var(--ac-tx); border-color: var(--ac); }
  .msg { min-height: 1.5em; }
  .rot { font-weight: 600; }
  .duas { grid-template-columns: 1fr 1fr; } .cheia { grid-column: 1 / -1; }
  textarea { width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); resize: vertical; }
  .tg { display: flex; align-items: center; gap: 12px; padding-top: 8px; border-top: 1px solid var(--line); }
  .tg > span { flex: 1; display: grid; }
  .sw { width: 56px; height: 34px; flex: none; border-radius: 99px; background: var(--line); position: relative; }
  .sw i { position: absolute; top: 4px; left: 4px; width: 26px; height: 26px; border-radius: 50%; background: var(--tx2); transition: transform .2s cubic-bezier(.3,1.4,.5,1), background .2s; }
  .sw.on { background: var(--ac); } .sw.on i { transform: translateX(22px); background: var(--ac-tx); }
  .bloco { padding: 16px; display: grid; gap: 12px; margin-top: 8px; border-top: 4px solid var(--c, transparent); }
  .ev { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding-top: 8px; border-top: 1px solid var(--line); } .ev > span { grid-column: 1 / -1; font-weight: 600; }
  label { display: grid; gap: 4px; font-size: .85rem; color: var(--tx2); }
  input, select { width: 100%; min-height: 44px; padding: 8px 10px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); }
  .metas { grid-template-columns: repeat(7, 1fr); gap: 4px; } .metas input { padding: 8px 2px; text-align: center; }
  .aula { display: grid; grid-template-columns: 1fr 1fr 44px; gap: 6px; align-items: center; padding-top: 8px; border-top: 1px solid var(--line); } .aula select, .aula .nome { grid-column: 1 / -1; }
  .cj { display: grid; gap: 2px; } .jan { display: grid; grid-template-columns: 1fr 1fr 44px; gap: 6px; align-items: center; }
  .x { width: 44px; height: 44px; color: var(--tx2); }
  .pri, .sec { min-height: 48px; border-radius: 14px; font-weight: 600; display: grid; place-items: center; cursor: pointer; }
  .pri { background: var(--ac); color: var(--ac-tx); } .sec { border: 1px solid var(--line); color: var(--tx); font-size: 1rem; }
</style>
