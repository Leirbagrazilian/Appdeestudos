<script>
  import { slide } from 'svelte/transition';
  import { app, fases, salvarRevisao, apagarRevisao, ajustes } from '../stores/app.svelte.js';
  import Chips from '../components/Chips.svelte';
  import SonoSemana from '../components/SonoSemana.svelte';
  import { PERGUNTAS, resumoSemana, historico, semanaDe } from '../lib/revisao.js';
  import { addDays, fmtCurta, fmtMin } from '../lib/dates.js';
  import { dur } from '../lib/prefs.js';
  import { kmDaSemana, planoSemanaCorrida, textoResumoCorrida } from '../lib/treino.js';
  import { avisar, salvarSemanaTreino } from '../stores/app.svelte.js';

  const atual = semanaDe(app.dia);
  let qual = $state('atual'); // 'atual' | 'passada'
  const seg = $derived(qual === 'atual' ? atual : addDays(atual, -7));
  const existente = $derived(app.revisoes[seg]);
  let resp = $state({ bem: '', faltou: '', foco: '' }), aberto = $state(null), falta = $state('');
  let corrida = $state({});
  const temCorrida = $derived(!!planoSemanaCorrida(app.cfg, seg, app.treinoSemanas));
  const kmSem = $derived(kmDaSemana(app.cfg, seg, app.treinos, app.treinoSemanas));

  // carrega as respostas salvas da semana escolhida
  $effect(() => { resp = { bem: existente?.bem ?? '', faltou: existente?.faltou ?? '', foco: existente?.foco ?? '' }; corrida = { ...(existente?.corrida ?? {}) }; falta = ''; });
  // treino: dor máxima registrada na semana entra como sugestão
  const dorMax = (campo) => Math.max(0, ...Array.from({ length: 7 }, (_, i) => +app.treinos[addDays(seg, i)]?.[campo] || 0));
  async function copiar() {
    const txt = textoResumoCorrida(app.cfg, seg, app.treinos, { ...corrida, joelho: corrida.joelho ?? dorMax('dor'), tornozelo: corrida.tornozelo ?? dorMax('tornozelo') }, app.treinoSemanas);
    try { await navigator.clipboard.writeText(txt); avisar('Resumo copiado', null, 'Cole na conversa do plano de corrida.'); }
    catch { avisar('Não consegui copiar', null, 'Selecione o texto abaixo e copie à mão.'); textoManual = txt; }
  }
  let textoManual = $state('');
  // km de cada dia da semana seguinte (nas fases 2 a 5 você define aos domingos; na fase 1 já vêm do plano)
  const prox = $derived(addDays(seg, 7));
  const planoProx = $derived(planoSemanaCorrida(app.cfg, prox, app.treinoSemanas));
  const DIAS_KM = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [0, 'Dom']];
  function kmDia(wd, v) {
    const dias = { ...(app.treinoSemanas[prox]?.dias ?? {}) };
    if (v === '') delete dias[wd]; else dias[wd] = Math.max(0, +v);
    salvarSemanaTreino(prox, dias);
  }

  const r = $derived(resumoSemana(app.cfg, fases(), { done: app.done, errors: app.errors, reviews: app.reviews, cumpridos: app.cumpridos, adiados: app.adiados, exams: app.exams }, seg));
  const hist = $derived(historico(app.revisoes));
  const pct = (x) => `${Math.round(x * 100)}%`;
  const hm = (m) => fmtMin(Math.round(m));

  async function salvar(ev) {
    ev.preventDefault();
    if (!resp.bem.trim() && !resp.faltou.trim() && !resp.foco.trim() && !Object.values(corrida).some((v) => v !== '' && v != null)) { falta = 'Responda pelo menos uma das perguntas.'; return; }
    await salvarRevisao(seg, { ...resp, corrida: { ...corrida }, resumo: { pct: r.pct, feitoMin: r.feitoMin, planMin: r.planMin, questoes: r.questoes, erros: r.erros, diasCumpridos: r.diasCumpridos } });
  }
</script>

<header class="pg"><p class="data">Domingo</p><h1>Revisão da semana</h1>
  <p class="sub">Três perguntas e um resumo. O foco que você escolher aparece na tela Hoje durante a semana seguinte.</p></header>

<Chips opcoes={[{ id: 'atual', nome: 'Esta semana' }, { id: 'passada', nome: 'Semana passada' }]} bind:valor={qual} rotulo="Semana a revisar" />
<p class="sub per">{fmtCurta(seg)} a {fmtCurta(addDays(seg, 6))}</p>

<section class="card res" aria-label="Resumo da semana">
  <div><strong>{pct(r.pct)}</strong><span>do plano feito</span><small>{hm(r.feitoMin)} de {hm(r.planMin)}</small></div>
  <div><strong>{r.diasCumpridos}</strong><span>dias cumpridos</span><small>de 7</small></div>
  <div><strong>{r.questoes.feitas}</strong><span>questões</span><small>{r.questoes.pct == null ? 'sem registro' : `${pct(r.questoes.pct)} de acerto`}</small></div>
  <div><strong>{r.erros}</strong><span>erros no caderno</span><small>{r.revisoesFeitas} revisões feitas</small></div>
</section>
{#if r.porMateria.length}
  <p class="sub mat">Onde o tempo foi: {r.porMateria.map(([m, min]) => `${m} ${hm(min)}`).join(' · ')}{r.adiados ? ` · ${r.adiados} ${r.adiados === 1 ? 'bloco adiado' : 'blocos adiados'}` : ''}</p>
{/if}

<h2>Sono da semana</h2>
<SonoSemana {seg} />

<form class="card f" onsubmit={salvar}>
  {#each PERGUNTAS as [campo, pergunta, ex]}
    <label>{pergunta}<textarea rows="2" placeholder={ex} bind:value={resp[campo]}></textarea></label>
  {/each}
  {#if temCorrida}
    <fieldset class="cor">
      <legend>Corrida da semana</legend>
      <div class="g2">
        <label>Km da semana<input type="number" inputmode="decimal" step="0.1" min="0" placeholder={String(kmSem.feitos).replace('.', ',')} bind:value={corrida.km} /></label>
        <label>Cansaço (0–10)<input type="number" inputmode="numeric" min="0" max="10" bind:value={corrida.cansaco} /></label>
        <label>Dor no joelho (0–10)<input type="number" inputmode="numeric" min="0" max="10" placeholder={String(dorMax('dor'))} bind:value={corrida.joelho} /></label>
        <label>Dor no tornozelo (0–10)<input type="number" inputmode="numeric" min="0" max="10" placeholder={String(dorMax('tornozelo'))} bind:value={corrida.tornozelo} /></label>
      </div>
      <label>Sono<input placeholder="ex.: 7 h por noite, acordei bem" bind:value={corrida.sono} /></label>
      <label>Como foram os temperos<textarea rows="2" bind:value={corrida.temperos}></textarea></label>
      <p class="sub">Meta: {String(kmSem.meta).replace('.', ',')} km · registrados: {String(kmSem.feitos).replace('.', ',')} km</p>
      <button type="button" class="sec" onclick={copiar}>Copiar resumo da corrida</button>
      {#if planoProx}
        <p class="sub">Km de cada dia da próxima semana (meta {String(planoProx.km).replace('.', ',')} km{planoProx.leve ? ', semana leve' : ''}). Deixe vazio para usar o plano.{planoProx.prova ? ` Semana de prova (${planoProx.prova.nome ?? 'prova'}): o dia da prova e os dias depois dela são fixos.` : ''}</p>
        <div class="g7">
          {#each DIAS_KM as [wd, nome]}
            <label>{nome}<input type="number" inputmode="decimal" step="0.5" min="0" placeholder={String(planoProx.dias[wd] ?? 0).replace('.', ',')} value={planoProx.travados?.includes(wd) ? '' : app.treinoSemanas[prox]?.dias?.[wd] ?? ''} disabled={planoProx.travados?.includes(wd)} title={planoProx.travados?.includes(wd) ? 'Fixo: semana de prova' : undefined} onchange={(e) => kmDia(wd, e.currentTarget.value)} /></label>
          {/each}
        </div>
      {/if}
      {#if textoManual}<textarea rows="8" readonly aria-label="Resumo da corrida">{textoManual}</textarea>{/if}
    </fieldset>
  {/if}
  {#if falta}<p class="falta" role="alert">{falta}</p>{/if}
  <button class="pri">{existente ? 'Atualizar a revisão' : 'Salvar a revisão'}</button>
  {#if existente}<p class="sub">Salva em {fmtCurta(existente.feita)}.</p>{/if}
</form>

<h2>Histórico</h2>
{#if hist.length}
  <ul class="grupo card">
    {#each hist as h (h.seg)}
      <li>
        <button class="cab" aria-expanded={aberto === h.seg} onclick={() => (aberto = aberto === h.seg ? null : h.seg)}>
          <span class="t"><strong>Semana de {fmtCurta(h.seg)}</strong><span class="sub">{h.foco ? `Foco: ${h.foco}` : 'sem foco definido'}{h.resumo ? ` · ${pct(h.resumo.pct)} do plano` : ''}</span></span>
        </button>
        {#if aberto === h.seg}
          <div class="det" transition:slide={{ duration: dur(220) }}>
            {#each PERGUNTAS as [campo, pergunta]}{#if h[campo]}<p><strong>{pergunta}</strong><br />{h[campo]}</p>{/if}{/each}
            <button class="sec" onclick={() => confirm('Apagar esta revisão?') && apagarRevisao(h.seg)}>Apagar</button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{:else}<p class="card vazio sub">Nenhuma revisão ainda. A primeira é a de domingo.</p>{/if}

<style>
  .g7 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; } .g7 label { font-size: .8rem; } .g7 input { padding: 8px 6px; text-align: center; }
  .cor { border: 0; padding: 0; margin: 0; display: grid; gap: 10px; } .cor legend { font-weight: 700; margin-bottom: 6px; color: var(--ac2); }
  .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .cor input, .cor textarea { width: 100%; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); }
  .sec { min-height: 48px; border-radius: 14px; border: 1px solid var(--line); font-weight: 600; }
  .per { margin: 8px 4px 0; }
  .res { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 10px; padding: 16px; margin-top: 12px; }
  .res div { display: grid; }
  .res strong { font-size: 1.7rem; font-weight: 600; color: var(--ac); line-height: 1.15; font-variant-numeric: tabular-nums; }
  .res span { color: var(--tx); font-size: .9rem; } .res small { color: var(--tx2); font-size: .8125rem; }
  .mat { margin: 8px 4px 0; }
  .f { padding: 16px; display: grid; gap: 14px; margin-top: 16px; }
  label { display: grid; gap: 6px; font-weight: 600; font-size: .95rem; }
  textarea { width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); resize: vertical; font-weight: 400; }
  .pri { min-height: 52px; border-radius: 14px; background: var(--ac); color: var(--ac-tx); font-weight: 700; }
  .sec { min-height: 44px; border-radius: 12px; border: 1px solid var(--line); color: var(--tx2); font-weight: 600; }
  .falta { color: var(--warn); font-weight: 600; }
  .cab { width: 100%; text-align: left; padding: 12px 16px; min-height: 56px; display: flex; }
  .t { display: grid; flex: 1; }
  .det { padding: 0 16px 16px; display: grid; gap: 10px; overflow: hidden; }
  .vazio { padding: 16px; }
</style>
