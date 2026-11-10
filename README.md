# Rumo à Aprovação

App pessoal de estudos em formato checklist (Escola Naval, EFOMM, ENEM e ITA). PWA offline, sem backend, dados no IndexedDB do aparelho.

## Como rodar
```bash
npm install
npm run dev        # desenvolvimento
npm test           # testes da lógica (fases, revisões, idade, planner)
npm run build      # gera /dist
npm run preview    # testa o build (PWA/offline)
```

## Instalar no celular
Abra o endereço publicado no Chrome (Android) → menu ⋮ → "Instalar app". No iPhone: Safari → Compartilhar → "Adicionar à Tela de Início". Depois do primeiro acesso funciona 100% offline.

## Publicar de graça
O build usa caminhos relativos e rotas por `#`, então funciona em qualquer um destes:
- **Netlify** (recomendado): "Add new site → Import from Git", build `npm run build`, pasta `dist`. Funciona com repositório privado.
- **Cloudflare Pages / Vercel**: mesma configuração (build `npm run build`, saída `dist`).
- **GitHub Pages**: só de graça se o repositório for público; publique a pasta `dist`.

## Editar dados
Tudo que é conteúdo está em `src/data/seed.json`: datas e status dos concursos, rotina, modelo de semana, métodos e a semana diagnóstica (com "como fazer" e "onde achar"). Os dados já salvos no aparelho ficam em Ajustes (etapa futura); para recarregar o seed do zero, limpe os dados do site.

## Estado das etapas
- [x] Fundação (Vite + Svelte, PWA, IndexedDB, fases automáticas, planner, revisões, idade)
- [x] Hoje, Calendário, Semana
- [ ] Caderno de erros · Simulados · Ajustes (backup, .ics, notificações)
- [ ] Polimento (Lighthouse, notificações)
