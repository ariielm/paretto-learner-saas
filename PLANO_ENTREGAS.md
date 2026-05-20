# Paretto SaaS — Plano de Entregas (Feature-Level, SDD)

> **Escopo deste plano**: Definir features e ordem de entrega das primeiras versões do SaaS Paretto. **Não define stack tecnológica** — isso entra no `/plan.md` de cada feature, depois que cada spec for aprovada.

---

## 1. Contexto

### 1.1 De onde estamos partindo

O **Paretto Learner** existe hoje como um sistema **single-user, file-based, acoplado ao Claude Code (IDE)**. Conceitualmente sofisticado, operacionalmente um vault Obsidian + skills + sub-agents:

- **5 níveis de profundidade** (L1~1pg → L5~500pg) com expansão 5× a cada nível.
- **Mapas de dependência DL1-DL5** em Mermaid (5-8 → 500+ nós).
- **Skill tree** com `state.json` por domínio (`feito[]`, `last_visited`, view do grafo).
- **Calibração ao perfil** (entrevista rica de 12 perguntas + expertise + lacunas).
- **Sub-agents** orquestrando geração (cartógrafo, conteudista, avaliador, sintetizador).
- **App embrionário** (Express + Vite + Cytoscape) que lê o vault e renderiza grafo localmente.

### 1.2 Onde queremos chegar

Um **SaaS multi-tenant** rodando em VPS própria, com signup público, geração de árvores de estudo por tema via LLM, e desbloqueio progressivo de nós. **Domínio inicial**: irischef.tech (provisório). **Modelo de deploy**: 100% dockerizado, banco e arquivos dentro da VPS (sem cloud externa).

### 1.3 Por que SDD

O usuário (Ariel) pediu **Spec-Driven Development** seguindo o fluxo da Anthropic (`/specify` → `/plan` → `/tasks` → `/implement`). Motivo: o projeto é conceitualmente rico (níveis Paretto, DAG de dependências, calibração) e tecnicamente fluido (LLM swappable, features futuras planejadas). Sem specs claras, a complexidade conceitual vira dívida técnica em 2 sprints.

### 1.4 Decisões já tomadas para a v0.1 (via entrevista)

| Tópico | Decisão |
|---|---|
| Granularidade da árvore | **Macro: DL1/DL2, 5-20 nós** |
| Critério de conclusão | **Self-marking** (botão "concluí"). Quiz/Feynman ficam para v0.2. |
| Geração de conteúdo | **On-demand** quando o usuário abre o nó (não pré-gerar) |
| Autenticação | **Google OAuth** apenas |
| Múltiplos temas | **Sim, sem limite na v0.1** (gate de plano free vem em v0.3) |
| Desbloqueio | **DAG: respeita dependências do grafo** (não linear) |
| Perfil | **Por tema** (2-3 perguntas curtas ao criar tema), sem perfil global |
| Idioma | **Português apenas** (i18n é v2+) |
| Deploy | **Dockerizado desde dia 1**, self-hosted em VPS, sem cloud externa |

---

## 2. Constitution — Princípios Invioláveis

Princípios que valem para toda feature, toda versão. Vão para `.specify/constitution.md` quando a estrutura SDD for criada.

1. **LLM é uma porta, não uma marca.** Todo uso de LLM passa por uma interface abstrata (`LLMProvider`). Trocar Gemini por OpenAI/Anthropic é configuração, não refactor. Mocking em testes é trivial.
2. **Multi-tenancy é fundação, não retrofit.** Toda entidade persistida carrega `user_id` desde o primeiro commit. Não existe "tabela global de domínios". Não existe "diretório /aprendiz/" compartilhado.
3. **Dados nunca saem da VPS na v0.1-v0.3.** Banco, arquivos, embeddings, logs, backups — tudo dentro da máquina ou em volume montado. Cloud externa requer decisão explícita (e versão nova).
4. **Calibração ao aprendiz é diferencial, não enfeite.** Mesmo a v0.1 minimalista preserva o conceito: o conteúdo gerado é informado pelo contexto declarado pelo usuário (no v0.1, mini-perfil por tema).
5. **Densidade informacional > volume.** Herdado do CLAUDE.md: cada nó, cada página, cada feature justifica sua existência. Sem filler, sem repetição.
6. **EXPANDIR, nunca repetir, entre níveis.** Subir do L1 para L2 (quando essa feature chegar em v0.2+) referencia o que foi coberto antes, nunca repete.
7. **Honestidade epistêmica.** Conteúdo gerado por LLM indica debates abertos, incertezas, múltiplas perspectivas. Não esconde limites.
8. **Português é a língua padrão.** Toda UI, conteúdo, mensagens de erro, prompts internos — em PT-BR. i18n é v2+.
9. **Expansibilidade modular.** Features novas (onboarding rico, estilos de comunicação, planos, conexões interdisciplinares, Feynman, tour) são plugáveis. Não é razoável reescrever core a cada feature nova.
10. **Tudo via SDD.** Nenhuma feature entra em produção sem `spec.md` aprovada. Bug fixes, ajustes triviais, e operações de infra podem ir direto.

---

## 3. Modelo SDD Adotado

### 3.1 Estrutura de diretórios SDD

```
.specify/
  constitution.md                   # Princípios invioláveis (seção 2)
  specs/
    v0.1/
      000-foundation/
        spec.md  plan.md  tasks.md
      001-auth-google-oauth/
        spec.md  plan.md  tasks.md
      002-llm-gateway/
        spec.md  plan.md  tasks.md
      003-criar-tema/
        spec.md  plan.md  tasks.md
      ...
    v0.2/
      ...
    v0.3/
      ...
```

### 3.2 Fluxo por feature

Para cada feature numerada:

1. **`spec.md`** — O QUÊ, independente de tecnologia. Inclui:
   - Objetivo (1-2 parágrafos)
   - User stories ("Como X, quero Y, para Z")
   - Critérios de aceite (lista bulletada, testável)
   - Casos de borda e tratamento de erro
   - Não-objetivos (o que essa feature NÃO faz)
   - Dependências de outras specs

2. **`plan.md`** — O COMO. Só depois da spec aprovada. Inclui:
   - Arquitetura (módulos, contratos, dados)
   - Decisões técnicas com trade-offs
   - Mudanças de schema (se houver)
   - Impacto em features existentes

3. **`tasks.md`** — Quebra executável. Cada item:
   - Ação concreta (não mais que ~1h de trabalho)
   - Critério de "feito"
   - Dependências entre tasks (se há paralelizáveis)

### 3.3 Constitution check em toda spec

Toda `spec.md` tem uma seção final **"Constitution Check"** onde verifica violações dos 10 princípios. Se há violação, ou (a) a spec é ajustada, ou (b) a constitution é emendada com decisão registrada.

### 3.4 Critério de "spec done" / "feature done"

- **Spec done**: Ariel aprova explicitamente. Sem aprovação, nada começa.
- **Plan done**: Ariel revisa e aprova decisões técnicas. Stack só é definida aqui.
- **Tasks done**: cada item da `tasks.md` checado, critérios de aceite da spec validados, deploy em VPS de staging (ou prod) funcionando.

---

## 4. v0.1 — Plano de Entregas Detalhado

### 4.1 Objetivo da v0.1

> Um usuário externo abre o site (irischef.tech), faz login com Google, cria um tema de estudo livre, recebe uma árvore macro (5-20 nós) gerada por LLM com dependências entre nós, e progride lendo o conteúdo de cada nó (gerado on-demand) e marcando como concluído. Múltiplos temas por usuário. Tudo self-hosted.

### 4.2 Features (specs) da v0.1 — em ordem de execução

A ordem reflete dependências entre features. Specs com prefixos próximos são candidatas a paralelizar.

#### Fase A — Foundation (sem essas, nada existe)

**000 — Bootstrap do Projeto e Constitution**
- Inicializar repositório com estrutura `.specify/`.
- Escrever `constitution.md` (seção 2 deste plano).
- Setup mínimo: container vazio rodando, healthcheck respondendo, CI básico (lint+test placeholder).
- Critério de aceite: `docker compose up` levanta um serviço que responde `200 OK` em `/health`.

**001 — Modelo de Domínio Conceitual**
- Spec **descritiva** (não código) das entidades centrais:
  - `User` (id, email, nome, criado_em)
  - `Tema` (id, user_id, nome, descrição livre, mini_perfil JSON, criado_em, status)
  - `Arvore` (id, tema_id, schema_version, gerada_em, versao) — guarda o grafo
  - `No` (id, arvore_id, slug, titulo, descricao, depende_de[]) — vértices do DAG
  - `Progresso` (user_id, no_id, status: bloqueado|disponivel|concluido, concluido_em)
  - `ConteudoNo` (no_id, nivel: L1, markdown, gerado_em, llm_provider, llm_model)
  - `EventoSistema` (user_id, tipo, payload, timestamp) — telemetria mínima
- Constitution check: `user_id` em tudo? ✓
- Não decide schema SQL nem ORM. Só conceitos e relações.

**002 — LLM Gateway (camada de abstração)**
- Interface `LLMProvider` com operações:
  - `gerarArvore(input: PromptArvore): Promise<Arvore>`
  - `gerarConteudoNo(input: PromptNo): Promise<Markdown>`
- Implementação inicial: **Gemini** (configurável via env).
- Implementação mock para testes (sem rede).
- Retry com backoff, timeout configurável, erros tipados.
- Logging estruturado (qual provider, qual modelo, tokens, latência) sem vazar prompt completo em logs prod.
- Rate limit por usuário (simples: N gerações/hora).
- Critério: trocar Gemini→OpenAI no futuro é alterar env vars + injetar nova classe. Não toca código de feature.

**003 — Auth via Google OAuth**
- Fluxo: landing → "Entrar com Google" → callback → sessão.
- Cria `User` no primeiro login (auto-signup).
- Logout funcional.
- Proteção de rotas autenticadas (middleware genérico).
- Sessão persistente (cookie httpOnly).
- Não escopo: recuperação de senha (não há senha), 2FA, social além de Google.

**004 — Persistência e Storage**
- Banco relacional self-hosted (escolha em `plan.md`).
- Migrations versionadas.
- Storage de arquivos: volume Docker (mesma VPS) — para conteúdos longos em markdown, se decidirmos não guardar no DB.
- Backup automatizado (cron + dump + retenção de N dias). **Isso é parte da v0.1**, não enfeite — VPS sem backup perde dados.
- Critério: derrubar e subir o container preserva todos os dados.

#### Fase B — Core Flow (criar tema → ver árvore)

**005 — Criar Tema com Mini-Perfil**
- UI: formulário com (a) nome do tema livre, (b) 2-3 perguntas curtas de calibração:
  - "O que você já sabe sobre [tema]?" (livre, curto)
  - "Qual seu objetivo com esse tema?" (livre, curto)
  - "Prefere abordagem mais teórica ou mais aplicada?" (escolha)
- Persistir `Tema` com `mini_perfil` JSON.
- Trigger pós-submit: dispara geração de árvore (próxima feature).
- Múltiplos temas permitidos; sem limite.

**006 — Geração da Árvore Macro (DL1/DL2)**
- Prompt template para LLM: domínio + mini-perfil → grafo DAG com 5-20 nós.
- Output esperado (estruturado, validável): lista de nós com `slug`, `titulo`, `descricao_breve` (1-2 linhas), `depende_de` (lista de slugs).
- Validação:
  - Sem ciclos no DAG (verificação topológica).
  - Cardinality dentro da faixa (5-20).
  - Todos `depende_de` referenciam nós existentes.
  - Se falhar validação: re-prompt com erro específico (até 2 retries) antes de mostrar erro ao usuário.
- Persistir `Arvore` + `No`s + `Progresso` inicial (raízes do DAG = `disponivel`, demais = `bloqueado`).
- UX: spinner com mensagens progressivas ("Analisando o tema...", "Mapeando dependências..."). Tempo esperado: 5-20s.
- Critério: gerar tema "História do Brasil" produz árvore coerente, sem ciclos, com pelo menos 1 raiz e desbloqueios em cascata possíveis.

**007 — Regenerar Árvore**
- Caso o usuário não goste da árvore inicial, botão "regenerar".
- Substitui a árvore mas **preserva** referência via `versao` (não deleta histórico no v0.1; espaço de DB é barato).
- Limite: ilimitado na v0.1 (gate vem em v0.3 com freemium).
- Aviso de UX: "Regenerar apaga seu progresso neste tema". Confirmação obrigatória.

**008 — Dashboard de Temas**
- Após login: lista de temas do usuário com:
  - Nome, criado em, % de conclusão (concluídos / total de nós).
  - Botão "abrir", "regenerar", "excluir".
  - Botão proeminente "+ Novo Tema".
- Estado vazio (sem temas) tem CTA claro.

#### Fase C — Estudo (abrir nó → ler → concluir)

**009 — Visualizador da Árvore**
- Renderização do grafo do tema: nós, arestas, estados visuais (bloqueado/disponível/concluído).
- Interativo: clicar em nó disponível abre o nó; clicar em bloqueado mostra tooltip "Conclua X, Y para desbloquear".
- Layout DAG legível (topological ou hierárquico — decisão de `plan.md`).
- Mobile-responsivo (mesmo que simplificado).
- Reutilizar inspiração do `aprendiz/dominios/*/skilltree.html` atual quando fizer sentido — não copiar o código (é cytoscape custom), mas o conceito de visualização.

**010 — Página de Nó (Leitura)**
- Acessível só se `Progresso.status == disponivel` ou `concluido`.
- Se conteúdo ainda não foi gerado: chama LLM Gateway (`gerarConteudoNo`, nível L1, com contexto do nome do tema + mini-perfil + título/descrição do nó). Spinner com mensagem.
- Conteúdo gerado é persistido (`ConteudoNo`). Reabrir o nó depois é instantâneo.
- Renderização: markdown → HTML, leitura confortável (tipografia, dark mode opcional).
- Botão "Marcar como concluído" no fim da página.
- Botão "Voltar à árvore".

**011 — Marcar Concluído e Desbloqueio em Cascata**
- Ao marcar nó `X` como concluído: para cada nó `Y` que tem `X` em `depende_de`, verificar se *todas* as dependências de `Y` estão concluídas. Se sim, `Y` vira `disponivel`.
- Atualização visível na árvore (sem precisar refresh manual — ou refresh, dependendo do plan).
- Idempotente: marcar duas vezes não quebra nada.

#### Fase D — Pré-release

**012 — Telemetria Mínima**
- Eventos chave registrados em `EventoSistema`:
  - `user_signup`, `tema_criado`, `arvore_gerada`, `arvore_regenerada`, `no_aberto`, `conteudo_gerado`, `no_concluido`, `llm_error`.
- Dashboard interno básico (rota admin, só Ariel acessa): contagem de usuários, temas, nós concluídos, erros LLM.
- Sem analytics externo (Mixpanel, GA) na v0.1 — todos os dados ficam na VPS.

**013 — Operações de Produção**
- `docker-compose.yml` completo (app + db + reverse proxy).
- Configuração de TLS (Let's Encrypt) para irischef.tech.
- Variáveis de ambiente documentadas (`.env.example`).
- Health check e readiness probe.
- Logs estruturados e centralizados (mesmo que stdout do container; rotacionados).
- Backup automatizado do DB (cron + retenção).
- Runbook básico: como fazer deploy, rollback, restaurar backup, ver logs.

**014 — Landing Page Mínima**
- 1 página explicando o que é o Paretto (em PT-BR).
- CTA: "Entrar com Google".
- Footer com termos de uso + privacidade (textos mínimos, AI-aware).
- Sem marketing copy elaborado; objetivo é não parecer placeholder.

### 4.3 Critérios de "v0.1 done"

A v0.1 está completa quando:

1. `irischef.tech` acessível publicamente, HTTPS.
2. Um usuário novo consegue: login Google → criar tema → ver árvore gerada → abrir nó → ler conteúdo → marcar concluído → desbloquear próximo.
3. Múltiplos usuários conseguem usar em paralelo sem interferir.
4. Trocar `LLM_PROVIDER=gemini` para `LLM_PROVIDER=mock` (ou outro) em env funciona sem mudar código.
5. `docker compose up` em uma VPS limpa, com env preenchido, sobe o sistema completo.
6. Backup do banco roda automaticamente e foi testado um restore.
7. Ariel usou o produto por 1 semana criando temas reais sem falhas críticas.
8. Todas as 14 specs com `spec.md`, `plan.md` e `tasks.md` aprovadas e tasks marcadas como done.

### 4.4 Explicitamente FORA da v0.1

Para evitar scope creep:

- Níveis acima de L1 (subir nível, índices L3+, capítulos)
- Quiz, Feynman, avaliação automática
- Perfil global do usuário (entrevista rica)
- Estilos de comunicação configuráveis (formal/informal)
- Planos pagos, freemium, billing
- Compartilhamento de árvores entre usuários
- `/conectar`, `/tour`, `/ensinar`, `/revisar`, `/memoria`, `/status`
- Múltiplos idiomas
- App mobile nativo
- Importação/exportação de dados
- Notificações por email (exceto recuperação de erros críticos da infra)

---

## 5. Roadmap Pós-v0.1 (conceitual, sem datas)

A ordem é proposta; será reavaliada após cada lançamento.

### v0.2 — Profundidade Pedagógica
Foco: tornar o produto **pedagogicamente diferenciado**, não só "gerador de listas".

- **Subida de nível L1→L2** por nó (preserva calibração entre níveis: L2 referencia L1, não repete).
- **Onboarding rico** com perfil global do usuário (versão simplificada das 12 perguntas; opcional, calibra todos os temas).
- **Quiz curto pós-leitura** (3-5 perguntas geradas, aprovação libera o próximo nó). Substitui ou complementa o self-marking.
- **Memória de sessão** — histórico do que foi estudado e quando.

### v0.3 — Modelo de Negócio
Foco: introduzir freemium **sem quebrar usuários existentes**.

- **Plano free vs pago**: limites em (a) número de temas, (b) regenerações por mês, (c) níveis acessíveis (free = L1 apenas), (d) modelos de LLM disponíveis.
- **Billing self-hosted ou via Stripe** (decidir em spec; Stripe quebra o princípio "tudo na VPS", precisa de constitution amendment).
- **Página de pricing**, downgrade graceful, upgrade flow.
- **Estilo de comunicação configurável** (formal acadêmico / didático / direto) — feature pequena, encaixa aqui.

### v0.4 — Conexões e Conteúdo Avançado
Foco: trazer features ricas do sistema original.

- **`/conectar` (interdisciplinar)** — análise de conexões entre tópicos / temas diferentes.
- **`/ensinar` (Feynman)** — usuário explica em texto, LLM dá feedback socrático.
- **L3+** — índices estruturados + capítulos sob demanda.
- **Revisão espaçada** — sistema sugere o que revisar baseado em intervalos (1d, 3d, 7d, 21d, 60d).

### v0.5+ — Plataforma
- **Templates de temas** (compartilháveis ou públicos).
- **i18n** (começando por inglês, dado que o público técnico é global).
- **Tour cinematográfico** (porting da skill `/tour`).
- **Skill tree atômica** (DL3/DL4) — granularidade fina para usuários avançados.
- **App mobile** (PWA primeiro, nativo depois).
- **API pública** (para integrações).
- **Marketplace de planos de estudo curados**.

---

## 6. Próximos Passos Imediatos

Em ordem, depois da aprovação deste plano:

1. **Criar a estrutura `.specify/`** no repositório (`constitution.md` + diretórios de specs).
2. **Escrever `constitution.md`** com os 10 princípios da seção 2 deste plano.
3. **Escrever `spec.md` da feature 000 (Bootstrap)** — primeira spec, para validar o template e o fluxo SDD.
4. **Ariel revisa e aprova spec 000.**
5. **Escrever `plan.md` da 000** — aqui sim, escolhe-se a stack (linguagem do backend, framework web, banco, etc.). Decisão registrada com trade-offs.
6. **Ariel revisa e aprova plan 000.**
7. **Escrever `tasks.md` da 000** e executar.
8. **Em paralelo (depois que 000 estiver pronto)**: escrever specs 001-004 (foundation) em batch, revisar todas juntas, aprovar, escrever plans, executar.
9. **Sequencializar Fases B → C → D** com ciclos curtos de spec→plan→implement por feature.

**Critério de "pronto para começar a codar"**: spec 000 + plan 000 aprovados.

---

## 7. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| LLM gera árvores ruins (incoerentes, ciclos, off-topic) | Alto — quebra UX | Spec 006 inclui validação estruturada + retry com erro contextual. Botão "regenerar" como escape. Logging de falhas para tuning de prompt. |
| Custo de LLM explode com usuários reais | Médio | On-demand já mitiga. Rate limit em LLM Gateway (spec 002). Telemetria de tokens (spec 012). Provider Gemini é barato. |
| VPS cai e perde dados | Alto | Backup automatizado é parte da spec 004 e 013, não enfeite. Restore testado antes da v0.1 ser "done". |
| Scope creep ("só mais essa feature") | Alto | Lista 4.4 explicita o que NÃO entra. Toda exceção exige decisão escrita. |
| Spec virar burocracia que atrasa | Médio | Specs curtas (1-2 páginas), template fixo, sem aprovação por comitê (só Ariel). Spec ≠ documento de requisitos corporativo. |
| Migração futura para outra VPS dolorida | Médio-Baixo | Dockerização desde dia 1 + backup testado tornam migração = `docker compose up` + restore em outra máquina. |
| Conceitos ricos do sistema atual diluídos | Alto (perde diferencial) | Constitution (especialmente princípios 4-6) é o guardião. Toda spec faz constitution check. |

---

## 8. Arquivos-chave de Referência

Para escrever as specs com fidelidade ao sistema atual (caminhos relativos ao repositório `paretto_learner` original):

- `CLAUDE.md` — regras globais, convenções, modelo de níveis e mapas.
- `instructions.md` — modelo de níveis com comandos `[L1]`, `[DL1]`, etc.
- `docs/metodologia_paretto.md` — princípios pedagógicos (Bloom, revisão espaçada, Feynman).
- `aprendiz/perfil.md` — exemplo de perfil rico (referência para o que **não** é o mini-perfil da v0.1, mas é o destino em v0.2).
- `aprendiz/dominios/biblia_antigo_testamento/state.json` — exemplo do schema de progresso atual (`feito[]`, `last_visited`, view).
- `aprendiz/dominios/*/skilltree.html` — visualizador atual de skill tree (referência conceitual para spec 009).
- `app/server/index.ts` + `app/src/` — embrião de servidor + frontend do projeto atual.
- `.claude/agents/` — sub-agents que servem de inspiração conceitual para a orquestração LLM no SaaS (não código direto).

---

## 9. Verificação do Plano

Este plano está pronto para execução quando:

- Ariel concorda com a constitution (seção 2).
- Ariel concorda com o escopo da v0.1 (seção 4) e o que está fora dela (seção 4.4).
- Ariel concorda com a ordem das features (seção 4.2) ou sugere reorganização.
- Ariel concorda com o roadmap conceitual pós-v0.1 (seção 5) — mesmo que possa mudar.
- Próximos passos imediatos (seção 6) estão claros e Ariel sabe qual é o primeiro entregável (criar `.specify/` + escrever spec 000).
