#!/usr/bin/env bash
set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}${CYAN}========================================${RESET}"
echo -e "${BOLD}${CYAN}   Agent Bahmni — First-Time Setup${RESET}"
echo -e "${BOLD}${CYAN}========================================${RESET}"
echo ""

# ── 1. Anthropic API key ──────────────────────────────────────────────────────

AI_CONFIG="ai-config.json"
CURRENT_KEY=$(node -e "try{const c=require('./$AI_CONFIG');process.stdout.write(c.anthropicApiKey||'')}catch(e){}" 2>/dev/null || echo "")

if [ -z "$CURRENT_KEY" ] || [ "$CURRENT_KEY" = "YOUR_ANTHROPIC_API_KEY_HERE" ]; then
  echo -e "${BOLD}Step 1: Anthropic API key${RESET}"
  echo -e "Get your key at ${CYAN}https://console.anthropic.com${RESET}"
  echo ""
  read -rp "  Enter your Anthropic API key (sk-ant-...): " API_KEY
  if [ -z "$API_KEY" ]; then
    echo -e "${YELLOW}  Warning: no key entered. Skipping — you can update $AI_CONFIG manually.${RESET}"
  else
    node -e "
      const fs = require('fs');
      const config = { anthropicApiKey: '$API_KEY' };
      fs.writeFileSync('$AI_CONFIG', JSON.stringify(config, null, 2) + '\n');
      console.log('  \u2713 Saved to $AI_CONFIG');
    "
  fi
else
  echo -e "${GREEN}  \u2713 Anthropic API key already set in $AI_CONFIG${RESET}"
fi
echo ""

# ── 2. Frontend dependencies ──────────────────────────────────────────────────

echo -e "${BOLD}Step 2: Frontend dependencies${RESET}"
if [ ! -d "node_modules" ]; then
  echo "  Running yarn install..."
  yarn --silent
  echo -e "${GREEN}  \u2713 Dependencies installed${RESET}"
else
  echo -e "${GREEN}  \u2713 node_modules already present (skip yarn install)${RESET}"
fi
echo ""

# ── 3. Whisper STT server (optional) ─────────────────────────────────────────

echo -e "${BOLD}Step 3: Local Whisper STT server (optional)${RESET}"
echo "  The Whisper server replaces Chrome's cloud Speech API — useful on"
echo "  networks that block external STT services."
echo ""
read -rp "  Set up local Whisper STT server? [y/N]: " SETUP_WHISPER
SETUP_WHISPER="${SETUP_WHISPER:-n}"

if [[ "$SETUP_WHISPER" =~ ^[Yy]$ ]]; then
  # Check Python
  if ! command -v python3 &>/dev/null; then
    echo -e "${YELLOW}  Warning: python3 not found. Install Python 3.11+ and re-run.${RESET}"
  else
    echo ""
    echo "  Whisper model sizes:"
    echo "    tiny   — fastest, least accurate (~75MB)"
    echo "    small  — good balance, recommended (~465MB)  [default]"
    echo "    medium — more accurate, slower (~1.5GB)"
    echo "    large  — most accurate, slowest (~3GB)"
    echo ""
    read -rp "  Choose model size [small]: " WHISPER_MODEL
    WHISPER_MODEL="${WHISPER_MODEL:-small}"

    # Write .env for whisper server
    echo "WHISPER_MODEL=$WHISPER_MODEL" > whisper-server/.env
    echo -e "${GREEN}  \u2713 Whisper model set to '$WHISPER_MODEL' (saved in whisper-server/.env)${RESET}"

    echo ""
    read -rp "  Install Python dependencies now? [Y/n]: " INSTALL_PY
    INSTALL_PY="${INSTALL_PY:-y}"
    if [[ "$INSTALL_PY" =~ ^[Yy]$ ]]; then
      echo "  Running pip install..."
      pip3 install -r whisper-server/requirements.txt -q
      echo -e "${GREEN}  \u2713 Python dependencies installed${RESET}"
    fi
  fi
else
  echo "  Skipped — the agent will fall back to the browser's Web Speech API."
fi
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────

echo -e "${BOLD}${GREEN}Setup complete!${RESET}"
echo ""
echo -e "  ${BOLD}To start the app:${RESET}"
echo ""

if [[ "$SETUP_WHISPER" =~ ^[Yy]$ ]]; then
  echo "    # Terminal 1 — Whisper STT server"
  echo "    cd whisper-server && python3 server.py"
  echo ""
fi

echo "    # Terminal 2 — Frontend dev server (includes Anthropic proxy)"
echo "    yarn dev"
echo ""
echo "  Then open ${CYAN}http://localhost:3000${RESET} and click the microphone icon in the header."
echo ""
