export const VERSAO = 1;
const EXTRAS = ['adiados', 'dificeis', 'lacunas', 'cumpridos', 'vistos', 'redacoes'];
export function baixar(nome, texto, tipo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: tipo }));
  a.download = nome; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const montar = (app) => JSON.stringify({
  versao: VERSAO, exportado: new Date().toISOString(), cfg: app.cfg, done: app.done, reviews: app.reviews, errors: app.errors, exams: app.exams,
  extras: Object.fromEntries(EXTRAS.map((k) => [k, app[k]])),
});
/** Valida o JSON de backup; lança Error com mensagem em português. */
export function validar(texto) {
  let d; try { d = JSON.parse(texto); } catch { throw new Error('Arquivo inválido: não é um JSON.'); }
  if (!d || d.versao !== VERSAO || !d.cfg?.concursos || typeof d.done !== 'object') throw new Error('Este arquivo não parece um backup do Estuda Gabriel.');
  return { cfg: d.cfg, done: d.done ?? {}, reviews: d.reviews ?? {}, errors: d.errors ?? {}, exams: d.exams ?? {}, extras: d.extras ?? {} };
}
