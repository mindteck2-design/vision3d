#!/usr/bin/env bash
# Simple start/stop for UI (port 3000) + CAD service (port 8000)
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
CAD_DIR="$ROOT/python/cad_service"
PID_DIR="$ROOT/.run"
CAD_PID="$PID_DIR/cad.pid"
UI_PID="$PID_DIR/ui.pid"
CAD_LOG="$PID_DIR/cad.log"
UI_LOG="$PID_DIR/ui.log"

mkdir -p "$PID_DIR"

ensure_cad() {
  cd "$CAD_DIR"
  if [[ ! -f .venv/bin/activate ]]; then
    echo "Creating Python .venv ..."
    python3 -m venv .venv
  fi
  # shellcheck disable=SC1091
  source .venv/bin/activate
  # check a few required packages
  if ! python -c "import fastapi, uvicorn, cv2, numpy, trimesh, pydantic, pytesseract" 2>/dev/null; then
    echo "Installing Python packages ..."
    pip install -r requirements.txt
  else
    echo "Python packages OK"
  fi
  if ! command -v tesseract >/dev/null 2>&1; then
    echo "Note: tesseract-ocr not found (optional for raster OCR). Install: sudo apt install tesseract-ocr"
  fi
}

ensure_ui() {
  cd "$ROOT"
  if ! command -v bun >/dev/null 2>&1; then
    echo "bun not found. Install bun first: https://bun.sh"
    exit 1
  fi
  if [[ ! -d node_modules ]] || [[ ! -d node_modules/vite ]]; then
    echo "Installing UI packages (bun) ..."
    bun install
  else
    echo "UI packages OK"
  fi
}

start() {
  ensure_cad
  ensure_ui

  if [[ -f "$CAD_PID" ]] && kill -0 "$(cat "$CAD_PID")" 2>/dev/null; then
    echo "CAD service already running (pid $(cat "$CAD_PID"))"
  else
    echo "Starting CAD service on :8000 ..."
    (
      cd "$CAD_DIR"
      # shellcheck disable=SC1091
      source .venv/bin/activate
      exec uvicorn app.main:app --host 0.0.0.0 --port 8000
    ) >"$CAD_LOG" 2>&1 &
    echo $! >"$CAD_PID"
    echo "  CAD pid $(cat "$CAD_PID")  log $CAD_LOG"
  fi

  if [[ -f "$UI_PID" ]] && kill -0 "$(cat "$UI_PID")" 2>/dev/null; then
    echo "UI already running (pid $(cat "$UI_PID"))"
  else
    echo "Starting UI on :3000 ..."
    (
      cd "$ROOT"
      exec bun run dev
    ) >"$UI_LOG" 2>&1 &
    echo $! >"$UI_PID"
    echo "  UI  pid $(cat "$UI_PID")  log $UI_LOG"
  fi

  echo
  echo "UI:  http://127.0.0.1:3000"
  echo "CAD: http://127.0.0.1:8000/health"
  echo "Stop with: ./vision3d.sh stop"
}

stop() {
  for name in CAD UI; do
    case $name in
      CAD) f="$CAD_PID" ;;
      UI)  f="$UI_PID" ;;
    esac
    if [[ -f "$f" ]]; then
      pid=$(cat "$f")
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        echo "Stopped $name (pid $pid)"
      else
        echo "$name not running"
      fi
      rm -f "$f"
    else
      echo "$name not running"
    fi
  done
  fuser -k 8000/tcp 2>/dev/null || true
  fuser -k 3000/tcp 2>/dev/null || true
}

status() {
  for name in CAD UI; do
    case $name in
      CAD) f="$CAD_PID"; port=8000 ;;
      UI)  f="$UI_PID";  port=3000 ;;
    esac
    if [[ -f "$f" ]] && kill -0 "$(cat "$f")" 2>/dev/null; then
      echo "$name: running (pid $(cat "$f"), :$port)"
    else
      echo "$name: stopped"
    fi
  done
}

case "${1:-}" in
  start)  start ;;
  stop)   stop ;;
  status) status ;;
  restart) stop; start ;;
  *)
    echo "Usage: $0 {start|stop|status|restart}"
    exit 1
    ;;
esac
