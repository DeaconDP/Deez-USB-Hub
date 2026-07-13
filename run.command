#!/bin/bash
# Deez USB Hub — one-click setup + run (macOS / Linux)
# Double-click this file on macOS, or: chmod +x run.command && ./run.command
#
# Note: USB hub topology is Windows-only today (USB-003 elsewhere).
# This launcher still installs deps and starts the Tauri shell for UI work.

set -euo pipefail

cd "$(dirname "$0")"

APP_NAME="Deez USB Hub"
DEV_PORT=1420
PID_FILE=".run/dev.pid"

fail() {
  echo
  echo "ERROR: $1"
  echo "See README.md for full requirements."
  echo
  read -r -p "Press Enter to close..."
  exit 1
}

cleanup_pid() {
  rm -f "$PID_FILE"
}
trap cleanup_pid EXIT INT TERM

echo
echo "=== ${APP_NAME} — one-click setup and run ==="
echo "Project: $(pwd)"
echo

echo "[1/4] Checking Node.js..."
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js is required but was not found on PATH."
  echo "Install it from https://nodejs.org (LTS 20+), then open this file again."
  echo
  if command -v open >/dev/null 2>&1; then
    open "https://nodejs.org" 2>/dev/null || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "https://nodejs.org" 2>/dev/null || true
  fi
  read -r -p "Press Enter to close..."
  exit 1
fi
echo "      Found $(node -v)"

echo "[2/4] Checking Rust..."
export PATH="${HOME}/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:${PATH}"
if ! command -v rustc >/dev/null 2>&1 || ! command -v cargo >/dev/null 2>&1; then
  echo "Rust is required but was not found on PATH."
  echo "Install it from https://rustup.rs , then open this file again."
  echo
  if command -v open >/dev/null 2>&1; then
    open "https://rustup.rs" 2>/dev/null || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "https://rustup.rs" 2>/dev/null || true
  fi
  read -r -p "Press Enter to close..."
  exit 1
fi
echo "      Found $(rustc --version)"
echo

mkdir -p .run

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(tr -d '[:space:]' < "$PID_FILE" || true)"
  if [[ -n "${OLD_PID}" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Stopping previous instance (PID ${OLD_PID})..."
    # Owned PID only — never killall by runtime name.
    pkill -P "$OLD_PID" 2>/dev/null || true
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
    if kill -0 "$OLD_PID" 2>/dev/null; then
      pkill -9 -P "$OLD_PID" 2>/dev/null || true
      kill -9 "$OLD_PID" 2>/dev/null || true
    fi
  fi
  rm -f "$PID_FILE"
fi

if command -v lsof >/dev/null 2>&1; then
  if lsof -iTCP:"${DEV_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
    fail "Port ${DEV_PORT} is already in use by another process. Free it, then try again."
  fi
elif command -v ss >/dev/null 2>&1; then
  if ss -ltn "( sport = :${DEV_PORT} )" 2>/dev/null | grep -q ":${DEV_PORT}"; then
    fail "Port ${DEV_PORT} is already in use by another process. Free it, then try again."
  fi
fi

echo $$ > "$PID_FILE"

echo "[3/4] Installing dependencies..."
npm install || fail "npm install failed."
echo

echo "[4/4] Starting Tauri dev (Vite on http://localhost:${DEV_PORT})..."
echo "First Rust build can take several minutes. Close this window or press Ctrl+C to stop."
case "$(uname -s)" in
  Darwin|Linux)
    echo "Note: full USB hub mapping requires Windows; this platform reports USB-003."
    ;;
esac
echo

set +e
npm run tauri dev
EXIT_CODE=$?
set -e

if [[ "$EXIT_CODE" -ne 0 ]]; then
  fail "tauri dev exited with code ${EXIT_CODE}. Need Node 20+, Rust stable, and a free port ${DEV_PORT}."
fi

exit 0
