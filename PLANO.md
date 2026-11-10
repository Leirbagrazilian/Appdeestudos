# Estuda Gabriel (antes: Rumo à Aprovação): plano do projeto

> Documento para aprovação antes de começar a programar.
> Data do plano: 10/11/2026.

## 1. Atenção: limites de idade (calculei com o seu nascimento em 25/11/2005)

| Concurso | Regra | Prova 2027 → matrícula 2028 | Prova 2028 → matrícula 2029 | Prova 2029 → matrícula 2030 |
|---|---|---|---|---|
| Escola Naval | menos de 23 anos em 01/01 do ano da matrícula | ✅ 22 anos | ❌ 23 anos | ❌ |
| EFOMM | 23 anos incompletos em 01/01 | ✅ 22 anos | ❌ 23 anos | ❌ |
| ITA | não completar 25 anos até 31/12 do ano da matrícula | ✅ faz 23 | ✅ faz 24 | ❌ faz 25 em 25/11/2030 |

**Conclusões importantes:**
- Pelas regras que você passou, **2027 é a única tentativa possível na Escola Naval e na EFOMM**. Isso reforça a prioridade delas no plano.
- **A tentativa principal no ITA em 2029 ficaria fora do limite** (matrícula em 2030, você faria 25 em novembro). A última tentativa válida seria a **prova de 2028**. Sugiro mudar o plano do ITA para "experiência em 2027, tentativa principal em 2028". Vale confirmar no próximo edital, porque essas regras às vezes mudam.

O app vai mostrar esse cálculo automaticamente em Ajustes (com a data de nascimento editável) e um aviso no card de cada concurso.

## 2. Stack e por quê

| Item | Escolha | Motivo |
|---|---|---|
| Framework | **Svelte 5 + Vite** | Compila para JS puro, sem runtime pesado. O app inteiro deve ficar em ~40–60 KB gzip (limite: 150 KB). |
| Dados | **IndexedDB** com um wrapper próprio de ~1 KB | Sem backend, tudo no aparelho. |
| PWA | `vite-plugin-pwa` (Workbox, só em build) | Service worker com precache: 100% offline após o primeiro acesso. |
| Gráficos | **SVG feito à mão** | Anéis, barras e linha de evolução sem biblioteca. |
| Fonte | **Inter** (variável, subset latino, auto-hospedada) | Legível e funciona offline. |
| Rotas | Hash router próprio (~30 linhas) | Funciona no GitHub Pages sem configuração. |
| Testes | Vitest para a lógica (periodização, revisões, ics) | A lógica de datas é o que mais pode quebrar. |

## 3. Estrutura de pastas

```
/
├─ index.html
├─ public/            ícones, manifest, fonte Inter
├─ src/
│  ├─ main.js
│  ├─ App.svelte                 layout + barra de navegação inferior
│  ├─ data/seed.json             ← concursos, datas, rotina, modelo de semana, métodos
│  ├─ lib/
│  │  ├─ db.js                   IndexedDB (stores: settings, done, reviews, errors, exams)
│  │  ├─ dates.js                utilidades de data (fuso local, dias da semana)
│  │  ├─ phases.js               periodização automática a partir das provas
│  │  ├─ planner.js              gera o checklist de um dia (fase + modelo de semana)
│  │  ├─ spaced.js               revisões 1/7/30 dias
│  │  ├─ age.js                  limites de idade
│  │  ├─ ics.js                  exportação .ics
│  │  ├─ backup.js               exportar/importar JSON
│  │  └─ notify.js               notificações locais
│  ├─ stores/                    estado reativo (Svelte runes)
│  ├─ components/                Checkbox animado, Ring, ProgressBar, Sheet, Toast(desfazer), Chip…
│  └─ screens/                   Hoje, Semana, Calendario, Erros, Simulados, Ajustes
├─ tests/
└─ README.md
```

## 4. Modelo de dados (`seed.json` editável)

```jsonc
{
  "perfil": { "nascimento": "2005-11-25" },
  "concursos": [
    { "id": "en", "nome": "Escola Naval", "cor": "#1E5AA8", "prioridade": 1,
      "limiteIdade": { "tipo": "menorQue", "idade": 23, "referencia": "01-01" },
      "link": "…site do SSPM…",
      "eventos": [
        { "tipo": "inscricao", "inicio": "2027-04-30", "fim": "2027-06-05", "status": "estimada" },
        { "tipo": "prova", "inicio": "2027-08-29", "fim": "2027-08-30", "status": "estimada" }
      ] }
    // efomm, enem, ita…
  ],
  "rotina": { "aulas": [...], "metaHoras": { "seg": 4, "ter": 4, "qua": 2, "qui": 4, "sex": 4, "sab": 6, "dom": 4 } },
  "modeloSemana": { "seg": [ { "materia": "Matemática", "min": 120, "metodo": "recuperacao" }, … ] },
  "metodos": { "recuperacao": "Faça questões sem consultar. Errou? Vai pro caderno de erros.", … }
}
```

As datas de 2026 ficam no histórico e as de 2027 entram como **estimada** (mesmas janelas +1 ano). Antes de gravar, confiro nos sites oficiais o que já existir do ciclo 2027.

## 5. Periodização automática (`phases.js`)

Entrada: datas de prova. Saída: lista de fases com início e fim. Recalcula sempre que uma data muda.

1. **Base**: de 10/11/2026 até o fim de fevereiro. Diagnóstico na 1ª semana.
2. **Desenvolvimento**: de março até o início da fase EFOMM. Prova antiga a cada 2 sábados. Checklist de inscrições.
3. **Específica EFOMM**: começa em `prova EFOMM − 7 semanas` (dentro da faixa de 6 a 8). Termina na prova.
4. **Específica Escola Naval**: começa em `max(prova EN − 7 semanas, fim da EFOMM)`.
5. **Reta final ITA + ENEM**: da EN até a última prova do ENEM.

- A **última semana antes de cada prova** vira "revisão leve" (carga de 60%, sem conteúdo novo).
- Se duas fases se sobrepõem, a de maior prioridade ganha e a outra é encurtada.
- O conteúdo de cada fase (quais matérias e qual tipo de prova antiga no sábado) muda o que o modelo de semana gera.

## 6. Como o checklist do dia é gerado (`planner.js`)

`dia → fase atual → modelo do dia da semana → blocos` + `revisões vencidas` + `lembretes (sono/exercício)`.

- Seg/ter/qui/sex: Matemática 2h · Física 1h · Português **ou** Inglês (alterna por semana) 1h · Caderno de erros 10 min
- Qua: Revisão espaçada 1h · Questões misturadas 1h
- Sáb: Prova antiga cronometrada ~4h (EFOMM/EN/ITA/ENEM conforme a fase) · Correção 2h
- Dom: Redação 1h30 · Química 1h30 · Planejar a semana 30 min
- Cada bloco tem um campo opcional "assunto". Ao marcar como feito com assunto preenchido, o app **agenda revisões para +1, +7 e +30 dias** e elas aparecem no dia certo. Revisão atrasada continua aparecendo como "vencida" (sem punir).
- O checklist é **gerado na hora**, não fica salvo. Só salvo o que você marcou, então mudar a rotina não estraga o histórico.

## 7. Telas

Navegação inferior fixa com 5 ícones: **Hoje · Semana · Calendário · Erros · Mais** (Simulados e Ajustes ficam em "Mais"). Tudo a no máximo 2 toques.

### 7.1 Hoje (tela inicial)
```
┌───────────────────────────────┐
│ Terça, 10 de nov              │
│ ● Fase 1 · Base   sem. 1/16   │  chip com a cor da fase
├───────────────────────────────┤
│  EFOMM em 257 dias            │  card com a cor do concurso
│  25/07/2027 · estimada        │  toque → calendário
├───────────────────────────────┤
│ ▓▓▓▓▓▓░░░░  2h10 de 4h · 54%  │  barra animada
├───────────────────────────────┤
│ ◯ Matemática · 2h             │  1 toque = feito (check com mola)
│   💡 Recuperação: questões     │
│      sem consultar            │
│ ◯ Física · 1h                 │
│ ◯ Inglês · 1h                 │
│ ◯ Caderno de erros · 10min    │
│ ── Revisões vencidas (2) ──   │
│ ◯ Funções afins · 7 dias      │
├───────────────────────────────┤
│ 🌙 Sono 7–9h · 🏃 movimento   │  lembrete discreto
└───────────────────────────────┘
  Toast: "Física concluída · Desfazer"
```
Ao tocar e segurar (ou na setinha) o bloco expande: assunto, minutos reais e nota rápida.

### 7.2 Semana
- 7 anéis (seg→dom), cada um preenchido pelas horas feitas/meta do dia; o dia de hoje fica destacado.
- Total: "21h de 28h". Barras por matéria mostrando que Matemática fica perto de 50%.
- **Constância que não pune**: média móvel de 4 semanas ("você cumpriu 82% nas últimas 4 semanas") + contagem de "semanas boas" que nunca zera.

### 7.3 Calendário
- Linha do tempo horizontal rolável de nov/2026 a nov/2027: faixa de fases coloridas + uma linha por concurso com marcos (◆ edital, ▶ abre inscrição, ■ fecha, ★ prova).
- Abaixo, lista cronológica dos próximos eventos com status (estimada/edital/confirmada) e botão **Verificar edital** (link oficial).
- Alertas 14, 7 e 1 dia antes de cada inscrição fechar (aparecem no Hoje + notificação).

### 7.4 Caderno de erros
- Botão "+" abre formulário curto: matéria (chips), assunto (texto com sugestões), tipo (Conteúdo / Atenção / Tempo). Salvar em 1 toque.
- Cada erro agenda revisão (1/7/30). Filtros por matéria e tipo + mini resumo ("60% dos seus erros são de atenção").

### 7.5 Simulados
- Registrar: data, concurso, nota por matéria (%).
- Gráfico de linha SVG por matéria + total, com a meta tracejada.

### 7.6 Ajustes
- Datas de cada concurso + status, nascimento e avisos de idade.
- Horários das aulas e metas por dia.
- Backup: exportar/importar JSON. Exportar `.ics` (provas, inscrições, alertas) para a Google Agenda.
- Notificações: ativar e escolher horário do lembrete diário.

## 8. Design

- Paleta calma: fundo off-white `#F7F8FA` / escuro `#0F1217`; destaque **verde-água** `#0E8A7E` (sucesso e progresso).
- Cores dos concursos (todas com contraste AA nos dois temas): Escola Naval azul-marinho, EFOMM azul-petróleo, ITA vinho, ENEM âmbar.
- Inter, base 16px, títulos 600; cantos de 16px; espaçamento em múltiplos de 8; toque mínimo de 48px.
- Animações: check com escala + traço SVG (220 ms), barra com `transition` de largura, anel com `stroke-dashoffset`. Tudo desligado com `prefers-reduced-motion`.
- Claro e escuro via `prefers-color-scheme`, com opção manual em Ajustes.

## 9. Notificações (limitação honesta)

Sem backend, o navegador só dispara notificação quando o app/service worker está ativo. Plano:
1. Ao abrir o app, verifico alertas do dia e notifico (Notification API).
2. Onde existir (Chrome Android), uso **Notification Triggers / Periodic Background Sync** para lembretes agendados.
3. Garantia real: o **.ics** coloca os alertas de inscrição na Google Agenda, que notifica sempre.

## 10. Etapas de entrega (um commit por etapa)

1. **Fundação**: Vite + Svelte, PWA, tema, navegação, IndexedDB, `seed.json`, lógica de fases/planner com testes.
2. **Hoje**: checklist, animação, desfazer, contagem regressiva, revisões espaçadas.
3. **Calendário**: linha do tempo, marcos, verificar edital, alertas.
4. **Semana**: anéis, metas, constância.
5. **Caderno de erros**, **Simulados**, **Ajustes** (backup, .ics, notificações).
6. **Polimento**: Lighthouse ≥ 95, bundle < 150 KB, README (rodar, instalar no celular, publicar no GitHub Pages/Netlify/Vercel).

## 11. Decisões que preciso de você

1. **ITA**: mudo a tentativa principal para 2028 (por causa do limite de idade)?
2. **Fase 1** começa hoje (10/11/2026) com o diagnóstico nesta semana. Pode ser?
3. **Português/Inglês**: alternar por dia (seg PT, ter EN…) ou por semana?
4. Hospedagem preferida: **GitHub Pages** (já que o código está aqui) ou Netlify/Vercel?
