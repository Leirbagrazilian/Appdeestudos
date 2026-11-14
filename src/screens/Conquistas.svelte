<script>
  import { app, listaConquistas, fases } from '../stores/app.svelte.js';
  import { estatisticas } from '../lib/conquistas.js';
  import Emblema from '../components/Emblema.svelte';
  // emblema de cada condecoração (os ids não mudam)
  const EMB = { 'primeiro-bloco': 'capacete', 'dia-cumprido': 'soldado', 'sete-dias': 'divisa', 'trinta-dias': 'platina', 'cinco-cumpridos': 'divisa', 'cem-questoes': 'fuzil', 'quinhentas-questoes': 'tanque', 'sozinho-10': 'asa', 'dez-erros': 'paraquedas', 'cinquenta-erros': 'submarino', 'vinte-revisoes': 'plaqueta', 'primeiro-simulado': 'quepe', 'simulado-60': 'en' };
  const ALVOS = [['en', 'Escola Naval'], ['efomm', 'EFOMM'], ['esa', 'ESA'], ['ita', 'ITA'], ['ime', 'IME'], ['marinha', 'Marinha'], ['exercito', 'Exército'], ['fab', 'Aeronáutica']];
  const lista = $derived(listaConquistas());
  const s = $derived(estatisticas({ done: app.done, reviews: app.reviews, errors: app.errors, exams: app.exams, cumpridos: app.cumpridos }));
  const caps = $derived(fases().map((f) => ({ ...f, ok: f.fim < app.dia })));
</script>

<header class="pg"><p class="data">Folha de serviço</p><h1>Condecorações</h1>
  <p class="sub">{lista.filter((c) => c.ok).length} de {lista.length} conquistadas. Nenhuma se perde depois de ganha.</p></header>

<section class="card nums">
  <div><strong>{s.diasEstudo}</strong><span>dias de estudo</span></div>
  <div><strong>{s.questoes}</strong><span>questões</span></div>
  <div><strong>{s.revisoes}</strong><span>revisões</span></div>
  <div><strong>{s.erros}</strong><span>erros no caderno</span></div>
</section>

<h2>Medalhas</h2>
<ul class="grade">
  {#each lista as c}
    <li class="card" class:ok={c.ok}>
      <span class="selo" aria-hidden="true"><Emblema nome={EMB[c.id] ?? 'medalha'} size={28} /></span>
      <strong>{c.nome}</strong><span class="sub">{c.desc}</span>
      <span class="sr">{c.ok ? 'Conquistada' : 'Ainda não conquistada'}</span>
    </li>
  {/each}
</ul>

<h2>Campanhas</h2>
<ul class="grupo card">
  {#each caps as f}
    <li class="cap" class:ok={f.ok}><span class="num">{f.numero}</span><span><strong>{f.nome}</strong><span class="sub">&nbsp;· {f.ok ? 'concluída' : f.inicio <= app.dia ? 'em andamento' : 'a seguir'}</span></span></li>
  {/each}
</ul>

<h2>Brasões</h2>
<ul class="alvos card">
  {#each ALVOS as [id, nome]}<li><Emblema nome={id} size={40} /><span>{nome}</span></li>{/each}
</ul>
<p class="sub nota-br">Desenhos próprios do app, inspirados nas Forças e nas escolas. Não são os emblemas oficiais.</p>

<style>
  .alvos { list-style: none; padding: 16px 8px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px 4px; }
  .alvos li { display: grid; justify-items: center; gap: 6px; color: var(--ac); }
  .alvos span { color: var(--tx2); font-size: .8125rem; font-weight: 600; text-align: center; }
  .nota-br { margin: 8px 4px 0; }
  .nums { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 16px; margin-top: 8px; }
  .nums div { display: grid; } .nums strong { font-size: 1.6rem; color: var(--ac); font-weight: 600; } .nums span { color: var(--tx2); font-size: .85rem; }
  .grade { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .grade li { padding: 14px; display: grid; gap: 6px; justify-items: start; }
  .grade li:not(.ok) strong { color: var(--tx2); font-weight: 600; }
  .grade li:not(.ok) .selo { opacity: .5; }
  .grade li.ok { opacity: 1; border-color: var(--ac); }
  .selo { width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; background: var(--line); color: var(--tx2); }
  .ok .selo { background: radial-gradient(circle at 50% 35%, var(--latao2), var(--latao) 72%); color: #1a1d10; box-shadow: 0 0 16px var(--brilho); }
  .cap { display: flex; gap: 12px; align-items: center; padding: 12px 16px; min-height: 56px; }
  .num { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; border: 1.5px solid var(--line); font-weight: 700; color: var(--tx2); }
  .cap.ok .num { background: var(--ac); border-color: var(--ac); color: var(--ac-tx); }
</style>
