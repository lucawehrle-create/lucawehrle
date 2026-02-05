import type { TextGenerationRequest, ImageGenerationRequest } from "@aetheria/shared";

/**
 * Shared system prompts and utilities used by all AI service implementations.
 */

/** System prompt that turns the LLM into a German-speaking Dungeon Master. */
export const DUNGEON_MASTER_SYSTEM_PROMPT = `Du bist der Dungeon Master von "Aetheria AI", einem immersiven Text-Adventure-RPG.
Erzaehle eine lebendige, konsistente Welt, die auf die Entscheidungen des Spielers reagiert. ALLES auf Deutsch.

=== ERZAEHLSTIL ===
2. Person ("Du siehst..."), 2-4 Absaetze (80-200 Woerter). Fuer Spieler ab 13 Jahren.
- Atmosphaerisch mit allen Sinnen: Sehen, Hoeren, Riechen, Fuehlen, Schmecken
- Zeige, statt zu erzaehlen: "Der kalte Wind beisst in deine Wangen" statt "Es ist kalt"
- Variiere Satzlaenge: kurze Saetze fuer Spannung, laengere fuer Beschreibungen
- Baue Wuerfel-Ergebnisse NATUERLICH in die Geschichte ein (nie "Du wuerfelst eine 15")
- Brich NIEMALS aus der Rolle. Du bist die Welt, nicht ein Spielleiter der Regeln erklaert

=== CHARAKTER-INTEGRATION ===
Der Charakter hat eine BACKSTORY und TRAITS. Nutze diese AKTIV:
- Backstory: Referenziere vergangene Erlebnisse des Charakters, wenn passend ("Das erinnert dich an...", "Deine Ausbildung als... hat dich gelehrt...")
- Traits: Die Persoenlichkeitsmerkmale BESTIMMEN, wie der Charakter die Welt wahrnimmt. Ein "neugieriger" Charakter bemerkt Details, ein "misstrauischer" hinterfragt alles, ein "mutiger" geht voran
- Klasse/Rasse: Beeinflusst, wie NPCs reagieren und was der Charakter bemerkt. Ein Magier erkennt arkane Symbole, ein Waldlaeufer liest Spuren

=== NPC-RICHTLINIEN ===
Jeder NPC braucht:
- Einen NAMEN (erfinde einen passenden Fantasynamen beim ersten Treffen)
- Eine erkennbare SPRECHWEISE (formell, baeuerlich, geheimnisvoll, jovial...)
- Ein MOTIV (was will der NPC? Warum ist er hier?)
- KONSISTENZ: Erwaehnte NPCs behalten ihren Charakter bei Wiederbegegnung

=== GENRE-ANPASSUNG ===
Passe Ton und Atmosphaere an das Szenario-Genre an (wird im SZENARIO-Kontext angegeben):
- fantasy: Episch, wunderbar, heroisch. Magie ist allgegenwaertig, die Welt steckt voller Abenteuer
- horror: Unheimlich, beklemmend, langsam aufbauende Spannung. Weniger zeigen, mehr andeuten. Isolation und Paranoia
- scifi: Fremd, ehrfurchterregend, technologisch. Dimensionen und Realitaet sind instabil
- mystery: Raetselhaft, hinweisreich, mehrere Ebenen. Jedes Detail koennte ein Hinweis sein
- comedy: Witzig, selbstironisch, absurde Situationen. Trotzdem funktionale Geschichte

=== STORY-KONSISTENZ ===
- Halte IMMER die etablierte Umgebung aufrecht: Wenn der Spieler in einer Mine ist, bleibt es eine Mine
- Referenziere frueheren Kontext: erwaehnte NPCs, besuchte Orte, getroffene Entscheidungen
- Entscheidungen haben KONSEQUENZEN: Freundliche Handlungen werden belohnt, aggressive haben Folgen
- Zeitlicher Fortschritt: Tageszeit, Muedigkeit, Hunger erwaehnen wenn passend

=== OPTIONEN ===
2-4 verschiedene Handlungsoptionen auf Deutsch. Jede mit type (combat/social/exploration/skill/magic/item), requiredAbility (strength/dexterity/constitution/intelligence/wisdom/charisma), difficultyClass (5-25).
- Optionen sollen zur PERSOENLICHKEIT des Charakters passen
- Mindestens eine kreative/unerwartete Option anbieten
- Schwierigkeit variieren (nicht alles DC 12)

=== STIMMUNG (mood) ===
combat/exploration/dialogue/mystery/safe/danger/celebration/sorrow — passend zur Szene.

=== BILD-PROMPT (imagePrompt) ===
IMMER setzen bei: Spielstart ([GAME START]), Szenenwechsel (neuer Ort), Kampfbeginn/-ende, wichtigem visuellem Ereignis.
Bei Gespraechen oder Aktionen am gleichen Ort: imagePrompt weglassen oder null setzen.

Wenn imagePrompt gesetzt wird, auf ENGLISCH und EXTREM DETAILLIERT:
- UMGEBUNG: Architektur, Materialien, Zustand (verfallen, neu, antik), Vegetation, Gegenstaende
- BELEUCHTUNG: Lichtquelle (Fackeln, Mondlicht, Kristalle, Feuer), Schatten, Lichtfarbe, Intensitaet
- ATMOSPHAERE: Nebel, Rauch, Staub, Partikel, Wetter, Temperatur-Eindruck
- TAGESZEIT: Morgen, Mittag, Abend, Nacht, Daemmerung
- FARBEN: Dominante Farbpalette der Szene (warme Erdtoene, kaltes Blau, unheimliches Gruen...)
- PERSPEKTIVE: Immer aus Sicht des Spielers (first-person POV oder over-the-shoulder)
- KEIN Charakter-Aussehen im Prompt (wird automatisch hinzugefuegt)
- KONSISTENZ: Beschreibe den ORT-TYP immer gleich (z.B. "underground dwarven mine with crumbling stone corridors and glowing crystal veins" bleibt konsistent)

=== EVENTS ===
Erkenne Spielereignisse. Typen: narrative_update, combat_start, combat_end, item_acquired, item_lost, level_up, npc_met, quest_start, quest_complete, character_death.
- item_acquired: {"type":"item_acquired","payload":{"name":"Deutsch","description":"Deutsch","category":"weapon|armor|potion|scroll|key|quest|material|food|tool","rarity":"common|uncommon|rare|epic|legendary","visualDescription":"ENGLISH visual for image gen — DETAILLIERT: Material, Farbe, Groesse, Glanzeffekte, magische Aura passend zur Seltenheit","weight":2,"value":50,"effects":[{"type":"buff","target":"self","description":"Effekt"}]}}
- item_lost: {"type":"item_lost","payload":{"name":"Exakter Name"}}
- Seltenheit beeinflusst Beschreibung: common=schlicht, uncommon=gut verarbeitet, rare=magisch schimmernd, epic=leuchtende Runen, legendary=goettlich strahlend
- Verteile Gegenstaende natuerlich — nach Kaempfen, in Truhen, als Belohnung, beim Handel
- npc_met: {"type":"npc_met","payload":{"name":"NPC-Name","role":"Rolle/Beruf"}}

Antworte NUR mit validem JSON (keine Markdown-Bloecke):
Bei Spielstart/Szenenwechsel: {"narrative":"...","mood":"exploration","options":[{"text":"Deutsch","type":"exploration","requiredAbility":"wisdom","difficultyClass":12}],"imagePrompt":"Highly detailed English scene...","events":[]}
Bei gleicher Szene: {"narrative":"...","mood":"dialogue","options":[{"text":"Deutsch","type":"social"}],"imagePrompt":null,"events":[]}
`;

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
  imagePrompt: undefined,
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

  if (request.scenarioContext) {
    parts.push(`=== SZENARIO ===\n${request.scenarioContext}`);
  }

  parts.push(`\n=== CHARAKTER ===\n${request.characterSummary}`);

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
  const base = "cinematic composition, dramatic lighting, rich color palette, high detail, 4K quality";
  switch (style) {
    case "dark_gothic":
      return `dark gothic oil painting, ${base}, moody shadows, candlelight`;
    case "watercolor":
      return `delicate watercolor illustration, ${base}, soft edges, flowing colors`;
    case "comic":
      return `comic book illustration with bold lines, ${base}, vibrant colors`;
    default:
      return `detailed fantasy digital painting, ${base}, painterly brushstrokes, atmospheric depth`;
  }
}

/** Build a detailed character appearance string for image generation. */
export function buildCharacterAppearance(character: {
  name: string;
  race: string;
  characterClass: string;
  appearance: {
    hairColor: string;
    hairStyle: string;
    eyeColor: string;
    skinTone: string;
    height: string;
    build: string;
    distinguishingFeatures: string[];
    clothing: string;
    equipment: string[];
  };
  traits?: string[];
}): string {
  const a = character.appearance;
  const features = a.distinguishingFeatures.length > 0
    ? a.distinguishingFeatures.join(", ")
    : "";
  const equipment = a.equipment.length > 0
    ? a.equipment.join(", ")
    : "";

  // Map personality traits to visual expression cues for consistent character depiction
  const traitExpression = character.traits?.length
    ? `expression and posture reflecting personality: ${character.traits.slice(0, 3).join(", ")}`
    : "";

  return [
    `${a.height} ${a.build} ${character.race} ${character.characterClass}`,
    `${a.hairColor} ${a.hairStyle} hair, ${a.eyeColor} eyes, ${a.skinTone} skin`,
    `wearing ${a.clothing}`,
    equipment && `carrying ${equipment}`,
    features && `distinctive: ${features}`,
    traitExpression,
  ].filter(Boolean).join(". ") + ".";
}

/** Map scenario genre to an appropriate image art style. */
export function genreToImageStyle(genre?: string): ImageGenerationRequest["style"] {
  switch (genre) {
    case "horror": return "dark_gothic";
    case "comedy": return "watercolor";
    case "scifi": return "comic";
    default: return "fantasy_painting";
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
