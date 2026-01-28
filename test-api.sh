#!/bin/bash
# ============================================
# Aetheria AI – API Test (End-to-End)
# ============================================
# Testet den kompletten Spielablauf über die API.
# Voraussetzung: Server läuft auf Port 4000
# ============================================

BASE="http://localhost:4000/api"
set -e

echo ""
echo "=== AETHERIA AI – End-to-End API Test ==="
echo ""

# 1. Health Check
echo "1) Health Check..."
curl -s "$BASE/health" | python3 -m json.tool
echo ""

# 2. User erstellen
echo "2) User erstellen..."
USER_RESPONSE=$(curl -s -X POST "$BASE/users" \
  -H "Content-Type: application/json" \
  -d '{"username":"TestHeld","email":"test@aetheria.ai"}')
echo "$USER_RESPONSE" | python3 -m json.tool
USER_ID=$(echo "$USER_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "   User-ID: $USER_ID"
echo ""

# 3. Charakter erstellen
echo "3) Charakter erstellen..."
CHAR_RESPONSE=$(curl -s -X POST "$BASE/users/$USER_ID/characters" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_ID" \
  -d '{
    "name": "Aldric der Tapfere",
    "race": "human",
    "characterClass": "warrior",
    "appearance": {
      "hairColor": "braun",
      "hairStyle": "kurz",
      "eyeColor": "gruen",
      "skinTone": "hell",
      "height": "tall",
      "build": "muscular",
      "distinguishingFeatures": ["Narbe am Kinn"],
      "clothing": "Kettenhemd und roter Umhang",
      "equipment": ["Langschwert", "Holzschild"]
    },
    "backstory": "Ein tapferer Krieger aus dem Norden, der nach Abenteuern sucht.",
    "traits": ["mutig", "loyal", "stur"]
  }')
echo "$CHAR_RESPONSE" | python3 -m json.tool
CHAR_ID=$(echo "$CHAR_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "   Charakter-ID: $CHAR_ID"
echo ""

# 4. Szenarien auflisten
echo "4) Verfuegbare Szenarien..."
curl -s "$BASE/scenarios" | python3 -c "
import sys,json
data = json.load(sys.stdin)['data']
for s in data:
    print(f\"   - {s['title']} ({s['difficulty']}) [{s['genre']}]\")
"
echo ""

# 5. Spielsession starten
echo "5) Spiel starten: 'The Lost Mines of Drakenvault'..."
SESSION_RESPONSE=$(curl -s -X POST "$BASE/game/sessions" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_ID" \
  -d "{\"characterId\":\"$CHAR_ID\",\"scenarioId\":\"scenario_lost_mines\"}")
echo "$SESSION_RESPONSE" | python3 -c "
import sys,json
data = json.load(sys.stdin)['data']
turn = data['turn']
print(f\"   Session: {data['session']['title']}\")
print(f\"   Stimmung: {turn['mood']}\")
print()
print(f\"   Erzaehlung:\")
print(f\"   {turn['narrative']}\")
print()
print(f\"   Optionen:\")
for o in turn['options']:
    print(f\"   [{o['type']}] {o['text']}\")
"
SESSION_ID=$(echo "$SESSION_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['session']['id'])")
OPTION_ID=$(echo "$SESSION_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['turn']['options'][0]['id'])")
echo ""

# 6. Aktion ausfuehren (Option waehlen)
echo "6) Aktion: Erste Option waehlen..."
ACTION_RESPONSE=$(curl -s -X POST "$BASE/game/sessions/$SESSION_ID/action" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_ID" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"action\":{\"type\":\"option\",\"optionId\":\"$OPTION_ID\",\"text\":\"Draw weapon and advance\"}}")
echo "$ACTION_RESPONSE" | python3 -c "
import sys,json
data = json.load(sys.stdin)['data']
turn = data['turn']
print(f\"   Stimmung: {turn['mood']}\")
if turn.get('diceRolls'):
    for r in turn['diceRolls']:
        status = 'ERFOLG' if r.get('success') else 'FEHLSCHLAG' if r.get('success') is False else ''
        crit = ' (KRITISCH!)' if r.get('criticalHit') else ' (PATZER!)' if r.get('criticalFail') else ''
        print(f\"   Wuerfel: {r['diceType']} = {r['total']} {status}{crit}\")
print()
print(f\"   Erzaehlung:\")
print(f\"   {turn['narrative']}\")
"
echo ""

# 7. Freitext-Aktion
echo "7) Freitext-Aktion: 'Ich untersuche die Umgebung genauer'..."
FREE_RESPONSE=$(curl -s -X POST "$BASE/game/sessions/$SESSION_ID/action" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_ID" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"action\":{\"type\":\"freetext\",\"text\":\"Ich untersuche die Umgebung genauer und suche nach versteckten Hinweisen\"}}")
echo "$FREE_RESPONSE" | python3 -c "
import sys,json
data = json.load(sys.stdin)['data']
turn = data['turn']
print(f\"   Stimmung: {turn['mood']}\")
print()
print(f\"   Erzaehlung:\")
print(f\"   {turn['narrative']}\")
print()
print(f\"   Neue Optionen:\")
for o in turn['options']:
    print(f\"   [{o['type']}] {o['text']}\")
"
echo ""

# 8. Objekt scannen (AR-Feature)
echo "8) AR-Scan: Objekt scannen..."
SCAN_RESPONSE=$(curl -s -X POST "$BASE/game/sessions/$SESSION_ID/scan" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $USER_ID" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"imageData\":\"test-image-base64\",\"format\":\"base64\"}")
echo "$SCAN_RESPONSE" | python3 -c "
import sys,json
data = json.load(sys.stdin)['data']
item = data['item']
print(f\"   Gescanntes Objekt: {item['name']}\")
print(f\"   Seltenheit: {item['rarity']}\")
print(f\"   Beschreibung: {item['description']}\")
print(f\"   Kategorie: {item['category']}\")
"
echo ""

# 9. Inventar pruefen
echo "9) Inventar pruefen..."
curl -s "$BASE/game/inventory/$CHAR_ID" | python3 -c "
import sys,json
data = json.load(sys.stdin)['data']
print(f\"   Gold: {data['gold']}\")
print(f\"   Slots: {len(data['items'])}/{data['maxSlots']}\")
for item in data['items']:
    print(f\"   - {item['name']} ({item['rarity']}) - {item['description'][:60]}...\")
"
echo ""

# 10. Energie-Status pruefen
echo "10) Energie-Status..."
curl -s "$BASE/users/$USER_ID" | python3 -c "
import sys,json
data = json.load(sys.stdin)['data']
e = data['energy']
print(f\"   Abo: {data['subscriptionTier']}\")
print(f\"   Tagesaktionen: {e['dailyActionsUsed']}/{e['dailyActionsMax']}\")
print(f\"   Gekaufte Energie: {e['current']}/{e['max']}\")
"
echo ""

echo "=== ALLE TESTS ERFOLGREICH ==="
echo ""
