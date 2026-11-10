<script>
  let { feito, onclick, label } = $props();
</script>
<button class="chk" class:on={feito} {onclick} role="checkbox" aria-checked={feito} aria-label={label}>
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
</button>
<style>
  .chk { width: 44px; height: 44px; flex: none; display: grid; place-items: center; }
  .chk::before { content: ''; grid-area: 1/1; width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid var(--tx2); transition: background .18s, border-color .18s, transform .22s cubic-bezier(.3,1.6,.5,1); }
  .chk.on::before { background: var(--ac); border-color: var(--ac); transform: scale(1.06); }
  svg { grid-area: 1/1; position: relative; fill: none; stroke: var(--ac-tx); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 22; stroke-dashoffset: 22; transition: stroke-dashoffset .25s ease .05s; }
  .on svg { stroke-dashoffset: 0; }
  .chk.on::after { content: ''; grid-area: 1/1; width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--ac); animation: estouro .55s ease-out forwards; pointer-events: none; }
  @keyframes estouro { from { transform: scale(1); opacity: .9; } to { transform: scale(2.2); opacity: 0; } }
</style>
