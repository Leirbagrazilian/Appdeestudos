<script>
  import { app, registrarTreino } from '../stores/app.svelte.js';
  import { treinoDoDia, treinoFeito } from '../lib/treino.js';
  import Linha from './Linha.svelte';

  let { dia, aberto = false, onAbrir, curta = false } = $props();
  const t = $derived(treinoDoDia(app.cfg, dia, { treinos: app.treinos, editadas: app.treinoSemanas, noiteCurta: curta }));
  const reg = $derived(app.treinos[dia] ?? {});
  const feito = $derived(treinoFeito(reg));
  let km = $state(null);
  const kmTxt = (x) => String(x).replace('.', ',');
  const NOME = { prova: 'Prova', descanso: 'Descanso', leve: 'Corrida leve', 'bem leve': 'Corrida bem leve', strides: 'Corrida leve + strides', qualidade: 'Corrida com 1 km forte', longao: 'Longão', caminhada: 'Caminhada' };
  async function marcar() {
    if (feito) return registrarTreino(dia, { feito: false, minimo: false });
    await registrarTreino(dia, { feito: true, km: km != null && km !== '' ? +km : t.km });
  }
  const nota = (campo, v) => registrarTreino(dia, { [campo]: +v });
</script>

{#if t}
  <Linha {feito} label="Treino feito" onToggle={marcar} {aberto} {onAbrir} icone="run" hora={t.hora ?? ''}
    titulo={`Treino · ${t.prova ? t.prova.nome : NOME[t.tipo] ?? 'Corrida'}${t.km ? ` · ${kmTxt(t.km)} km` : ''}`}
    sub={`${t.min ? `~${t.min} min` : t.intensidade}${t.musculacao ? ` · musculação ${t.musculacao.ini}` : ''}${t.semanaLeve ? ' · semana leve' : ''}`}
    aviso={t.alerta || t.choque || ''}>
    <p class="mut">{t.intensidade}</p>
    <ul class="info">
      <li>Tênis: {t.tenis}</li>
      {#if t.musculacao}<li>Musculação {t.musculacao.tipo} às {t.musculacao.ini}{t.musculacao.correrAntes ? ' (a corrida vem antes)' : ''}</li>{/if}
      {#if t.fortalecimento}<li>Fortalecimento: {t.fortalecimento.join(', ')}</li>{/if}
      <li>{t.dica}</li>
    </ul>
    <div class="mais">
      <label>Km real<input type="number" inputmode="decimal" step="0.1" min="0" placeholder={kmTxt(t.km)} value={reg.km ?? ''} onchange={(e) => { km = e.currentTarget.value; if (feito) registrarTreino(dia, { km: +km || 0 }); }} /></label>
      <label>Dor no joelho (0–10)<input type="number" inputmode="numeric" min="0" max="10" value={reg.dor ?? ''} onchange={(e) => nota('dor', e.currentTarget.value)} /></label>
      <label>Dor no tornozelo (0–10)<input type="number" inputmode="numeric" min="0" max="10" value={reg.tornozelo ?? ''} onchange={(e) => nota('tornozelo', e.currentTarget.value)} /></label>
      <label class="ck"><input type="checkbox" checked={!!reg.inchaco} onchange={(e) => registrarTreino(dia, { inchaco: e.currentTarget.checked })} /> Inchaço</label>
      {#if !feito}<button class="sec" onclick={() => registrarTreino(dia, { minimo: true })}>Dia corrido: fazer só 20 min de caminhada</button>{/if}
    </div>
  </Linha>
{/if}

<style>
  .mut { color: var(--tx2); margin: 0; }
  .info { list-style: none; padding: 0; margin: 0; display: grid; gap: 4px; color: var(--tx2); }
  .mais { display: grid; gap: 10px; }
  label { display: grid; gap: 4px; font-size: .85rem; color: var(--tx2); }
  input:not([type=checkbox]) { width: 100%; min-height: 44px; padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--tx); }
  .ck { display: flex; gap: 10px; align-items: center; min-height: 44px; } .ck input { width: 22px; height: 22px; accent-color: var(--ac); }
  .sec { min-height: 48px; border-radius: 14px; border: 1px solid var(--line); font-weight: 600; }
</style>
