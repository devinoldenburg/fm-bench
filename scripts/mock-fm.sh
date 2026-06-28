#!/usr/bin/env bash
# Minimal fm stub for fm-bench off macOS (see AGENTS.md). Usage:
#   FM_BIN="$(pwd)/scripts/mock-fm.sh" node bin/fm-bench.js --models system --runs 2 --profile quick
set -euo pipefail

cmd="${1:-}"
shift || true

case "$cmd" in
  --help|-h|'')
    cat <<'EOF'
Apple Foundation Models CLI (mock)

MODELS
  system        On-device Apple Foundation Model (default)
  pcc           Apple Foundation Model on Private Cloud Compute

USAGE
  fm respond --model <model>
  fm available --model <model>
  fm quota-usage --model <model>
  fm token-count --quiet
EOF
    exit 0
    ;;
  available)
    model=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --model) model="$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    echo "System model available: ${model:-system}"
    exit 0
    ;;
  quota-usage)
    echo "quota: 1000 remaining"
    exit 0
    ;;
  token-count)
    wc -c | awk '{print int($1/4)+1}'
    exit 0
    ;;
  respond)
    model="system"
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --model) model="$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    prompt="$(cat)"
    words="$(echo "$prompt" | wc -w | tr -d ' ')"
    i=0
    while [[ $i -lt $words ]]; do
      echo -n "token "
      i=$((i + 1))
    done
    echo "ok from mock-fm model=$model"
    exit 0
    ;;
  *)
    echo "mock-fm: unknown command $cmd" >&2
    exit 1
    ;;
esac