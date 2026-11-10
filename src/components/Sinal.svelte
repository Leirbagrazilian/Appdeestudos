<script>
  import Bat from './Bat.svelte';
  // Sinal luminoso (feixe + círculo) com silhueta de morcego original; decorativo.
</script>
<div class="sinal" aria-hidden="true">
  <i class="feixe"></i>
  <span class="disco"><Bat size={40} /></span>
  <span class="voa v1"><Bat size={18} /></span>
  <span class="voa v2"><Bat size={12} /></span>
  <span class="voa v3"><Bat size={14} /></span>
</div>
<style>
  .sinal { position: absolute; right: 4px; top: 6px; width: 120px; height: 90px; pointer-events: none; }
  .disco { position: absolute; right: 8px; top: 8px; width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center;
    background: radial-gradient(circle at 50% 40%, #f1cf6b, var(--ac) 70%); color: #0a0a0c; box-shadow: 0 0 28px rgba(214,169,60,.45); animation: pulso 5s ease-in-out infinite; }
  :global(:root[data-theme=claro]) .disco, :global(:root[data-theme=auto]) .disco { box-shadow: none; }
  .voa { position: absolute; color: var(--tx2); opacity: .75; animation: voo 7s ease-in-out infinite; }
  .v1 { left: 0; top: 14px; } .v2 { left: 30px; top: 58px; animation-delay: -2.5s; opacity: .5; } .v3 { right: 0; top: 70px; animation-delay: -4s; opacity: .6; }
  @keyframes voo { 0%,100% { transform: translate(0,0) rotate(-4deg); } 50% { transform: translate(8px,-6px) rotate(5deg) scaleY(.85); } }
  @keyframes pulso { 0%,100% { box-shadow: 0 0 22px rgba(214,169,60,.35); } 50% { box-shadow: 0 0 36px rgba(214,169,60,.6); } }
</style>
