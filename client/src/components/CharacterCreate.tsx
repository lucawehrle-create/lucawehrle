import React, { useState, useEffect } from "react";
import { useGame } from "../context/GameContext.js";
import { createCharacter, getCharacters } from "../services/api.js";
import { NavBar } from "./NavBar.js";
import type { CreateCharacterRequest } from "@aetheria/shared";
import styles from "./CharacterCreate.module.css";

const RACES = ["human", "elf", "dwarf", "halfling", "orc", "tiefling", "dragonborn"] as const;
const CLASSES = ["warrior", "mage", "rogue", "cleric", "ranger", "bard", "paladin"] as const;

const RACE_LABELS: Record<string, string> = {
  human: "Mensch", elf: "Elf", dwarf: "Zwerg", halfling: "Halbling",
  orc: "Ork", tiefling: "Tiefling", dragonborn: "Drachenblut",
};

const CLASS_LABELS: Record<string, string> = {
  warrior: "Krieger", mage: "Magier", rogue: "Schurke", cleric: "Kleriker",
  ranger: "Waldlaeufer", bard: "Barde", paladin: "Paladin",
};

const CLASS_DESCRIPTIONS: Record<string, string> = {
  warrior: "Meister des Nahkampfs. Krieger zeichnen sich durch schwere Ruestung und maechtige Waffen aus.",
  mage: "Beherrscher arkaner Magie. Magier fuehren verheerende Zauber, sind aber im Nahkampf verwundbar.",
  rogue: "Heimlich und gerissen. Schurken verlassen sich auf Geschicklichkeit, List und praezise Angriffe.",
  cleric: "Goettliche Zauberwirker, die Verbuendete heilen und Feinde mit der Macht ihres Glaubens laeutern.",
  ranger: "Geschickte Faehrtenleser und Bogenschuetzen, die in der Wildnis mit Klinge und Bogen bestehen.",
  bard: "Charismatische Kuenstler, deren magische Musik Verbuendete inspiriert und Feinde verwirrt.",
  paladin: "Heilige Krieger, die Kampfkunst mit goettlicher Magie und unerschuetterlicher Entschlossenheit vereinen.",
};

// --- Appearance option definitions ---

interface AppearanceOption {
  value: string;
  label: string;
  color?: string; // CSS color for color-coded buttons
}

const HAIR_COLORS: AppearanceOption[] = [
  { value: "black", label: "Schwarz", color: "#1a1a1a" },
  { value: "brown", label: "Braun", color: "#6b3a2a" },
  { value: "blond", label: "Blond", color: "#d4a550" },
  { value: "red", label: "Rot", color: "#a33030" },
  { value: "white", label: "Weiss", color: "#e8e8e8" },
  { value: "silver", label: "Silber", color: "#b0b8c8" },
  { value: "blue", label: "Blau", color: "#4488cc" },
  { value: "green", label: "Gruen", color: "#448844" },
];

const HAIR_STYLES: AppearanceOption[] = [
  { value: "short", label: "Kurz" },
  { value: "long", label: "Lang" },
  { value: "braided", label: "Geflochten" },
  { value: "shaved", label: "Rasiert" },
  { value: "curly", label: "Lockig" },
  { value: "tied-up", label: "Hochgesteckt" },
];

const EYE_COLORS: AppearanceOption[] = [
  { value: "blue", label: "Blau", color: "#4488cc" },
  { value: "green", label: "Gruen", color: "#44aa66" },
  { value: "brown", label: "Braun", color: "#7a5530" },
  { value: "gray", label: "Grau", color: "#8888a0" },
  { value: "golden", label: "Gold", color: "#c8a830" },
  { value: "violet", label: "Violett", color: "#9955cc" },
  { value: "red", label: "Rot", color: "#cc3333" },
];

const SKIN_TONES: AppearanceOption[] = [
  { value: "fair", label: "Hell", color: "#f5d6b8" },
  { value: "olive", label: "Olive", color: "#c8a878" },
  { value: "brown", label: "Braun", color: "#8b6b4a" },
  { value: "dark", label: "Dunkel", color: "#5a3a2a" },
  { value: "pale", label: "Bleich", color: "#e8ddd8" },
  { value: "greenish", label: "Gruenlich", color: "#6a8a5a" },
  { value: "reddish", label: "Roetlich", color: "#b86050" },
  { value: "scaled", label: "Schuppig", color: "#5a7a6a" },
];

const HEIGHTS: AppearanceOption[] = [
  { value: "short", label: "Klein" },
  { value: "average", label: "Mittel" },
  { value: "tall", label: "Gross" },
];

const BUILDS: AppearanceOption[] = [
  { value: "slim", label: "Schlank" },
  { value: "average", label: "Mittel" },
  { value: "muscular", label: "Muskuloes" },
  { value: "heavy", label: "Kraeftig" },
];

const FEATURE_OPTIONS: AppearanceOption[] = [
  { value: "scar across face", label: "Gesichtsnarbe" },
  { value: "tribal tattoos", label: "Tattoos" },
  { value: "glowing runes on skin", label: "Leuchtende Runen" },
  { value: "pointed ears", label: "Spitze Ohren" },
  { value: "braided beard", label: "Geflochtener Bart" },
  { value: "eye patch", label: "Augenklappe" },
  { value: "horn ornaments", label: "Hornschmuck" },
  { value: "war paint", label: "Kriegsbemalung" },
];

// Smart defaults by race
function getRaceDefaults(race: string): Partial<{
  hairColor: string;
  hairStyle: string;
  eyeColor: string;
  skinTone: string;
  height: string;
  build: string;
}> {
  switch (race) {
    case "elf": return { hairColor: "silver", hairStyle: "long", eyeColor: "green", skinTone: "fair", height: "tall", build: "slim" };
    case "dwarf": return { hairColor: "red", hairStyle: "braided", eyeColor: "brown", skinTone: "olive", height: "short", build: "muscular" };
    case "halfling": return { hairColor: "brown", hairStyle: "curly", eyeColor: "brown", skinTone: "fair", height: "short", build: "slim" };
    case "orc": return { hairColor: "black", hairStyle: "shaved", eyeColor: "red", skinTone: "greenish", height: "tall", build: "muscular" };
    case "tiefling": return { hairColor: "black", hairStyle: "long", eyeColor: "golden", skinTone: "reddish", height: "average", build: "average" };
    case "dragonborn": return { hairColor: "white", hairStyle: "shaved", eyeColor: "golden", skinTone: "scaled", height: "tall", build: "muscular" };
    default: return { hairColor: "brown", hairStyle: "short", eyeColor: "blue", skinTone: "fair", height: "average", build: "average" };
  }
}

// Clothing defaults by class
function getClassClothing(charClass: string): string {
  switch (charClass) {
    case "warrior": return "heavy plate armor and a large sword";
    case "mage": return "flowing arcane robes and a glowing staff";
    case "rogue": return "dark leather armor with a hooded cloak";
    case "cleric": return "white and gold holy vestments with a sacred symbol";
    case "ranger": return "green woodland cloak and leather armor with a bow";
    case "bard": return "colorful performer's outfit with a lute";
    case "paladin": return "gleaming silver armor with a holy shield";
    default: return "adventurer's outfit";
  }
}

export function CharacterCreate() {
  const { state, dispatch } = useGame();
  const [name, setName] = useState("");
  const [race, setRace] = useState<string>("human");
  const [charClass, setCharClass] = useState<string>("warrior");
  const [backstory, setBackstory] = useState("");

  // Appearance state
  const [hairColor, setHairColor] = useState("brown");
  const [hairStyle, setHairStyle] = useState("short");
  const [eyeColor, setEyeColor] = useState("blue");
  const [skinTone, setSkinTone] = useState("fair");
  const [height, setHeight] = useState<string>("average");
  const [build, setBuild] = useState<string>("average");
  const [features, setFeatures] = useState<string[]>([]);
  const [showAppearance, setShowAppearance] = useState(false);

  // Apply race defaults when race changes
  useEffect(() => {
    const defaults = getRaceDefaults(race);
    if (defaults.hairColor) setHairColor(defaults.hairColor);
    if (defaults.hairStyle) setHairStyle(defaults.hairStyle);
    if (defaults.eyeColor) setEyeColor(defaults.eyeColor);
    if (defaults.skinTone) setSkinTone(defaults.skinTone);
    if (defaults.height) setHeight(defaults.height);
    if (defaults.build) setBuild(defaults.build);
  }, [race]);

  function toggleFeature(value: string) {
    setFeatures((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value],
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!state.user) return;

    dispatch({ type: "SET_LOADING", isLoading: true });

    const data: CreateCharacterRequest = {
      name,
      race,
      characterClass: charClass,
      appearance: {
        hairColor,
        hairStyle,
        eyeColor,
        skinTone,
        height: height as "short" | "average" | "tall",
        build: build as "slim" | "average" | "muscular" | "heavy",
        distinguishingFeatures: features,
        clothing: getClassClothing(charClass),
        equipment: [],
      },
      backstory: backstory || `Ein mutiger ${RACE_LABELS[race]} ${CLASS_LABELS[charClass]}, der nach Abenteuern sucht.`,
      traits: ["mutig", "neugierig"],
    };

    const result = await createCharacter(state.user.id, data);
    if (result.success && result.data) {
      const charResult = await getCharacters(state.user.id);
      if (charResult.success && charResult.data) {
        dispatch({ type: "SET_CHARACTERS", characters: charResult.data });
      }
      dispatch({ type: "SELECT_CHARACTER", character: result.data });
      dispatch({ type: "SET_VIEW", view: "scenario_select" });
    } else {
      dispatch({ type: "SET_ERROR", error: result.error?.message ?? "Charakter konnte nicht erstellt werden" });
    }
    dispatch({ type: "SET_LOADING", isLoading: false });
  }

  // Build preview description
  const hairLabel = HAIR_COLORS.find((h) => h.value === hairColor)?.label ?? hairColor;
  const hairStyleLabel = HAIR_STYLES.find((h) => h.value === hairStyle)?.label ?? hairStyle;
  const eyeLabel = EYE_COLORS.find((e) => e.value === eyeColor)?.label ?? eyeColor;
  const skinLabel = SKIN_TONES.find((s) => s.value === skinTone)?.label ?? skinTone;
  const heightLabel = HEIGHTS.find((h) => h.value === height)?.label ?? height;
  const buildLabel = BUILDS.find((b) => b.value === build)?.label ?? build;

  return (
    <div className={styles.page}>
      <NavBar
        back={{ label: "Heldenauswahl", onClick: () => dispatch({ type: "SET_VIEW", view: "character_select" }) }}
      />
      <div className={styles.container}>
      <h2 className={styles.title}>Erschaffe deinen Helden</h2>

      <form className={styles.form} onSubmit={handleCreate}>
        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <input
            className={styles.input}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Gib deinem Charakter einen Namen..."
            required
            minLength={2}
            maxLength={30}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Volk</label>
          <div className={styles.optionGrid}>
            {RACES.map((r) => (
              <button
                key={r}
                type="button"
                className={`${styles.optionButton} ${race === r ? styles.selected : ""}`}
                onClick={() => setRace(r)}
              >
                {RACE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Klasse</label>
          <div className={styles.optionGrid}>
            {CLASSES.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.optionButton} ${charClass === c ? styles.selected : ""}`}
                onClick={() => setCharClass(c)}
              >
                {CLASS_LABELS[c]}
              </button>
            ))}
          </div>
          <p className={styles.classDesc}>{CLASS_DESCRIPTIONS[charClass]}</p>
        </div>

        {/* Appearance section */}
        <div className={styles.appearanceSection}>
          <button
            type="button"
            className={styles.appearanceToggle}
            onClick={() => setShowAppearance(!showAppearance)}
          >
            <span className={styles.appearanceToggleIcon}>{showAppearance ? "\u25BC" : "\u25B6"}</span>
            <span className={styles.label}>Aussehen anpassen</span>
            <span className={styles.appearancePreview}>
              {hairLabel}, {eyeLabel} Augen, {heightLabel}
            </span>
          </button>

          {showAppearance && (
            <div className={styles.appearanceFields}>
              {/* Hair Color */}
              <div className={styles.subField}>
                <span className={styles.subLabel}>Haarfarbe</span>
                <div className={styles.colorGrid}>
                  {HAIR_COLORS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`${styles.colorButton} ${hairColor === opt.value ? styles.colorSelected : ""}`}
                      onClick={() => setHairColor(opt.value)}
                      title={opt.label}
                    >
                      <span
                        className={styles.colorSwatch}
                        style={{ background: opt.color }}
                      />
                      <span className={styles.colorLabel}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hair Style */}
              <div className={styles.subField}>
                <span className={styles.subLabel}>Frisur</span>
                <div className={styles.optionGrid}>
                  {HAIR_STYLES.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`${styles.miniOption} ${hairStyle === opt.value ? styles.selected : ""}`}
                      onClick={() => setHairStyle(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Eye Color */}
              <div className={styles.subField}>
                <span className={styles.subLabel}>Augenfarbe</span>
                <div className={styles.colorGrid}>
                  {EYE_COLORS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`${styles.colorButton} ${eyeColor === opt.value ? styles.colorSelected : ""}`}
                      onClick={() => setEyeColor(opt.value)}
                      title={opt.label}
                    >
                      <span
                        className={styles.colorSwatch}
                        style={{ background: opt.color }}
                      />
                      <span className={styles.colorLabel}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Skin Tone */}
              <div className={styles.subField}>
                <span className={styles.subLabel}>Hautfarbe</span>
                <div className={styles.colorGrid}>
                  {SKIN_TONES.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`${styles.colorButton} ${skinTone === opt.value ? styles.colorSelected : ""}`}
                      onClick={() => setSkinTone(opt.value)}
                      title={opt.label}
                    >
                      <span
                        className={styles.colorSwatch}
                        style={{ background: opt.color }}
                      />
                      <span className={styles.colorLabel}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Height & Build */}
              <div className={styles.subFieldRow}>
                <div className={styles.subField}>
                  <span className={styles.subLabel}>Groesse</span>
                  <div className={styles.optionGrid}>
                    {HEIGHTS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`${styles.miniOption} ${height === opt.value ? styles.selected : ""}`}
                        onClick={() => setHeight(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.subField}>
                  <span className={styles.subLabel}>Statur</span>
                  <div className={styles.optionGrid}>
                    {BUILDS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`${styles.miniOption} ${build === opt.value ? styles.selected : ""}`}
                        onClick={() => setBuild(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Distinguishing Features */}
              <div className={styles.subField}>
                <span className={styles.subLabel}>Besondere Merkmale</span>
                <div className={styles.optionGrid}>
                  {FEATURE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`${styles.miniOption} ${features.includes(opt.value) ? styles.selected : ""}`}
                      onClick={() => toggleFeature(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview card */}
              <div className={styles.previewCard}>
                <span className={styles.previewTitle}>Vorschau</span>
                <p className={styles.previewText}>
                  {hairStyleLabel}es {hairLabel}es Haar, {eyeLabel}e Augen, {skinLabel}e Haut.{" "}
                  {heightLabel}, {buildLabel}e Statur.
                  {features.length > 0 && (
                    <> {features.map((f) => FEATURE_OPTIONS.find((o) => o.value === f)?.label).filter(Boolean).join(", ")}.</>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Hintergrundgeschichte (optional)</label>
          <textarea
            className={styles.textarea}
            value={backstory}
            onChange={(e) => setBackstory(e.target.value)}
            placeholder="Was ist die Geschichte deines Charakters? Die KI wird sie in die Erzaehlung einweben..."
            rows={4}
            maxLength={500}
          />
        </div>

        <div className={styles.actions}>
          <button type="submit" className={styles.createButton}>
            Charakter erstellen
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
