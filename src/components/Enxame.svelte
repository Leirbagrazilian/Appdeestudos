<script>
  import Bat from './Bat.svelte';
  // Morcegos voando pela tela: só transform/opacity (leve) e sem interação.
  let { festa = false } = $props();
  const base = [
    { s: 30, t: 12, d: 34, a: -3, o: 0.5, v: 0 }, { s: 18, t: 24, d: 26, a: -14, o: 0.45, v: 1 },
    { s: 38, t: 40, d: 46, a: -22, o: 0.4, v: 0 }, { s: 16, t: 58, d: 30, a: -8, o: 0.5, v: 1 },
    { s: 26, t: 72, d: 40, a: -30, o: 0.4, v: 0 }, { s: 20, t: 86, d: 28, a: -18, o: 0.45, v: 1 },
  ];
  const extra = Array.from({ length: 12 }, (_, i) => ({ s: 18 + (i % 4) * 8, t: 6 + ((i * 17) % 85), d: 7 + (i % 5) * 1.6, a: -(i * 1.3), o: 0.9, v: i % 2 }));
  const lista = $derived(festa ? extra : base);
</script>
<div class="enxame" class:festa aria-hidden="true">
  {#each lista as b}
    <div class="rota" class:volta={b.v} style="top:{b.t}%;animation-duration:{b.d}s;animation-delay:{b.a}s">
      <div class="alto" style="animation-duration:{2.4 + (b.s % 5) * 0.4}s">
        <span class="asa" style="opacity:{b.o}"><Bat size={b.s} /></span>
      </div>
    </div>
  {/each}
</div>
<style>
  .enxame { position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; color: var(--tx2); }
  .festa { z-index: 4; color: var(--ac); }
  .rota { position: absolute; left: 0; animation: cruza linear infinite; will-change: transform; }
  .rota.volta { animation-direction: reverse; }
  .rota.volta .asa { display: block; transform: scaleX(-1); }
  .alto { animation: ondula ease-in-out infinite alternate; }
  .asa { display: block; animation: bate .32s ease-in-out infinite alternate; transform-origin: 50% 70%; }
  .rota.volta .asa { animation-name: bateVolta; }
  :global(.enxame svg) { display: block; }
  @keyframes cruza { from { transform: translateX(-15vw); } to { transform: translateX(110vw); } }
  @keyframes ondula { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-36px) rotate(4deg); } }
  @keyframes bate { from { transform: scaleY(1); } to { transform: scaleY(.45); } }
  @keyframes bateVolta { from { transform: scaleX(-1) scaleY(1); } to { transform: scaleX(-1) scaleY(.45); } }
</style>
