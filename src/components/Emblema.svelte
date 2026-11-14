<script module>
  // Silhuetas militares originais (48×48, cor herdada). Emblemas de instituições são versões próprias e estilizadas.
  const ESTRELA = 'M24 4l4.9 14.3H44l-12.2 8.9 4.6 14.3L24 32.7l-12.4 8.8 4.6-14.3L4 18.3h15.1z';
  const ASA = 'M20 22c-6-6-14-7-19-6 2 3 4 4 6 5-2 0-3 .5-4 1 2 2.5 5 3 7 3-1 .5-2 1-3 2 4 2 9 1 13 0z';
  const L = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  const ancora = (t = '') => `<g ${t} ${L} stroke-width="3.4"><circle cx="24" cy="8.5" r="4"/><path d="M24 12.5V42M15 20h18M7.5 28c1 9 8 14 16.5 14s15.5-5 16.5-14"/></g><path ${t} d="M2.5 31.5l5-10 6.5 8.5zM45.5 31.5l-5-10-6.5 8.5z"/>`;
  const asas = `<path d="${ASA}"/><path transform="matrix(-1 0 0 1 48 0)" d="${ASA}"/>`;
  export const EMBLEMAS = {
    estrela: `<path d="${ESTRELA}"/>`,
    ancora: ancora(),
    aviao: '<path d="M47 24c-5-2.8-12-3-21-3L14 6H9l6 15H8l-4-5.5H1L3 24l-2 8.5h3L8 27h7L9 42h5l12-15c9 0 16-.2 21-3z"/>',
    helicoptero: `<path d="M6 25c0-6 5-10 12-10h6c4 0 7 2 8 6l13 2 1-6h2v12h-2l-1-2-14 2c-2 4-5 6-9 6H12c-4 0-6-4-6-8z"/><path ${L} stroke-width="2.2" d="M4 10h36M21 10v5M9 40.5h19M13 35v5M23 35v5"/>`,
    navio: '<path d="M1 30h46l-5 9H7zM13 28v-6h6v-6h6V6h2v4h4v2h-4v4h3v6h7v6zM38 28v-3h4v1h5v1.5h-5V28z"/>',
    mercante: '<path d="M1 29h46l-4 10H6zM4 27V15h3v-5h4v5h3v12zM17 27v-6h8v6zM27 27v-6h8v6zM37 27v-4h7v4zM21 19v-5h9v5z"/>',
    submarino: `<path d="M3 30c0-5 6-7 14-7h3v-8h8l2 8h8c5 0 8 3 8 7s-3 7-8 7H12c-6 0-9-3-9-7z"/><path ${L} stroke-width="2" d="M24 15v-5h4"/>`,
    tanque: '<path d="M7 31h34a4.5 4.5 0 010 9H7a4.5 4.5 0 010-9zM9 29l3-5h26l2 5zM16 22v-5h14l2 5zM31 18h16v2.4H31z"/>',
    capacete: '<path d="M6 30C6 17 14 9 24 9s18 8 18 21l4 3v3H2v-3z"/>',
    quepe: '<path d="M7 21c0-8 8-12 17-12s17 4 17 12l-2 5H9zM9 28h30v4H9zM6 34h36c-1 4-8 6-18 6-8 0-14-2-18-6z"/>',
    divisa: '<path d="M8 18L24 8l16 10v6L24 14 8 24zM8 28l16-10 16 10v6L24 24 8 34zM8 38l16-10 16 10v6L24 34 8 44z"/>',
    platina: `<path ${L} stroke-width="2.6" d="M15 4h18l3 40H12z"/><circle cx="24" cy="10" r="2.4"/><path transform="translate(17.5 15) scale(.27)" d="${ESTRELA}"/><path d="M14.5 32h19v3h-19zM14 38h20v3H14z"/>`,
    plaqueta: `<path ${L} stroke-width="1.6" d="M16 9C14 3 28 0 31 8"/><g fill-rule="evenodd"><path transform="rotate(14 28 28)" opacity=".55" d="M24 12h9a5 5 0 015 5v20a5 5 0 01-5 5h-9a5 5 0 01-5-5V17a5 5 0 015-5zm4.5 3.5a2 2 0 100 4 2 2 0 000-4z"/><path transform="rotate(-12 20 28)" d="M15 11h10a5 5 0 015 5v21a5 5 0 01-5 5H15a5 5 0 01-5-5V16a5 5 0 015-5zm5 3.5a2 2 0 100 4 2 2 0 000-4zM14 26v2.2h12V26zm0 5v2.2h9V31z"/></g>`,
    asa: `${asas}<path d="M19 16h10v10c0 4-3 6-5 7-2-1-5-3-5-7z"/>`,
    medalha: '<path fill-rule="evenodd" d="M16 2h16v13l-8 5-8-5zM24 20a12 12 0 110 24 12 12 0 010-24zm0 5l-1.650 4.730-5.010.110 4 3.030-1.450 4.790L24 34.8l4.110 2.860-1.450-4.790 4-3.030-5.010-.110z"/>',
    fuzil: '<path d="M1 28l10-6h19v-2h3v2h14v2.4H37V26h-6l-2 2h-3l-1 7h-4.5l1-7H13l-9 5z"/>',
    espadas: `<g ${L} stroke-width="3"><path d="M9 5l27 32M39 5L12 37"/><path stroke-width="3.4" d="M29 39l9-8M19 39l-9-8"/></g><circle cx="38.5" cy="41.5" r="2.6"/><circle cx="9.5" cy="41.5" r="2.6"/>`,
    paraquedas: `<path d="M4 22C4 11 13 4 24 4s20 7 20 18c-3-3-7-3-10 0-3-3-7-3-10 0-3-3-7-3-10 0-3-3-7-3-10 0z"/><path ${L} stroke-width="1.2" d="M4.5 22L23 39M14 22l9.5 17M24 22v17M34 22l-9.5 17M43.5 22L25 39"/><rect x="21.5" y="38" width="5" height="8" rx="2"/>`,
    soldado: '<path d="M16.5 14.5a7.5 7.5 0 0015 0zM14 13c1-7 5-9 10-9s9 2 10 9l3 1v1.5H14zM6 46c0-11 8-17 18-17s18 6 18 17zM38.5 35.5l6.5-13-9.5-9-1.5 2.5 6.5 7-5 10z"/>',
    leme: `<g ${L}><circle cx="24" cy="24" r="12" stroke-width="3.4"/><path stroke-width="2.6" d="M24 3v42M3 24h42M9.2 9.2l29.6 29.6M38.8 9.2L9.2 38.8"/></g><circle cx="24" cy="24" r="4.5"/>`,
    // instituições (desenhos próprios, não são os logotipos oficiais)
    en: `${ancora('transform="translate(4.8 9.6) scale(.8)"')}<path transform="translate(1 1) scale(.25)" d="${ESTRELA}"/><path transform="translate(35 1) scale(.25)" d="${ESTRELA}"/><path transform="translate(18.5 -1) scale(.23)" d="${ESTRELA}"/>`,
    marinha: ancora(),
    efomm: `<g ${L}><circle cx="24" cy="21" r="10" stroke-width="3"/><path stroke-width="2.3" d="M24 3v36M6 21h36M11.3 8.3l25.4 25.4M36.7 8.3L11.3 33.7"/><path stroke-width="2.2" d="M4 44c3.3-3 6.7-3 10 0s6.7 3 10 0 6.7-3 10 0 6.7 3 10 0"/></g><circle cx="24" cy="21" r="3.8"/>`,
    esa: `<g ${L} stroke-width="2.8"><path d="M10 12l25 28M38 12L13 40"/><path d="M28 41l9-7M20 41l-9-7"/></g><path transform="translate(18 0) scale(.25)" d="${ESTRELA}"/>`,
    exercito: `<g ${L} stroke-width="3"><path d="M9 5l27 32M39 5L12 37"/><path stroke-width="3.4" d="M29 39l9-8M19 39l-9-8"/></g>`,
    fab: `<g transform="translate(0 -2)">${asas}</g><path transform="translate(16.5 12.5) scale(.31)" d="${ESTRELA}"/>`,
    ita: `<g transform="translate(1.5 -7) scale(.76 1)"><path d="${ASA}"/></g><g transform="translate(46.5 -7) scale(-.76 1)"><path d="${ASA}"/></g><g fill="none" stroke="currentColor"><circle cx="24" cy="16" r="7.6" stroke-width="2.8" stroke-dasharray="2.390 2.390"/><circle cx="24" cy="16" r="5.2" stroke-width="2"/></g><circle cx="24" cy="16" r="2"/><text x="24" y="43" text-anchor="middle" font-size="14" font-weight="800" letter-spacing="1.5" font-family="Inter,system-ui,sans-serif">ITA</text>`,
    ime: `<path ${L} stroke-width="2.6" d="M7 3h34v22c0 10-9 16-17 20C16 41 7 35 7 25z"/><path d="M16 26V9h3.2v3h3.2V9h3.2v3h3.2V9H32v17h-5.5v-5a2.5 2.5 0 00-5 0v5z"/><text x="24" y="37.5" text-anchor="middle" font-size="9.5" font-weight="800" letter-spacing=".8" font-family="Inter,system-ui,sans-serif">IME</text>`,
  };
</script>
<script>
  let { nome = 'estrela', size = 24, class: cls = '' } = $props();
</script>
<svg class={cls} viewBox="0 0 48 48" width={size} height={size} fill="currentColor" aria-hidden="true">{@html EMBLEMAS[nome] ?? EMBLEMAS.estrela}</svg>
