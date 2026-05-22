# Paretto SaaS

Plataforma multi-tenant de aprendizado progressivo assistido por IA. Versão SaaS do projeto Paretto Learner original.

## Status

v0.1 em desenvolvimento. Spec 000 (Bootstrap) implementada.

## Stack

Definida em [`docs/decisions/0001-stack-escolhida.md`](./docs/decisions/0001-stack-escolhida.md):

- **Next.js 16** (App Router) + **TypeScript 5**
- **PostgreSQL 16** (não configurado neste bootstrap — entra na spec 004)
- **Drizzle ORM** (idem)
- **Tailwind CSS v4** para estilos
- **Vitest** para testes
- **Nginx + Certbot** como reverse proxy (entra na spec 016)
- **Docker** + **Docker Compose** para empacotamento

## Como rodar localmente

Pré-requisitos:

- **Node 22 LTS** (Dockerfile e CI usam 22; localmente pode usar 20+ se preferir)
- **Docker + Docker Compose** (recomendado: [OrbStack](https://orbstack.dev/) em macOS)
- **`uv`** para o `specify` CLI (`brew install uv`)
- Cópia de `.env.example` como `.env` com valores reais preenchidos

```bash
cp .env.example .env
# editar .env com valores reais (na v0.1 inicial só LLM_PROVIDER=mock importa)

# Opção 1: dev local sem container
npm install
npm run dev
# app em http://localhost:3000

# Opção 2: container
docker compose up --build
# app em http://localhost:3000
```

Endpoint de saúde disponível em `http://localhost:3000/health` (retorna JSON `{ "status": "ok", "version": "0.1.0-dev" }`).

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (hot reload) |
| `npm run build` | Build de produção (`.next/standalone/server.js`) |
| `npm start` | (Não suportado — use `node .next/standalone/server.js` ou Docker) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (`vitest run`) |
| `npm run test:watch` | Vitest em watch mode |

## Documentos de referência

- [`PLANO_ENTREGAS.md`](./PLANO_ENTREGAS.md) — plano de alto nível: escopo v0.1, roadmap pós-v0.1, riscos.
- [`docs/superpowers/specs/2026-05-20-saas-foundation-design.md`](./docs/superpowers/specs/2026-05-20-saas-foundation-design.md) — design fundacional.
- [`docs/superpowers/specs/2026-05-21-pre-implementation-decisions-design.md`](./docs/superpowers/specs/2026-05-21-pre-implementation-decisions-design.md) — decisões consolidadas pré-implementação (stack + insumos de specs 001/002).
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
