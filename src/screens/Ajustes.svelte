<script>
  import { app, salvarCfg, importar, restaurarSeed } from '../stores/app.svelte.js';
  import { gerarICS } from '../lib/ics.js';
  import { baixar, montar, validar } from '../lib/backup.js';
  import { pedir, suportado } from '../lib/notify.js';
  import { fmtBR } from '../lib/dates.js';

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
  const addAula = () => { app.cfg.rotina.aulas.push({ dia: 1, inicio: '08:00', fim: '10:00', nome: 'Aula' }); salvar(); };
  const delAula = (i) => { app.cfg.rotina.aulas.splice(i, 1); salvar(); };
</script>

<h1>Ajustes</h1>
<p class="msg muted" role="status">{msg}</p>

<h2>Datas e status</h2>
<p class="muted">Quando o edital sair, mude a data e o status. As fases se reajustam sozinhas.</p>
{#each app.cfg.concursos as c}
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

<h2>Meta de horas por dia</h2>
<section class="card bloco metas">
  {#each ordem as d}<label>{DIAS[d].slice(0, 3)}<input type="number" min="0" max="12" step="0.5" bind:value={app.cfg.rotina.metaHoras[d]} onchange={salvar} /></label>{/each}
</section>

<h2>Aulas da faculdade</h2>
<section class="card bloco">
  {#each app.cfg.rotina.aulas as a, i}
    <div class="aula">
      <select aria-label="Dia" bind:value={a.dia} onchange={salvar}>{#each ordem as d}<option value={d}>{DIAS[d]}</option>{/each}</select>
      <input type="time" aria-label="Início" bind:value={a.inicio} onchange={salvar} />
      <input type="time" aria-label="Fim" bind:value={a.fim} onchange={salvar} />
      <button class="x" aria-label="Remover aula" onclick={() => delAula(i)}>✕</button>
    </div>
  {/each}
  <button class="sec" onclick={addAula}>＋ Adicionar aula</button>
</section>

<h2>Notificações</h2>
<section class="card bloco">
  {#if notif === 'unsupported'}<p class="muted">Este navegador não oferece notificações. Use o arquivo .ics.</p>
  {:else if app.cfg.notificacoes && notif === 'granted'}<p>Ativadas: avisos de inscrição (14, 7 e 1 dia) e de revisões, ao abrir o app.</p><button class="sec" onclick={() => { app.cfg.notificacoes = false; salvar(); }}>Desativar</button>
  {:else}<p class="muted">Funcionam quando você abre o app. Para avisos garantidos, importe o .ics na Google Agenda.</p><button class="pri" onclick={ativarNotif}>Ativar notificações</button>{/if}
</section>

<h2>Backup e agenda</h2>
<section class="card bloco">
  <button class="pri" onclick={() => baixar(`rumo-backup-${app.dia}.json`, montar(app), 'application/json')}>Exportar backup (JSON)</button>
  <label class="sec file">Importar backup<input type="file" accept="application/json,.json" onchange={arquivo} hidden /></label>
  <button class="pri" onclick={() => baixar('rumo-aprovacao.ics', gerarICS(app.cfg), 'text/calendar')}>Exportar .ics (Google Agenda)</button>
  <p class="muted">Na Google Agenda: Configurações → Importar e exportar → Importar. Os alarmes de 14, 7 e 1 dia já vão no arquivo.</p>
  <button class="sec" onclick={resetar}>Restaurar datas e metas padrão</button>
</section>

<style>
  .msg { min-height: 1.5em; }
  .bloco { padding: 16px; display: grid; gap: 12px; margin-top: 8px; border-top: 4px solid var(--c, transparent); }
  .ev { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding-top: 8px; border-top: 1px solid var(--line); } .ev > span { grid-column: 1 / -1; font-weight: 600; }
  label { display: grid; gap: 4px; font-size: .85rem; color: var(--tx2); }
  input, select { width: 100%; min-height: 44px; padding: 8px 10px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); }
  .metas { grid-template-columns: repeat(7, 1fr); gap: 4px; } .metas input { padding: 8px 2px; text-align: center; }
  .aula { display: grid; grid-template-columns: 1fr 1fr 44px; gap: 6px; align-items: center; padding-top: 8px; border-top: 1px solid var(--line); } .aula select { grid-column: 1 / -1; }
  .x { width: 44px; height: 44px; color: var(--tx2); }
  .pri, .sec { min-height: 48px; border-radius: 14px; font-weight: 600; display: grid; place-items: center; cursor: pointer; }
  .pri { background: var(--ac); color: var(--ac-tx); } .sec { border: 1px solid var(--line); color: var(--tx); font-size: 1rem; }
</style>
