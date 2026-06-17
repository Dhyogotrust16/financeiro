#!/bin/sh
# Sobe o sistema inteiro numa única porta (4000)
# 1. Builda o frontend
# 2. Builda o backend
# 3. Inicia o Express que serve os dois

set -e

echo "==> Buildando frontend..."
cd artifacts/financeiro
npm run build
cd ../..

echo "==> Buildando backend..."
cd artifacts/api-server
node ./build.mjs

echo "==> Iniciando servidor na porta 4000..."
exec node --env-file=.env --enable-source-maps ./dist/index.mjs
