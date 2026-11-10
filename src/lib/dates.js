// Datas são strings "AAAA-MM-DD" no fuso local; nada de UTC para não errar o dia.
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => iso(new Date());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const weekday = (s) => parse(s).getDay(); // 0 = domingo
export const startOfWeek = (s) => addDays(s, -((weekday(s) + 6) % 7)); // segunda
export const weekIndex = (s) => Math.floor(diffDays('2026-11-09', startOfWeek(s)) / 7);
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const diaNome = (s) => DIAS[weekday(s)];
export const fmtCurta = (s) => { const d = parse(s); return `${d.getDate()} de ${MESES[d.getMonth()]}`; };
export const fmtBR = (s) => s.split('-').reverse().join('/');
export const fmtMin = (m) => { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`) : `${r} min`; };
