<script>
  let { pct = 0, size = 44, stroke = 5, cor = 'var(--ac)', children } = $props();
  const r = $derived((size - stroke) / 2), c = $derived(2 * Math.PI * r);
</script>
<svg width={size} height={size} viewBox="0 0 {size} {size}" aria-hidden="true">
  <circle cx={size/2} cy={size/2} {r} fill="none" stroke="var(--line)" stroke-width={stroke} />
  <circle cx={size/2} cy={size/2} {r} fill="none" stroke={cor} stroke-width={stroke} stroke-linecap="round"
    stroke-dasharray={c} stroke-dashoffset={c * (1 - Math.min(1, pct))} transform="rotate(-90 {size/2} {size/2})" style="transition: stroke-dashoffset .5s ease" />
</svg>
