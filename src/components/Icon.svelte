<script>
  let { nome, size = 18 } = $props();
  const P = {
    bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
    run: 'M13 4.5a1.5 1.5 0 1 0 0-.01M8 21l3-6-2-2 2-4 3 2 3 1M6 12l3-4 3-1',
    clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    down: 'M6 9l6 6 6-6',
  };
</script>
<svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={P[nome]} /></svg>
