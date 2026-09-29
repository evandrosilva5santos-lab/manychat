#!/usr/bin/env bash
# ECC Quality Gate Verification Script
# Executa a verificação Level 1 e Level 2 automaticamente

set -e

echo "🔍 [ECC] Executando verificação de qualidade..."

echo "1/2 Verificando tipos TypeScript..."
npx tsc --noEmit

echo "2/2 Executando suíte de testes Vitest..."
npm test

echo "✅ [ECC Quality Gate] Todos os checks passaram com sucesso!"
