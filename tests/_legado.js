// Config "antiga" (sem início real, treino e oração em 17/11) para os testes que dependem dessas datas.
export function legado(c) {
  delete c.perfil.inicioReal;
  c.treinoPlano.inicio = '2026-11-17';
  c.oracaoPlano.inicio = '2026-11-17';
  return c;
}
