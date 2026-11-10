// Sons gerados na hora (Web Audio): nada para baixar, funciona offline.
let ctx;
const contexto = () => (ctx ??= new (window.AudioContext || window.webkitAudioContext)());

/** Sininho curto de conclusão. */
export function sino() {
  try {
    const c = contexto(), t = c.currentTime;
    for (const [f, d] of [[880, 0], [1320, 0.12]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.18, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.6);
      o.connect(g).connect(c.destination); o.start(t + d); o.stop(t + d + 0.65);
    }
  } catch { /* sem áudio */ }
}

let fonte, ganho;
/** Som ambiente de chuva (ruído marrom filtrado), em loop. */
export function ambiente(ligar) {
  try {
    if (!ligar) { fonte?.stop(); fonte = null; return; }
    if (fonte) return;
    const c = contexto(), n = c.sampleRate * 4, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    let ult = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; ult = (ult + 0.02 * w) / 1.02; d[i] = ult * 3.5; }
    fonte = c.createBufferSource(); fonte.buffer = buf; fonte.loop = true;
    const filtro = c.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 1200;
    ganho = c.createGain(); ganho.gain.value = 0.35;
    fonte.connect(filtro).connect(ganho).connect(c.destination); fonte.start();
  } catch { /* sem áudio */ }
}
export const ambienteLigado = () => !!fonte;
