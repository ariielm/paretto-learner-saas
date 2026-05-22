# Standard — Logging & Observability

## Formato
Texto plano por linha. JSON estruturado fica para quando precisar (v0.2+).

## Padrão de linha

`[timestamp] [LEVEL] [feature] mensagem útil`

Se há `user_id` ou `request_id` no contexto, incluir como sufixo: `... user_id=abc123 request_id=xyz789`.

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
