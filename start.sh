#!/bin/bash
# ============================================
# Aetheria AI – Startskript
# ============================================
# Starte dieses Skript mit:   bash start.sh
# Stoppen mit:                 Strg+C (Ctrl+C)
# ============================================

# In das Verzeichnis wechseln, in dem dieses Skript liegt
cd "$(dirname "$0")" || exit 1

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║        AETHERIA AI – RPG Server      ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# .env automatisch erstellen, wenn sie noch nicht existiert
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "  ┌──────────────────────────────────────┐"
    echo "  │  .env Datei wurde automatisch         │"
    echo "  │  erstellt aus .env.example             │"
    echo "  │                                        │"
    echo "  │  Fuer echte KI: Oeffne die .env Datei  │"
    echo "  │  und trage deinen API-Key ein.         │"
    echo "  │                                        │"
    echo "  │  Ohne API-Key laeuft die App im        │"
    echo "  │  Demo-Modus mit vorgeschriebenen       │"
    echo "  │  Texten.                               │"
    echo "  └──────────────────────────────────────┘"
    echo ""
  fi
fi

# Abhaengigkeiten installieren falls node_modules fehlt
if [ ! -d node_modules ]; then
  echo "  Installiere Abhaengigkeiten (npm install)..."
  echo ""
  npm install
  echo ""
fi

# Server starten
echo "  Server startet auf http://localhost:4000"
echo "  Frontend startet auf http://localhost:3000"
echo ""
echo "  Oeffne im Browser: http://localhost:3000"
echo ""
echo "  Zum Stoppen: Strg+C druecken"
echo ""

# Beide Services parallel starten
npx concurrently \
  --names "SERVER,CLIENT" \
  --prefix-colors "blue,green" \
  "npx tsx server/src/index.ts" \
  "npx vite client --port 3000"
