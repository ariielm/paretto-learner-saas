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
