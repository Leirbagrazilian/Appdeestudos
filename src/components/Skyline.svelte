<script>
  // Skyline com janelas: cada bloco concluído na semana acende uma janela.
  let { total = 0, acesas = 0 } = $props();
  const preds = [], vagas = []; let x = 0, s = 7;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  while (x < 400) {
    const w = 18 + Math.floor(rnd() * 22), h = 22 + Math.floor(rnd() * 46);
    preds.push({ x, w, h, ant: rnd() > 0.7 });
    for (let yy = 80 - h + 6; yy < 76; yy += 9) for (let xx = x + 4; xx + 4 < x + w - 2; xx += 8) vagas.push({ x: xx, y: yy, o: rnd() });
    x += w + 3;
  }
  // Ordem estável e espalhada para as janelas usadas.
  const ordem = [...vagas].sort((a, b) => a.o - b.o);
  const janelas = $derived(ordem.slice(0, Math.min(total, ordem.length)));
</script>
<svg class="sk" viewBox="0 0 400 80" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <g class="pr">{#each preds as p}<rect x={p.x} y={80 - p.h} width={p.w} height={p.h} rx="1" />{#if p.ant}<rect x={p.x + p.w / 2 - 1} y={80 - p.h - 9} width="2" height="9" />{/if}{/each}</g>
  {#each janelas as j, i (j.x + '-' + j.y)}<rect class="jan" class:on={i < acesas} x={j.x} y={j.y} width="4" height="5" rx="0.6" style="transition-delay:{(i % 6) * 60}ms" />{/each}
</svg>
<style>
  .sk { position: absolute; left: -16px; right: -16px; bottom: 0; width: calc(100% + 32px); height: 84px; pointer-events: none; }
  .pr { fill: var(--tx); opacity: .07; }
  .jan { fill: var(--tx); opacity: .1; transition: fill .6s ease, opacity .6s ease; }
  .jan.on { fill: var(--ac); opacity: .95; filter: drop-shadow(0 0 2px var(--ac)); }
</style>
