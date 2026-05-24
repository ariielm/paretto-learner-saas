# Spec 000.5 — Deploy Contínuo + Smoke Test em Produção (design)

> Output da sessão de brainstorming que antecipa parte da spec 016 ("Ops de Produção") para o início do backlog, viabilizando deploy a cada merge desde a próxima feature.

**Documento de design** — não substitui a `spec.md` final desta feature; precede e enquadra a `spec.md` + `plan.md`.

**Documentos relacionados:**
- `docs/superpowers/specs/2026-05-20-saas-foundation-design.md` — design fundacional (constitution, standards, backlog 18 specs, workflow). A spec 016 será reescopada após esta 000.5.
- `docs/superpowers/specs/2026-05-21-pre-implementation-decisions-design.md` — decisões de stack (Next.js 16 + Postgres + Drizzle + Nginx).
- `docs/decisions/0001-stack-escolhida.md` — ADR da stack.
- `docs/superpowers/plans/2026-05-20-spec-000-bootstrap.md` — plano executado da spec 000.

---

## Contexto

Após a implementação da spec 000 (2026-05-22), a aplicação tem Next.js + Dockerfile + docker-compose + CI verde, mas **só roda localmente**. Nenhum código está em produção. Toda spec subsequente seria desenvolvida sem validação real até a spec 016 ("Ops de Produção"), penúltima do backlog v0.1.

Esse caminho deixa o feedback loop longo — TLS, Nginx, deploy automatizado, persistência, env management, runbook só seriam exercitados no final, quando o backlog inteiro já depende deles. Qualquer surpresa operacional aparece tarde.

**Decisão:** antecipar uma *fatia fina* de Ops como nova spec 000.5, focada apenas no que viabiliza "merge na main = código em prod com TLS válido respondendo no domínio público". Restante de Ops (backup, runbook, hardening avançado, observabilidade) permanece na spec 016, agora reescopada como "Hardening de Ops".

**Pré-condições atendidas:**
- VPS provisionada, SSH funcional.
- DNS de `irischef.tech` apontando corretamente para a VPS.
- Repo `ariielm/paretto-learner-saas` público (desde 2026-05-22).
- Branch protection na `main` exigindo CI verde.

---

## 1. Posição no backlog + escopo

### 1.1 Nome e numeração

Nova spec **`000.5 — Deploy Contínuo + Smoke Test em Produção`**, inserida entre 000 e 001 sem renumerar nenhuma spec existente. A numeração decimal sinaliza que é uma fatia antecipada de outra spec (016), não uma feature de produto.

### 1.2 Reescopo da spec 016

A spec 016 originalmente cobria "Ops de Produção" completa. Após 000.5, 016 é **reescopada** para **"Hardening de Ops"** e cobre apenas o que sobrou:

- Backup automatizado do DB (depende da spec 004 introduzir Postgres).
- Log rotation / centralização além de stdout do Docker.
- Runbook completo (rollback manual, restore, debug em prod, migração de VPS).
- Dashboard de saúde além de smoke test binário.
- Secrets vault ou rotação programática (se decidirmos sair do modelo manual).
- Cleanup periódico de tags antigas no GHCR.
- Hardening adicional da VPS (fail2ban, auto-updates de OS, etc.).

A atualização do design fundacional (`2026-05-20-saas-foundation-design.md`) para refletir isso é uma das tasks desta spec.

### 1.3 Em escopo de 000.5

- Provisão da VPS com user dedicado `deploy`, firewall `ufw`, SSH key-only.
- `docker-compose.production.yml` rodando 3 serviços: `app` (puxa de GHCR), `nginx-proxy` (`nginxproxy/nginx-proxy`), `acme-companion` (`nginxproxy/acme-companion`).
- Extensão do `.github/workflows/ci.yml` com job `deploy` que dispara só em push para `main` após `build-and-test` verde.
- Push de imagem para `ghcr.io/ariielm/paretto-learner-saas` com tags `sha-<short>` + `latest`.
- TLS Let's Encrypt automático via `acme-companion`.
- Smoke test pós-deploy: HTTPS em `/health` (200 + JSON `{status:'ok'}`) e `/` (200).
- Rollback automático para a tag anterior se smoke falhar.
- `.env` na VPS criado manualmente, com valores reais — CI nunca toca.

### 1.4 Fora de escopo (NÃO entram em 000.5)

- Postgres (entra na spec 004; até lá só app é containerizado em prod).
- Backup, restore, log rotation, runbook.
- Secrets em vault ou rotação automática.
- Staging environment / multi-env.
- Cleanup de imagens antigas no GHCR.
- Health dashboard ou monitoring além de smoke test binário.
- Blue-green / canary deploys.

### 1.5 Critérios de aceitação

1. `https://irischef.tech/health` retorna HTTP 200 com body JSON `{status:'ok', version:...}`.
2. `https://irischef.tech/` retorna HTTP 200 com a home page do Next.js.
3. Certificado TLS válido emitido por Let's Encrypt, sem erros de cadeia.
4. `git push origin main` (após qualquer feature passar CI) dispara deploy automático que termina com smoke test verde — sem ação humana.
5. Quando o smoke test falha, o deploy reverte automaticamente para a tag anterior e o job do GH Actions termina em estado `failed`. Dev recebe notificação por email/UI do GitHub.
6. Spec 016 atualizada no design fundacional refletindo o reescopo.

---

## 2. Pipeline de deploy

### 2.1 Fluxo end-to-end

```
push main → GH Actions (build-and-test) → [verde] → GH Actions (deploy job)
                                                      ├─ docker buildx (target=runner)
                                                      ├─ docker push → ghcr.io
                                                      │      tags: sha-<short>, latest
                                                      ├─ ssh deploy@VPS
                                                      │   ├─ cd /opt/paretto
                                                      │   ├─ cp .current_tag .last_tag (backup p/ rollback)
                                                      │   ├─ echo "sha-<short>" > .current_tag
                                                      │   ├─ TAG=$(cat .current_tag) \
                                                      │   │   docker compose -f docker-compose.production.yml pull
                                                      │   └─ TAG=$(cat .current_tag) \
                                                      │       docker compose -f docker-compose.production.yml up -d --remove-orphans
                                                      ├─ smoke test (Seção 3.2)
                                                      └─ [falha] → rollback (Seção 3.3)
```

### 2.2 Mudanças no `.github/workflows/ci.yml`

O workflow atual ganha um job novo `deploy`:

```yaml
deploy:
  needs: build-and-test
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  runs-on: ubuntu-latest
  permissions:
    contents: read
    packages: write
  steps:
    - uses: actions/checkout@v4
    - uses: docker/setup-buildx-action@v3
    - name: Login to GHCR
      uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    - name: Build and push
      uses: docker/build-push-action@v6
      with:
        context: .
        push: true
        tags: |
          ghcr.io/ariielm/paretto-learner-saas:sha-${{ github.sha }}
          ghcr.io/ariielm/paretto-learner-saas:latest
    - name: Deploy to VPS
      uses: appleboy/ssh-action@v1
      with:
        host: ${{ secrets.VPS_HOST }}
        username: ${{ secrets.VPS_USER }}
        key: ${{ secrets.VPS_SSH_KEY }}
        # known_hosts via env do step
        script: |
          set -euo pipefail
          cd /opt/paretto
          cp .current_tag .last_tag 2>/dev/null || true
          echo "sha-${{ github.sha }}" > .current_tag
          TAG=$(cat .current_tag) docker compose -f docker-compose.production.yml pull
          TAG=$(cat .current_tag) docker compose -f docker-compose.production.yml up -d --remove-orphans
    - name: Smoke test
      id: smoke
      run: |
        ./.github/scripts/smoke-test.sh https://irischef.tech
    - name: Rollback on failure
      if: failure() && steps.smoke.conclusion == 'failure'
      uses: appleboy/ssh-action@v1
      with:
        host: ${{ secrets.VPS_HOST }}
        username: ${{ secrets.VPS_USER }}
        key: ${{ secrets.VPS_SSH_KEY }}
        script: |
          set -euo pipefail
          cd /opt/paretto
          PREV=$(cat .last_tag)
          echo "Rolling back to $PREV"
          TAG=$PREV docker compose -f docker-compose.production.yml up -d --remove-orphans
          echo "$PREV" > .current_tag
```

`known_hosts` é injetado via env var antes do `ssh-action` (detalhe de plano fechado em `tasks.md`).

### 2.3 Tagging strategy

- `sha-<7chars>` — referência imutável, usado para rollback.
- `latest` — apontamento mutável para a versão atual; útil para `docker pull` ad-hoc.
- Sem semver na v0.1; releases formais entram quando houver convenção de versão.

### 2.4 Secrets necessários no GitHub Actions

| Secret | Conteúdo |
|---|---|
| `VPS_HOST` | IP ou hostname público da VPS |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | private key (OpenSSH/PEM) com pubkey em `authorized_keys` do user `deploy` |
| `VPS_KNOWN_HOSTS` | output de `ssh-keyscan -H VPS_HOST` para prevenir MITM |
| `GITHUB_TOKEN` | built-in, usado para login no GHCR (não precisa configurar manualmente) |

### 2.5 Diretório de prod na VPS

`/opt/paretto/`, owner `deploy:deploy`, contém:

- `docker-compose.production.yml` — definido em 3.1, versionado no repo, copiado pelo plan via SSH no setup inicial. **Não é a mesma coisa que `docker-compose.yml` (dev).**
- `.env` — manual, gitignored, criado por dev na VPS, `chmod 600`. Contém pelo menos `LETSENCRYPT_EMAIL=<email>` (usado por `acme-companion` para emissão e renovação dos certs). Demais variáveis (`GEMINI_API_KEY`, `SESSION_SECRET`, etc.) entram conforme cada spec posterior precisar.
- `.current_tag` — tag corrente, escrito pelo CI.
- `.last_tag` — tag anterior, escrito pelo CI imediatamente antes de `pull` nova, usado para rollback.

---

## 3. Stack na VPS, smoke test, rollback, hardening

### 3.1 `docker-compose.production.yml`

```yaml
services:
  nginx-proxy:
    image: nginxproxy/nginx-proxy:1.6
    container_name: nginx-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - certs:/etc/nginx/certs
      - vhost:/etc/nginx/vhost.d
      - html:/usr/share/nginx/html
      - /var/run/docker.sock:/tmp/docker.sock:ro
    restart: unless-stopped

  acme-companion:
    image: nginxproxy/acme-companion:2.4
    container_name: acme-companion
    depends_on:
      - nginx-proxy
    volumes:
      - certs:/etc/nginx/certs
      - vhost:/etc/nginx/vhost.d
      - html:/usr/share/nginx/html
      - acme:/etc/acme.sh
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      DEFAULT_EMAIL: ${LETSENCRYPT_EMAIL}
    restart: unless-stopped

  app:
    image: ghcr.io/ariielm/paretto-learner-saas:${TAG:-latest}
    container_name: paretto-app
    expose:
      - "3000"
    env_file:
      - .env
    environment:
      VIRTUAL_HOST: irischef.tech
      VIRTUAL_PORT: "3000"
      LETSENCRYPT_HOST: irischef.tech
    restart: unless-stopped
    depends_on:
      - nginx-proxy

volumes:
  certs:
  vhost:
  html:
  acme:
```

**Funcionamento:** `nginx-proxy` escuta o socket Docker (read-only), descobre containers com `VIRTUAL_HOST` e gera config Nginx automaticamente. `acme-companion` vê containers com `LETSENCRYPT_HOST` e provisiona/renova certs via Let's Encrypt. App não expõe portas no host — apenas `expose` interno; só `nginx-proxy` expõe 80/443.

**Trade-off conhecido:** mount do Docker socket é um vetor de privilégio. Read-only mitiga, mas alternativas mais seguras (`docker-gen` separado, config manual) ficam fora de escopo da v0.1. Documentado para revisitar na spec 016.

### 3.2 Smoke test

Script em `.github/scripts/smoke-test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:?usage: smoke-test.sh <base_url>}"

echo "Waiting for /health to respond..."
for i in $(seq 1 30); do
  if curl -fsS --max-time 5 "${BASE_URL}/health" > /dev/null 2>&1; then
    echo "  ready after ${i} attempts"
    break
  fi
  sleep 3
done

echo "Smoke: GET ${BASE_URL}/health"
HEALTH_BODY=$(curl -fsS --max-time 10 "${BASE_URL}/health")
echo "$HEALTH_BODY"
echo "$HEALTH_BODY" | jq -e '.status == "ok"' > /dev/null

echo "Smoke: GET ${BASE_URL}/ (home)"
HOME_CODE=$(curl -fsS --max-time 10 -o /dev/null -w "%{http_code}" "${BASE_URL}/")
[ "$HOME_CODE" = "200" ] || { echo "home returned $HOME_CODE"; exit 1; }

echo "Smoke: TLS chain valid"
echo | openssl s_client -servername "${BASE_URL#https://}" -connect "${BASE_URL#https://}:443" -verify_return_error 2>&1 \
  | grep -q "Verify return code: 0 (ok)"

echo "Smoke test PASSED"
```

Notas:
- O retry de 30×3s no `/health` cobre o tempo de `acme-companion` emitir cert na primeira execução (pode levar 30-60s).
- A verificação TLS usa `openssl s_client` para validar a cadeia inteira, não só HTTP 200.
- Em redeploys subsequentes (cert já emitido), os 3 checks rodam em segundos.

### 3.3 Rollback automático

Quando o step `smoke` retorna não-zero, o step `Rollback on failure` (`if: failure()`) executa via SSH:

```bash
cd /opt/paretto
PREV=$(cat .last_tag)
echo "Rolling back to $PREV"
TAG=$PREV docker compose -f docker-compose.production.yml up -d --remove-orphans
echo "$PREV" > .current_tag
```

`.last_tag` foi escrito imediatamente antes do `pull` novo, então sempre aponta para a versão estável anterior. O `current_tag` é restaurado para manter consistência.

**Limitações conhecidas (documentar na spec, sem ação na 000.5):**
- Primeiro deploy não tem `.last_tag` ainda — `cp .current_tag .last_tag 2>/dev/null || true` ignora silenciosamente; falha no primeiro smoke deixaria prod quebrada até intervenção manual. Aceitável por ser exatamente 1 deploy.
- Se rollback também falhar, o job termina em failure sem auto-recuperação adicional — dev recebe notificação e age manualmente.
- Rollback não desfaz migrations de DB (Postgres ainda não existe v0.1; quando entrar com spec 004, esse caso será tratado em ADR ou na 016).

### 3.4 Hardening básico da VPS (setup inicial)

| Item | Como |
|---|---|
| User `deploy` no group `docker` | `adduser --disabled-password deploy && usermod -aG docker deploy` |
| SSH key only | `~deploy/.ssh/authorized_keys` com pubkey gerada por dev. `/etc/ssh/sshd_config`: `PasswordAuthentication no`, `PermitRootLogin no`. Restart sshd. |
| Firewall ufw | `ufw default deny incoming` + `ufw allow 22/tcp` + `ufw allow 80,443/tcp` + `ufw enable` |
| `known_hosts` pinned | `ssh-keyscan -H <VPS_HOST>` no setup local, output vai para GH Secret `VPS_KNOWN_HOSTS` |
| GHCR pull anônimo | Nenhuma config — imagem é pública (repo é público) |
| `.env` permissions | `chmod 600 /opt/paretto/.env`, owner `deploy:deploy` |
| Watchtower / OS auto-update | Fora de escopo — entra na 016 |

### 3.5 Aderência aos princípios da Constitution

- **III (Dados na VPS):** App, certs, ACME state, secrets reais (`.env`) — todos na VPS. Imagens em GHCR público não contêm dados de usuário (apenas código já público). Sem ADR de exceção necessária.
- **V (Densidade):** `docker-compose.production.yml` tem só 3 serviços essenciais. Nenhuma peça especulativa (sem watchtower, sem agentes de monitoring extra, sem staging).
- **IX (Modularidade):** descoberta via labels Docker — adicionar Postgres (spec 004) ou novos containers é só compose + labels, sem mexer no proxy ou no acme.
- **X (SDD):** esta spec passa por `spec.md` → `plan.md` → `tasks.md` → implementação como qualquer outra.
- **XII (Migration path):** não há usuários afetados (pré-launch). Mudança de URL ou cert não impacta dados.

### 3.6 Standards aplicáveis

- **`error-handling.md`:** smoke test falha = `LLMError`-equivalent no nível de deploy. Falha clara, ação automática (rollback) — alinhada com o princípio "ação clara quando possível".
- **`logging-and-observability.md`:** logs do Nginx, acme e app vão para stdout do Docker (rotacionado pelo daemon). Log centralizado fica para 016.
- **`testing.md`:** smoke test é a forma E2E mais externa do projeto. Não substitui testes de integração mas valida que tudo está conectado.
- **`prompt-management.md`:** N/A (sem LLM nessa spec).

---

## 4. Próximos passos

Após este doc ser aprovado pelo usuário:

1. Invocar `superpowers:writing-plans` para criar o plano de implementação executável.
2. Plano será dividido em fases:
   - **A. Setup local + pre-VPS**: criar `docker-compose.production.yml`, smoke-test.sh, extensão do CI workflow (sem fazer push ainda).
   - **B. Provisão da VPS**: SSH inicial, criar user `deploy`, ufw, sshd hardening, criar `/opt/paretto/`, gerar SSH key de deploy, configurar GH Secrets.
   - **C. Primeiro deploy manual** (smoke do pipeline): rodar manualmente todos os passos do CI no VPS para validar que o stack sobe e cert é emitido — antes de delegar pro GH Actions.
   - **D. Push do workflow + observação do primeiro deploy automatizado.**
   - **E. Atualizar foundation design** (reescopo da 016) e memórias.
3. Plano espelha o estilo da 000: cada task com sub-steps executáveis, requisitos obrigatórios listados, sem placeholders dependentes de decisão.

---

## Verificação do design

Este documento está pronto para virar input do plano quando:

- Usuário aprova a Seção 1 (posição + escopo). ✅
- Usuário aprova a Seção 2 (pipeline). ✅
- Usuário aprova a Seção 3 (VPS + smoke + hardening). ✅
- Usuário revisa o arquivo gravado e confirma sem mudanças adicionais (próximo passo).
