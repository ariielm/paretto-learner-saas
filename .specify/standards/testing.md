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
- Comando único local: `npm test` (Vitest, decidido em ADR 0001).
- Obrigatórios em CI antes de cada merge em `main`.
