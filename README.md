# Estuda Gabriel

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
- **GitHub Pages** (já configurado em `.github/workflows/pages.yml`): em Settings → Pages, escolha Source = **GitHub Actions**. Cada push na `main` publica o app. Grátis se o repositório for público.

## Editar dados
Tudo que é conteúdo está em `src/data/seed.json`: datas e status dos concursos, rotina, modelo de semana, métodos e a semana diagnóstica (com "como fazer" e "onde achar"). Os dados já salvos no aparelho ficam em Ajustes (etapa futura); para recarregar o seed do zero, limpe os dados do site.

## Estado das etapas
- [x] Fundação, Hoje, Calendário, Semana, Caderno de erros, Simulados, Ajustes
- [x] Sensação: animação de toque, transição entre telas, detalhes que deslizam, tremor em erro de formulário, vibração e sons opcionais, texto ajustável, controle de animações
- [x] Estudar melhor: modo foco com cronômetro (sessões de 50 min + 10 de pausa, continua com o app fechado), registro de questões na pausa, foto do caderno no caderno de erros, link da aula por matéria, revisão com nota (fácil/ok/difícil), "passar para amanhã"
- [x] Motivação: cidade que acende (uma janela por bloco da semana), sinal que acompanha o dia e o horário, "dia difícil", carta para você mesmo, pausas ativas
- [x] Profundidade: mapa de lacunas, nota de corte nos simulados, insígnias e capítulos
- [x] Extras: som de chuva gerado no próprio app (sem download)

## Como usar o modo foco
1. Na tela Hoje, toque no ▶ ao lado do bloco.
2. Pode fechar o app e ir para o caderno e os vídeos: o tempo é calculado pelo relógio, então continua certo.
3. Na pausa, registre as questões (+1 acertei / +1 errei), se refez alguma sem olhar a resolução e o assunto.
4. No fim, "Concluir bloco" grava os minutos reais e as questões. Elas aparecem em Semana → Questões da semana.

## Notas
- Notificações locais só disparam quando o app é aberto (limitação de PWA sem servidor). Pelo mesmo motivo, o cronômetro não consegue tocar um alarme com outro app em primeiro plano: no Android há um botão experimental que tenta abrir o timer do relógio do sistema. Os alertas garantidos de inscrição (14, 7 e 1 dia) vão no arquivo `.ics` para a Google Agenda.
- As datas de 2027 são estimativas (ciclo 2026 + 1 ano). Edite em Ajustes quando os editais saírem.
