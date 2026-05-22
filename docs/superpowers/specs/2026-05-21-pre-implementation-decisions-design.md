# Pré-implementação — Decisões consolidadas

> Output da sessão de brainstorming que fecha decisões bloqueantes antes da execução da spec 000. Materializa o conteúdo do **ADR 0001 (stack)** e informa o conteúdo das specs **001 (Modelo de Domínio)** e **002 (LLM Gateway)** quando elas forem escritas.

**Documento de design** — não substitui as specs individuais; pré-decide pontos estruturais para que essas specs sejam escritas com contexto técnico fechado.

**Documentos relacionados:**
- `PLANO_ENTREGAS.md` (raiz) — plano de alto nível.
- `docs/superpowers/specs/2026-05-20-saas-foundation-design.md` — design fundacional (constitution, standards, backlog 18 specs, workflow).
- `docs/superpowers/plans/2026-05-20-spec-000-bootstrap.md` — plano da spec 000 (17 tasks). A Task 4 desse plano materializa o ADR 0001 a partir deste documento.

---

## Contexto

Antes desta sessão, o projeto tinha 3 documentos fundacionais commitados (PLANO_ENTREGAS, foundation design, plano da spec 000) mas nenhum código. O plano da spec 000 está pronto para executar, com uma única decisão estrutural pendente: a **stack tecnológica** (ADR 0001). Tasks 10-13 do plano da spec 000 dependem dessa decisão (Dockerfile, docker-compose, healthcheck, CI workflow têm placeholders "conforme stack").

Adicionalmente, as specs 001 (Domínio) e 002 (LLM Gateway) — que rodam logo após a spec 000 e bloqueiam todas as features posteriores — têm pontos estruturais ainda em aberto que afetam schema de DB e arquitetura de erros. Fechar esses pontos agora reduz retrabalho.

**Time real:** Ariel + Vinicius (2 pessoas). Implementação será feita majoritariamente com auxílio de LLM (Claude Code). **Critério-guia desta sessão:** stack e padrões devem ser amigáveis para LLM — linguagens com forte sinal em datasets recentes, frameworks bem-documentados, paradigmas explícitos (menos magia), e minimização do número de linguagens/codebases que a LLM precisa segurar em contexto.

---

## 1. Stack tecnológica (ADR 0001)

### 1.1 Decisão

| Dimensão | Decisão | Versão alvo |
|---|---|---|
| Backend + Frontend (1 codebase) | **Next.js (App Router) + TypeScript** | Next 15.x, TS 5.x |
| Arquitetura back↔front | Server Components + Server Actions (mutações) + Route Handlers (`app/api/*` para OAuth callback e webhooks) | — |
| Banco de dados | **PostgreSQL** | 16.x |
| ORM / query layer | **Drizzle ORM** + `drizzle-kit` (migrations) | Drizzle 0.3x+ |
| Reverse proxy / TLS | **Nginx + Certbot** | Nginx stable, Certbot estável |
| Runtime container | Node.js LTS | Node 22.x |
| Validação de schemas | **Zod** | 3.x |

### 1.2 Por que esta combinação

- **1 linguagem (TypeScript) ponta a ponta.** Minimiza contexto que a LLM precisa carregar para qualquer edição. Sem CORS, sem contratos JSON duplicados entre back e front, sem dois ecossistemas de testes.
- **Next.js App Router + RSC.** Padrão dominante em datasets de treino recentes. LLM gera código moderno de Next com alta qualidade. Server Components + Server Actions cobrem 90% do fluxo back↔front sem REST manual.
- **PostgreSQL + JSONB.** Necessário para `Tema.mini_perfil` (formato flexível) e `EventoSistema.payload` (discriminated union, ver §2). Suporta multi-tenancy desde dia 1 com índices em `user_id` (princípio II).
- **Drizzle vs Prisma.** Drizzle expõe SQL explicitamente; LLM enxerga o que está acontecendo. Prisma é mais conhecido em datasets antigos, mas seu cliente gerado + DSL `schema.prisma` é mais magia (mais contexto pra segurar).
- **Nginx + Certbot.** Escolha do time pelo histórico de exemplos em datasets e padrão "tradicional" de produção.
- **Zod.** Único validador para inputs de Server Actions, payloads de eventos, output estruturado do LLM e parsing de env. Reduz duplicação.

### 1.3 Aderência aos princípios

- **III (Dados na VPS):** Postgres + Nginx + Next.js + arquivos rodam todos em containers Docker na VPS. Sem provider externo de dados na v0.1.
- **I (LLM como porta):** Atendida pela arquitetura do Gateway (§3), não pela stack em si.
- **II (Multi-tenancy):** Drizzle permite tipar queries que carregam `user_id` no nível do schema; convenção será verificada em code review (humano + standard testing).

### 1.4 Trade-offs aceitos

- **Acoplamento Next-específico.** Server Actions e RSC são Next-only. Migração para outro framework é trabalho real (não deve acontecer na v0.1–v0.3).
- **Drizzle em evolução rápida.** APIs mudam mais que Prisma. Mitigação: versionar `drizzle-orm` e `drizzle-kit` exatamente, atualizar com ADR quando upgrade for material.
- **Nginx + Certbot vs Caddy.** Nginx exige cron de renovação Certbot e config mais verbosa. Aceito pela familiaridade.

### 1.5 Alternativas consideradas e rejeitadas

- **FastAPI (Python) + React (Vite) separado.** Pydantic excelente para output estruturado de LLM, mas dobra contexto LLM (2 linguagens + 2 codebases) e força contratos JSON duplicados. Rejeitada pelo critério-guia.
- **Express/Fastify + React (Vite) separado.** Mesma linguagem, mas 2 apps com mais boilerplate manual (rotas REST + estado de cliente + loading states). Server Actions reduzem esse boilerplate. Rejeitada.
- **SQLite + Drizzle.** Zero ops, atrativo para v0.1, mas contenção concorrente em geração on-demand de árvore (LLM call de 5-20s segurando lock). Migração futura para Postgres é trabalho real. Rejeitada — começar com Postgres é mais barato que migrar depois.
- **Prisma.** Mais sinal em datasets antigos, mas magia (schema próprio + cliente gerado) cresce contexto da LLM. Drizzle preferido.
- **Caddy.** Mais simples para Let's Encrypt, mas time optou por Nginx + Certbot.

---

## 2. Decisões estruturais do domínio (informa spec 001)

### 2.1 Entidades e relações (recap, sem mudanças vs foundation design)

```
User (1) ── (N) Tema
Tema (1) ── (N) Arvore     [append-only; ver §2.2]
Arvore (1) ── (N) No
No (N) ── (N) No           [grafo de dependências, DAG]
User+No (1) ── (1) Progresso
No (1) ── (0..1) ConteudoNo   [v0.1: só nivel='L1'; campo nivel já antecipa L2+]
User (1) ── (N) EventoSistema
```

### 2.2 Versionamento da Arvore (append-only)

**Decisão:** `Tema 1-N Arvore` com `Tema.arvore_corrente_id` apontando para a versão atual.

**Comportamento:**

- `Arvore` tem campo `versao INT NOT NULL` (1, 2, 3…) e `tema_id` (FK).
- Cada `Arvore` tem seus próprios `No`s (FK `arvore_id`).
- `Progresso` é vinculado a `(user_id, no_id)`; como `No` pertence a uma `Arvore` específica, Progresso fica naturalmente segregado por versão.
- **Regenerar:** INSERT nova `Arvore` com `versao = max + 1` para esse `tema_id`, INSERT novos `No`s, UPDATE `Tema.arvore_corrente_id`. Arvore antiga + Nos antigos + Progressos antigos permanecem no DB (não são visíveis na UI v0.1, mas auditáveis).
- **Mini-perfil é IMUTÁVEL após criação do Tema** (princípio IV): regenerar usa o mesmo `Tema.mini_perfil`. Mudar mini-perfil = criar Tema novo, não regenerar.

**Por que append-only:**

- Invariante simples (Progresso → No → Arvore → Tema → User), sem cleanup de órfãos.
- Auditável: dá pra reconstruir o histórico de tentativas sem `audit table` separada.
- Padrão LLM-friendly: sem necessidade de manter "tabela ativa + tabela snapshot" na cabeça.
- Custo em DB é trivial para v0.1 (volume baixo, dados textuais leves).

**Rejeitadas:** "Tema 1-1 Arvore + audit table" (2 caminhos pra mesma entidade, cleanup complexo). "Tema 1-N sem `current_id` explícito" (todas as queries precisam `ORDER BY versao DESC LIMIT 1`, risco de bug).

### 2.3 `EventoSistema` — discriminated union TS + Zod

**Schema DB:**
```sql
EventoSistema (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES User(id),
  tipo        TEXT NOT NULL,
  payload     JSONB NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
)
-- Índice composto
CREATE INDEX evento_user_tipo_ts ON EventoSistema(user_id, tipo, timestamp DESC);
```

**Forma no código (TS):**

```ts
type Evento =
  | { tipo: 'user_signup',      payload: { provider: 'google', email_domain: string } }
  | { tipo: 'tema_criado',      payload: { tema_id: string, mini_perfil_hash: string } }
  | { tipo: 'arvore_gerada',    payload: { arvore_id: string, num_nos: number, latencia_ms: number, llm_provider: string, llm_model: string, prompt_version: string } }
  | { tipo: 'arvore_regenerada',payload: { tema_id: string, arvore_id_anterior: string, arvore_id_nova: string, versao_nova: number } }
  | { tipo: 'no_aberto',        payload: { no_id: string } }
  | { tipo: 'conteudo_gerado',  payload: { no_id: string, latencia_ms: number, llm_provider: string, llm_model: string, prompt_version: string } }
  | { tipo: 'no_concluido',     payload: { no_id: string, desbloqueados: string[] } }
  | { tipo: 'llm_error',        payload: { provider: string, model: string, error_class: string, retry_attempts: number } }
  /* lista canônica completa fechada na spec 015 (Telemetria) */;
```

- Zod schema por variante, validação ao escrever via helper `registrarEvento(evento: Evento)`.
- Queries de telemetria usam `tipo` no WHERE, e `payload->>'campo'` quando precisar.
- **Restrições de privacidade (do standard logging-and-observability):**
  - `payload` NUNCA contém prompt completo do LLM.
  - `payload` NUNCA contém resposta completa do LLM.
  - `payload` NUNCA contém conteúdo do `mini_perfil` — só `mini_perfil_hash`.

### 2.4 Pontos deferidos para a própria spec 001

Os itens abaixo NÃO são bloqueantes para começar a implementação. Cabem ser fechados quando a `spec.md` da 001 for escrita (após spec 000 estar implementada):

- Texto exato das 2-3 perguntas do `mini_perfil` e schema interno do JSON resultante.
- Valores de `Tema.status` (provavelmente `ativo | arquivado`; soft delete preferido pela auditabilidade).
- Política de delete de Tema (hard vs soft) — recomendação: soft delete consistente com append-only de Arvore.
- Cardinalidade exata de `ConteudoNo` na v0.1: 1 por `(no_id, nivel='L1')`. Se houver futura regeneração de conteúdo de 1 nó, define-se na spec onde isso entrar.
- Invariantes detalhadas do DAG além de "sem ciclos + ≥1 raiz + 5-20 nós" (limite de dependências por nó, profundidade máxima) — fechadas na spec 008 (Geração de Árvore).

---

## 3. Decisões estruturais do LLM Gateway (informa spec 002)

### 3.1 Interface

Assinatura conceitual (TS pseudocode — implementação real fechada na spec 002):

```ts
interface LLMProvider {
  gerarArvore(input: PromptArvore): Promise<ArvoreEstrutura>
  gerarConteudoNo(input: PromptNo): Promise<Markdown>
}
```

Implementações em v0.1:
- `GeminiProvider` — usa SDK oficial do Google Generative AI.
- `MockProvider` — retorna fixtures determinísticos; usado em testes e em dev sem API key.

Seleção via env `LLM_PROVIDER=mock|gemini`. Trocar implementação = config, nunca refactor (princípio I).

### 3.2 Política de retry — diferenciada por causa

| Categoria do erro | Comportamento |
|---|---|
| 5xx / timeout / rate-limit do provider | Retry com backoff exponencial: até 3 tentativas (1s / 2s / 4s) |
| 4xx do provider (input nosso ruim) | Sem retry → sobe `LLMError` imediato (bug nosso, logar com nível ERROR) |
| Output estruturado inválido (Zod parse falha) | **Re-prompt 1x** com erro embutido no input ("Output anterior falhou validação porque X. Refaça."); se ainda falhar, sobe `LLMOutputError` |
| Sucesso | Retorna direto |

Alinha com o que a spec 008 (Geração de Árvore) já requer ("re-prompt com erro específico, até 2 retries").

### 3.3 Rate limit — em-memória no processo Next.js

- Estrutura: `Map<user_id, { window_start: number, count_arvore: number, count_conteudo: number }>` no processo Node.
- Unidade: **gerações por hora por usuário**, configurável via env:
  - `LLM_LIMIT_ARVORE_HORA` (default `20`)
  - `LLM_LIMIT_CONTEUDO_HORA` (default `100`)
- Janela: 1 hora rolante por usuário (não calendário).
- **Zera no restart** (limitação aceita para v0.1; documentada na spec 002 como ponto a revisitar se houver abuso real ou se rodarmos múltiplos processos no futuro).
- Quando estourado: sobe `LLMRateLimitError` (não chama provider).

### 3.4 Taxonomia de erros

| Classe | Quando | HTTP user-facing | Mensagem PT-BR sugerida |
|---|---|---|---|
| `LLMError` | Falha após retries esgotados (provider down, timeout, 5xx persistente) | 5xx | "Não conseguimos gerar agora. Tente novamente em instantes." |
| `LLMOutputError` | Output estruturado inválido após re-prompt | 5xx | "Não conseguimos gerar uma árvore coerente. Tente regenerar." |
| `LLMRateLimitError` | Usuário estourou rate limit nosso | 429 | "Você atingiu o limite de gerações desta hora. Tente novamente em {N} minutos." |
| `InternalError` (do standard) | Bug não esperado dentro do Gateway | 5xx | "Algo deu errado. Tente novamente em instantes." |

Todas herdam do hierarquia de erros do `standards/error-handling.md`. Stack traces vão para logs com nível ERROR; user-facing vê só a mensagem.

### 3.5 Logging do Gateway

Aplica `standards/logging-and-observability.md`:

- **Log por chamada (INFO):** `provider`, `model`, `operacao` (`gerarArvore|gerarConteudoNo`), `tokens_in`, `tokens_out`, `latency_ms`, `prompt_version`, `prompt_hash`, `user_id`.
- **Log de retry (WARN):** `tentativa_atual`, `motivo` (`5xx|timeout|parse_error`), `proximo_delay_ms`.
- **Log de erro final (ERROR):** classe do erro + provider error code + tentativas totais.
- **Proibido logar:** prompt completo, resposta completa, conteúdo do `mini_perfil`. Apenas hash + metadata.

### 3.6 Configuração via env (consolida `.env.example` da spec 000)

```bash
# LLM provider
LLM_PROVIDER=mock                       # mock | gemini
LLM_MODEL_ARVORE=gemini-2.5-pro         # default por provider quando vazio
LLM_MODEL_CONTEUDO=gemini-2.5-flash
GEMINI_API_KEY=

# Rate limits (gerações/hora por usuário)
LLM_LIMIT_ARVORE_HORA=20
LLM_LIMIT_CONTEUDO_HORA=100

# Timeout (ms) — única chamada antes de retry
LLM_TIMEOUT_MS=60000
```

### 3.7 Observabilidade futura (Langfuse)

Langfuse self-hosted (Docker, alinhado ao princípio III) é compatível com Next.js + TS via SDK oficial `langfuse`. **Não adotado na v0.1** — entra como spec posterior (provavelmente entre 002 e 008) ou como extensão da spec 015 (Telemetria). Apenas registrado como caminho futuro sem bloqueio.

### 3.8 Pontos deferidos para a própria spec 002

Os itens abaixo NÃO são bloqueantes; cabe fechar quando a `spec.md` da 002 for escrita:

- Estrutura exata dos prompts `PromptArvore` e `PromptNo` (campos, ordem, formato de instruções) — alinhada com `standards/prompt-management.md`.
- Schema Zod completo de `ArvoreEstrutura` (validação de DAG sem ciclos, cardinality, referências) — coordenado com spec 008.
- Política exata de quando re-prompt vs desistir em `gerarConteudoNo` (markdown é menos estruturado que árvore — provavelmente sem re-prompt, só retry de transporte).
- Versionamento concreto dos arquivos de prompt (`app/prompts/gerar_arvore.v1.md` etc.).

---

## 4. Constitution + Standards Check

**Constitution (12 princípios):**

- [x] **I. LLM como porta** — Gateway com `LLMProvider` abstrato + Gemini/Mock; troca via env.
- [x] **II. Multi-tenancy fundação** — Toda entidade do §2 (Tema, Arvore, No via cascata, Progresso, ConteudoNo via cascata, EventoSistema) traz `user_id` direto ou transitivamente; Postgres + Drizzle suportam.
- [x] **III. Dados na VPS** — Postgres, app, Nginx tudo em Docker; sem provider externo de dados na v0.1.
- [x] **IV. Calibração** — Mini-perfil IMUTÁVEL por Tema explicitado em §2.2.
- [x] **V. Densidade informacional** — Stack mínima (1 linguagem), domínio sem campos especulativos, gateway sem features fora de escopo.
- [n/a] **VI. Expansão entre níveis** — v0.1 só L1; `ConteudoNo.nivel` reservado para v0.2+.
- [n/a] **VII. Honestidade epistêmica** — Decisão de prompt, não de design estrutural; entra nos prompts da spec 008.
- [x] **VIII. Português padrão** — Mensagens user-facing dos erros do Gateway todas em PT-BR; código (nomes de entidades, tipos) em inglês padrão.
- [x] **IX. Expansibilidade modular** — `LLMProvider` plugável; `Evento` é discriminated union extensível por variante; Drizzle migrations modulares.
- [x] **X. Spec-driven** — Este doc é pré-spec; specs 001/002 ainda serão escritas formalmente com `spec.md` antes de implementar.
- [x] **XI. Minimização de dados** — `EventoSistema.payload` documenta o que NÃO entra (prompt, mini_perfil); apenas hashes/metadata.
- [n/a] **XII. Migration path** — Não há usuários existentes ainda (pré-launch).

**Standards aplicados:**

- [x] **testing.md** — Gateway com mock provider (integration test obrigatório), invariantes do domínio (DAG sem ciclos é unit test) já antecipados.
- [x] **logging-and-observability.md** — §3.5 detalha logs; §2.3 detalha proibições de payload.
- [x] **error-handling.md** — §3.4 detalha 4 classes + HTTP status + mensagens PT-BR.
- [x] **prompt-management.md** — §3.5 inclui `prompt_version` e `prompt_hash` no log; §3.8 referencia versionamento de arquivos.

---

## 5. Próximos passos

Após este doc ser aprovado pelo usuário:

1. Invocar `superpowers:writing-plans` para criar plano de implementação consolidado **se necessário**, OU
2. Atualizar o plano da spec 000 existente (`docs/superpowers/plans/2026-05-20-spec-000-bootstrap.md`) substituindo os placeholders `<linguagem>`, `<comando-install>`, etc., das Tasks 10-13 pelos valores reais desta decisão (Node 22, `npm`, `next start`, `node:22-alpine`, etc.), e materializando o conteúdo de `docs/decisions/0001-stack-escolhida.md` da Task 4.

A diferença prática: o plano existente foi feito como template stack-agnóstico justamente para que pudesse ser concretizado por este doc. Não precisa um plano novo — precisa preencher os placeholders.

A spec 000 implementada destrava:
- **Spec 001 (Domínio)** — escrita com §2 deste doc como insumo.
- **Spec 002 (LLM Gateway)** — escrita com §3 deste doc como insumo.

Ambas paralelizáveis.

---

## Verificação do design

Este documento está pronto para virar input do plano de implementação quando:

- Usuário aprova a Seção 1 (stack). ✅
- Usuário aprova a Seção 2 (domínio). ✅
- Usuário aprova a Seção 3 (LLM Gateway). ✅
- Usuário revisa este arquivo gravado e confirma sem mudanças adicionais (próximo passo).
