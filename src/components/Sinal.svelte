<script>
  import Bat from './Bat.svelte';
  // Sinal luminoso: fica mais forte conforme o dia avança (pct) e brilha mais à noite.
  let { pct = 0, noite = false } = $props();
  const forca = $derived(0.45 + 0.55 * Math.min(1, pct));
</script>
<div class="sinal" class:noite aria-hidden="true" style="--f:{forca}">
  <i class="feixe"></i>
  <span class="disco"><Bat size={40} /></span>
  <span class="voa v1"><Bat size={18} /></span>
  <span class="voa v2"><Bat size={12} /></span>
  <span class="voa v3"><Bat size={14} /></span>
</div>
<style>
  .sinal { position: absolute; right: 4px; top: 6px; width: 120px; height: 90px; pointer-events: none; }
  .feixe { position: absolute; right: 30px; top: 60px; width: 60px; height: 120px; background: linear-gradient(to top, transparent, rgba(255,198,26,calc(var(--f) * .12))); clip-path: polygon(40% 100%, 60% 100%, 100% 0, 0 0); transform: rotate(180deg); opacity: 0; transition: opacity 1s ease; }
  .noite .feixe { opacity: 1; }
  .disco { position: absolute; right: 8px; top: 8px; width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center;
    background: radial-gradient(circle at 50% 40%, #fbe08a, var(--ac) 70%); color: #0a0a0c; opacity: calc(.35 + var(--f) * .65);
    filter: saturate(calc(.4 + var(--f) * .6)); box-shadow: 0 0 calc(var(--f) * 40px) rgba(255,198,26,calc(var(--f) * .55)); transition: opacity .8s ease, filter .8s ease, box-shadow .8s ease; animation: pulso 5s ease-in-out infinite; }
  .noite .disco { box-shadow: 0 0 calc(var(--f) * 60px) rgba(255,198,26,calc(var(--f) * .75)); }
  :global(:root[data-theme=claro]) .disco, :global(:root[data-theme=auto]) .disco { box-shadow: none; }
  .voa { position: absolute; color: var(--tx2); opacity: .75; animation: voo 7s ease-in-out infinite; }
  .v1 { left: 0; top: 14px; } .v2 { left: 30px; top: 58px; animation-delay: -2.5s; opacity: .5; } .v3 { right: 0; top: 70px; animation-delay: -4s; opacity: .6; }
  @keyframes voo { 0%,100% { transform: translate(0,0) rotate(-4deg); } 50% { transform: translate(8px,-6px) rotate(5deg) scaleY(.85); } }
  @keyframes pulso { 50% { transform: scale(1.04); } }
</style>
