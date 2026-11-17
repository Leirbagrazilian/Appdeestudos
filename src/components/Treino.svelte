<script>
  import { slide } from 'svelte/transition';
  import { app, registrarTreino } from '../stores/app.svelte.js';
  import { treinoDoDia, treinoFeito } from '../lib/treino.js';
  import { dur } from '../lib/prefs.js';
  import Emblema from './Emblema.svelte';

  let { dia } = $props();
  const t = $derived(treinoDoDia(app.cfg, dia, { treinos: app.treinos, editadas: app.treinoSemanas }));
  const reg = $derived(app.treinos[dia] ?? {});
  const feito = $derived(treinoFeito(reg));
  let aberto = $state(false), km = $state(null);
  const kmTxt = (x) => String(x).replace('.', ',');
  const NOME = { leve: 'Corrida leve', 'bem leve': 'Corrida bem leve', strides: 'Corrida leve + strides', qualidade: 'Corrida com 1 km forte', longao: 'Longão', caminhada: 'Caminhada' };
  async function marcar() {
    if (feito) return registrarTreino(dia, { feito: false, minimo: false });
    await registrarTreino(dia, { feito: true, km: km != null && km !== '' ? +km : t.km });
  }
  const nota = (campo, v) => registrarTreino(dia, { [campo]: +v });
</script>

{#if t}
  <section class="card treino" class:ok={feito} class:alerta={t.dor} aria-label="Treino de hoje">
    <div class="cab">
      <span class="ic" aria-hidden="true"><Emblema nome="estrela" size={22} /></span>
      <span class="tx">
        <span class="data">Treino · {t.hora}{t.min ? ` · ~${t.min} min` : ''}{t.semanaLeve ? ' · semana leve' : ''}</span>
        <strong>{NOME[t.tipo] ?? 'Corrida'}{t.km ? ` · ${kmTxt(t.km)} km` : ''}</strong>
        <span class="sub">{t.intensidade}</span>
      </span>
      <button class="chk" role="checkbox" aria-checked={feito} aria-label="Treino feito" onclick={marcar}>{feito ? '✓' : ''}</button>
    </div>
    {#if t.alerta}<p class="al" role="alert">{t.alerta}</p>{/if}
    <ul class="info">
      <li>Tênis: {t.tenis}</li>
      {#if t.musculacao}<li>Musculação {t.musculacao.tipo} às {t.musculacao.ini}{t.musculacao.antesCorrer ? ' (a corrida vem antes)' : ''}</li>{/if}
      {#if t.fortalecimento}<li>Fortalecimento: {t.fortalecimento.join(', ')}</li>{/if}
      <li>{t.dica}</li>
    </ul>
    <button class="lk" aria-expanded={aberto} onclick={() => (aberto = !aberto)}>{aberto ? 'Fechar' : 'Km real, dor e dia mínimo'}</button>
    {#if aberto}
      <div class="mais" transition:slide={{ duration: dur(200) }}>
        <label>Km real<input type="number" inputmode="decimal" step="0.1" min="0" placeholder={kmTxt(t.km)} value={reg.km ?? ''} onchange={(e) => { km = e.currentTarget.value; if (feito) registrarTreino(dia, { km: +km || 0 }); }} /></label>
        <label>Dor no joelho (0–10)<input type="number" inputmode="numeric" min="0" max="10" value={reg.dor ?? ''} onchange={(e) => nota('dor', e.currentTarget.value)} /></label>
        <label>Dor no tornozelo (0–10)<input type="number" inputmode="numeric" min="0" max="10" value={reg.tornozelo ?? ''} onchange={(e) => nota('tornozelo', e.currentTarget.value)} /></label>
        <label class="ck"><input type="checkbox" checked={!!reg.inchaco} onchange={(e) => registrarTreino(dia, { inchaco: e.currentTarget.checked })} /> Inchaço</label>
        {#if !feito}<button class="sec" onclick={() => registrarTreino(dia, { minimo: true })}>Dia corrido: fazer só 20 min de caminhada</button>{/if}
      </div>
    {/if}
  </section>
{/if}

<style>
  .treino { padding: 14px 16px; margin-top: 16px; display: grid; gap: 10px; border-left: 3px solid var(--ac2); }
  .treino.ok { border-left-color: var(--ac); } .treino.alerta { border-left-color: var(--erro, #c0392b); }
  .cab { display: flex; gap: 12px; align-items: center; }
  .ic { color: var(--ac); flex: none; } .tx { flex: 1; display: grid; gap: 2px; }
  .chk { width: 44px; height: 44px; flex: none; border-radius: 50%; border: 2px solid var(--ac); color: var(--ac-tx); font-weight: 800; font-size: 1.1rem; }
  .ok .chk { background: var(--ac); }
  .al { background: var(--warn-bg); color: var(--warn); padding: 10px 12px; border-radius: 12px; font-weight: 600; font-size: .9rem; }
  .info { list-style: none; padding: 0; margin: 0; display: grid; gap: 4px; color: var(--tx2); font-size: .875rem; }
  .lk { justify-self: start; min-height: 44px; color: var(--ac); font-weight: 600; text-decoration: underline; }
  .mais { display: grid; gap: 10px; }
  label { display: grid; gap: 4px; font-size: .85rem; color: var(--tx2); }
  input:not([type=checkbox]) { width: 100%; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); }
  .ck { display: flex; gap: 10px; align-items: center; min-height: 44px; } .ck input { width: 22px; height: 22px; accent-color: var(--ac); }
  .sec { min-height: 48px; border-radius: 14px; border: 1px solid var(--line); font-weight: 600; }
</style>
