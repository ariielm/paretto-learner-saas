# Paretto SaaS — Foundation Design

**Status:** spec 000 implementada em commit `a52af2b` em 2026-05-22.

> Output da sessão de brainstorming que precede a primeira spec do projeto. Define o framework SDD operacional, a constitution refinada, os standards docs, o backlog v0.1 detalhado e o workflow de trabalho do time.

**Documento de design** — não substitui as specs individuais; precede e enquadra todas elas.

**Documentos relacionados:**
- `PLANO_ENTREGAS.md` (raiz) — plano de alto nível com escopo de v0.1, roadmap pós-v0.1, riscos.
- `.specify/constitution.md` (a criar na spec 000) — princípios invioláveis derivados deste documento.
- `.specify/standards/*.md` (a criar na spec 000) — padrões repetíveis derivados deste documento.

---

## Contexto

O Paretto Learner existe como sistema single-user file-based acoplado ao Claude Code (IDE). Esta sessão de brainstorming planejou o trabalho de transformá-lo em SaaS multi-tenant rodando em VPS própria, com:

- Auth via Google OAuth
- Múltiplos temas por usuário
- Árvore macro (DL1/DL2, 5-20 nós) gerada por LLM
- Mini-perfil imutável por tema, calibrando o conteúdo
- Conteúdo L1 gerado on-demand por nó
- Desbloqueio em cascata respeitando DAG de dependências
- Tudo dockerizado, dados na VPS, LLM swappable
- Português apenas, código em inglês

Decisão guarda-chuva: usar **spec-kit oficial do GitHub** (`/specify`, `/plan`, `/tasks`, `/implement`) e seguir SDD rigoroso.

---

## 1. Estrutura do repositório

```
paretto-learner-saas/
├── .specify/                          # criado por `specify init`
│   ├── constitution.md                # 12 princípios invioláveis
│   ├── standards/
│   │   ├── testing.md
│   │   ├── logging-and-observability.md
│   │   ├── error-handling.md
│   │   └── prompt-management.md
│   ├── specs/
│   │   ├── v0.1/
│   │   │   ├── 000-bootstrap/
│   │   │   │   ├── spec.md  plan.md  tasks.md
│   │   │   └── ...
│   │   ├── v0.2/  v0.3/ ...
│   └── templates/                     # custom (estende spec-kit)
│       ├── spec-template.md           # com seção Constitution+Standards Check
│       ├── plan-template.md
│       └── tasks-template.md
├── docs/
│   ├── PLANO_ENTREGAS.md
│   ├── superpowers/specs/             # documentos de design pré-spec
│   ├── decisions/                     # ADRs
│   │   └── 0001-stack-escolhida.md    # a criar na spec 000 plan.md
│   └── runbook/                       # operação
├── app/                               # código (layout decidido na spec 000 plan.md)
├── docker-compose.yml
├── .env.example
├── README.md
└── CHANGELOG.md
```

**Monorepo único** (backend + frontend + infra + docs). Razões: time pequeno, atomic commits cross-cutting, simplifica CI/deploy. Split possível em v0.5+.

---

## 2. Constitution (12 princípios)

Vão para `.specify/constitution.md` na spec 000.

### I. LLM Como Porta, Não Como Marca (NON-NEGOTIABLE)
Todo uso de LLM DEVE passar por interface abstrata (`LLMProvider`). Trocar Gemini ↔ OpenAI ↔ Anthropic é configuração via env, nunca refactor. Mocking trivial. Features acopladas a provider específico são rejeitadas.

### II. Multi-Tenancy É Fundação, Não Retrofit (NON-NEGOTIABLE)
Toda entidade persistida DEVE carregar `user_id` desde o primeiro commit. Não existe tabela global. Queries sem `user_id` em contexto autenticado são bugs de segurança.

### III. Dados Permanecem Na VPS (v0.1–v0.3)
Banco, arquivos, embeddings, logs, backups DEVEM ficar na VPS ou volume montado. Provider externo requer ADR explícito em `docs/decisions/`. Default = self-hosted.

### IV. Calibração Ao Aprendiz É Diferencial (NON-NEGOTIABLE)
Geração de conteúdo DEVE ser informada por contexto declarado pelo usuário (v0.1: mini-perfil por tema). Mini-perfil é **IMUTÁVEL** após criação do tema (regenerar = criar tema novo).

### V. Densidade Informacional > Volume
Cada nó, página, feature, linha de código DEVE justificar sua existência. Filler, repetição, abstração prematura são rejeitados.

### VI. Expansão, Nunca Repetição, Entre Níveis (NON-NEGOTIABLE)
Quando L1→L2→L3 chegarem (v0.2+), cada nível REFERENCIA o anterior e ADICIONA. Nunca repete.

### VII. Honestidade Epistêmica
Conteúdo gerado DEVE indicar debates abertos, incertezas, múltiplas perspectivas quando aplicável.

### VIII. Português É A Língua Padrão
Toda UI, conteúdo, mensagens de erro, prompts internos DEVEM estar em PT-BR. Código (nomes de variáveis, comentários técnicos) em inglês padrão.

### IX. Expansibilidade Modular (NON-NEGOTIABLE)
Features futuras DEVEM ser plugáveis sem reescrever core. Adicionar feature não deve disparar mais que 1-2 mudanças em código existente fora do escopo da própria feature.

### X. Spec-Driven Development (NON-NEGOTIABLE)
Nenhuma feature em produção sem `spec.md` aprovado + `plan.md` aprovado + `tasks.md` executado. Bug fixes triviais e ajustes de config podem ir direto. Toda spec DEVE incluir "Constitution + Standards Check".

### XI. Minimização De Dados Pessoais
Coletamos APENAS o necessário. v0.1: email + nome (do Google) + mini-perfis declarados. NUNCA: telefone, endereço, dados de cartão, tracking comportamental além da telemetria documentada. Novo campo coletado exige justificativa na spec.

### XII. Mudanças User-Facing Exigem Migration Path
Mudança que afeta dados ou UX de usuários existentes DEVE ter plano de migração na `plan.md`. Sem migração planejada, PR rejeitado.

---

## 3. Standards docs

Quatro arquivos em `.specify/standards/`. Criados na spec 000. Versões enxutas — evoluem por PR conforme specs encontram lacunas.

### `testing.md`
- **Pirâmide**: muitos unit, alguns integration, poucos e2e críticos.
- **Unit obrigatórios** para: lógica de domínio (DAG validation, cascata de unlock), parsers/validators.
- **Integration obrigatórios** para: queries multi-tenant (garantir isolamento por `user_id`), LLM Gateway com mock provider.
- **E2E obrigatórios** para: fluxo crítico signup→criar-tema→ler-nó→concluir.
- **Coverage**: sem % rígido. Regra — toda PR adiciona teste para o que adiciona; bug fix adiciona teste que falharia sem o fix.
- **Onde rodam**: comando único local (definido na spec 000); obrigatório em CI antes do merge.

### `logging-and-observability.md`
- **Formato**: texto plano por linha. JSON estruturado fica para quando precisar.
- **Padrão**: `[timestamp] [LEVEL] [feature] mensagem útil` + sufixo com `user_id`/`request_id` quando aplicável.
- **Níveis**: DEBUG (local), INFO (eventos de negócio), WARN (recuperável), ERROR (alguém precisa ver).
- **Nunca logar**: prompt completo do LLM, resposta completa do LLM, conteúdo do mini-perfil. Logar apenas metadados (modelo, tokens, latência, hash do prompt). *Proteção de privacidade, não maturidade — desde dia 1.*
- **Telemetria de negócio** (signup, tema criado, nó concluído) vai em `EventoSistema` no DB (spec 015), separada dos logs.
- **Sem provider externo**: stdout do container, rotacionado pelo Docker.

### `error-handling.md`
- **3 categorias de erro**:
  - `ValidationError` — input inválido. 4xx, mensagem PT-BR direta.
  - `LLMError` — falha na geração. Retry detalhado na spec 002. Após retries, mensagem PT-BR + opção de regenerar.
  - `InternalError` — resto. 5xx, mensagem PT-BR genérica, stack trace só nos logs.
- **Mensagens user-facing**: PT-BR, sem stack trace, ação clara quando possível.
- **4xx vs 5xx**: 4xx = problema do request, log nível INFO. 5xx = problema nosso, log nível ERROR.
- Spec inclui seção "Falhas e recuperação" só quando fizer sentido (gerador de árvore sim; landing page não).

### `prompt-management.md`
- Prompts vivem em arquivos versionados (`app/prompts/*.md`), não inline.
- Cada prompt tem versão no nome (`gerar_arvore.v1.md`).
- Mudar prompt = bumpa versão. Conteúdo já gerado com versão antiga **não regenera** automaticamente (princípio XII).
- Telemetria: cada `ConteudoNo` registra `prompt_version` + `llm_provider` + `llm_model`.
- Variáveis: template string com placeholders nomeados (`{{nome_tema}}`, `{{mini_perfil}}`). Sem concatenação ad-hoc.
- Output estruturado (gerador de árvore): exigir JSON validável, schema documentado.
- A/B testing de prompts: fora de escopo v0.1.

---

## 4. Backlog de specs v0.1 (18 specs)

### Fase A — Foundation

| # | Spec | Notas |
|---|---|---|
| 000 | **Bootstrap + Constitution + Standards** | `specify init`, constitution.md, 4 standards docs, esqueleto do projeto, healthcheck, CI mínimo, `docker compose up` funcional. Aqui se decide a stack. |
| 001 | **Modelo de Domínio Conceitual** | Entidades + relações + invariantes (`User`, `Tema`, `Arvore`, `No`, `Progresso`, `ConteudoNo`, `EventoSistema`). Descritiva, não código. |
| 002 | **LLM Gateway** | Interface `LLMProvider`, implementação Gemini, mock, retry/timeout/rate-limit, aplica `standards/prompt-management.md`. |
| 003 | **Auth Google OAuth + Sessão** | Fluxo OAuth, criação do `User` no primeiro login, gestão de sessão, middleware de proteção. |
| 004 | **DB Schema + Migrations** | Schema concreto a partir do modelo conceitual, ferramenta de migrations, primeira migration. |
| 005 | **Backup e Restore** | Cron + dump + retenção + restore testado (não só "tem backup", mas "fizemos restore e funcionou"). |
| 006 | **Estratégia de Testes** | Aplica `standards/testing.md`: como rodar local + CI, fixtures multi-tenant, helpers comuns. |

### Fase B — Core Flow

| # | Spec | Notas |
|---|---|---|
| 007 | **Criar Tema com Mini-Perfil** | Formulário (nome + 2-3 perguntas), persiste `Tema` com `mini_perfil` imutável, dispara geração. |
| 008 | **Geração da Árvore Macro (DL1/DL2)** | Prompt template + validação estruturada (DAG sem ciclos, cardinality 5-20, retries) + persistência. Peça crítica. |
| 009 | **Regenerar Árvore** | Botão regenerar, preserva histórico via `versao`, confirmação obrigatória ("apaga progresso"). |
| 010 | **Dashboard de Temas** | Lista de temas do usuário com % conclusão, ações (abrir/regenerar/excluir), CTA "+ Novo Tema". |

### Fase C — Estudo

| # | Spec | Notas |
|---|---|---|
| 011 | **Visualizador da Árvore** | Grafo DAG com estados visuais, interativo, mobile-responsivo. |
| 012 | **Página de Nó + Geração On-Demand de L1** | Render do conteúdo (cache no DB), spinner durante geração, markdown→HTML, botão "marcar concluído". |
| 013 | **Marcar Concluído + Desbloqueio em Cascata** | Lógica de transição de estados no DAG, idempotente, refletido na árvore (refresh manual — real-time fica v0.2). |

### Fase D — Pré-release

| # | Spec | Notas |
|---|---|---|
| 014 | **Empty States + First-Time UX** | Dashboard vazio com CTA claro, exemplo visível, mensagens em PT-BR que ensinam o produto. |
| 015 | **Telemetria Mínima + Admin Mínimo** | Eventos em `EventoSistema`, rota `/admin` (acesso restrito) com contagens. Sem provider externo. |
| 016 | **Ops de Produção** | `docker-compose.yml` completo, TLS (Let's Encrypt), logs rotacionados, healthcheck/readiness, runbook. |
| 017 | **Landing Page + Termos Mínimos** | 1 página PT-BR explicando o produto, CTA Google login, footer com termos minimalistas (LGPD formal em v0.2). |

### Mapa de dependências

```
000 (Bootstrap)
 ├─→ 001 (Domínio)
 │    ├─→ 003 (Auth)
 │    ├─→ 004 (DB) ──→ 005 (Backup)
 │    │              └→ 007 (Criar Tema) ──→ 008 (Gerar Árvore)
 │    │                                       ├→ 009 (Regenerar)
 │    │                                       └→ 010 (Dashboard) ──→ 011 (Visualizador)
 │    │                                                              └→ 012 (Pág Nó + Geração)
 │    │                                                                  └→ 013 (Concluído + Cascata)
 │    └─→ 002 (LLM Gateway) ──→ 008 e 012
 │
 └─→ 006 (Testing Strategy) — informa todas as outras
 └─→ 014 (Empty States) — depende de 010
 └─→ 015 (Telemetria) — depende de 013
 └─→ 016 (Ops) — depende de tudo
 └─→ 017 (Landing) — independente
```

**Caminho crítico**: 000 → 001 → 004 → 007 → 008 → 010 → 011 → 012 → 013 → 016 → release.

**Paralelizáveis** (após 001 e 004): 002, 003, 005, 006, 017 podem rolar independentes.

### Itens explicitamente FORA da v0.1

- Níveis L2+ (subir nível, capítulos)
- Quiz, Feynman, avaliação automática
- Perfil global do usuário
- Estilos de comunicação configuráveis
- Planos pagos, freemium, billing
- LGPD formal + account management programático
- Cost cap automático
- Feedback de qualidade (thumbs up/down)
- Real-time updates do grafo
- Compartilhamento de árvores
- Acessibilidade (a11y)
- i18n
- App mobile
- Notificações por email

---

## 5. Workflow operacional

### Ciclo de uma feature

```
1. Criar branch        feat/NNN-<slug-spec>
2. /specify         →  spec.md (rascunho)
3. Revisor aprova spec.md
4. /plan            →  plan.md (rascunho técnico, decide stack quando aplicável)
5. Revisor aprova plan.md
6. /tasks           →  tasks.md (lista executável)
7. /implement       →  código + testes
8. CI verde (GitHub Actions: lint + test + build)
9. Merge direto na main (squash ou rebase)
10. Branch deletada
```

### Aprovação

- **Spec / Plan / Tasks aprovados**: qualquer dev do time responde "aprovado" no chat ou edita o arquivo direto e commita. Sem aprovação, próxima etapa não roda.
- **Implementação aprovada**: `tasks.md` 100% completa + CI verde + Constitution & Standards Check ✅ na spec.

### Constitution + Standards Check

Toda `spec.md` termina com:

```markdown
## Constitution + Standards Check

**Constitution (12 princípios):**
- [x] I. LLM como porta — usa LLMProvider abstrato
- [x] II. Multi-tenancy — toda query nova carrega user_id
- [x] IV. Calibração — mini-perfil injetado no prompt
- [n/a] VI. Expansão entre níveis — não aplicável (só L1 na v0.1)
- ...

**Standards aplicados:**
- [x] testing.md — unit + integration listadas em tasks.md
- [x] logging-and-observability.md — eventos a logar definidos abaixo
- [x] error-handling.md — categorização de erros desta feature
- [n/a] prompt-management.md — não envolve LLM
```

Spec sem este check ou com `[n/a]` injustificado = não aprovada.

### CI (GitHub Actions)

- **Trigger**: cada `push` em qualquer branch + cada merge na `main`.
- **O que roda**:
  - Lint (linter da stack escolhida na spec 000)
  - Unit + integration tests
  - Build do container
  - (Após spec 016) deploy automatizado para staging
- **Branch protection na `main`**: ativada via GitHub. CI tem que passar antes do merge. Sem PR formal, mas regra de "CI verde para merge" continua via branch protection.
- **Secrets**: GitHub Secrets para CI; volume Docker em prod. ADR documenta na spec 000.

> Nota constitution III: GitHub Actions roda código fora da VPS mas **não toca dados de usuário** (CI usa mocks/fixtures). Não viola o princípio. Documentado como ADR `0002-ci-no-github-actions.md`.

### Versionamento de specs

- Spec é documento vivo até o merge. Depois, vira **frozen reference** descrevendo o que foi construído.
- Mudanças posteriores na mesma área criam **nova spec numerada** com referência à original.
- Bug fixes pequenos não exigem nova spec. Mudança de comportamento exige.
- Toda spec frozen ganha header: `Status: implementado em <commit-hash>`.

### Mudanças durante a implementação

1. Parar. Não improvisar silenciosamente.
2. Editar `spec.md` na mesma branch, explicar no commit.
3. Atualizar Constitution + Standards Check se afetar.
4. Pingar revisor pra re-aprovar a parte mudada.

### ADRs (Architecture Decision Records)

Decisões com impacto além da feature atual vão para `docs/decisions/NNNN-<slug>.md`. Esperados:
- `0001-stack-escolhida.md` (spec 000 plan.md)
- `0002-ci-no-github-actions.md` (spec 000)
- `0003-storage-conteudo-no-db-vs-fs.md` (spec 004 ou 012)
- `0004-excecao-ao-principio-III-stripe.md` (quando freemium chegar em v0.3)

Template: **Contexto · Decisão · Consequências · Alternativas consideradas**.

### Git workflow

- **Branch por spec**: `feat/NNN-<slug>`.
- **Commits**: `feat:`, `fix:`, `docs:`, `chore:`, `test:`.
- **Sem PR formal**: merge direto na `main` após CI verde + Constitution Check.
- **Branch protection**: `main` exige CI verde. Sem force-push.

### Quem implementa

- Time multi-dev. Cada dev pode pegar uma spec inteira ou tasks específicas (por isso `tasks.md` separado é útil).
- Sub-agents do Claude Code podem ser usados para trabalho paralelizável.
- Sub-agent **não decide** Constitution Check — dev humano decide.

---

## 6. Próximos passos imediatos

### Pré-requisitos (fora do fluxo SDD)

1. **Repositório GitHub criado** (`paretto-learner-saas`, privado), branch protection na `main` (CI verde obrigatório, sem force-push). Time adicionado com permissão de push.
2. **VPS provisionada** com Docker + Docker Compose. SSH funcional. *(Já disponível.)*
3. **DNS de `irischef.tech`** apontando pra VPS. TLS será configurado na spec 016.
4. **Conta Google Cloud** com projeto para OAuth (consent screen + client ID + secret). Usado pela spec 003.
5. **Chave de API Gemini** (Google AI Studio). Usada pela spec 002.
6. **spec-kit CLI** instalado localmente (`uvx --from git+https://github.com/github/spec-kit.git specify init`). Documentado no `README.md` na spec 000.

### Sequência inicial

```
[Setup]
  Criar repo GitHub (paretto-learner-saas, privado)
  → cd paretto-learner-saas
  → specify init
  → estrutura .specify/ criada pela ferramenta
  → git init + remote + push inicial

[Documentação fundacional, pre-spec-000]
  → PLANO_ENTREGAS.md já no repo
  → Este documento de design em docs/superpowers/specs/
  → Criar docs/decisions/ vazio
  → Criar .specify/standards/ vazio (populado pela spec 000)

[Primeira branch]
  → git checkout -b feat/000-bootstrap
  → /specify spec 000 (Bootstrap + Constitution + Standards)
  → Spec produz:
      .specify/constitution.md (12 princípios da Seção 2)
      .specify/standards/testing.md
      .specify/standards/logging-and-observability.md
      .specify/standards/error-handling.md
      .specify/standards/prompt-management.md
      Esqueleto do projeto (estrutura definida no plan)
      Dockerfile + docker-compose.yml mínimo (1 serviço, healthcheck)
      .github/workflows/ci.yml (lint + test placeholders)
      README.md + .env.example
  → Revisar spec
  → /plan spec 000 — STACK É DECIDIDA AQUI
      ADR 0001-stack-escolhida.md
      ADR 0002-ci-no-github-actions.md
  → Revisar plan
  → /tasks spec 000
  → /implement spec 000
  → CI verde + Constitution Check
  → Merge feat/000-bootstrap → main
```

### Decisão pendente na spec 000 plan.md

Categorias a decidir (sem palpite agora):

- **Backend** (linguagem + framework): Node/TypeScript, Python, Go, Ruby, Elixir, etc.
- **Frontend** (framework): React/Next, Vue/Nuxt, SvelteKit, Astro, Remix, Phoenix LiveView, etc.
- **Banco de dados**: PostgreSQL, MySQL, SQLite (último é tentador pra v0.1 pelo zero-ops).
- **ORM/query layer**: depende da linguagem.
- **Reverse proxy / TLS**: Caddy (mais simples pra Let's Encrypt) vs Traefik vs Nginx.
- **Frontend ↔ Backend**: SPA + REST, monolito server-rendered, RPC tipado (tRPC), etc.

### Sequência após spec 000

Specs 001 (Domínio) e 002 (LLM Gateway) podem rolar em paralelo se houver mais de um dev — não dependem uma da outra. Ambas bloqueiam features posteriores.

A partir daí, segue o mapa de dependências da Seção 4 spec a spec.

---

## Verificação do design

Este documento está pronto para virar input das próximas sessões quando:

- Time concorda com a constitution (Seção 2).
- Time concorda com os standards docs (Seção 3) e com a estratégia de quando expandi-los.
- Time concorda com o escopo da v0.1 (Seção 4) e o que está fora dela.
- Time concorda com a ordem das specs (Seção 4) e o mapa de dependências.
- Time concorda com o workflow operacional (Seção 5).
- Pré-requisitos da Seção 6 estão atendidos ou em andamento.
