<script>
  // Base naval da semana: fortaleza, quartel, torre de controle, hangar e um navio no cais.
  // Cada bloco concluído na semana acende uma luz (janela, vigia ou lâmpada). À noite os holofotes varrem o céu.
  let { total = 0, acesas = 0, noite = false } = $props();
  const vagas = []; let s = 11;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const jan = (x, y, w = 3.4, h = 4.4) => vagas.push({ x, y, w, h, rx: 0.5, o: rnd() });
  const luz = (cx, cy, r = 1.5) => vagas.push({ x: cx - r, y: cy - r, w: r * 2, h: r * 2, rx: r, o: rnd() });
  const grade = (x0, y0, cols, rows, dx, dy, w, h) => { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) jan(x0 + c * dx, y0 + r * dy, w, h); };
  grade(4, 53, 6, 2, 8, 9); grade(68, 53, 6, 2, 8, 9);          // muralha (dos dois lados do portão)
  grade(14.3, 34, 2, 2, 8, 6.5); grade(80, 27, 3, 3, 6.3, 7);   // torres
  grade(125, 49, 8, 3, 7.5, 7); luz(152, 40, 1.7);               // quartel
  grade(199.6, 25.5, 3, 1, 5.8, 0, 3.4, 5); grade(205.3, 42, 1, 3, 0, 10); luz(207, 9, 1.4); // torre de controle
  luz(236, 53.2, 1.3); luz(248, 49.3, 1.3); luz(260, 53.2, 1.3); luz(283.2, 27.5, 1.3);      // hangar e guindaste
  for (let i = 0; i < 13; i++) luz(305 + i * 6.3, 60.5);        // vigias do casco
  for (let i = 0; i < 12; i++) luz(308 + i * 6.3, 66, 1.3);
  grade(315.5, 49.6, 8, 1, 6, 0, 3, 3.6); grade(323, 40.6, 5, 1, 5.4, 0, 3, 3.6); grade(326, 33, 3, 1, 4.5, 0, 2.8, 3); luz(331.8, 10.5, 1.4); // superestrutura e mastro
  // Ordem estável e espalhada para as luzes usadas.
  const ordem = [...vagas].sort((a, b) => a.o - b.o);
  const luzes = $derived(ordem.slice(0, Math.min(total, ordem.length)));
  const ameias = (n) => 'h4v-3h4v3'.repeat(n);
  const SIL = `M0 72V47${ameias(14)}V72zM10 72V30${ameias(2)}h4V72zM76 72V22${ameias(3)}V72zM87.4 5h1.2v17h-1.2z`
    + 'M120 72V44h-2l34-11 34 11h-2v28zM203 72V34h-6l-2-12h4v-2h7.5V11h1v9H215v2h4l-2 12h-6v38zM224 72V54q24-18 48 0v18z'
    + 'M272 69h128v3H272zM282 69V25h2.5v44zM277 30l33-5v2.2l-33 6.8zM306 27h.8v13h-.8zM304.4 40h4v3h-4z'
    + 'M294 56h92l13-6-6 20q-.5 2-3 2h-88q-3 0-4-2zM296 46h1v10h-1zM312 47h52v9h-52zM320 38h30v9h-30zM324 31h16v7h-16zM331 11h1.6v20H331zM326 17h12v1.2h-12zM328 21h8v2.4h-8zM352 47V34h7l2 13zM368 50h9v6h-9zM376 51.5h13v1.6h-13z';
</script>
<svg class="base" class:noite viewBox="0 0 400 84" aria-hidden="true">
  <defs><linearGradient id="feixe" gradientUnits="userSpaceOnUse" x1="0" y1="12" x2="0" y2="-120"><stop offset="0" stop-color="var(--luz)" /><stop offset="1" stop-color="var(--luz)" stop-opacity="0" /></linearGradient></defs>
  <g class="holo"><path class="h1" d="M207 12l-46-150h34z" /><path class="h2" d="M331.8 12l12-150h34z" /></g>
  <path class="mar" d="M0 72h400v12H0z" />
  <path class="onda" d="M8 77h22M52 80h30M104 76.5h18M150 79.5h26M204 77h30M262 80h20M300 77.5h34M352 80h28" />
  <path class="sil" d={SIL} />
  <path class="vao" d="M50 72V62a6 6 0 0112 0v10zM234 72V59q14-9 28 0v13z" />
  <path class="flama" d="M88.6 5.5h10l-2.4 2.8 2.4 2.8h-10z" />
  {#each luzes as j, i (j.x + '-' + j.y)}<rect class="luz" class:on={i < acesas} x={j.x} y={j.y} width={j.w} height={j.h} rx={j.rx} style="transition-delay:{(i % 6) * 60}ms" />{/each}
</svg>
<style>
  .base { display: block; width: calc(100% + 32px); margin: 14px -16px 0; aspect-ratio: 400 / 84; height: auto; overflow: visible; pointer-events: none; }
  .sil { fill: var(--sil); }
  .vao { fill: var(--sil2); }
  .mar { fill: var(--sil); opacity: .45; }
  .onda { fill: none; stroke: var(--sil2); stroke-width: 1; stroke-linecap: round; }
  .flama { fill: var(--ac); }
  .luz { fill: var(--sil2); stroke: var(--luz); stroke-width: 0; stroke-opacity: .34; transition: fill .6s ease, stroke-width .6s ease; }
  .luz.on { fill: var(--luz); stroke-width: 3; }
  .holo { opacity: 0; transition: opacity 1.2s ease; fill: url(#feixe); }
  .noite .holo { opacity: .13; }
  .holo path { transform-box: fill-box; transform-origin: 50% 100%; animation: varre 14s ease-in-out infinite alternate; }
  .holo .h1 { transform-origin: 100% 100%; }
  .holo .h2 { transform-origin: 0 100%; animation-duration: 18s; animation-direction: alternate-reverse; }
  @keyframes varre { from { transform: rotate(-14deg); } to { transform: rotate(16deg); } }
</style>
