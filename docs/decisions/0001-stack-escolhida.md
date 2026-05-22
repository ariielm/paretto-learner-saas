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
