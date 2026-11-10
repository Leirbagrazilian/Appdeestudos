import { addDays } from './dates.js';
import { ALERTAS } from './alerts.js';

const dt = (s) => s.replaceAll('-', '');
const esc = (t) => t.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

/** Eventos de dia inteiro (fim exclusivo) + alarmes 14/7/1 dia antes do fim das inscrições. */
export function gerarICS(cfg) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Estuda Gabriel//PT-BR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Estuda Gabriel'];
  for (const c of cfg.concursos) for (const e of c.eventos) {
    const nome = e.tipo === 'inscricao' ? 'Inscrições' : (e.nome ?? 'Prova');
    L.push('BEGIN:VEVENT', `UID:${c.id}-${e.tipo}-${e.inicio}@rumo-aprovacao`, `DTSTAMP:20260101T000000Z`,
      `DTSTART;VALUE=DATE:${dt(e.inicio)}`, `DTEND;VALUE=DATE:${dt(addDays(e.fim, 1))}`,
      `SUMMARY:${esc(`${c.nome}: ${nome} (${e.status})`)}`, `DESCRIPTION:${esc(`Confira o edital: ${c.link}`)}`);
    if (e.tipo === 'inscricao') for (const n of ALERTAS)
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`Inscrição ${c.nome} fecha em ${n} dia(s)`)}`, `TRIGGER:-P${n}D`, 'END:VALARM');
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}
