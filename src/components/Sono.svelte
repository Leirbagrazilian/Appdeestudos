<script>
  import { app, registrarSono, apagarSono, conferirNoite, planejarNoite, limparNoite } from '../stores/app.svelte.js';
  import { noiteDe, horariosNoite, registroDaManha, fmtH, estadoDoDia } from '../lib/sono.js';
  import { addDays } from '../lib/dates.js';
  import Linha from './Linha.svelte';

  // Cartões de sono da tela Hoje. tipo: 'manha' (Como dormiu?), 'noite' (Dormir às...) ou 'cochilo' (depois de noite curta).
  let { dia, tipo, aberto = false, onAbrir } = $props();
  const ctx = $derived({ noites: app.sonoNoites, sono: app.sono });
  const ontem = $derived(addDays(dia, -1));
  const noiteOntem = $derived(noiteDe(app.cfg, ontem, ctx));
  const reg = $derived(registroDaManha(app.sono, dia));
  const hoje = $derived(horariosNoite(app.cfg, dia, ctx));
  const estado = $derived(estadoDoDia(app.cfg, dia, ctx));

  // formulário da manhã: horas pré-preenchidas com o plano da noite
  let dormiu = $state(null), acordou = $state(null), q = $state(null);
  const vDormiu = $derived(dormiu ?? reg?.dormiu ?? noiteOntem.dormir);
  const vAcordou = $derived(acordou ?? reg?.acordou ?? noiteOntem.acordar);
  const vQ = $derived(q ?? reg?.q ?? null);
  // planejar a noite de hoje
  let pd = $state(null), pa = $state(null), msg = $state('');
  const sd = $derived(pd ?? hoje.dormir), sa = $derived(pa ?? hoje.acordar);

  async function salvarManha() { await registrarSono(dia, { dormiu: vDormiu, acordou: vAcordou, q: vQ }); onAbrir?.(); }
  async function planejar() {
    const plano = { dormir: sd, acordar: sa }, r = conferirNoite(dia, plano);
    if (r.erro) { msg = r.erro; return; }
    if (r.avisos.length && !confirm(`${r.avisos.join('\n')}\n\nPlanejar assim mesmo?`)) return;
    await planejarNoite(dia, plano); msg = r.curta ? 'Noite curta planejada.' : 'Noite salva.'; pd = pa = null;
  }
  async function padrao() { await limparNoite(dia); pd = pa = null; msg = 'Voltou ao padrão.'; }
</script>

{#if tipo === 'manha'}
  <Linha feito={!!reg} label="Sono registrado" onToggle={() => (reg ? apagarSono(dia) : salvarManha())} {aberto} {onAbrir} icone="moon" hora={noiteOntem.acordar}
    titulo={reg ? `Dormiu ${fmtH(reg.horas)}${reg.q ? ` · qualidade ${reg.q}` : ''}` : 'Como dormiu?'}
    sub={reg ? `${reg.dormiu} às ${reg.acordou}` : `Planejado: ${noiteOntem.dormir} às ${noiteOntem.acordar} (${fmtH(noiteOntem.horas)})`}
    aviso={reg && reg.horas < 6 ? 'Menos de 6 h: o dia é Dia mínimo.' : estado === 'curta' ? 'Noite curta: corrida leve, MATAR HOJE depois do almoço, cochilo de 20 min.' : ''}>
    <div class="duas">
      <label>Dormi às<input type="time" value={vDormiu} onchange={(e) => (dormiu = e.currentTarget.value)} /></label>
      <label>Acordei às<input type="time" value={vAcordou} onchange={(e) => (acordou = e.currentTarget.value)} /></label>
    </div>
    <div class="qual" role="radiogroup" aria-label="Qualidade do sono, de 1 a 5">
      {#each [1, 2, 3, 4, 5] as n}<button type="button" role="radio" aria-checked={vQ === n} class:on={vQ === n} onclick={() => (q = n)}>{n}</button>{/each}
    </div>
    <p class="mut">1 = péssima · 5 = ótima</p>
    <button class="pri" type="button" onclick={salvarManha}>{reg ? 'Atualizar' : 'Salvar'}</button>
  </Linha>
{:else if tipo === 'noite'}
  <li class="noite">
    <button class="cab" aria-expanded={aberto} onclick={onAbrir}>
      <span class="tit">Dormir às {hoje.dormir} · acordar às {hoje.acordar}</span>
      <span class="sub">{fmtH(hoje.horas)} de sono · terço {hoje.terco} · oração {hoje.oracao} · telas off {hoje.telas}{hoje.maisCedo ? ' · 30 min mais cedo (noite curta ontem)' : ''}</span>
      {#if hoje.curta}<span class="av">Noite curta planejada (6 a 7 h)</span>{/if}
    </button>
    {#if aberto}
      <div class="det">
        <ul class="info">
          <li>Terço às {hoje.terco}</li><li>Oração da noite às {hoje.oracao}</li><li>Telas desligadas às {hoje.telas} (notificação, com o app aberto)</li>
        </ul>
        <p class="mut">Planejar esta noite de outro jeito (noite curta: 6 a 7 h, no máximo 1 por semana, nunca 2 seguidas, nunca na véspera de longão, simulado ou prova):</p>
        <div class="duas">
          <label>Dormir às<input type="time" value={sd} onchange={(e) => (pd = e.currentTarget.value)} /></label>
          <label>Acordar às<input type="time" value={sa} onchange={(e) => (pa = e.currentTarget.value)} /></label>
        </div>
        <button class="pri" type="button" onclick={planejar}>Salvar esta noite</button>
        {#if hoje.editada}<button class="sec" type="button" onclick={padrao}>Voltar ao padrão</button>{/if}
        {#if msg}<p class="mut" role="status">{msg}</p>{/if}
      </div>
    {/if}
  </li>
{:else}
  <li class="noite"><div class="cab"><span class="tit">Cochilo de 20 min</span><span class="sub">Depois do almoço, por causa da noite curta. Alarme de 20 min.</span></div></li>
{/if}

<style>
  .noite { border-top: 1px solid var(--line); }
  .cab { width: 100%; text-align: left; display: grid; gap: 1px; padding: 8px 4px 8px 46px; min-height: 56px; align-content: center; }
  .tit { font-weight: 600; } .sub { color: var(--tx2); font-size: .85rem; } .av { color: var(--warn); font-size: .8125rem; font-weight: 600; }
  .det { padding: 2px 4px 18px 46px; display: grid; gap: 10px; font-size: .9rem; }
  .info { list-style: none; padding: 0; margin: 0; display: grid; gap: 4px; color: var(--tx2); }
  .mut { color: var(--tx2); margin: 0; font-size: .85rem; }
  .duas { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  label { display: grid; gap: 4px; font-size: .85rem; color: var(--tx2); }
  input { width: 100%; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); }
  .qual { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .qual button { min-height: 44px; border-radius: 10px; border: 1px solid var(--line); font-weight: 700; color: var(--tx2); }
  .qual .on { background: var(--ac); border-color: var(--ac); color: var(--ac-tx); }
  .pri, .sec { min-height: 48px; border-radius: 14px; font-weight: 700; }
  .pri { background: var(--ac); color: var(--ac-tx); } .sec { border: 1px solid var(--line); color: var(--tx); }
</style>
