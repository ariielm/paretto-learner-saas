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
