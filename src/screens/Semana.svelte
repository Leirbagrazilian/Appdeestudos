<script>
  import { app, fases } from '../stores/app.svelte.js';
  import { blocosDoDia, metaDoDia } from '../lib/planner.js';
  import { addDays, startOfWeek, diaNome, fmtMin, parse } from '../lib/dates.js';
  import Ring from '../components/Ring.svelte';

  const fs = $derived(fases());
  const feitoNoDia = (dia) => Object.entries(app.done).filter(([k]) => k.startsWith(dia + ':')).reduce((s, [, v]) => s + v.min, 0);
  const semana = (ini) => Array.from({ length: 7 }, (_, i) => {
    const dia = addDays(ini, i), plan = blocosDoDia(app.cfg, fs, dia);
    const planMin = plan.reduce((s, b) => s + b.min, 0);
    return { dia, plan, planMin, feito: feitoNoDia(dia), meta: metaDoDia(app.cfg, dia) };
  });
  const ini = $derived(startOfWeek(app.dia));
  const dias = $derived(semana(ini));
  const feitoTotal = $derived(dias.reduce((s, d) => s + d.feito, 0));
  const metaTotal = $derived(dias.reduce((s, d) => s + d.meta, 0));
  // matéria -> minutos feitos
  const porMateria = $derived.by(() => {
    const m = {};
    for (const [k, v] of Object.entries(app.done)) if (k >= ini && k < addDays(ini, 7) + '~') { const d = k.slice(0, 10); if (d >= ini && d <= addDays(ini, 6)) m[v.materia] = (m[v.materia] ?? 0) + v.min; }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  });
  const maxMat = $derived(Math.max(1, ...porMateria.map((x) => x[1])));
  // constância: últimas 4 semanas (a atual conta só até hoje); semanas boas nunca zeram
  const hist = $derived(Array.from({ length: 4 }, (_, i) => semana(addDays(ini, -7 * (3 - i)))).map((s) => {
    const ate = s.filter((d) => d.dia <= app.dia);
    const meta = ate.reduce((a, d) => a + d.meta, 0), feito = ate.reduce((a, d) => a + d.feito, 0);
    return meta ? feito / meta : 0;
  }));
  const media = $derived(Math.round((hist.reduce((a, b) => a + b, 0) / 4) * 100));
  const boas = $derived.by(() => {
    let n = 0; const dias0 = new Set(Object.keys(app.done).map((k) => startOfWeek(k.slice(0, 10))));
    for (const w of dias0) { const s = semana(w); const f = s.reduce((a, d) => a + d.feito, 0), m = s.reduce((a, d) => a + d.meta, 0); if (m && f / m >= 0.7) n++; }
    return n;
  });
  const msg = $derived(media >= 80 ? 'Ritmo excelente. Mantenha o ritmo.' : media >= 50 ? 'Bom ritmo. Uma semana mais fraca não apaga o que você construiu.' : 'Recomeçar é parte do processo. Faça só o próximo bloco.');
  const letra = (d) => diaNome(d).slice(0, 3);
</script>

<h1>Semana</h1>
<p class="muted">{feitoTotal / 60 < 10 ? (feitoTotal / 60).toFixed(1).replace('.', ',') : Math.round(feitoTotal / 60)}h feitas de {metaTotal / 60}h de meta</p>

<section class="card aneis" aria-label="Progresso por dia">
  {#each dias as d}
    {@const p = d.planMin ? d.feito / d.planMin : 0}
    <div class="dia" class:hoje={d.dia === app.dia}>
      <Ring pct={p} size={44} />
      <span class="l">{letra(d.dia)}</span>
      <span class="muted v">{d.feito ? fmtMin(d.feito) : '–'}</span>
    </div>
  {/each}
</section>

<section class="card total">
  <div class="bar" role="progressbar" aria-valuenow={Math.round(feitoTotal / metaTotal * 100)} aria-valuemin="0" aria-valuemax="100"><i style="width:{Math.min(100, feitoTotal / metaTotal * 100)}%"></i></div>
  <p class="muted">{Math.round(feitoTotal / metaTotal * 100)}% da meta semanal</p>
</section>

<h2>Constância</h2>
<section class="card cons">
  <p class="big">{media}%</p>
  <p class="muted">média das últimas 4 semanas</p>
  <div class="hist" aria-hidden="true">{#each hist as h}<i style="height:{Math.max(6, Math.min(1, h) * 48)}px"></i>{/each}</div>
  <p>{msg}</p>
  <p class="muted">Semanas boas (70% ou mais) até agora: <strong>{boas}</strong>. Esse número nunca diminui.</p>
</section>

<h2>Por matéria (esta semana)</h2>
<section class="card mat">
  {#each porMateria as [nome, min]}
    <div class="lin"><span>{nome}</span><div class="b"><i style="width:{min / maxMat * 100}%"></i></div><span class="muted">{fmtMin(min)}</span></div>
  {:else}<p class="muted">Marque seu primeiro bloco para ver o gráfico.</p>{/each}
  {#if porMateria.length}<p class="muted">Meta: Matemática perto de metade do tempo total.</p>{/if}
</section>

<style>
  .aneis { display: grid; grid-template-columns: repeat(7, 1fr); padding: 16px 4px; margin-top: 16px; text-align: center; }
  .dia { display: grid; justify-items: center; gap: 2px; padding: 4px 0; border-radius: 12px; }
  .dia.hoje { background: var(--ac-bg); }
  .l { font-size: .75rem; font-weight: 600; text-transform: capitalize; } .v { font-size: .7rem; }
  .total { padding: 16px; margin-top: 12px; display: grid; gap: 8px; }
  .bar, .b { height: 10px; background: var(--line); border-radius: 99px; overflow: hidden; }
  .bar i, .b i { display: block; height: 100%; background: var(--ac); border-radius: 99px; transition: width .5s ease; }
  .cons { padding: 16px; display: grid; gap: 4px; } .big { font-size: 2.25rem; font-weight: 700; color: var(--ac); }
  .hist { display: flex; gap: 8px; align-items: end; height: 52px; margin: 8px 0; } .hist i { width: 28px; background: var(--ac); border-radius: 6px; opacity: .8; }
  .mat { padding: 16px; display: grid; gap: 12px; } .lin { display: grid; grid-template-columns: 7rem 1fr auto; gap: 12px; align-items: center; font-size: .9rem; }
</style>
