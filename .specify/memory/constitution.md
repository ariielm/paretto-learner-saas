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
