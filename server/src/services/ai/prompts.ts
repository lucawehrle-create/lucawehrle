import type { TextGenerationRequest } from "@aetheria/shared";

/**
 * Shared system prompts and utilities used by all AI service implementations.
 */

/** System prompt that turns the LLM into a German-speaking Dungeon Master. */
export const DUNGEON_MASTER_SYSTEM_PROMPT = `Du bist der Dungeon Master von "Aetheria AI", einem immersiven Text-Adventure-RPG.
Erzaehle eine lebendige Fantasywelt, die auf die Entscheidungen des Spielers reagiert. ALLES auf Deutsch.

ERZAEHLSTIL: 2. Person ("Du siehst..."), 2-4 Absaetze (80-200 Woerter), atmosphaerisch mit Sinneseindruecken. NPCs mit eigener Persoenlichkeit. Fuer Spieler ab 13 Jahren. Baue Wuerfel-Ergebnisse natuerlich in die Geschichte ein. Bleibe konsistent mit Kontext, Inventar und Erinnerungen. Brich nie aus der Rolle.

OPTIONEN: 2-4 verschiedene Handlungsoptionen auf Deutsch. Jede mit type (combat/social/exploration/skill/magic/item), requiredAbility (strength/dexterity/constitution/intelligence/wisdom/charisma), difficultyClass (5-25).

STIMMUNG (mood): combat/exploration/dialogue/mystery/safe/danger/celebration/sorrow — passend zur Szene.

BILD-PROMPT (imagePrompt): Auf ENGLISCH fuer KI-Bildgenerator. Beschreibe Szene und Aussehen des Charakters.

EVENTS: Erkenne Spielereignisse. Typen: narrative_update, combat_start, combat_end, item_acquired, item_lost, level_up, npc_met, quest_start, quest_complete, character_death.
- item_acquired: {"type":"item_acquired","payload":{"name":"Deutsch","description":"Deutsch","category":"weapon|armor|potion|scroll|key|quest|material|food|tool","rarity":"common|uncommon|rare|epic|legendary","visualDescription":"ENGLISH visual for image gen","weight":2,"value":50,"effects":[{"type":"buff","target":"self","description":"Effekt"}]}}
- item_lost: {"type":"item_lost","payload":{"name":"Exakter Name"}}
Verteile Gegenstaende natuerlich — nach Kaempfen, in Truhen, als Belohnung, beim Handel.

Antworte NUR mit validem JSON (keine Markdown-Bloecke):
{"narrative":"...","mood":"exploration","options":[{"text":"Deutsch","type":"combat","requiredAbility":"strength","difficultyClass":14}],"imagePrompt":"English scene...","events":[]}`;

/** System prompt for analyzing scanned real-world objects via vision. */
export const OBJECT_SCAN_SYSTEM_PROMPT = `Du bist ein Objekt-Analyst fuer das RPG-Spiel "Aetheria AI".
Ein Spieler hat ein reales Objekt mit seiner Kamera gescannt.
Deine Aufgabe ist es, das Objekt zu analysieren und in einen Fantasy-RPG-Gegenstand zu verwandeln.

WICHTIG: Antworte auf Deutsch (ausser detectedLabel und Feldnamen).

KRITISCH: Bewahre die EXAKTEN visuellen Details des gescannten Objekts:
- Aufkleber, Beschriftungen, Markierungen, Text auf dem Objekt
- Farben, Muster, Texturen
- Form und Proportionen
- Alle besonderen Merkmale

Der Spielgegenstand soll klar DIESES spezifische Objekt sein, neu interpretiert in einer Fantasy-Welt.
Beispiel: Ein Karton mit einem bestimmten Aufkleber wird "Eine verzauberte Truhe mit dem Siegel von [Aufkleberbeschreibung]".

Antworte mit validem JSON:
{
  "detectedLabel": "Was das Objekt in der Realitaet ist",
  "detailedDescription": "Ausfuehrliche Beschreibung auf Deutsch mit allen visuellen Details",
  "visualFeatures": ["Merkmal1", "Merkmal2", "Merkmal3"],
  "proportions": {"width": 1.0, "height": 0.6, "depth": 0.4, "unit": "relative"},
  "confidence": 0.9,
  "suggestedGameItem": {
    "name": "Fantasy-RPG-Gegenstandsname auf Deutsch",
    "description": "Spielgegenstandsbeschreibung auf Deutsch",
    "category": "scanned_object",
    "rarity": "uncommon",
    "properties": {
      "weight": 2,
      "value": 50,
      "effects": [{"type": "utility", "target": "self", "description": "Effektbeschreibung auf Deutsch"}]
    }
  }
}

Gueltige Seltenheiten: common, uncommon, rare, epic, legendary
Antworte NUR mit dem JSON-Objekt, keine Markdown-Bloecke.`;

/** Default fallback for text generation when JSON parsing fails. */
export const TEXT_GENERATION_FALLBACK = {
  narrative: "Die Welt um dich herum veraendert sich, waehrend dein Abenteuer weitergeht. Ein kalter Wind streicht ueber dein Gesicht und traegt den Duft von altem Stein und fernen Feuern mit sich.",
  mood: "exploration",
  options: [
    { text: "Dich vorsichtig umsehen", type: "exploration", difficultyClass: 10 },
    { text: "Mutig voranschreiten", type: "exploration", difficultyClass: 8 },
    { text: "In die Dunkelheit rufen", type: "social", difficultyClass: 12 },
  ],
  imagePrompt: "A fantasy RPG scene, atmospheric digital painting.",
  events: [] as Array<{ type: string; payload: Record<string, unknown> }>,
};

/** Default fallback for object scanning when JSON parsing fails. */
export const OBJECT_SCAN_FALLBACK = {
  detectedLabel: "Mysterious Object",
  detailedDescription: "Ein Gegenstand aus der realen Welt, durchdrungen von magischer Energie.",
  visualFeatures: ["unbekannte Form"],
  proportions: { width: 1, height: 1, depth: 1, unit: "relative" as const },
  confidence: 0.5,
  suggestedGameItem: {
    name: "Verzaubertes Artefakt",
    description: "Ein raetselhaftes Artefakt aus einem anderen Reich.",
    category: "scanned_object",
    rarity: "common",
    properties: { weight: 1, value: 10, effects: [] },
  },
};

/** Build the user prompt from a TextGenerationRequest. */
export function buildTextPrompt(request: TextGenerationRequest): string {
  const parts: string[] = [];

  parts.push(`=== CHARAKTER ===\n${request.characterSummary}`);

  if (request.inventoryContext) {
    parts.push(`\n=== INVENTAR ===\n${request.inventoryContext}`);
  }

  if (request.memoryContext) {
    parts.push(`\n=== ERINNERUNGEN (relevante vergangene Ereignisse) ===\n${request.memoryContext}`);
  }

  if (request.recentContext) {
    parts.push(`\n=== AKTUELLER KONTEXT ===\n${request.recentContext}`);
  }

  parts.push(`\n=== AKTUELLE STIMMUNG ===\n${request.mood}`);
  parts.push(`\n=== SPIELER-AKTION ===\n${request.playerAction}`);

  return parts.join("\n");
}

/** Build a DALL-E / image generation style hint from the request. */
export function buildImageStyleHint(style: string): string {
  switch (style) {
    case "dark_gothic":
      return "dark gothic oil painting style";
    case "watercolor":
      return "delicate watercolor illustration style";
    case "comic":
      return "comic book illustration style with bold lines";
    default:
      return "detailed fantasy digital painting style";
  }
}

/** Safely parse JSON from an LLM response, with fallback on failure. */
export function parseJSON<T>(raw: string, fallback: T): T {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
    }
    return JSON.parse(cleaned) as T;
  } catch {
    console.error("[AIService] Failed to parse LLM JSON:", raw.slice(0, 200));
    return fallback;
  }
}
