#!/usr/bin/env bash
# Bootstrap do ambiente de desenvolvimento do PATRIUM OS.
#
# Por que existe: o sandbox onde o projeto é validado reinicia de vez em quando e
# perde tudo que não está versionado — Bun, node_modules e até o .git. Os
# arquivos-fonte persistem (estão no workspace), então recuperar é barato desde
# que ninguém precise redescobrir a ordem dos comandos.
#
# Uso:  bash scripts/bootstrap.sh
set -euo pipefail

REPO_URL="https://github.com/Implantac/screenshot-perfect-clone-199.git"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# 1. Bun
if ! command -v bun >/dev/null 2>&1 && [ ! -x "$HOME/.bun/bin/bun" ]; then
  echo "→ instalando Bun"
  curl -fsSL https://bun.sh/install | bash >/dev/null 2>&1
fi
export PATH="$HOME/.bun/bin:$PATH"
echo "→ bun $(bun --version)"

# 2. Dependências
if [ ! -d node_modules ]; then
  echo "→ instalando dependências (frozen lockfile)"
  bun install --frozen-lockfile >/dev/null
fi
echo "→ node_modules: $(ls node_modules | wc -l) pacotes"

# 3. Git (o .git pode ter sido perdido; o conteúdo já está no workspace)
if [ ! -d .git ]; then
  echo "→ recuperando histórico do remoto"
  tmp="$(mktemp -d)"
  git clone --quiet "$REPO_URL" "$tmp/repo"
  mv "$tmp/repo/.git" .git
  rm -rf "$tmp"
  git config user.email "agent@patrium.os"
  git config user.name "PATRIUM Agent"
fi
echo "→ HEAD: $(git log --oneline -1)"

# 4. Sanidade
bun run typecheck >/dev/null 2>&1 && echo "→ typecheck ok" || echo "→ typecheck FALHOU"
echo "✔ pronto (bun test · bun run build:lowmem · bun run check:schema)"
