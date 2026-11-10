<script>
  import { app, listaConquistas, fases } from '../stores/app.svelte.js';
  import { estatisticas } from '../lib/conquistas.js';
  import Bat from '../components/Bat.svelte';
  const lista = $derived(listaConquistas());
  const s = $derived(estatisticas({ done: app.done, reviews: app.reviews, errors: app.errors, exams: app.exams, cumpridos: app.cumpridos }));
  const caps = $derived(fases().map((f) => ({ ...f, ok: f.fim < app.dia })));
</script>

<header class="pg"><p class="data">Sua jornada</p><h1>Insígnias</h1>
  <p class="sub">{lista.filter((c) => c.ok).length} de {lista.length} conquistadas. Nenhuma se perde depois de ganha.</p></header>

<section class="card nums">
  <div><strong>{s.diasEstudo}</strong><span>dias de estudo</span></div>
  <div><strong>{s.questoes}</strong><span>questões</span></div>
  <div><strong>{s.revisoes}</strong><span>revisões</span></div>
  <div><strong>{s.erros}</strong><span>erros no caderno</span></div>
</section>

<h2>Insígnias</h2>
<ul class="grade">
  {#each lista as c}
    <li class="card" class:ok={c.ok}>
      <span class="selo" aria-hidden="true"><Bat size={26} /></span>
      <strong>{c.nome}</strong><span class="sub">{c.desc}</span>
      <span class="sr">{c.ok ? 'Conquistada' : 'Ainda não conquistada'}</span>
    </li>
  {/each}
</ul>

<h2>Capítulos</h2>
<ul class="grupo card">
  {#each caps as f}
    <li class="cap" class:ok={f.ok}><span class="num">{f.numero}</span><span><strong>{f.nome}</strong><span class="sub"> · {f.ok ? 'concluído' : f.inicio <= app.dia ? 'em andamento' : 'a seguir'}</span></span></li>
  {/each}
</ul>

<style>
  .nums { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 16px; margin-top: 8px; }
  .nums div { display: grid; } .nums strong { font-size: 1.6rem; color: var(--ac); font-weight: 600; } .nums span { color: var(--tx2); font-size: .85rem; }
  .grade { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .grade li { padding: 14px; display: grid; gap: 6px; justify-items: start; }
  .grade li:not(.ok) strong { color: var(--tx2); font-weight: 600; }
  .grade li:not(.ok) .selo { opacity: .5; }
  .grade li.ok { opacity: 1; border-color: var(--ac); }
  .selo { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--line); color: var(--tx2); }
  .ok .selo { background: radial-gradient(circle at 50% 40%, #fbe08a, var(--ac) 70%); color: #0a0a0c; box-shadow: 0 0 16px color-mix(in srgb, var(--ac) 50%, transparent); }
  .cap { display: flex; gap: 12px; align-items: center; padding: 12px 16px; min-height: 56px; }
  .num { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; border: 1.5px solid var(--line); font-weight: 700; color: var(--tx2); }
  .cap.ok .num { background: var(--ac); border-color: var(--ac); color: var(--ac-tx); }
</style>
