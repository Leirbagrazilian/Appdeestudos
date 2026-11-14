<script>
  import Emblema from './Emblema.svelte';
  // Brasão-sol: ganha força conforme o dia avança (pct) e brilha mais à noite. Uma esquadrilha passa ao lado.
  let { pct = 0, noite = false } = $props();
  const forca = $derived(0.45 + 0.55 * Math.min(1, pct));
</script>
<div class="farol" class:noite aria-hidden="true" style="--f:{forca}">
  <i class="raios"></i>
  <span class="disco"><Emblema nome="en" size={42} /></span>
  <span class="voa v1"><Emblema nome="aviao" size={18} /></span>
  <span class="voa v2"><Emblema nome="aviao" size={12} /></span>
  <span class="voa v3"><Emblema nome="aviao" size={12} /></span>
</div>
<style>
  .farol { position: absolute; right: 0; top: 4px; width: 124px; height: 96px; pointer-events: none; }
  .raios { position: absolute; right: 2px; top: 2px; width: 88px; height: 88px; border-radius: 50%; opacity: calc(.15 + var(--f) * .55);
    background: repeating-conic-gradient(var(--ac) 0 3deg, transparent 3deg 15deg);
    -webkit-mask: radial-gradient(circle, transparent 36px, #000 37px, #000 43px, transparent 44px); mask: radial-gradient(circle, transparent 36px, #000 37px, #000 43px, transparent 44px);
    transition: opacity .8s ease; animation: gira 80s linear infinite; }
  .disco { position: absolute; right: 14px; top: 14px; width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center;
    background: radial-gradient(circle at 50% 35%, var(--latao2), var(--latao) 72%); color: #1a1d10; opacity: calc(.4 + var(--f) * .6);
    filter: saturate(calc(.45 + var(--f) * .55)); box-shadow: inset 0 0 0 2px rgba(26,29,16,.28), 0 0 calc(var(--f) * 34px) var(--brilho); transition: opacity .8s ease, filter .8s ease, box-shadow .8s ease; animation: pulso 6s ease-in-out infinite; }
  .noite .disco { box-shadow: inset 0 0 0 2px rgba(26,29,16,.28), 0 0 calc(var(--f) * 52px) var(--brilho); }
  .voa { position: absolute; color: var(--tx2); opacity: .7; animation: voo 8s ease-in-out infinite; }
  .voa :global(svg) { display: block; transform: rotate(-14deg); }
  .v1 { left: 2px; top: 18px; } .v2 { left: -14px; top: 34px; animation-delay: -.5s; opacity: .5; } .v3 { left: 6px; top: 42px; animation-delay: -1s; opacity: .5; }
  @keyframes voo { 0%,100% { transform: translate(0,0); } 50% { transform: translate(9px,-5px); } }
  @keyframes pulso { 50% { transform: scale(1.035); } }
  @keyframes gira { to { transform: rotate(360deg); } }
</style>
