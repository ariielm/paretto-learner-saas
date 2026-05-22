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
