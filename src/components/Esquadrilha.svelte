<script>
  import Emblema from './Emblema.svelte';
  // Silhuetas à deriva pela tela: aeronaves cruzam, insígnias sobem devagar. Só transform/opacity, sem interação.
  let { festa = false } = $props();
  // m: 'voa' cruza na horizontal (t = topo %) · 'deriva' sobe balançando (x = esquerda %)
  const base = [
    { n: 'aviao', m: 'voa', s: 34, t: 9, d: 40, a: -6, o: .3 },
    { n: 'helicoptero', m: 'voa', v: 1, s: 30, t: 37, d: 62, a: -30, o: .22 },
    { n: 'aviao', m: 'voa', s: 20, t: 63, d: 33, a: -19, o: .22 },
    { n: 'ancora', m: 'deriva', s: 26, x: 80, d: 70, a: -12, o: .22 },
    { n: 'estrela', m: 'deriva', s: 16, x: 9, d: 58, a: -40, o: .3 },
    { n: 'plaqueta', m: 'deriva', s: 24, x: 28, d: 82, a: -65, o: .2 },
    { n: 'ita', m: 'deriva', s: 34, x: 50, d: 90, a: -22, o: .2 },
    { n: 'ime', m: 'deriva', s: 30, x: 90, d: 76, a: -50, o: .2 },
    { n: 'divisa', m: 'deriva', s: 20, x: 66, d: 64, a: -3, o: .22 },
    { n: 'asa', m: 'deriva', s: 30, x: 16, d: 96, a: -78, o: .2 },
  ];
  const NOMES = ['estrela', 'medalha', 'estrela', 'divisa', 'ancora', 'estrela', 'asa'];
  const extra = [
    ...Array.from({ length: 4 }, (_, i) => ({ n: 'aviao', m: 'voa', s: 26 + (i % 2) * 10, t: 8 + i * 9, d: 5 + i * 0.5, a: -i * 0.45, o: .95 })),
    ...Array.from({ length: 10 }, (_, i) => ({ n: NOMES[i % NOMES.length], m: 'deriva', s: 16 + (i % 4) * 7, x: 4 + ((i * 23) % 90), d: 6 + (i % 5) * 1.3, a: -(i * 1.1), o: .9 })),
  ];
  const lista = $derived(festa ? extra : base);
</script>
<div class="esquadrilha" class:festa aria-hidden="true">
  {#each lista as b}
    <div class="rota {b.m}" class:volta={b.v} style="{b.m === 'voa' ? `top:${b.t}%` : `left:${b.x}%`};animation-duration:{b.d}s;animation-delay:{b.a}s">
      <div class="balanco" style="animation-duration:{5 + (b.s % 5)}s;opacity:{b.o}"><Emblema nome={b.n} size={b.s} /></div>
    </div>
  {/each}
</div>
<style>
  .esquadrilha { position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; color: var(--tx2); contain: strict; }
  .festa { z-index: 4; color: var(--ac); }
  .rota { position: absolute; animation: linear infinite; will-change: transform; }
  .voa { left: 0; animation-name: cruza; }
  .voa.volta { animation-name: cruzaVolta; }
  .deriva { top: 0; animation-name: sobe; }
  .balanco { animation: ondula ease-in-out infinite alternate; }
  .deriva .balanco { animation-name: oscila; }
  .volta :global(svg) { transform: scaleX(-1); }
  :global(.esquadrilha svg) { display: block; }
  @keyframes cruza { from { transform: translateX(-15vw); } to { transform: translateX(110vw); } }
  @keyframes cruzaVolta { from { transform: translateX(110vw); } to { transform: translateX(-15vw); } }
  @keyframes sobe { from { transform: translateY(104vh); } to { transform: translateY(-12vh); } }
  @keyframes ondula { from { transform: translateY(0) rotate(-2deg); } to { transform: translateY(-22px) rotate(3deg); } }
  @keyframes oscila { from { transform: translateX(-10px) rotate(-9deg); } to { transform: translateX(10px) rotate(9deg); } }
</style>
