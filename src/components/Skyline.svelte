<script>
  // Skyline noturna procedural (prédios simples), bem discreta.
  const preds = []; let x = 0, s = 7;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  while (x < 400) { const w = 16 + Math.floor(rnd() * 22), h = 14 + Math.floor(rnd() * 34); preds.push({ x, w, h, ant: rnd() > .7 }); x += w + 2; }
</script>
<svg class="sk" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">
  {#each preds as p}<rect x={p.x} y={60 - p.h} width={p.w} height={p.h} />{#if p.ant}<rect x={p.x + p.w / 2 - 1} y={60 - p.h - 8} width="2" height="8" />{/if}{/each}
</svg>
<style>
  .sk { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 56px; fill: var(--tx); opacity: .06; pointer-events: none; }
</style>
