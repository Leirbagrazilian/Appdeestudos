# Estuda Gabriel

App pessoal de estudos (PWA, Svelte 5 + Vite, dados no IndexedDB, sem backend). Idioma: português. Spec em andamento: SPEC v2 (melhorias).

## Como trabalhar
- Abra só os arquivos que for mudar. Não reescreva o que funciona. Um commit com testes por etapa. Respostas curtas.
- Comandos: `npm test`, `npm run build`, `npm run dev`.
- Lógica pura em `src/lib/` (com teste), estado em `src/stores/app.svelte.js`, telas em `src/screens/`, dados em `src/data/seed.json`.

## Delegação e modelos
Delegue busca ao `explorador`, código rotineiro ao `implementador` e verificação ao `revisor`. Use fable só se o revisor reprovar duas vezes.
Sessão principal: `/model opusplan` (Opus planeja, Sonnet executa).
