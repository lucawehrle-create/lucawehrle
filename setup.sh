#!/bin/bash
# ============================================
# Aetheria AI – Ersteinrichtung (Setup)
# ============================================
# Dieses Skript hilft dir bei der Einrichtung.
# Starte es mit:   bash setup.sh
# ============================================

# In das Verzeichnis wechseln, in dem dieses Skript liegt
cd "$(dirname "$0")" || exit 1

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║     AETHERIA AI – Ersteinrichtung    ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Schritt 1: Node.js pruefen
echo "  [1/4] Pruefe Node.js..."
if ! command -v node &> /dev/null; then
  echo ""
  echo "  ❌ Node.js ist nicht installiert!"
  echo ""
  echo "  So installierst du Node.js auf dem Mac:"
  echo "    1. Oeffne https://nodejs.org"
  echo "    2. Lade die LTS-Version herunter"
  echo "    3. Installiere die heruntergeladene Datei"
  echo "    4. Starte dieses Skript danach erneut"
  echo ""
  exit 1
fi
NODE_VERSION=$(node --version)
echo "         Node.js $NODE_VERSION gefunden"

# Schritt 2: Abhaengigkeiten installieren
echo ""
echo "  [2/4] Installiere Abhaengigkeiten..."
if [ ! -d node_modules ]; then
  npm install
  if [ $? -ne 0 ]; then
    echo ""
    echo "  ❌ Installation fehlgeschlagen."
    echo "     Bitte pruefe deine Internetverbindung."
    exit 1
  fi
else
  echo "         Bereits installiert"
fi

# Schritt 3: .env Datei erstellen
echo ""
echo "  [3/4] Pruefe .env Konfiguration..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "         .env Datei wurde erstellt"
else
  echo "         .env Datei existiert bereits"
fi

# Schritt 4: API-Key Hinweis
echo ""
echo "  [4/4] API-Key Konfiguration"
echo ""

# Pruefen ob bereits ein Key gesetzt ist
HAS_KEY=false
if [ -f .env ]; then
  if grep -q "ANTHROPIC_API_KEY=sk-" .env 2>/dev/null || \
     grep -q "GEMINI_API_KEY=AI" .env 2>/dev/null; then
    HAS_KEY=true
  fi
fi

if [ "$HAS_KEY" = true ]; then
  echo "         API-Key ist konfiguriert!"
else
  echo "  ┌──────────────────────────────────────────────┐"
  echo "  │                                              │"
  echo "  │  Die App laeuft auch OHNE API-Key im         │"
  echo "  │  Demo-Modus (vorgeschriebene Texte).         │"
  echo "  │                                              │"
  echo "  │  Fuer echte KI brauchst du einen             │"
  echo "  │  API-Key von EINEM dieser Anbieter:          │"
  echo "  │                                              │"
  echo "  │  Option A: Google Gemini (kostenlos)         │"
  echo "  │  → https://aistudio.google.com/apikey        │"
  echo "  │                                              │"
  echo "  │  Option B: Anthropic Claude                  │"
  echo "  │  → https://console.anthropic.com/            │"
  echo "  │                                              │"
  echo "  │  Trage den Key in die .env Datei ein:        │"
  echo "  │  → Oeffne .env mit einem Texteditor          │"
  echo "  │  → Setze den Key hinter das = Zeichen        │"
  echo "  │                                              │"
  echo "  └──────────────────────────────────────────────┘"
fi

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║  Einrichtung abgeschlossen!                  ║"
echo "  ║                                              ║"
echo "  ║  Starte die App mit:   bash start.sh         ║"
echo "  ║                                              ║"
echo "  ║  .env bearbeiten:                            ║"
echo "  ║    Mac:   open .env                          ║"
echo "  ║    oder:  nano .env                          ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""
