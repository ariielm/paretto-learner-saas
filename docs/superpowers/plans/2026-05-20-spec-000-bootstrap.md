# Spec 000 — Bootstrap + Constitution + Standards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setup do repositório `paretto-learner-saas` com spec-kit CLI instalado e inicializado, constitution.md + 4 standards docs materializados a partir do design fundacional, esqueleto do projeto rodando em Docker com healthcheck respondendo 200, CI verde no GitHub Actions, ADRs de stack e CI registrados, branch protection ativada na `main`.

**Architecture:** Fluxo SDD via spec-kit oficial. Estrutura `.specify/` criada pela ferramenta na Task 3. Materialização manual dos arquivos textuais (constitution, standards, ADRs, README) a partir do design doc fundacional. Stack de aplicação é escolhida e justificada via ADR 0001 na Task 4 — tasks subsequentes que dependem da stack referenciam os requisitos da Seção 4.1 do design doc e do ADR 0001.

**Tech Stack (fixo deste plano):** spec-kit CLI (Python via `uvx`), Docker + Docker Compose, GitHub Actions, GitHub CLI (`gh`).
**Tech Stack da aplicação (decidida em 2026-05-21):** Next.js 15 (App Router) + TypeScript 5.x + Node 22 LTS, PostgreSQL 16, Drizzle ORM, Nginx + Certbot, Zod. Detalhes completos e justificativas em `docs/superpowers/specs/2026-05-21-pre-implementation-decisions-design.md` §1. A Task 4 deste plano apenas materializa essa decisão em ADRs.

**Referências primárias:**
- `docs/superpowers/specs/2026-05-20-saas-foundation-design.md` (design fundacional — constitution, standards, backlog, workflow).
- `docs/superpowers/specs/2026-05-21-pre-implementation-decisions-design.md` (pré-implementação — stack + insumos das specs 001 e 002).

---

## Pré-requisitos antes de executar este plano

- [ ] Repositório `ariielm/paretto-learner-saas` existe no GitHub (privado) e está clonado localmente em `/Users/ariielm/dev/projects/paretto-learner-saas` (já feito; commit inicial `c7c6ed5` na `main`).
- [ ] `gh` CLI instalado e autenticado (já feito; conta `ariielm`).
- [ ] `git` configurado (já feito; `arielhenrique3@gmail.com`).
- [ ] `docker` e `docker compose` instalados na máquina do executor.
- [ ] `uv` ou `uvx` instalado para rodar o spec-kit CLI (Python). Se não tiver: `brew install uv`.

---

## Task 1: Instalar spec-kit CLI e validar funcionamento

**Files:** nenhum (apenas instalação de ferramenta global).

- [ ] **Step 1.1: Instalar `specify` CLI via uvx**

```bash
uvx --from git+https://github.com/github/spec-kit.git specify --help
```

Expected output: tela de ajuda do `specify` CLI listando subcomandos (`init`, `check`, etc.). Se aparecer erro, instale `uv` primeiro: `brew install uv`.

- [ ] **Step 1.2: Verificar versão**

```bash
uvx --from git+https://github.com/github/spec-kit.git specify --version
```

Expected: string de versão (ex: `0.x.y`). Registrar a versão para o ADR 0002 na Task 4.

- [ ] **Step 1.3: Commit (skip — nada mudou no repo)**

Sem commit aqui. Esta task instala ferramenta global.

---

## Task 2: Criar branch de trabalho

**Files:** nenhum (operação git).

- [ ] **Step 2.1: Garantir que está em `main` atualizada**

```bash
cd /Users/ariielm/dev/projects/paretto-learner-saas
git checkout main
git pull origin main
```

Expected: "Already up to date" ou pull de mudanças remotas.

- [ ] **Step 2.2: Criar e checkout da branch da spec 000**

```bash
git checkout -b feat/000-bootstrap
```

Expected: `Switched to a new branch 'feat/000-bootstrap'`.

---

## Task 3: Inicializar spec-kit no repositório

**Files:**
- Create (via tooling): `.specify/` (estrutura inteira gerada pelo `specify init`)
- Possíveis: `.specify/memory/constitution.md` (template vazio), `.specify/templates/`, `.specify/scripts/`

- [ ] **Step 3.1: Rodar `specify init` no diretório raiz**

```bash
cd /Users/ariielm/dev/projects/paretto-learner-saas
uvx --from git+https://github.com/github/spec-kit.git specify init --here
```

Expected: criação da estrutura `.specify/` no diretório atual. Aceitar defaults do CLI. Se houver prompt sobre overwrite de arquivos existentes (`README.md`, `.gitignore`), recusar — temos versões nossas.

- [ ] **Step 3.2: Inspecionar estrutura criada**

```bash
ls -la .specify/
find .specify -type f | head -30
```

Expected: listar arquivos como `.specify/memory/constitution.md`, `.specify/templates/spec-template.md`, `.specify/templates/plan-template.md`, `.specify/templates/tasks-template.md`, e possivelmente scripts auxiliares.

Registrar mentalmente o caminho exato do `constitution.md` gerado pelo tooling — é onde populamos na Task 5.

- [ ] **Step 3.3: Commit da estrutura spec-kit (sem conteúdo populado)**

```bash
git add .specify/ .gitignore
git status
```

Verificar que apenas `.specify/` e atualizações de `.gitignore` (caso o spec-kit tenha adicionado entradas) entram no commit. Nada de credenciais ou arquivos pessoais.

```bash
git commit -m "chore: initialize spec-kit structure via specify init"
```

---

## Task 4: Materializar ADR 0001 (stack) e ADR 0002 (CI) a partir do design doc de pré-implementação

**Files:**
- Create: `docs/decisions/0001-stack-escolhida.md`
- Create: `docs/decisions/0002-ci-no-github-actions.md`

Decisão de stack já foi tomada na sessão de brainstorming de 2026-05-21 e está materializada em `docs/superpowers/specs/2026-05-21-pre-implementation-decisions-design.md` §1. Esta task só **registra** a decisão como ADR (não re-decide).

- [ ] **Step 4.1: Verificar decisão consolidada de stack**

A decisão é (referência: design doc de pré-implementação §1.1):

| Dimensão | Decisão | Versão alvo |
|---|---|---|
| Backend + Frontend (1 codebase) | Next.js (App Router) + TypeScript | Next 15.x, TS 5.x |
| Arquitetura back↔front | Server Components + Server Actions + Route Handlers (`app/api/*`) | — |
| Banco de dados | PostgreSQL | 16.x |
| ORM / query layer | Drizzle ORM + drizzle-kit | 0.3x+ |
| Reverse proxy / TLS | Nginx + Certbot | stable |
| Runtime container | Node.js LTS | 22.x |
| Validação de schemas | Zod | 3.x |

Critérios já aplicados na decisão: minimização de linguagens (1 TS), sinal LLM em datasets, self-hostable (princípio III), JSONB para campos flexíveis do domínio.

- [ ] **Step 4.2: Criar `docs/decisions/0001-stack-escolhida.md`**

Conteúdo completo do arquivo (escrever literalmente; substituir apenas a data e nomes dos decisores):

```markdown
# ADR 0001: Stack tecnológica escolhida

**Status:** Aceito
**Data:** 2026-05-21
**Decisores:** Ariel, Vinicius

## Contexto

O design fundacional (`docs/superpowers/specs/2026-05-20-saas-foundation-design.md`, Seção 6) deferiu a escolha de stack para a spec 000 plan.md. A decisão foi fechada na sessão de brainstorming de 2026-05-21, registrada em `docs/superpowers/specs/2026-05-21-pre-implementation-decisions-design.md` §1. Esta ADR materializa essa decisão no formato canônico.

Critério-guia: implementação será feita majoritariamente com auxílio de LLM (Claude Code); stack deve favorecer LLMs — linguagens com forte sinal em datasets recentes, frameworks bem-documentados, paradigmas explícitos, minimização do número de linguagens/codebases.

## Decisão

- **Backend + Frontend:** Next.js 15 (App Router) + TypeScript 5.x — monorepo único, 1 linguagem ponta a ponta.
- **Arquitetura backend↔frontend:** Server Components + Server Actions (mutações) + Route Handlers em `app/api/*` (OAuth callback, webhooks). Sem API REST tradicional separada.
- **DB:** PostgreSQL 16. JSONB nativo para `Tema.mini_perfil` e `EventoSistema.payload`.
- **ORM:** Drizzle ORM + drizzle-kit (migrations). Schema em TypeScript, SQL legível, sem cliente gerado.
- **Reverse proxy / TLS:** Nginx + Certbot.
- **Runtime container:** Node 22 LTS.
- **Validação de schemas:** Zod 3.x (única para Server Actions, payloads de eventos, output estruturado de LLM e parsing de env).

## Consequências

- **Positivas:**
  - 1 linguagem reduz contexto que LLM precisa carregar para qualquer edição.
  - Next.js App Router é padrão dominante em datasets recentes — LLM gera código de alta qualidade.
  - Server Actions + RSC reduzem boilerplate de API REST.
  - Drizzle expõe SQL explicitamente; LLM enxerga o que está acontecendo (vs Prisma com cliente gerado).
  - Postgres + JSONB suporta o domínio sem migrations complicadas.
- **Negativas / trade-offs aceitos:**
  - Acoplamento Next-específico (Server Actions e RSC são Next-only). Migração para outro framework é trabalho real, não previsto v0.1–v0.3.
  - Drizzle evolui rápido; versionar exatamente e atualizar via ADR quando upgrade for material.
  - Nginx + Certbot exige cron de renovação e config mais verbosa que Caddy. Aceito pela familiaridade.
- **Impacto no princípio III (dados na VPS):** Stack inteira é self-hostable. Next.js roda em container Node, Postgres em container oficial, Nginx em container ou nativo na VPS. Sem provider externo de dados.

## Alternativas consideradas

- **FastAPI (Python) + React (Vite) separado.** Pydantic excelente para output estruturado de LLM, mas dobra contexto LLM (2 linguagens + 2 codebases) e força contratos JSON duplicados. Rejeitada.
- **Express/Fastify + React (Vite) separado.** Mesma linguagem que opção atual, mas 2 apps com mais boilerplate manual (rotas REST + estado de cliente + loading states). Server Actions reduzem esse boilerplate. Rejeitada.
- **SQLite + Drizzle.** Zero ops, mas contenção concorrente em geração on-demand de árvore (LLM call de 5-20s segurando lock). Migração futura para Postgres é custosa. Rejeitada — Postgres desde dia 1 é mais barato.
- **Prisma.** Mais sinal em datasets antigos, mas magia (schema próprio + cliente gerado) cresce contexto LLM. Drizzle preferido.
- **Caddy.** Mais simples para Let's Encrypt, mas time optou por Nginx + Certbot.
```

- [ ] **Step 4.3: Criar `docs/decisions/0002-ci-no-github-actions.md`**

Conteúdo completo do arquivo:

```markdown
# ADR 0002: CI no GitHub Actions

**Status:** Aceito
**Data:** 2026-05-21
**Decisores:** Ariel, Vinicius

## Contexto

A constitution (princípio III) exige que dados de usuário permaneçam na VPS. CI tradicionalmente roda em provedor externo. Precisamos decidir se isso é exceção ao princípio.

## Decisão

Adotamos **GitHub Actions** como plataforma de CI para o repositório `ariielm/paretto-learner-saas`.

CI executa: lint (ESLint), type-check (`tsc --noEmit`), unit tests + integration tests (Vitest), build de container (`docker build .`). CI NÃO toca dados reais de usuário em nenhum momento — fixtures e mocks apenas.

## Consequências

- **Positivas:** Integração nativa com `gh` CLI já usado pelo time; sem custo de hospedar runner próprio; ecossistema maduro de actions.
- **Trade-off vs. princípio III:** GitHub Actions roda código fora da VPS. Considerada aceitável porque (a) código fonte já está hospedado no GitHub, (b) CI nunca toca dados de produção, (c) secrets de CI são separados dos de produção (GitHub Secrets vs. volume Docker).
- **Restrição:** Workflows NÃO podem fazer deploy direto para produção — deploy fica em runbook separado (spec 016).

## Alternativas consideradas

- **Self-hosted CI (Woodpecker, Drone) na própria VPS:** Mais alinhado ao princípio III literal, mas VPS já hospeda app + DB e ficaria sobrecarregada. Setup operacional adicional sem benefício prático na v0.1.
- **Sem CI / git hooks locais (pre-commit):** Dev pode pular hook com `--no-verify`, sem garantia de qualidade. Inadequado mesmo com time de 2 pessoas + LLM como executor.
```

Salvar literalmente.

- [ ] **Step 4.4: Commit dos ADRs**

```bash
git add docs/decisions/0001-stack-escolhida.md docs/decisions/0002-ci-no-github-actions.md
git commit -m "docs: ADR 0001 (stack) and ADR 0002 (CI)"
```

---

## Task 5: Popular constitution.md com os 12 princípios

**Files:**
- Modify: `.specify/memory/constitution.md` (ou caminho equivalente gerado pelo spec-kit na Task 3 — verificar onde está exatamente)

- [ ] **Step 5.1: Identificar caminho correto da constitution gerada pelo spec-kit**

```bash
find .specify -name "constitution.md"
```

Expected: um único caminho, provavelmente `.specify/memory/constitution.md`. Se o spec-kit tiver gerado em outro lugar, usar o caminho real nas instruções abaixo.

- [ ] **Step 5.2: Substituir o conteúdo placeholder pelo conteúdo abaixo**

Conteúdo completo (extraído da Seção 2 do design doc — copiado integralmente para auditabilidade do plano):

```markdown
# Paretto SaaS — Constitution

## I. LLM Como Porta, Não Como Marca (NON-NEGOTIABLE)
Todo uso de LLM DEVE passar por interface abstrata (`LLMProvider`). Trocar Gemini ↔ OpenAI ↔ Anthropic é configuração via env, nunca refactor. Mocking trivial. Features acopladas a provider específico são rejeitadas.

## II. Multi-Tenancy É Fundação, Não Retrofit (NON-NEGOTIABLE)
Toda entidade persistida DEVE carregar `user_id` desde o primeiro commit. Não existe tabela global. Queries sem `user_id` em contexto autenticado são bugs de segurança.

## III. Dados Permanecem Na VPS (v0.1–v0.3)
Banco, arquivos, embeddings, logs, backups DEVEM ficar na VPS ou volume montado. Provider externo requer ADR explícito em `docs/decisions/`. Default = self-hosted.

## IV. Calibração Ao Aprendiz É Diferencial (NON-NEGOTIABLE)
Geração de conteúdo DEVE ser informada por contexto declarado pelo usuário (v0.1: mini-perfil por tema). Mini-perfil é **IMUTÁVEL** após criação do tema (regenerar = criar tema novo).

## V. Densidade Informacional > Volume
Cada nó, página, feature, linha de código DEVE justificar sua existência. Filler, repetição, abstração prematura são rejeitados.

## VI. Expansão, Nunca Repetição, Entre Níveis (NON-NEGOTIABLE)
Quando L1→L2→L3 chegarem (v0.2+), cada nível REFERENCIA o anterior e ADICIONA. Nunca repete.

## VII. Honestidade Epistêmica
Conteúdo gerado DEVE indicar debates abertos, incertezas, múltiplas perspectivas quando aplicável.

## VIII. Português É A Língua Padrão
Toda UI, conteúdo, mensagens de erro, prompts internos DEVEM estar em PT-BR. Código (nomes de variáveis, comentários técnicos) em inglês padrão.

## IX. Expansibilidade Modular (NON-NEGOTIABLE)
Features futuras DEVEM ser plugáveis sem reescrever core. Adicionar feature não deve disparar mais que 1-2 mudanças em código existente fora do escopo da própria feature.

## X. Spec-Driven Development (NON-NEGOTIABLE)
Nenhuma feature em produção sem `spec.md` aprovado + `plan.md` aprovado + `tasks.md` executado. Bug fixes triviais e ajustes de config podem ir direto. Toda spec DEVE incluir seção "Constitution + Standards Check".

## XI. Minimização De Dados Pessoais
Coletamos APENAS o necessário. v0.1: email + nome (do Google) + mini-perfis declarados. NUNCA: telefone, endereço, dados de cartão, tracking comportamental além da telemetria documentada. Novo campo coletado exige justificativa na spec.

## XII. Mudanças User-Facing Exigem Migration Path
Mudança que afeta dados ou UX de usuários existentes DEVE ter plano de migração na `plan.md`. Sem migração planejada, PR rejeitado.
```

Escrever este conteúdo no arquivo identificado no Step 5.1.

- [ ] **Step 5.3: Verificar conteúdo**

```bash
grep -c "^## " .specify/memory/constitution.md
```

Expected: `12` (doze princípios).

- [ ] **Step 5.4: Commit**

```bash
git add .specify/memory/constitution.md
git commit -m "docs(constitution): populate 12 inviolable principles"
```

---

## Task 6: Criar standards/testing.md

**Files:**
- Create: `.specify/standards/testing.md`

- [ ] **Step 6.1: Criar diretório `standards/`**

```bash
mkdir -p .specify/standards
```

- [ ] **Step 6.2: Criar arquivo com conteúdo completo**

Conteúdo (extraído da Seção 3 do design doc):

```markdown
# Standard — Testing

## Pirâmide
- Muitos unit, alguns integration, poucos e2e críticos.

## Unit obrigatórios
- Lógica de domínio (validação de DAG, cascata de desbloqueio).
- Parsers e validators.

## Integration obrigatórios
- Queries multi-tenant — garantir isolamento por `user_id`.
- `LLMGateway` com mock provider.

## E2E obrigatórios
- Fluxo crítico: signup → criar tema → ler nó → marcar concluído.

## Coverage
Sem percentual rígido. Regra: toda PR adiciona teste para o que adiciona; bug fix adiciona teste que falharia sem o fix.

## Onde rodam
- Comando único local (definido pela stack escolhida no ADR 0001 — `npm test`, `pytest`, `go test ./...`, etc.).
- Obrigatórios em CI antes de cada merge em `main`.
```

- [ ] **Step 6.3: Commit**

```bash
git add .specify/standards/testing.md
git commit -m "docs(standards): add testing standard"
```

---

## Task 7: Criar standards/logging-and-observability.md

**Files:**
- Create: `.specify/standards/logging-and-observability.md`

- [ ] **Step 7.1: Criar arquivo com conteúdo completo**

```markdown
# Standard — Logging & Observability

## Formato
Texto plano por linha. JSON estruturado fica para quando precisar (v0.2+).

## Padrão de linha
```

`[timestamp] [LEVEL] [feature] mensagem útil`

Se há `user_id` ou `request_id` no contexto, incluir como sufixo: `... user_id=abc123 request_id=xyz789`.

```markdown
## Níveis
- **DEBUG** — só local, nunca em prod.
- **INFO** — eventos de negócio (signup, tema criado, nó concluído).
- **WARN** — recuperável (LLM retry, validação falhou, retry funcionou).
- **ERROR** — alguém precisa ver (LLM falhou após retries, exception não tratada).

## Nunca logar
- Prompt completo do LLM (logar metadados: modelo, tokens, latência, hash do prompt).
- Resposta completa do LLM.
- Conteúdo do `mini_perfil` do usuário.

Esta regra é proteção de privacidade, não maturidade — vale desde o dia 1.

## Telemetria de negócio
Eventos de produto (signup, tema criado, nó concluído, etc.) vão em `EventoSistema` no DB (definido pela spec 015 — Telemetria), separados dos logs.

## Sem provider externo
stdout do container, rotacionado pelo Docker. Sem Sentry, Datadog, etc., na v0.1.
```

- [ ] **Step 7.2: Commit**

```bash
git add .specify/standards/logging-and-observability.md
git commit -m "docs(standards): add logging-and-observability standard"
```

---

## Task 8: Criar standards/error-handling.md

**Files:**
- Create: `.specify/standards/error-handling.md`

- [ ] **Step 8.1: Criar arquivo com conteúdo completo**

```markdown
# Standard — Error Handling

## Três categorias de erro

### `ValidationError`
Input do usuário inválido. Vira HTTP 4xx. Mensagem em PT-BR direta ao usuário.

### `LLMError`
Falha na geração via `LLMProvider`. Política de retry detalhada na spec 002 (LLM Gateway). Após retries esgotados, mensagem PT-BR com opção de regenerar.

### `InternalError`
Qualquer outro erro inesperado. Vira HTTP 5xx. Mensagem PT-BR genérica ("Algo deu errado. Tente novamente em instantes."). Stack trace só nos logs.

## Mensagens user-facing
- Sempre PT-BR.
- Sem stack trace.
- Com ação clara quando possível ("Tente novamente", "Regenere", "Entre em contato").

## 4xx vs 5xx
- **4xx** — problema do request. Log nível `INFO`.
- **5xx** — problema nosso. Log nível `ERROR`.

## Seção "Falhas e recuperação" em specs
Obrigatória apenas onde aplicável (ex: gerador de árvore, geração de conteúdo). Para specs sem fluxo de erro relevante (landing page estática, dashboard puramente read), pode ser omitida.
```

- [ ] **Step 8.2: Commit**

```bash
git add .specify/standards/error-handling.md
git commit -m "docs(standards): add error-handling standard"
```

---

## Task 9: Criar standards/prompt-management.md

**Files:**
- Create: `.specify/standards/prompt-management.md`

- [ ] **Step 9.1: Criar arquivo com conteúdo completo**

```markdown
# Standard — Prompt Management

## Localização
Prompts vivem em arquivos versionados (`app/prompts/*.md`, ou equivalente conforme estrutura definida no ADR 0001), nunca inline no código.

## Versionamento
Cada prompt tem versão no nome (ex: `gerar_arvore.v1.md`, `gerar_no_l1.v1.md`).

## Mudança de prompt
- Mudar prompt = bumpa versão (`v1` → `v2`).
- Conteúdo já gerado com versão antiga **não regenera** automaticamente (princípio XII — migration explícito necessário).

## Telemetria
Cada `ConteudoNo` (entidade definida na spec 001) registra:
- `prompt_version` — qual versão gerou.
- `llm_provider` — qual provider (gemini, openai, mock).
- `llm_model` — qual modelo específico.

## Variáveis no prompt
- Template string com placeholders nomeados: `{{nome_tema}}`, `{{mini_perfil}}`, `{{descricao_no}}`.
- NUNCA concatenação ad-hoc no código.

## Output estruturado
Prompts que retornam dados estruturados (gerador de árvore) DEVEM exigir JSON validável. Schema do output é documentado junto ao prompt.

## A/B testing
Fora de escopo v0.1. Entra em v0.3+ junto com freemium.
```

- [ ] **Step 9.2: Commit**

```bash
git add .specify/standards/prompt-management.md
git commit -m "docs(standards): add prompt-management standard"
```

---

## Task 10: Scaffold do projeto Next.js + Dockerfile

**Files:**
- Create (via tooling): estrutura inteira do projeto Next.js (`app/`, `package.json`, `tsconfig.json`, `next.config.mjs`, etc.)
- Create: `Dockerfile`
- Modify: `next.config.mjs` (adicionar `output: 'standalone'`)

**Requisitos obrigatórios:**

1. Base image: `node:22-alpine` (pin de versão, não `:latest`).
2. Multi-stage: estágio `deps` (instala dependencies) + `builder` (constrói app Next) + `runner` (só artefatos finais).
3. Usuário não-root no estágio `runner` (`nextjs` user UID 1001).
4. `EXPOSE 3000`.
5. `HEALTHCHECK` apontando para `/health` (endpoint criado na Task 12).
6. `CMD ["node", "server.js"]` rodando o output `standalone` do Next.

Pré-requisito: `next.config.mjs` precisa ter `output: 'standalone'` para o build gerar o servidor mínimo.

- [ ] **Step 10.0: Gerar projeto Next.js**

Rodar `create-next-app` no diretório atual (já contém arquivos como `docs/`, `.specify/`, README.md, etc. — `create-next-app` precisa de flag para não reclamar):

```bash
npx create-next-app@latest . \
  --typescript \
  --eslint \
  --app \
  --src-dir=false \
  --tailwind=false \
  --turbopack=false \
  --import-alias='@/*' \
  --use-npm \
  --skip-install
```

Se o CLI reclamar de diretório não-vazio, aceitar a sobrescrita seletiva ou rodar `npx create-next-app@latest paretto-next-tmp` em diretório temporário e copiar os arquivos relevantes (`app/`, `package.json`, `tsconfig.json`, `next.config.mjs`, `next-env.d.ts`, `.eslintrc.json`, `public/`) para a raiz, depois apagar o temporário.

Após o scaffold, rodar `npm install` para popular `node_modules` e gerar `package-lock.json`.

Editar `next.config.mjs` para adicionar `output: 'standalone'`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}

export default nextConfig
```

Verificar que `npm run dev` sobe o app em `http://localhost:3000`. Parar (`Ctrl+C`).

Verificar que `npm run build` completa sem erro. Após build, deve existir `.next/standalone/server.js`.

- [ ] **Step 10.1: Escrever `Dockerfile`**

Conteúdo de referência (ajustar apenas se o estrutura do projeto Next.js diferir):

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
```

Verificar que os 6 requisitos obrigatórios estão atendidos.

- [ ] **Step 10.2: Buildar localmente**

```bash
docker build -t paretto-saas:dev .
```

Expected: build sucesso, imagem listada em `docker images | grep paretto-saas`.

- [ ] **Step 10.3: Rodar container e verificar**

```bash
docker run --rm -p 3000:3000 --name paretto-test paretto-saas:dev &
sleep 5
docker ps | grep paretto-test
docker stop paretto-test
```

Expected: container sobe, fica visível em `docker ps`, para limpo. Healthcheck pode ainda não responder (endpoint criado na Task 12) — OK por ora.

- [ ] **Step 10.4: Commit do scaffold + Dockerfile**

Em 2 commits separados pra história ficar limpa:

```bash
# 1) Scaffold Next.js
git add package.json package-lock.json tsconfig.json next.config.mjs next-env.d.ts .eslintrc.json app/ public/
git commit -m "feat: scaffold Next.js 15 (App Router, TypeScript)"

# 2) Dockerfile
git add Dockerfile
git commit -m "feat: add multi-stage Dockerfile for Next.js standalone"
```

---

## Task 11: Configurar docker-compose.yml mínimo

**Files:**
- Create: `docker-compose.yml`

**Requisitos obrigatórios** do compose v0.1 (versão completa do compose com DB+reverse-proxy fica na spec 016):

1. Versão `3.8` ou superior (ou sem versão, usando compose v2 schema).
2. Um serviço `app` apontando para o `Dockerfile` local (build context = `.`).
3. Porta `3000` (ou conforme ADR) mapeada para o host.
4. Variáveis de ambiente lidas de `.env` via `env_file`.
5. `restart: unless-stopped`.
6. `healthcheck` no compose espelhando o do Dockerfile (curl/wget em `/health` a cada 30s, timeout 10s, retries 3).

- [ ] **Step 11.1: Escrever `docker-compose.yml`**

Template-base (ajustar porta conforme ADR):

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
```

- [ ] **Step 11.2: Criar `.env` local com placeholders mínimos para a v0.1 inicial**

```bash
cat > .env <<'EOF'
NODE_ENV=development
PORT=3000
LLM_PROVIDER=mock
EOF
```

(Demais variáveis — `DATABASE_URL`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, etc. — entram na Task 15 via `.env.example` e ficam vazias localmente até as specs que as consomem.)

Importante: `.env` está em `.gitignore`. Não vai pro repo.

- [ ] **Step 11.3: Validar compose**

```bash
docker compose config
```

Expected: parse do compose sem erros, output mostra a configuração resolvida.

- [ ] **Step 11.4: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose.yml with healthcheck"
```

---

## Task 12: Implementar healthcheck endpoint (Next.js Route Handler)

**Files:**
- Create: `app/api/health/route.ts` (Route Handler)
- Create: `tests/health.test.ts` (Vitest)
- Modify: `package.json` (scripts `test`, `lint`, dev deps)
- Modify: `vitest.config.ts` (criar se não existir)

**Pré-requisito da task:** projeto Next.js inicializado (`npx create-next-app@latest .` com TypeScript, App Router, ESLint). Esta etapa precede o Step 12.1 — se ainda não rodou, rodar agora.

**Requisitos obrigatórios:**

1. Endpoint `GET /health` retorna HTTP `200` quando o app está vivo.
2. Body do response: JSON `{ "status": "ok", "version": "0.1.0-dev" }` (versão lida de `package.json` ou env var no futuro).
3. Sem autenticação (precisa funcionar antes do auth ser configurado).
4. **Teste automatizado em Vitest** que faz request ao handler e verifica status 200 + body — escrito ANTES da implementação (TDD).

- [ ] **Step 12.1: Adicionar Vitest ao projeto e criar `vitest.config.ts`**

```bash
npm install --save-dev vitest @vitest/coverage-v8
```

Criar `vitest.config.ts` na raiz:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

Adicionar scripts em `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 12.2: Escrever teste do healthcheck (TDD) — `tests/health.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/health/route'

describe('GET /health', () => {
  it('retorna 200 com status ok', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(typeof body.version).toBe('string')
  })
})
```

Configurar alias `@/*` no `tsconfig.json` se ainda não existir (padrão do `create-next-app`).

- [ ] **Step 12.3: Rodar teste e confirmar falha**

```bash
npm test
```

Expected: FAIL com erro tipo "Cannot find module '@/app/api/health/route'" (endpoint não existe ainda).

- [ ] **Step 12.4: Implementar `app/api/health/route.ts`**

```ts
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: '0.1.0-dev',
  })
}
```

- [ ] **Step 12.5: Rodar teste e confirmar pass**

```bash
npm test
```

Expected: `1 test passed`.

- [ ] **Step 12.6: Verificar end-to-end no container**

```bash
docker compose up --build -d
sleep 10
curl -i http://localhost:3000/health
docker compose down
```

Expected: `HTTP/1.1 200 OK` + body JSON `{"status":"ok","version":"0.1.0-dev"}`.

- [ ] **Step 12.7: Commit**

```bash
git add app/api/health/route.ts tests/health.test.ts vitest.config.ts package.json package-lock.json tsconfig.json
git commit -m "feat: add /health endpoint with vitest test"
```

---

## Task 13: Configurar GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Requisitos obrigatórios** do CI v0.1:

1. Trigger: `push` em qualquer branch + `pull_request` para `main`.
2. Job único `build-and-test` em `ubuntu-latest`.
3. Steps na ordem:
   - Checkout do código (`actions/checkout@v4`).
   - Setup da linguagem (versão alinhada com Dockerfile).
   - Install de dependências.
   - Lint (linter padrão da stack).
   - Tests (unit + integration).
   - Build do container (`docker build .`) — sem push.
4. Falha em qualquer step quebra o job inteiro.
5. Caching de dependências (npm, pip, go modules) para acelerar runs subsequentes.

- [ ] **Step 13.1: Criar diretório**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 13.2: Escrever `.github/workflows/ci.yml`**

Conteúdo concreto (Node 22 alinhado com Dockerfile, `npm` como gerenciador):

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type-check
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Build container
        run: docker build -t paretto-saas:ci .
```

Notas:
- `npm run lint` usa o `next lint` configurado pelo `create-next-app`.
- `npm run typecheck` invoca `tsc --noEmit` (script adicionado na Task 12.1).
- `npm test` invoca `vitest run` (script adicionado na Task 12.1).
- Build do container valida que `Dockerfile` constrói sem erro.

- [ ] **Step 13.3: Commit e push para disparar primeiro run**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for lint+test+build"
git push -u origin feat/000-bootstrap
```

- [ ] **Step 13.4: Verificar run no GitHub**

```bash
gh run watch
```

Expected: workflow `CI` executa e passa todos os steps. Se falhar, ler logs com `gh run view <run-id> --log-failed` e corrigir.

---

## Task 14: Atualizar README.md final

**Files:**
- Modify: `README.md`

- [ ] **Step 14.1: Substituir o README atual pelo conteúdo completo abaixo**

```markdown
# Paretto SaaS

Plataforma multi-tenant de aprendizado progressivo assistido por IA. Versão SaaS do projeto Paretto Learner original.

## Status

v0.1 em desenvolvimento. Spec 000 (Bootstrap) implementada.

## Stack

Definida em [`docs/decisions/0001-stack-escolhida.md`](./docs/decisions/0001-stack-escolhida.md).

## Como rodar localmente

Pré-requisitos:
- Docker + Docker Compose
- `uv` (para `specify` CLI)
- Cópia de `.env.example` como `.env` com valores reais preenchidos

```bash
cp .env.example .env
# editar .env com valores reais
docker compose up --build
```

App disponível em `http://localhost:3000/health` (até spec 003 chegar com auth).

## Documentos de referência

- [`PLANO_ENTREGAS.md`](./PLANO_ENTREGAS.md) — plano de alto nível: escopo v0.1, roadmap pós-v0.1, riscos.
- [`docs/superpowers/specs/2026-05-20-saas-foundation-design.md`](./docs/superpowers/specs/2026-05-20-saas-foundation-design.md) — design fundacional.
- [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) — 12 princípios invioláveis.
- [`.specify/standards/`](./.specify/standards/) — standards repetíveis (testing, logging, error-handling, prompt-management).
- [`docs/decisions/`](./docs/decisions/) — ADRs.

## Metodologia

[Spec-Driven Development](https://github.com/github/spec-kit) com spec-kit oficial. Toda feature segue `spec → plan → tasks → implement` via slash commands.

## Idioma

- Conteúdo do app, prompts, mensagens user-facing: **PT-BR**.
- Código, comentários técnicos, logs: **inglês**.

## Licença

A definir.
```

- [ ] **Step 14.2: Commit**

```bash
git add README.md
git commit -m "docs: update README with stack, run instructions, and refs"
```

---

## Task 15: Criar .env.example

**Files:**
- Create: `.env.example`

- [ ] **Step 15.1: Escrever `.env.example` com placeholders (não valores reais)**

Variáveis mínimas para a v0.1 (alinhadas com a stack Next.js/Node 22 e as decisões do design doc de pré-implementação §3.6):

```bash
# Ambiente
NODE_ENV=development
PORT=3000

# LLM Gateway (spec 002)
LLM_PROVIDER=mock                  # opções: mock, gemini
LLM_MODEL_ARVORE=gemini-2.5-pro
LLM_MODEL_CONTEUDO=gemini-2.5-flash
GEMINI_API_KEY=                    # preencher quando for usar Gemini
LLM_LIMIT_ARVORE_HORA=20
LLM_LIMIT_CONTEUDO_HORA=100
LLM_TIMEOUT_MS=60000

# Database (spec 004 — placeholder por ora)
DATABASE_URL=postgres://paretto:paretto@localhost:5432/paretto

# Auth Google OAuth (spec 003 — placeholder por ora)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SESSION_SECRET=                    # gerar com `openssl rand -hex 32`
NEXTAUTH_URL=http://localhost:3000  # ajustar quando spec 003 escolher lib de auth
```

- [ ] **Step 15.2: Commit**

```bash
git add .env.example
git commit -m "docs: add .env.example with v0.1 placeholders"
```

---

## Task 16: Ativar branch protection na main

**Files:** nenhum (configuração via `gh` CLI ou web).

- [ ] **Step 16.1: Ativar branch protection**

```bash
gh api -X PUT repos/ariielm/paretto-learner-saas/branches/main/protection \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["build-and-test"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true
}
EOF
```

Expected: response JSON descrevendo a proteção ativada. Sem erros.

- [ ] **Step 16.2: Verificar regra ativa**

```bash
gh api repos/ariielm/paretto-learner-saas/branches/main/protection
```

Expected: JSON mostrando `required_status_checks.contexts = ["build-and-test"]`, `allow_force_pushes.enabled = false`, `required_linear_history.enabled = true`.

---

## Task 17: Validar critérios de aceite da spec 000 + merge

**Files:** nenhum (validação + merge).

- [ ] **Step 17.1: Critério 1 — `docker compose up` funciona**

```bash
docker compose up --build -d
sleep 15
curl -i http://localhost:3000/health
docker compose down
```

Expected: HTTP 200 + JSON `{ "status": "ok", ... }`.

- [ ] **Step 17.2: Critério 2 — `.specify/` populado**

```bash
test -f .specify/memory/constitution.md && grep -c "^## " .specify/memory/constitution.md
test -f .specify/standards/testing.md
test -f .specify/standards/logging-and-observability.md
test -f .specify/standards/error-handling.md
test -f .specify/standards/prompt-management.md
echo "all files present"
```

Expected: `12` (princípios na constitution) + 4 arquivos de standards.

- [ ] **Step 17.3: Critério 3 — ADRs registrados**

```bash
ls docs/decisions/
```

Expected: pelo menos `0001-stack-escolhida.md` e `0002-ci-no-github-actions.md`. Ambos sem placeholders literais (`<...>`).

- [ ] **Step 17.4: Critério 4 — CI verde no último push**

```bash
gh run list --branch feat/000-bootstrap --limit 5
```

Expected: último run com status `completed` e conclusão `success`.

- [ ] **Step 17.5: Merge para `main`**

Como decidimos "sem PR formal" (workflow operacional do design doc), merge direto:

```bash
git checkout main
git pull origin main
git merge --no-ff feat/000-bootstrap -m "feat: spec 000 — bootstrap + constitution + standards"
git push origin main
```

Expected: merge sucesso, push aceito (branch protection permite porque CI passou na branch antes do merge).

- [ ] **Step 17.6: Deletar branch local e remota**

```bash
git branch -d feat/000-bootstrap
git push origin --delete feat/000-bootstrap
```

- [ ] **Step 17.7: Confirmar spec 000 frozen**

Adicionar header de status no arquivo `docs/superpowers/specs/2026-05-20-saas-foundation-design.md` (linha após o título):

```markdown
**Status:** spec 000 implementada em commit `<sha do merge>` em `<YYYY-MM-DD>`.
```

Commit + push em main:

```bash
git add docs/superpowers/specs/2026-05-20-saas-foundation-design.md
git commit -m "docs: mark spec 000 as implemented"
git push origin main
```

---

## Verificação final

A spec 000 está completa quando todos esses são verdadeiros:

1. ✅ `.specify/memory/constitution.md` contém os 12 princípios.
2. ✅ `.specify/standards/` contém 4 arquivos (testing, logging-and-observability, error-handling, prompt-management).
3. ✅ `docs/decisions/0001-stack-escolhida.md` e `0002-ci-no-github-actions.md` existem, sem placeholders literais.
4. ✅ `Dockerfile`, `docker-compose.yml`, `.env.example` existem.
5. ✅ `GET /health` retorna 200 OK com JSON `{ "status": "ok", ... }`.
6. ✅ `.github/workflows/ci.yml` existe e o run mais recente está verde.
7. ✅ Branch protection na `main` exige check `build-and-test` e bloqueia force-push.
8. ✅ Branch `feat/000-bootstrap` mergeada e deletada.
9. ✅ Design doc atualizado com status "spec 000 implementada".

A partir daqui, **specs 001 (Domínio) e 002 (LLM Gateway)** podem rolar em paralelo.

---

## Self-Review checklist (executado pelo autor do plano)

- **Spec coverage:** Cada item da Seção 4 (Spec 000) do design doc tem task neste plano? Constitution ✅ (Task 5), Standards ✅ (Tasks 6-9), esqueleto + healthcheck ✅ (Tasks 10-12), CI ✅ (Task 13), Docker ✅ (Tasks 10-11), `docker compose up` funcional ✅ (Task 17.1), ADRs ✅ (Task 4).
- **Placeholder scan:** Tasks 10-13 e 15 originalmente continham placeholders (`<linguagem>`, `<comando-install>`) que dependiam do ADR 0001. Após a sessão de pré-implementação de 2026-05-21 (ver design doc dedicado), todos foram substituídos pelos valores reais: Node 22, npm, Next.js 15, Drizzle, Postgres 16, Nginx. Os únicos `<...>` que sobraram são exemplos de comando (`<run-id>` em `gh run view`) e campos a preencher em runtime (`<sha do merge>` em `Task 17.7`).
- **Type consistency:** Nomes de arquivos consistentes entre tasks (`.specify/memory/constitution.md`, `.specify/standards/testing.md`, etc.). `feat/000-bootstrap` referenciada com mesmo nome em Tasks 2, 13.3, 17.5, 17.6.
