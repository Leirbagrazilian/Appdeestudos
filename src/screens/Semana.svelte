<script>
  import { app, fases, ajustes } from '../stores/app.svelte.js';
  import { blocosAjustados, metaDoDia } from '../lib/planner.js';
  import { addDays, startOfWeek, diaNome, fmtMin, parse } from '../lib/dates.js';
  import Ring from '../components/Ring.svelte';
  import { fmtCurta } from '../lib/dates.js';

  const fs = $derived(fases());
  const diaDe = (k, v) => v.dia ?? k.slice(0, 10);
  const feitoNoDia = (dia) => Object.entries(app.done).filter(([k, v]) => diaDe(k, v) === dia).reduce((s, [, v]) => s + v.min, 0);
  const semana = (ini) => Array.from({ length: 7 }, (_, i) => {
    const dia = addDays(ini, i), plan = blocosAjustados(app.cfg, fs, dia, ajustes());
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
    for (const [k, v] of Object.entries(app.done)) { const d = diaDe(k, v); if (d >= ini && d <= addDays(ini, 6)) m[v.materia] = (m[v.materia] ?? 0) + v.min; }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  });
  // questões registradas no cronômetro, por matéria
  const questoes = $derived.by(() => {
    const m = {};
    for (const [k, v] of Object.entries(app.done)) {
      const d = diaDe(k, v); if (!v.questoes || d < ini || d > addDays(ini, 6)) continue;
      const q = (m[v.materia] ??= { feitas: 0, acertos: 0 }); q.feitas += v.questoes.feitas; q.acertos += v.questoes.acertos;
    }
    return Object.entries(m).sort((a, b) => b[1].feitas - a[1].feitas);
  });
  const totalQ = $derived(questoes.reduce((s, [, q]) => s + q.feitas, 0));
  const maxMat = $derived(Math.max(1, ...porMateria.map((x) => x[1])));
  // constância: últimas 4 semanas (a atual conta só até hoje); semanas boas nunca zeram
  const hist = $derived(Array.from({ length: 4 }, (_, i) => semana(addDays(ini, -7 * (3 - i)))).map((s) => {
    const ate = s.filter((d) => d.dia <= app.dia);
    const meta = ate.reduce((a, d) => a + d.meta, 0), feito = ate.reduce((a, d) => a + d.feito, 0);
    return meta ? feito / meta : 0;
  }));
  const media = $derived(Math.round((hist.reduce((a, b) => a + b, 0) / 4) * 100));
  const boas = $derived.by(() => {
    let n = 0; const dias0 = new Set(Object.entries(app.done).map(([k, v]) => startOfWeek(diaDe(k, v))));
    for (const w of dias0) { const s = semana(w); const f = s.reduce((a, d) => a + d.feito, 0), m = s.reduce((a, d) => a + d.meta, 0); if (m && f / m >= 0.7) n++; }
    return n;
  });
  const msg = $derived(media >= 80 ? 'Ritmo excelente. Mantenha o ritmo.' : media >= 50 ? 'Bom ritmo. Uma semana mais fraca não apaga o que você construiu.' : 'Recomeçar é parte do processo. Faça só o próximo bloco.');
  const letra = (d) => diaNome(d).slice(0, 3);
</script>

<header>
  <p class="data">Semana · {fmtCurta(ini)} a {fmtCurta(addDays(ini, 6))}</p>
  <h1>{feitoTotal / 60 < 10 ? (feitoTotal / 60).toFixed(1).replace('.', ',') : Math.round(feitoTotal / 60)}h <span>de {metaTotal / 60}h</span></h1>
  <div class="bar" role="progressbar" aria-label="Meta semanal" aria-valuenow={Math.round(feitoTotal / metaTotal * 100)} aria-valuemin="0" aria-valuemax="100"><i style="width:{Math.min(100, feitoTotal / metaTotal * 100)}%"></i></div>
  <p class="sub">{Math.round(feitoTotal / metaTotal * 100)}% da meta semanal</p>
</header>

<section class="aneis" aria-label="Progresso por dia">
  {#each dias as d}
    {@const p = d.planMin ? d.feito / d.planMin : 0}
    <div class="dia" class:hoje={d.dia === app.dia}>
      <Ring pct={p} size={40} stroke={4} />
      <span class="l">{letra(d.dia)}</span>
      <span class="v">{d.feito ? fmtMin(d.feito) : '–'}</span>
    </div>
  {/each}
</section>

<h2>Constância</h2>
<section class="card cons">
  <div class="topo"><p class="big">{media}%</p><p class="sub">média das últimas 4 semanas</p></div>
  <div class="hist" aria-hidden="true">{#each hist as h}<i style="height:{Math.max(4, Math.min(1, h) * 48)}px"></i>{/each}</div>
  <p class="frase">{msg}</p>
  <p class="sub">Semanas boas (70% ou mais): <strong>{boas}</strong>. Esse número nunca diminui.</p>
</section>

<h2>Questões da semana</h2>
<section class="card mat">
  {#each questoes as [nome, q]}
    {@const p = q.feitas ? q.acertos / q.feitas : 0}
    <div class="lin"><span>{nome}</span><div class="b"><i style="width:{p * 100}%"></i></div><span class="sub">{q.acertos}/{q.feitas} · {Math.round(p * 100)}%</span></div>
  {:else}<p class="sub">Use o cronômetro (▶ na tela Hoje) e registre as questões na pausa: aqui aparece seu índice de acerto por matéria.</p>{/each}
  {#if totalQ}<p class="sub">{totalQ} questões resolvidas nesta semana.</p>{/if}
</section>

<h2>Horas por matéria</h2>
<section class="card mat">
  {#each porMateria as [nome, min]}
    <div class="lin"><span>{nome}</span><div class="b"><i style="width:{min / maxMat * 100}%"></i></div><span class="sub">{fmtMin(min)}</span></div>
  {:else}<p class="sub">Marque seu primeiro bloco para ver o gráfico.</p>{/each}
  {#if porMateria.length}<p class="sub">Meta: Matemática perto de metade do tempo total.</p>{/if}
</section>

<style>
  header { padding: 20px 4px 8px; }
  .data { color: var(--ac2); font-size: .8rem; text-transform: uppercase; letter-spacing: .12em; font-weight: 500; }
  h1 { margin-top: 4px; font-size: 2.4rem; font-weight: 700; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
  h1 span { font-size: 1.1rem; font-weight: 400; color: var(--tx2); letter-spacing: 0; }
  .bar, .b { height: 4px; background: var(--line); border-radius: 99px; overflow: hidden; }
  header .bar { margin-top: 12px; }
  .bar i, .b i { display: block; height: 100%; background: var(--ac); border-radius: 99px; transition: width .5s ease; }
  .sub { color: var(--tx2); font-size: .85rem; }
  header .sub { margin-top: 8px; }
  .aneis { display: grid; grid-template-columns: repeat(7, 1fr); padding: 20px 0 8px; margin-top: 12px; text-align: center; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .dia { display: grid; justify-items: center; gap: 2px; padding: 6px 0; border-radius: 12px; }
  .dia.hoje { outline: 1px solid var(--ac); outline-offset: -1px; }
  .l { font-size: .8125rem; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--tx2); } .dia.hoje .l { color: var(--ac); }
  .v { font-size: .8125rem; color: var(--tx2); font-variant-numeric: tabular-nums; }
  h2 { margin-top: 28px; }
  .cons { padding: 16px; display: grid; gap: 8px; }
  .topo { display: flex; align-items: baseline; gap: 12px; } .big { font-size: 2.2rem; font-weight: 300; letter-spacing: -.03em; color: var(--ac); }
  .hist { display: flex; gap: 6px; align-items: end; height: 52px; } .hist i { width: 100%; max-width: 44px; background: var(--ac); border-radius: 4px; opacity: .75; }
  .frase { font-style: italic; color: var(--tx); }
  .mat { padding: 16px; display: grid; gap: 14px; } .lin { display: grid; grid-template-columns: 6.5rem 1fr auto; font-variant-numeric: tabular-nums; gap: 12px; align-items: center; font-size: .9rem; }
</style>
