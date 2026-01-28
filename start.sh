#!/bin/bash
# ============================================
# Aetheria AI – Startskript
# ============================================
# Starte dieses Skript mit:   bash start.sh
# Stoppen mit:                 Strg+C (Ctrl+C)
# ============================================

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║        AETHERIA AI – RPG Server      ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Server starten
echo "  Server startet auf http://localhost:4000"
echo "  Frontend startet auf http://localhost:3000"
echo ""
echo "  Öffne im Browser: http://localhost:3000"
echo ""
echo "  Zum Stoppen: Strg+C drücken"
echo ""

# Beide Services parallel starten
npx concurrently \
  --names "SERVER,CLIENT" \
  --prefix-colors "blue,green" \
  "npx tsx server/src/index.ts" \
  "npx vite client --port 3000"
