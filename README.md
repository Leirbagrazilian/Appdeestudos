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
- [x] Caderno de erros 2.0: lição por erro, treino tipo flashcard (2 acertos seguidos = dominado), abas e busca, painel "Seus vilões"
- [x] QG (antiga aba Mais): cartões de resumo, redação com as 5 competências do ENEM, status do backup
- [x] Proteção dos dados: o app pede ao navegador para não apagar os dados; lembrete de backup a cada 7 dias

## Como usar o modo foco
1. Na tela Hoje, toque no ▶ ao lado do bloco.
2. Pode fechar o app e ir para o caderno e os vídeos: o tempo é calculado pelo relógio, então continua certo.
3. Na pausa, registre as questões (+1 acertei / +1 errei), se refez alguma sem olhar a resolução e o assunto.
4. No fim, "Concluir bloco" grava os minutos reais e as questões. Elas aparecem em Semana → Questões da semana.

## Concursos e idade (SPEC v2, etapa 1)
Nascimento 25/11/2005; o ano da matrícula é o da prova + 1 e a idade é calculada, nunca fixa.
- Escola Naval: menos de 23 anos em 30/06. EFOMM: 23 incompletos em 01/01. ITA: não completar 25 até 31/12.
- ESA (área Geral): 17 a 24 anos até 31/12. IME: fora do limite (aparece só como informação).
- Conflito de provas (ex.: EFOMM × ESA em 26/07/2027) aparece no Calendário e na tela Hoje; prioridade EFOMM.
- Fases: 1 Base · 2 Desenvolvimento · 3 EFOMM+ESA · 4 Escola Naval · 5 ITA · 6 ENEM (só provas antigas).
- Atualizações do seed (`versaoSeed`) entram no app sem apagar o que você editou (datas, status, carta, links).

## Matérias × concursos e Trilha (SPEC v2, etapa 2)
- Matemática, Português e Inglês servem a EN, EFOMM, ITA e ESA; Física a EN, EFOMM e ITA; Química só ao ITA; Hist/Geo só à ESA; Cálculo só à EN. A Escola Naval elimina com menos de 50% em qualquer matéria ou redação abaixo de 50/100.
- A tela **Trilha** (substitui o Mapa de lacunas) lista os tópicos de cada matéria na ordem de estudo, com os concursos que cada um serve e a sua nota de domínio (0 a 3). As notas antigas do mapa foram aproveitadas.
- "O que estudar a seguir": dentro da janela dos próximos 3 tópicos, vale primeiro o que serve a mais concursos.

## Rotina e planner v2 (SPEC v2, etapa 3)
- **Janelas de estudo** por dia (editáveis em Ajustes). Os blocos entram nelas com **50 min de foco e 10 de pausa**; cada bloco mostra o horário.
- **Horas por semana** vêm da tabela da fase (base de 50 h) escalada para a **meta líquida de 43 h**. Sábado: prova antiga cronometrada + correção; domingo: redação + planejamento.
- Regras: matéria abaixo de 50% no último simulado ganha +2 h na semana seguinte (tiradas da mais forte); inglês com 75% ou mais fica em 1 h de manutenção; rampa opcional de 75% nas 2 primeiras semanas; semana antes da prova = revisão leve.
- Janelas com horário vazio, inválido ou sobreposto são ignoradas (e avisadas em Ajustes). A meta diária antiga (`metaHoras`) foi substituída pela meta líquida semanal e não é migrada.
- A rampa vale nas 2 primeiras semanas do planner, depois da semana diagnóstica.
- A Fase 6 (ENEM) usa uma tabela estimada (muita prova antiga); ajuste em `horasFase.enem` no seed se quiser.

## Meus livros (SPEC v2, etapa 4)
- Tela **QG → Meus livros**: por matéria, escolha o **livro principal** (Física Clássica por padrão; Tópicos de Física como opção; Química: Feltre, editável), veja os volumes e vincule cada um a tópicos da Trilha.
- Cadastre **uma vez** capítulo, páginas e exercícios de cada tópico. O app calcula a **cota do bloco** (teoria 10 pág/h, gramática 15 pág/h, ajustados pelo que você registrar) e **continua de onde você parou**: o que não foi lido fica para o próximo bloco.
- A biblioteca do SPEC vem cadastrada **sem páginas**. Links: só entram os que apareceram na busca ("link visto na busca"); os demais ficam "a confirmar" e você cola o seu. Questões por hora: 6 (EN/EFOMM) e 3 (ITA).
- Os temas de redação já cobrados na Escola Naval aparecem na tela Redação (lista do SPEC, não verificada).

## Bloco = tarefa exata (SPEC v2, etapa 5)
- Cada bloco de estudo vira uma tarefa: **vídeo → páginas do livro → exercícios → questões do tópico**. O tópico vem da Trilha (o próximo, pela regra dos concursos), as páginas da biblioteca (Meus livros) e os minutos são divididos 25% vídeo, 45% páginas/exercícios e 30% questões, só entre o que existe. Vários blocos da mesma matéria no dia continuam de onde o anterior parou.
- **Questões: o app não guarda nem gera questões.** Em cada tópico (Trilha → "Links de questões e vídeo") você cola o link de uma lista já filtrada: QConcursos, Estuda.com, prova em PDF ou outro. O bloco mostra os links com a cota grátis do dia (padrão 10 + 5, editável em Ajustes) e, quando acaba, sugere a prova em PDF ou os exercícios do livro.
- **Registro em uma tela:** marcar o bloco é 1 toque; "Registrar" (no aviso ou no bloco) abre: questões feitas e acertadas, onde fez, páginas lidas e os erros (assunto + tipo) que vão para o caderno. Corrigir depois não duplica páginas, cota nem erros. Daí saem o **acerto por tópico** (na Trilha) e a leitura "de onde parei".
- Sem páginas cadastradas, o bloco mostra vídeo e questões e um botão "Cadastrar páginas". O cronômetro mostra a mesma tarefa e, ao concluir, abre o registro só dos erros.

## Extras e telas (SPEC v2, etapa 6)
- **Dia mínimo** (substitui o "dia difícil"): um único bloco de 45 min com 20 questões da matéria mais fraca + revisões vencidas. Conta como dia cumprido. Botão na tela Hoje.
- **Revisão de domingo** (QG → Revisão da semana): 3 perguntas (o que foi bem, o que faltou, foco da próxima), resumo automático (horas, questões, erros, dias cumpridos) e histórico. O foco aparece na Hoje durante a semana seguinte.
- **Cobertura do conteúdo** (Trilha): % de tópicos dominados e % de páginas lidas por matéria.
- **Ajustes**: janelas de estudo, meta, rampa e livro principal de cada matéria.
- O lembrete de sono/exercício foi removido.

## Base do zero (SPEC v3)
- **Fase 0 · Base do zero** (16/11/2026 a 10/01/2027, 8 semanas): 24 h Mat, 10 Fís, 5 Quím, 3 Port, 1 Ing por semana. Sem prova antiga, sem simulado e sem dia livre (Natal e Ano Novo também têm estudo). As fases seguintes: 1 Ensino médio, 2 EFOMM+ESA (maio), 3 Escola Naval, 4 ITA, 5 ENEM.
- **Sábado e domingo mais cheios:** janelas novas e `peso do fim de semana` (Ajustes). O total semanal continua na meta.
- **Modo domínio:** cada tópico da Fase 0 só avança com 8 acertos em 10 (ou "dominado no Khan"). Abaixo disso o próximo bloco repete o tópico; depois de 3 tentativas ele fica **travado** (aviso na Hoje, botão de destravar na Trilha).
- **Trilha da Fase 0:** tópicos pequenos (1 tópico ≈ 1 bloco de 2×50 min), agrupados por semana da tabela do SPEC.
- **Bloco da Fase 0:** vídeo curto (até 20 min), exercícios (Khan/OBMEP) e livro, com no mínimo 10 exercícios.
- **Progresso** (QG): checkpoint mensal (10 questões de Matemática da EFOMM em 30 min, aviso no primeiro sábado do mês), gráfico e o **portão da Fase 0**: teste de saída do Khan com 80% ou mais e checkpoint com pelo menos 5 acertos (e melhor que o diagnóstico). Se falhar, prorroga 2 semanas só com os tópicos fracos.

## Notas
- Notificações locais só disparam quando o app é aberto (limitação de PWA sem servidor). Pelo mesmo motivo, o cronômetro não consegue tocar um alarme com outro app em primeiro plano: no Android há um botão experimental que tenta abrir o timer do relógio do sistema. Os alertas garantidos de inscrição (14, 7 e 1 dia) vão no arquivo `.ics` para a Google Agenda.
- As datas de 2027 são estimativas (ciclo 2026 + 1 ano). Edite em Ajustes quando os editais saírem.
