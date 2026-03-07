#!/usr/bin/env bash
set -euo pipefail

CYAN='\033[0;36m'
ORANGE='\033[0;33m'
RESET='\033[0m'
BOLD='\033[1m'

ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

prefix_lines() {
  local color="$1"
  local label="$2"
  while IFS= read -r line; do
    printf "${color}${BOLD}[%s]${RESET} %s\n" "$label" "$line"
  done
}

echo -e "${ORANGE}${BOLD}[backend]${RESET} building..."
cd "$ROOT/backend" && cargo build -q 2>&1 | prefix_lines "$ORANGE" "backend"

echo -e "${CYAN}${BOLD}[frontend]${RESET} installing deps..."
cd "$ROOT/frontend" && npm install --silent 2>&1 | prefix_lines "$CYAN" "frontend"

echo ""
echo -e "  ${ORANGE}${BOLD}backend${RESET}  → http://localhost:3000"
echo -e "  ${CYAN}${BOLD}frontend${RESET} → http://localhost:5173"
echo ""

cd "$ROOT/backend" && cargo run -q 2>&1 | prefix_lines "$ORANGE" "backend" &
BACKEND_PID=$!

cd "$ROOT/frontend" && npm run dev 2>&1 | prefix_lines "$CYAN" "frontend" &
FRONTEND_PID=$!

wait
