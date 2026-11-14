#!/usr/bin/env bash
# Usage: bash games/gnaft/snap.sh <scenario> <out.png> [port]
# Screenshots the running dev server in a debug scenario (see runSnap in src/selftest.ts).
set -u
SCEN="${1:-raft}"; OUT="${2:?out.png}"; PORT="${3:-5183}"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
PROFILE="$(mktemp -d)"
timeout 90 "$EDGE" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --user-data-dir="$PROFILE" \
  --window-size=1280,720 --virtual-time-budget=3000 --screenshot="$OUT" "http://localhost:$PORT/#snap=$SCEN" 2>/dev/null
rm -rf "$PROFILE"
