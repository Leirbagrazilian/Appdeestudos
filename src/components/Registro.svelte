<script>
  import { app, registrarResultado, fecharRegistro, pf, fases } from '../stores/app.svelte.js';
  import { faseDoDia } from '../lib/phases.js';
  import Chips from './Chips.svelte';
  import { limitesCota } from '../lib/tarefas.js';
  import { vibrar } from '../lib/prefs.js';

  // b = bloco; tarefa = tarefa do bloco (só existe antes de marcar como feito); soErros = vindo do cronômetro, só falta registrar os erros
  let { b, tarefa = null, soErros = false } = $props();

  const feito = app.done[b.id] ?? {};
  const res = feito.resultado ?? null;
  const topico = feito.topico ?? tarefa?.topico ?? '';
  const vinculoId = feito.vinculoId ?? tarefa?.vinculoId ?? null;
  const temPaginas = !!vinculoId || (feito.paginasPlan ?? tarefa?.paginas?.n ?? 0) > 0;
  const errosJa = res?.errosRegistrados ?? 0;
  const zero = faseDoDia(fases(), app.dia).id === 'zero' && !!topico; // Fase 0: exercícios (Khan/OBMEP) e modo domínio
  let khan = $state(res?.khan ?? false);

  let feitas = $state(res?.feitas ?? feito.questoesPlan ?? tarefa?.questoes?.n ?? 0);
  let acertos = $state(res ? res.acertos : null);
  let site = $state(res?.site ?? feito.fontePlan ?? tarefa?.questoes?.fontes?.find((f) => !f.esgotada)?.site ?? null);
  let paginas = $state(res?.paginas ?? feito.paginasPlan ?? tarefa?.paginas?.n ?? 0);
  let linhas = $state([]), treme = $state(false), falta = $state('');

  const tipos = $derived(app.cfg.tiposErro);
  const opcoesSite = $derived([...(app.cfg.sitesQuestoes ?? []).filter((s) => (zero ? !['qconcursos', 'estuda'].includes(s.id) : !['khan', 'obmep'].includes(s.id))).map((s) => ({ id: s.id, nome: s.nome })), { id: 'livro', nome: 'Livro' }]);
  const nErros = $derived(acertos == null ? 0 : Math.max(0, feitas - acertos - errosJa));
  const visiveis = $derived(Math.min(nErros, 8));
  const lim = $derived(limitesCota(app.cfg));
  const usadas = $derived(app.cotas[app.dia]?.[site] ?? 0);
  const delta = $derived(site && res?.site === site ? feitas - (res?.feitas ?? 0) : feitas);
  const naCota = $derived(site === 'qconcursos' || site === 'estuda');

  // mantém as linhas de erro em dia com a quantidade (sem perder o que você já escreveu)
  $effect(() => {
    while (linhas.length < visiveis) linhas.push({ assunto: topico, tipo: 'conteudo' });
    if (linhas.length > visiveis) linhas.length = visiveis;
  });

  const mexer = (campo, n) => {
    vibrar(pf(), 'toque');
    if (campo === 'feitas') { feitas = Math.max(0, feitas + n); if (acertos != null) acertos = Math.min(acertos, feitas); }
    else acertos = Math.min(feitas, Math.max(0, (acertos ?? 0) + n));
  };
  async function salvar(ev) {
    ev.preventDefault();
    if (!soErros && !khan && feitas > 0 && acertos == null) {
      falta = 'Diga quantas você acertou.'; vibrar(pf(), 'erro'); treme = false; requestAnimationFrame(() => (treme = true)); return;
    }
    await registrarResultado(b, {
      feitas, acertos: acertos ?? 0, khan: zero && khan, site: feitas ? site : null, paginas: temPaginas ? +paginas || 0 : 0,
      erros: linhas.slice(0, visiveis), topico, vinculoId, minutosLeitura: feito.minLeitura ?? tarefa?.paginas?.min ?? 0,
    });
  }
  const tecla = (e) => { if (e.key === 'Escape') fecharRegistro(); };
  // o painel precisa ficar acima da barra de navegação: sai da área principal (que tem camada própria) para o <body>
  function portal(no) { document.body.appendChild(no); return { destroy() { no.remove(); } }; }
</script>

<svelte:window onkeydown={tecla} />
<div class="portal" use:portal>
<div class="fundo" role="presentation" onclick={fecharRegistro}></div>
<form class="folha" class:treme role="dialog" aria-modal="true" aria-label="Registrar resultado de {b.titulo}" onsubmit={salvar} onanimationend={() => (treme = false)}>
  <header>
    <p class="data">{soErros ? 'Erros do bloco' : 'Registrar resultado'}</p>
    <h2>{b.materia}{topico ? ` · ${topico}` : ''}</h2>
  </header>

  {#if !soErros}
    <section aria-label="Questões">
      <div class="lin"><span>{zero ? 'Exercícios feitos' : 'Questões feitas'}</span>
        <span class="step"><button type="button" aria-label="Menos uma questão feita" onclick={() => mexer('feitas', -1)}>−</button><strong>{feitas}</strong><button type="button" aria-label="Mais uma questão feita" onclick={() => mexer('feitas', 1)}>+</button></span></div>
      {#if feitas > 0}
        <div class="lin"><span>Acertei</span>
          <span class="step"><button type="button" aria-label="Menos um acerto" onclick={() => mexer('acertos', -1)}>−</button><strong>{acertos ?? '–'}</strong><button type="button" aria-label="Mais um acerto" onclick={() => mexer('acertos', 1)}>+</button></span></div>
        <button type="button" class="todas" onclick={() => { acertos = feitas; vibrar(pf(), 'ok'); }}>Acertei todas</button>
        {#if zero}<p class="sub meta">{feitas < 10 ? 'Faça pelo menos 10 para o tópico ser avaliado.' : acertos != null && acertos / feitas >= 0.8 ? 'Passou: 8 em 10 ou mais.' : acertos != null ? 'Abaixo de 8 em 10: o tópico se repete.' : 'Meta: 8 em 10.'}</p>{/if}
        <p class="sub rot">Onde você fez</p>
        <Chips opcoes={opcoesSite} bind:valor={site} rotulo="Onde você fez as questões" />
        {#if naCota}<p class="sub cota" class:fim={usadas + delta >= lim[site]}>{opcoesSite.find((o) => o.id === site)?.nome} hoje: {usadas + delta} de {lim[site]} da cota grátis{usadas + delta >= lim[site] ? '. Acabou: use o PDF da prova ou os exercícios do livro.' : '.'}</p>{/if}
      {/if}
    </section>

    {#if zero}
      <label class="khan"><input type="checkbox" bind:checked={khan} /> Marquei como dominado no Khan (vale como dominado)</label>
    {/if}
    {#if temPaginas}
      <label class="pag">Páginas lidas<input type="number" inputmode="numeric" min="0" bind:value={paginas} /></label>
    {/if}
  {/if}

  {#if visiveis > 0}
    <section aria-label="Erros para o caderno">
      <p class="sub rot">Erros para o caderno ({nErros}){nErros > 8 ? ': os 8 primeiros aqui, o resto você registra depois no Caderno de erros' : ''}</p>
      {#each linhas as l, i}
        <div class="erro">
          <input aria-label="Assunto do erro {i + 1}" placeholder="Assunto" bind:value={l.assunto} />
          <select aria-label="Tipo do erro {i + 1}" bind:value={l.tipo}>{#each tipos as t}<option value={t.id}>{t.nome}</option>{/each}</select>
        </div>
      {/each}
    </section>
  {/if}

  {#if falta}<p class="falta" role="alert">{falta}</p>{/if}
  <div class="acoes"><button type="button" class="sec" onclick={fecharRegistro}>Agora não</button><button class="pri">Salvar</button></div>
</form>
</div>

<style>
  .fundo { position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 8; animation: aparece .2s ease; }
  .folha { position: fixed; left: 0; right: 0; bottom: 0; z-index: 9; max-width: 640px; margin: 0 auto; max-height: 88dvh; overflow-y: auto; background: var(--card); border: 1px solid var(--ac); border-bottom: 0; border-radius: 20px 20px 0 0; padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); display: grid; gap: 12px; animation: sobe .26s cubic-bezier(.2,.8,.2,1); }
  h2 { margin: 0; font-size: 1.15rem; text-transform: none; letter-spacing: -.01em; color: var(--tx); }
  .lin { display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 52px; }
  .step { display: inline-flex; align-items: center; gap: 10px; }
  .step button { width: 48px; height: 48px; border-radius: 14px; border: 1px solid var(--line); font-size: 1.4rem; font-weight: 700; }
  .step strong { min-width: 2.2ch; text-align: center; font-size: 1.5rem; font-variant-numeric: tabular-nums; color: var(--ac); }
  .todas { min-height: 44px; border-radius: 12px; border: 1px dashed var(--ac); color: var(--ac); font-weight: 600; }
  .rot { margin-top: 4px; }
  .cota { margin-top: 6px; } .cota.fim { color: var(--warn); font-weight: 600; }
  .meta { color: var(--ac); }
  .khan { display: flex; gap: 10px; align-items: center; min-height: 44px; font-size: .92rem; }
  .khan input { width: 22px; height: 22px; min-height: 0; accent-color: var(--ac); flex: none; }
  .pag { display: grid; gap: 4px; font-size: .85rem; color: var(--tx2); }
  input, select { width: 100%; min-height: 44px; padding: 8px 10px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); }
  .erro { display: grid; grid-template-columns: 1fr 9.5rem; gap: 6px; margin-top: 6px; }
  .falta { color: var(--warn); font-weight: 600; }
  .acoes { display: grid; grid-template-columns: 1fr 2fr; gap: 8px; }
  .pri, .sec { min-height: 52px; border-radius: 14px; font-weight: 700; }
  .pri { background: var(--ac); color: var(--ac-tx); } .sec { border: 1px solid var(--line); color: var(--tx); font-weight: 600; }
  @keyframes aparece { from { opacity: 0; } }
  @keyframes sobe { from { transform: translateY(30px); opacity: 0; } }
</style>
