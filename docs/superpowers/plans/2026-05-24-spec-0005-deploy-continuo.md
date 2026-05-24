# Spec 000.5 — Deploy Contínuo + Smoke Test em Produção: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habilitar deploy automatizado a cada merge na `main` para `https://irischef.tech`, com TLS Let's Encrypt automático, smoke test pós-deploy (`/health` + `/`), e rollback automático para tag anterior em caso de falha.

**Architecture:** Job `deploy` no GH Actions builda imagem após `build-and-test` verde, faz push para `ghcr.io/ariielm/paretto-learner-saas`, SSH na VPS, `docker compose pull && up -d` no `/opt/paretto/docker-compose.production.yml`. Stack na VPS = `nginx-proxy` + `acme-companion` + `app`, com descoberta via labels (`VIRTUAL_HOST`, `LETSENCRYPT_HOST`). Smoke test via `curl` HTTPS; rollback `if: failure()` no workflow re-executa `up -d` com a tag anterior.

**Tech Stack:** GitHub Actions, GHCR (público), Docker + Docker Compose, `nginxproxy/nginx-proxy`, `nginxproxy/acme-companion`, OpenSSH, Let's Encrypt, `ufw`. Sem dependências novas no projeto Node.

**Referências primárias:**
- `docs/superpowers/specs/2026-05-24-spec-0005-deploy-continuo-design.md` — design completo desta spec.
- `docs/superpowers/specs/2026-05-20-saas-foundation-design.md` — foundation (atualizado na Task 17 desta plan).
- `docs/decisions/0001-stack-escolhida.md` — ADR da stack.

---

## Pré-requisitos antes de executar este plano

- [ ] Spec 000 implementada e mergeada na `main` (commit `cb2ef2f` ou superior). Verificar: `git log --oneline -1` na `main`.
- [ ] `docker` daemon rodando localmente (OrbStack/Docker Desktop). Verificar: `docker version`.
- [ ] `gh` CLI autenticado como `ariielm`. Verificar: `gh auth status`.
- [ ] Acesso SSH **root** à VPS funcional. Verificar: `ssh root@<VPS_HOST> "echo ok"` retorna `ok`.
- [ ] DNS de `irischef.tech` resolve para o IP da VPS. Verificar: `dig +short irischef.tech` retorna o IP esperado.
- [ ] Email definido para Let's Encrypt (será gravado em `/opt/paretto/.env` na Task 12). Registrar mentalmente; será usado no Step 12.2.
- [ ] Variável de ambiente local `VPS_HOST` exportada com o IP/hostname para evitar substituir manualmente nas tasks. Sugestão: `export VPS_HOST=<ip-da-vps>` antes de começar.

---

## Task 1: Criar branch de trabalho

**Files:** nenhum (operação git).

- [ ] **Step 1.1: Garantir que está em `main` atualizada**

```bash
cd /Users/ariielm/dev/projects/paretto-learner-saas
git checkout main
git pull origin main
```

Expected: "Already up to date." ou pull com fast-forward.

- [ ] **Step 1.2: Criar e checkout da branch**

```bash
git checkout -b feat/0005-deploy
```

Expected: `Switched to a new branch 'feat/0005-deploy'`.

---

## Task 2: Criar `docker-compose.production.yml`

**Files:**
- Create: `docker-compose.production.yml` (raiz do repo)

- [ ] **Step 2.1: Escrever o arquivo**

Conteúdo completo:

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

- [ ] **Step 2.2: Validar YAML**

```bash
docker compose -f docker-compose.production.yml config > /dev/null
echo "compose config OK"
```

Expected: comando termina sem erro + linha "compose config OK". Erros de YAML aparecem na saída.

Nota: o aviso `WARN[0000] The "LETSENCRYPT_EMAIL" variable is not set.` é esperado — essa variável só existe no `.env` da VPS, não localmente.

---

## Task 3: Criar `.github/scripts/smoke-test.sh`

**Files:**
- Create: `.github/scripts/smoke-test.sh`

- [ ] **Step 3.1: Criar diretório e arquivo**

```bash
mkdir -p .github/scripts
```

Conteúdo de `.github/scripts/smoke-test.sh`:

```bash
#!/usr/bin/env bash
# Smoke test pos-deploy. Recebe a URL base (https://irischef.tech) como arg.
# Valida: /health 200 + JSON {status: ok}, / 200, e cadeia TLS valida.

set -euo pipefail

BASE_URL="${1:?usage: smoke-test.sh <base_url>}"
HOST="${BASE_URL#https://}"
HOST="${HOST#http://}"
HOST="${HOST%%/*}"

echo ">> Waiting for ${BASE_URL}/health to respond (30x3s)..."
ready=0
for i in $(seq 1 30); do
  if curl -fsS --max-time 5 "${BASE_URL}/health" > /dev/null 2>&1; then
    echo "   ready after ${i} attempts"
    ready=1
    break
  fi
  sleep 3
done

if [ "$ready" -ne 1 ]; then
  echo "FAIL: ${BASE_URL}/health did not respond within 90s"
  exit 1
fi

echo ">> Smoke 1/3: GET ${BASE_URL}/health"
HEALTH_BODY=$(curl -fsS --max-time 10 "${BASE_URL}/health")
echo "   body: ${HEALTH_BODY}"
echo "${HEALTH_BODY}" | jq -e '.status == "ok"' > /dev/null

echo ">> Smoke 2/3: GET ${BASE_URL}/ (home)"
HOME_CODE=$(curl -fsS --max-time 10 -o /dev/null -w "%{http_code}" "${BASE_URL}/")
if [ "${HOME_CODE}" != "200" ]; then
  echo "FAIL: home returned ${HOME_CODE}"
  exit 1
fi
echo "   code: ${HOME_CODE}"

echo ">> Smoke 3/3: TLS chain valid for ${HOST}"
TLS_OUT=$(echo | openssl s_client -servername "${HOST}" -connect "${HOST}:443" -verify_return_error 2>&1 || true)
if ! echo "${TLS_OUT}" | grep -q "Verify return code: 0 (ok)"; then
  echo "FAIL: TLS verification did not return 0 (ok)"
  echo "${TLS_OUT}" | tail -20
  exit 1
fi
echo "   TLS OK"

echo ">> Smoke test PASSED"
```

- [ ] **Step 3.2: Tornar executável**

```bash
chmod +x .github/scripts/smoke-test.sh
ls -la .github/scripts/smoke-test.sh
```

Expected: permissões `-rwxr-xr-x`.

- [ ] **Step 3.3: Validar sintaxe bash**

```bash
bash -n .github/scripts/smoke-test.sh && echo "syntax OK"
```

Expected: "syntax OK".

---

## Task 4: Estender `.github/workflows/ci.yml` com job `deploy`

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 4.1: Substituir o arquivo inteiro pelo conteúdo abaixo**

Conteúdo completo (preserva job `build-and-test` existente + adiciona `deploy`):

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Build (gera tipos do Next antes do typecheck)
        run: npm run build

      - name: Type-check
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Build container (smoke do Dockerfile)
        run: docker build -t paretto-saas:ci .

  deploy:
    needs: build-and-test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Compute short SHA
        id: sha
        run: echo "short=$(echo ${{ github.sha }} | cut -c1-7)" >> "$GITHUB_OUTPUT"

      - name: Build and push to GHCR
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ghcr.io/ariielm/paretto-learner-saas:sha-${{ steps.sha.outputs.short }}
            ghcr.io/ariielm/paretto-learner-saas:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Configure SSH known_hosts
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.VPS_KNOWN_HOSTS }}" >> ~/.ssh/known_hosts
          chmod 644 ~/.ssh/known_hosts

      - name: Deploy to VPS (pull + up)
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            set -euo pipefail
            cd /opt/paretto
            # Salvar tag corrente como last_tag (para rollback)
            if [ -f .current_tag ]; then
              cp .current_tag .last_tag
            fi
            NEW_TAG="sha-${{ steps.sha.outputs.short }}"
            echo "$NEW_TAG" > .current_tag
            echo ">> Deploying $NEW_TAG"
            TAG="$NEW_TAG" docker compose -f docker-compose.production.yml pull
            TAG="$NEW_TAG" docker compose -f docker-compose.production.yml up -d --remove-orphans

      - name: Smoke test
        id: smoke
        run: ./.github/scripts/smoke-test.sh https://irischef.tech

      - name: Rollback on smoke failure
        if: failure() && steps.smoke.conclusion == 'failure'
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            set -euo pipefail
            cd /opt/paretto
            if [ ! -f .last_tag ]; then
              echo "FATAL: no .last_tag to rollback to. Manual intervention required."
              exit 1
            fi
            PREV=$(cat .last_tag)
            echo ">> Rolling back to $PREV"
            TAG="$PREV" docker compose -f docker-compose.production.yml up -d --remove-orphans
            echo "$PREV" > .current_tag
            echo ">> Rollback complete"
```

- [ ] **Step 4.2: Validar YAML (parse)**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML OK"
```

Expected: "YAML OK" sem stack trace.

Se `python3` não estiver disponível, alternativa: `npx --yes js-yaml .github/workflows/ci.yml > /dev/null && echo "OK"`.

---

## Task 5: Commit Fase A + push da branch

**Files:** nenhum novo (commit dos arquivos das Tasks 2-4).

- [ ] **Step 5.1: Verificar status**

```bash
git status --short
```

Expected: 3 arquivos modificados/novos: `docker-compose.production.yml`, `.github/scripts/smoke-test.sh`, `.github/workflows/ci.yml`.

- [ ] **Step 5.2: Commit**

```bash
git add docker-compose.production.yml .github/scripts/smoke-test.sh .github/workflows/ci.yml
git commit -m "feat(deploy): add production compose, smoke test, and CI deploy job

Spec 000.5 Fase A: arquivos no repo para deploy continuo.

- docker-compose.production.yml: nginx-proxy + acme-companion + app
  com descoberta via VIRTUAL_HOST e LETSENCRYPT_HOST labels.
- .github/scripts/smoke-test.sh: valida /health, /, e cadeia TLS.
- .github/workflows/ci.yml: novo job 'deploy' (gate: build-and-test
  verde + push em main) que builda, pusha para ghcr.io, SSH na VPS,
  docker compose pull && up, smoke test, rollback automatico se
  smoke falhar.

Tasks subsequentes (Fase B-E) cuidam de provisao da VPS, secrets,
primeiro deploy manual de validacao, observar primeiro deploy
automatizado, e reescopo da spec 016 no design fundacional."
```

- [ ] **Step 5.3: Push da branch (CI vai rodar mas job deploy ainda não dispara — branch != main)**

```bash
git push -u origin feat/0005-deploy
gh run watch
```

Expected: workflow `CI` roda só o job `build-and-test` (job `deploy` é skipped por `if: github.ref == 'refs/heads/main'`). `build-and-test` deve passar verde.

---

## Task 6: Verificar acesso SSH root à VPS

**Files:** nenhum.

- [ ] **Step 6.1: Validar conectividade**

```bash
ssh root@${VPS_HOST} 'uname -a && docker --version && docker compose version'
```

Expected: linha do `uname` (kernel Linux), versão do `docker` (>= 20.x ideal), versão do `docker compose` (>= 2.x).

Se `docker` não estiver instalado na VPS, parar aqui e instalar antes de prosseguir:

```bash
ssh root@${VPS_HOST} 'curl -fsSL https://get.docker.com | sh'
```

Re-validar com o primeiro comando.

---

## Task 7: Criar user `deploy` + group docker na VPS

**Files:** nenhum no repo. Operação na VPS.

- [ ] **Step 7.1: Criar user e adicionar ao group docker**

```bash
ssh root@${VPS_HOST} 'bash -s' <<'REMOTE'
set -euo pipefail
if id deploy >/dev/null 2>&1; then
  echo "user deploy already exists"
else
  adduser --disabled-password --gecos "" deploy
  echo "user deploy created"
fi
usermod -aG docker deploy
id deploy
REMOTE
```

Expected: linha `id deploy` mostrando o user + groups, incluindo `docker`.

- [ ] **Step 7.2: Validar que `deploy` consegue rodar docker**

```bash
ssh root@${VPS_HOST} 'sudo -u deploy docker ps'
```

Expected: cabeçalho `CONTAINER ID IMAGE COMMAND …` (sem containers listados ainda, OK).

Se der "permission denied", revalidar group docker:

```bash
ssh root@${VPS_HOST} 'groups deploy'
```

---

## Task 8: Gerar SSH key local + adicionar à VPS

**Files:** local `~/.ssh/paretto_deploy_ed25519` (privada, NÃO vai pro repo).

- [ ] **Step 8.1: Gerar par de chaves local (dedicada ao deploy)**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/paretto_deploy_ed25519 -C "paretto-deploy@github-actions" -N ""
ls -la ~/.ssh/paretto_deploy_ed25519*
```

Expected: 2 arquivos novos (`paretto_deploy_ed25519` e `paretto_deploy_ed25519.pub`), permissões `600` na privada e `644` na pública.

Nota: `-N ""` cria sem passphrase (necessário porque o GH Actions não consegue digitar passphrase).

- [ ] **Step 8.2: Copiar pubkey para `~deploy/.ssh/authorized_keys` na VPS**

```bash
PUBKEY=$(cat ~/.ssh/paretto_deploy_ed25519.pub)
ssh root@${VPS_HOST} "bash -s" <<REMOTE
set -euo pipefail
mkdir -p ~deploy/.ssh
chmod 700 ~deploy/.ssh
echo "${PUBKEY}" >> ~deploy/.ssh/authorized_keys
chmod 600 ~deploy/.ssh/authorized_keys
chown -R deploy:deploy ~deploy/.ssh
echo "OK"
REMOTE
```

Expected: "OK".

- [ ] **Step 8.3: Validar login como deploy via SSH key**

```bash
ssh -i ~/.ssh/paretto_deploy_ed25519 -o IdentitiesOnly=yes deploy@${VPS_HOST} 'whoami && docker ps'
```

Expected: linha `deploy` + cabeçalho `CONTAINER ID IMAGE …`.

---

## Task 9: Hardening do sshd

**Files:** na VPS, `/etc/ssh/sshd_config`.

- [ ] **Step 9.1: Backup + desabilitar PasswordAuthentication e PermitRootLogin**

```bash
ssh root@${VPS_HOST} 'bash -s' <<'REMOTE'
set -euo pipefail
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.$(date +%Y%m%d)

# Remove linhas conflitantes existentes
sed -i.tmp -E 's/^[#[:space:]]*PasswordAuthentication[[:space:]].*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i.tmp -E 's/^[#[:space:]]*PermitRootLogin[[:space:]].*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config

# Garante presenca das linhas (append se ausente)
grep -q "^PasswordAuthentication no" /etc/ssh/sshd_config || echo "PasswordAuthentication no" >> /etc/ssh/sshd_config
grep -q "^PermitRootLogin" /etc/ssh/sshd_config || echo "PermitRootLogin prohibit-password" >> /etc/ssh/sshd_config

# Validar config
sshd -t && echo "sshd config OK"
REMOTE
```

Expected: "sshd config OK".

Nota sobre `PermitRootLogin prohibit-password`: continua permitindo login root **via key** (caso de emergência), mas bloqueia password. Mais seguro que `yes`, menos restritivo que `no` (que poderia te trancar fora se a chave do deploy parar de funcionar).

- [ ] **Step 9.2: Restart sshd**

```bash
ssh root@${VPS_HOST} 'systemctl restart sshd && systemctl status sshd --no-pager | head -10'
```

Expected: status `active (running)`.

- [ ] **Step 9.3: Validar que login com password está bloqueado**

```bash
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -o NumberOfPasswordPrompts=1 -o ConnectTimeout=5 root@${VPS_HOST} 'echo "ERROR: password login worked"' 2>&1 | tail -3
```

Expected: mensagem do tipo `Permission denied (publickey)` ou similar. **Não** ver "ERROR: password login worked".

- [ ] **Step 9.4: Validar que login com key ainda funciona**

```bash
ssh -i ~/.ssh/paretto_deploy_ed25519 -o IdentitiesOnly=yes deploy@${VPS_HOST} 'echo "deploy key still works"'
```

Expected: "deploy key still works".

---

## Task 10: Configurar firewall (ufw)

**Files:** nenhum no repo. Operação na VPS.

- [ ] **Step 10.1: Instalar ufw se necessário + configurar**

```bash
ssh root@${VPS_HOST} 'bash -s' <<'REMOTE'
set -euo pipefail
if ! command -v ufw >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq ufw
fi

# IMPORTANTE: permitir 22 ANTES de enable, senao trava SSH
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw default deny incoming
ufw default allow outgoing

# --force evita prompt interativo no enable
ufw --force enable
ufw status verbose
REMOTE
```

Expected: linhas mostrando regras `22/tcp ALLOW`, `80/tcp ALLOW`, `443/tcp ALLOW`, default `deny (incoming)` / `allow (outgoing)`, status `active`.

- [ ] **Step 10.2: Validar SSH ainda funciona**

```bash
ssh -i ~/.ssh/paretto_deploy_ed25519 -o IdentitiesOnly=yes deploy@${VPS_HOST} 'echo "ssh after ufw OK"'
```

Expected: "ssh after ufw OK".

---

## Task 11: Criar `/opt/paretto/` + SCP do compose

**Files:**
- `/opt/paretto/docker-compose.production.yml` (VPS, via scp)

- [ ] **Step 11.1: Criar diretório com owner correto**

```bash
ssh root@${VPS_HOST} 'mkdir -p /opt/paretto && chown deploy:deploy /opt/paretto && ls -ld /opt/paretto'
```

Expected: `drwxr-xr-x ... deploy deploy ... /opt/paretto`.

- [ ] **Step 11.2: SCP do compose de prod**

```bash
scp -i ~/.ssh/paretto_deploy_ed25519 docker-compose.production.yml deploy@${VPS_HOST}:/opt/paretto/
ssh -i ~/.ssh/paretto_deploy_ed25519 deploy@${VPS_HOST} 'ls -la /opt/paretto/'
```

Expected: arquivo `docker-compose.production.yml` listado em `/opt/paretto/`, owner `deploy:deploy`.

---

## Task 12: Criar `/opt/paretto/.env` com `LETSENCRYPT_EMAIL`

**Files:**
- `/opt/paretto/.env` (VPS, criado manualmente)

- [ ] **Step 12.1: Definir email do Let's Encrypt**

Escolher um email válido (preferencialmente do owner do domínio). Será usado para notificações de expiração de cert pela Let's Encrypt.

Sugestão: `arielhenrique3@gmail.com` (já é o git user do projeto).

- [ ] **Step 12.2: Criar `.env` na VPS via SSH (sem expor email em historico local)**

```bash
ssh -i ~/.ssh/paretto_deploy_ed25519 deploy@${VPS_HOST} 'bash -s' <<'REMOTE'
set -euo pipefail
read -r -p "Email para Let's Encrypt: " EMAIL
cat > /opt/paretto/.env <<EOF
LETSENCRYPT_EMAIL=${EMAIL}
NODE_ENV=production
PORT=3000
LLM_PROVIDER=mock
EOF
chmod 600 /opt/paretto/.env
echo "---"
cat /opt/paretto/.env
echo "---"
ls -la /opt/paretto/.env
REMOTE
```

Expected: o `read` te pede o email interativamente; depois exibe `.env` com `LETSENCRYPT_EMAIL=...`, `NODE_ENV=production`, `PORT=3000`, `LLM_PROVIDER=mock`. Permissões `-rw-------` (600), owner `deploy`.

Alternativa não-interativa (se você está confortável em digitar inline):
```bash
EMAIL="arielhenrique3@gmail.com"
ssh -i ~/.ssh/paretto_deploy_ed25519 deploy@${VPS_HOST} "cat > /opt/paretto/.env <<EOF
LETSENCRYPT_EMAIL=${EMAIL}
NODE_ENV=production
PORT=3000
LLM_PROVIDER=mock
EOF
chmod 600 /opt/paretto/.env && ls -la /opt/paretto/.env"
```

---

## Task 13: Capturar `known_hosts` + configurar GH Secrets

**Files:** secrets no GitHub (repo `ariielm/paretto-learner-saas`).

- [ ] **Step 13.1: Capturar fingerprint da VPS**

```bash
ssh-keyscan -H "${VPS_HOST}" 2>/dev/null > /tmp/paretto_known_hosts
cat /tmp/paretto_known_hosts | head -5
```

Expected: 1-3 linhas começando com hash `|1|...|...= ssh-ed25519 ...` (uma por tipo de chave: rsa, ed25519, ecdsa).

- [ ] **Step 13.2: Setar os 4 GH Secrets via `gh` CLI**

```bash
# VPS_HOST
echo -n "${VPS_HOST}" | gh secret set VPS_HOST --repo ariielm/paretto-learner-saas

# VPS_USER (sempre 'deploy')
echo -n "deploy" | gh secret set VPS_USER --repo ariielm/paretto-learner-saas

# VPS_SSH_KEY (private key do deploy gerada na Task 8)
gh secret set VPS_SSH_KEY --repo ariielm/paretto-learner-saas < ~/.ssh/paretto_deploy_ed25519

# VPS_KNOWN_HOSTS
gh secret set VPS_KNOWN_HOSTS --repo ariielm/paretto-learner-saas < /tmp/paretto_known_hosts

# Listar para conferir
gh secret list --repo ariielm/paretto-learner-saas
```

Expected: lista mostrando `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS` com timestamp "Updated... seconds ago".

- [ ] **Step 13.3: Limpar `known_hosts` temporário**

```bash
rm /tmp/paretto_known_hosts
```

---

## Task 14: Smoke test manual end-to-end (validar stack antes de delegar ao CI)

**Files:** nenhum novo. Operações locais + na VPS.

Esta task simula o que o CI vai fazer, mas manualmente. Se algo der errado, é mais fácil debugar antes de envolver o GH Actions.

- [ ] **Step 14.1: Login local no GHCR**

```bash
gh auth token | docker login ghcr.io -u ariielm --password-stdin
```

Expected: "Login Succeeded".

- [ ] **Step 14.2: Build local + tag para GHCR com tag de teste**

```bash
TEST_TAG="test-$(date +%Y%m%d-%H%M%S)"
docker build -t ghcr.io/ariielm/paretto-learner-saas:${TEST_TAG} .
docker images | grep paretto-learner-saas | head -3
echo "TEST_TAG=${TEST_TAG}"
```

Expected: build OK, imagem listada, `TEST_TAG=test-...` registrado mentalmente.

- [ ] **Step 14.3: Push do tag de teste para GHCR**

```bash
docker push ghcr.io/ariielm/paretto-learner-saas:${TEST_TAG}
```

Expected: push completo, sem erro `denied`.

- [ ] **Step 14.4: SSH na VPS e fazer pull + up manual**

```bash
ssh -i ~/.ssh/paretto_deploy_ed25519 deploy@${VPS_HOST} bash -s <<REMOTE
set -euo pipefail
cd /opt/paretto
echo "${TEST_TAG}" > .current_tag
TAG="${TEST_TAG}" docker compose -f docker-compose.production.yml pull
TAG="${TEST_TAG}" docker compose -f docker-compose.production.yml up -d --remove-orphans
echo "---"
docker compose -f docker-compose.production.yml ps
REMOTE
```

Expected: 3 containers listados (`nginx-proxy`, `acme-companion`, `paretto-app`), status `Up`.

- [ ] **Step 14.5: Esperar `acme-companion` emitir cert (primeiro deploy demora ~30-60s)**

```bash
ssh -i ~/.ssh/paretto_deploy_ed25519 deploy@${VPS_HOST} 'docker logs -f acme-companion 2>&1 | head -50' &
LOG_PID=$!
sleep 60
kill ${LOG_PID} 2>/dev/null || true
```

Expected nos logs: linhas como `Creating/renewal of certificates for irischef.tech`, `... Success`, possivelmente `Reloading nginx-proxy`. Se aparecer erro de rate limit do Let's Encrypt, **parar e contatar dev** (workaround: ACME_CA_URI staging).

- [ ] **Step 14.6: Rodar smoke test local apontando para irischef.tech**

```bash
./.github/scripts/smoke-test.sh https://irischef.tech
```

Expected: linhas `Smoke 1/3 ... ok`, `Smoke 2/3 ... 200`, `Smoke 3/3 ... TLS OK`, `Smoke test PASSED`.

Se falhar:
- 1/3 (`/health`): verificar que app subiu — `ssh ... docker logs paretto-app | tail -20`.
- 2/3 (`/`): mesmo + verificar que home page existe (espera-se sim, é scaffold padrão do Next).
- 3/3 (TLS): verificar que `acme-companion` terminou de emitir — `ssh ... docker logs acme-companion | tail -20`. Pode precisar esperar mais 30-60s.

- [ ] **Step 14.7: Verificar via browser (opcional, sanidade)**

Abrir `https://irischef.tech/health` no browser. Esperado: JSON `{"status":"ok","version":"0.1.0-dev"}` com cadeado verde.

---

## Task 15: Cleanup do teste manual

**Files:** nenhum.

- [ ] **Step 15.1: Apagar a tag de teste do GHCR (opcional mas limpo)**

```bash
# Lista versions da package
gh api -X GET "/users/ariielm/packages/container/paretto-learner-saas/versions" --jq '.[] | {id, name, created_at}' | head -20
```

Expected: lista de versions; identifique a com nome contendo o `TEST_TAG`.

Para deletar a versão de teste (substitua `<VERSION_ID>` pelo id retornado):
```bash
gh api -X DELETE "/users/ariielm/packages/container/paretto-learner-saas/versions/<VERSION_ID>"
```

Se preferir manter (não custa nada e serve de histórico), pular esse passo.

- [ ] **Step 15.2: Estado atual da VPS pode ficar como está**

O container `paretto-app` rodando com `TEST_TAG` é o estado atual. Quando o primeiro deploy automatizado rodar (Task 16), ele vai substituir por `sha-<short>` da `main`. Sem ação necessária.

---

## Task 16: Merge `feat/0005-deploy` na `main` + observar primeiro deploy automatizado

**Files:** nenhum.

- [ ] **Step 16.1: Garantir que branch tem CI verde**

```bash
gh run list --branch feat/0005-deploy --limit 1 --json conclusion,status,workflowName
```

Expected: `conclusion: success`, `status: completed`. Se não, esperar.

- [ ] **Step 16.2: Fast-forward merge na main**

```bash
git checkout main
git pull origin main
git merge --ff-only feat/0005-deploy
git log --oneline -5
```

Expected: HEAD da main avança para o último commit da feat. Linear history preservada.

- [ ] **Step 16.3: Push da main (dispara CI completo incluindo job deploy)**

```bash
git push origin main
```

Expected: push aceito. Branch protection passa porque o último commit já tem `build-and-test` verde (rodou na branch). Aviso "Required status check 'build-and-test' is expected" para o job deploy é normal (ele vai rodar agora).

- [ ] **Step 16.4: Observar o run completo (build-and-test + deploy)**

```bash
gh run watch
```

Expected: workflow `CI` roda 2 jobs:
1. `build-and-test` — passa (idêntico ao da branch).
2. `deploy` — builda, push GHCR, SSH na VPS, pull, up, smoke test. Termina verde.

Se `deploy` falhar:
- **Falha em "Build and push to GHCR"**: provável problema de permissão no `GITHUB_TOKEN`. Verificar `permissions: packages: write` no job.
- **Falha em "Deploy to VPS"**: SSH falhou. Re-verificar secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`. Pode ser `known_hosts` malformado.
- **Falha em "Smoke test"**: rollback automático rodou. Investigar logs do app na VPS (`ssh ... docker logs paretto-app`). Após corrigir, fazer novo commit para re-disparar.

- [ ] **Step 16.5: Verificar manualmente que prod está respondendo**

```bash
curl -sS -i https://irischef.tech/health
curl -sS -o /dev/null -w "%{http_code}\n" https://irischef.tech/
```

Expected: `200 OK` + JSON `{"status":"ok",...}` para `/health`; `200` para `/`.

- [ ] **Step 16.6: Verificar tag corrente na VPS**

```bash
ssh -i ~/.ssh/paretto_deploy_ed25519 deploy@${VPS_HOST} 'cat /opt/paretto/.current_tag /opt/paretto/.last_tag'
```

Expected: `.current_tag` = `sha-<short do commit de merge>`. `.last_tag` = o `TEST_TAG` da Task 14 (ou ausente se você limpou).

---

## Task 17: Atualizar foundation design (reescopo da spec 016)

**Files:**
- Modify: `docs/superpowers/specs/2026-05-20-saas-foundation-design.md`

- [ ] **Step 17.1: Localizar a linha da spec 016 no backlog (Seção 4)**

```bash
grep -n "016" docs/superpowers/specs/2026-05-20-saas-foundation-design.md
```

Expected: linha tipo `| 016 | **Ops de Produção** | ... |`.

- [ ] **Step 17.2: Substituir descrição da 016**

Editar a linha da 016 trocando a descrição atual por:

`| 016 | **Hardening de Ops** | Backup automatizado do DB, log rotation/centralização, runbook completo (rollback manual, restore, debug em prod, migração de VPS), dashboard de saúde, cleanup de tags antigas no GHCR, hardening adicional (fail2ban, auto-updates de OS). Pressupõe spec 000.5 (Deploy Contínuo) já implementada. |`

- [ ] **Step 17.3: Adicionar nota sobre 000.5 logo após a tabela de Fase A do backlog**

Localizar a tabela "Fase A — Foundation" e adicionar abaixo dela um parágrafo:

```markdown
> **Nota — Spec 000.5 (Deploy Contínuo + Smoke Test):** inserida após esse design ser escrito para antecipar uma fatia fina da spec 016, viabilizando deploy a cada merge desde 001. Detalhes em `docs/superpowers/specs/2026-05-24-spec-0005-deploy-continuo-design.md`. A spec 016 foi reescopada como "Hardening de Ops".
```

- [ ] **Step 17.4: Commit**

```bash
git add docs/superpowers/specs/2026-05-20-saas-foundation-design.md
git commit -m "docs(foundation): rescope spec 016 + insert 000.5 note

Spec 000.5 (Deploy Continuo + Smoke Test em Producao) foi adicionada
ao backlog apos esse design fundacional ser escrito. Ela antecipa uma
fatia fina do que era a spec 016 (Ops de Producao), para viabilizar
deploy automatico desde o inicio.

Spec 016 reescopada para 'Hardening de Ops' (backup, runbook, log
centralizado, dashboard de saude, hardening avancado) -- o que NAO
coube na fatia fina da 000.5."
git push origin main
```

Expected: push aceito (admin bypass aceitavel para doc).

---

## Task 18: Atualizar memórias + CLAUDE.md

**Files:**
- Modify: `/Users/ariielm/.claude/projects/-Users-ariielm-dev-projects-paretto-learner-saas/memory/project_paretto_saas_status.md`
- Modify: `/Users/ariielm/.claude/projects/-Users-ariielm-dev-projects-paretto-learner-saas/memory/MEMORY.md`

- [ ] **Step 18.1: Atualizar status do projeto**

Editar `project_paretto_saas_status.md`:

- No campo `description` do frontmatter, substituir por:
  ```
  description: "Paretto SaaS — specs 000 e 000.5 IMPLEMENTADAS. Deploy contínuo ativo em https://irischef.tech. Próximo: specs 001 (Domínio) e 002 (LLM Gateway)."
  ```
- No corpo do "Estado atual", adicionar bullet:
  ```
  - Spec 000.5 (Deploy Contínuo + Smoke Test em Produção) IMPLEMENTADA em <YYYY-MM-DD>. `https://irischef.tech/health` responde 200 OK com TLS válido. Merge na `main` dispara deploy automatizado (CI → GHCR → SSH → docker compose pull && up → smoke test → rollback se falhar).
  ```
- Em "Decisões já consolidadas (NÃO re-perguntar)", adicionar:
  ```
  - Deploy: pipeline CI → GHCR → SSH na VPS via job `deploy` no `.github/workflows/ci.yml`. Stack na VPS = `nginx-proxy` + `acme-companion` + `app` em `/opt/paretto/docker-compose.production.yml`. TLS Let's Encrypt automático.
  - VPS user para deploy: `deploy` (não-root, group docker), SSH key dedicada em `~/.ssh/paretto_deploy_ed25519` (local) e GH Secret `VPS_SSH_KEY`.
  - Secrets reais (`.env` em prod): manuais na VPS em `/opt/paretto/.env`, owner `deploy:deploy` chmod 600. CI nunca toca.
  - Rollback: automático na falha do smoke test, restaura `TAG=$(cat .last_tag)` via `docker compose up -d`.
  ```

- [ ] **Step 18.2: Atualizar MEMORY.md index**

Substituir a linha do status para refletir o novo estado:

```markdown
- [Status do projeto + decisões consolidadas](project_paretto_saas_status.md) — specs 000 e 000.5 IMPLEMENTADAS; deploy contínuo ativo; próximo são specs 001 e 002.
```

- [ ] **Step 18.3: Atualizar CLAUDE.md (instrução pro próximo agente)**

Em `/Users/ariielm/dev/projects/paretto-learner-saas/CLAUDE.md`, adicionar logo após a linha existente:

```markdown
Deploy continuo ativo: merge em main publica para https://irischef.tech via
GitHub Actions (job `deploy`). Stack de prod em docker-compose.production.yml.
```

Commit:

```bash
cd /Users/ariielm/dev/projects/paretto-learner-saas
git add CLAUDE.md
git commit -m "docs: note deploy contínuo no CLAUDE.md"
git push origin main
```

---

## Task 19: Validar critérios de aceite + cleanup branch

**Files:** nenhum.

- [ ] **Step 19.1: Critério 1 — `/health` retorna 200 + JSON**

```bash
curl -sS https://irischef.tech/health | jq '.'
```

Expected: `{"status":"ok","version":"0.1.0-dev"}`.

- [ ] **Step 19.2: Critério 2 — `/` retorna 200**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://irischef.tech/
```

Expected: `200`.

- [ ] **Step 19.3: Critério 3 — cert TLS válido**

```bash
echo | openssl s_client -servername irischef.tech -connect irischef.tech:443 -verify_return_error 2>&1 | grep -E "(Verify return code|issuer)"
```

Expected: `Verify return code: 0 (ok)` + linha `issuer=...Let's Encrypt...`.

- [ ] **Step 19.4: Critério 4 — push em main dispara deploy automático (já validado na Task 16)**

```bash
gh run list --branch main --limit 1 --json conclusion,workflowName
```

Expected: `conclusion: success`, último run do `CI`.

- [ ] **Step 19.5: Critério 5 — rollback existe (smoke do mecanismo, opcional)**

Smoke do rollback é arriscado em prod. Documentado como exercício futuro (entra na spec 016 como "validar rollback periodicamente"). Para esta spec, basta que o step `Rollback on smoke failure` esteja presente no workflow:

```bash
grep -A 5 "Rollback on smoke failure" .github/workflows/ci.yml
```

Expected: bloco com `if: failure() && steps.smoke.conclusion == 'failure'` visível.

- [ ] **Step 19.6: Critério 6 — foundation design atualizado (validado na Task 17)**

```bash
grep -A 2 "Hardening de Ops" docs/superpowers/specs/2026-05-20-saas-foundation-design.md
```

Expected: linha com a nova descrição da 016.

- [ ] **Step 19.7: Cleanup da branch local e remota**

```bash
git checkout main
git pull origin main
git branch -d feat/0005-deploy
git push origin --delete feat/0005-deploy
```

Expected: branch local e remota deletadas.

- [ ] **Step 19.8: Marcar spec 000.5 como implementada no design doc**

Editar `docs/superpowers/specs/2026-05-24-spec-0005-deploy-continuo-design.md` adicionando logo após o título:

```markdown
**Status:** implementada em commit `<SHA>` em <YYYY-MM-DD>.
```

Substituir `<SHA>` pelo hash do último commit em main (`git rev-parse --short HEAD`).

Commit:

```bash
git add docs/superpowers/specs/2026-05-24-spec-0005-deploy-continuo-design.md
git commit -m "docs: mark spec 000.5 as implemented"
git push origin main
```

---

## Verificação final

Spec 000.5 está completa quando todos esses são verdadeiros:

1. ✅ `docker-compose.production.yml` existe no repo (raiz).
2. ✅ `.github/scripts/smoke-test.sh` existe e é executável.
3. ✅ `.github/workflows/ci.yml` tem jobs `build-and-test` + `deploy`.
4. ✅ `https://irischef.tech/health` retorna 200 OK + JSON `{status:'ok'}`.
5. ✅ `https://irischef.tech/` retorna 200 OK.
6. ✅ Cert TLS válido (Let's Encrypt, cadeia OK).
7. ✅ Push em `main` dispara CI completo (build-and-test + deploy) e termina verde.
8. ✅ `/opt/paretto/.current_tag` e `/opt/paretto/.last_tag` existem na VPS.
9. ✅ Spec 016 reescopada como "Hardening de Ops" no foundation design.
10. ✅ Memórias e CLAUDE.md atualizados refletindo deploy contínuo ativo.

A partir daqui, **specs 001 (Domínio) e 002 (LLM Gateway)** podem rolar em paralelo e, ao serem mergeadas em `main`, sobem para prod automaticamente.

---

## Self-Review checklist (executado pelo autor do plano)

- **Spec coverage:** cada item da Seção 1.5 do design doc tem task neste plano? Critério 1 (200 + JSON `/health`) ✅ Task 19.1. Critério 2 (home 200) ✅ Task 19.2. Critério 3 (TLS válido) ✅ Task 19.3. Critério 4 (deploy automático) ✅ Tasks 4, 16, 19.4. Critério 5 (rollback em falha) ✅ Tasks 4, 19.5. Critério 6 (foundation atualizado) ✅ Tasks 17, 19.6.
- **Placeholder scan:** placeholders intencionais limitados a `<SHA>` na Task 19.8 (preenchido em runtime) e `${VPS_HOST}` em vários comandos (assumido como env var do executor, documentado nos pré-requisitos). Sem `TBD`/`TODO`.
- **Type consistency:** nomes consistentes — `feat/0005-deploy` em Tasks 1, 5, 16, 19. Secrets `VPS_HOST`/`VPS_USER`/`VPS_SSH_KEY`/`VPS_KNOWN_HOSTS` consistentes entre Tasks 4 e 13. Path `/opt/paretto/` consistente em todas as referências VPS.
- **Spec 016 reescopo:** a Task 17 atualiza o foundation design conforme prometido na Seção 1.2 do design doc da 000.5.
