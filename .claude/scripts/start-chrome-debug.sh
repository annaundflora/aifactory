#!/bin/bash
# Start Chrome with remote debugging for MCP DevTools
# Usage: bash .claude/scripts/start-chrome-debug.sh

CHROME_PATH="/c/Program Files/Google/Chrome/Application/chrome.exe"
DEBUG_PORT=9222
USER_DATA_DIR="$TEMP/chrome-debug-profile"

echo "Starting Chrome with remote debugging on port $DEBUG_PORT..."
"$CHROME_PATH" \
  --remote-debugging-port=$DEBUG_PORT \
  --user-data-dir="$USER_DATA_DIR" \
  --no-first-run \
  --no-default-browser-check \
  "http://localhost:3000" &

echo "Chrome started. DevTools MCP can connect via http://127.0.0.1:$DEBUG_PORT"
