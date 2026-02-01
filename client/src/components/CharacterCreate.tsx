import React, { useState } from "react";
import { useGame } from "../context/GameContext.js";
import { createCharacter, getCharacters } from "../services/api.js";
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

export function CharacterCreate() {
  const { state, dispatch } = useGame();
  const [name, setName] = useState("");
  const [race, setRace] = useState<string>("human");
  const [charClass, setCharClass] = useState<string>("warrior");
  const [backstory, setBackstory] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!state.user) return;

    dispatch({ type: "SET_LOADING", isLoading: true });

    const data: CreateCharacterRequest = {
      name,
      race,
      characterClass: charClass,
      appearance: {
        hairColor: "brown",
        hairStyle: "long",
        eyeColor: "blue",
        skinTone: "fair",
        height: "average",
        build: "average",
        distinguishingFeatures: [],
        clothing: `${charClass} armor and gear`,
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

  return (
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
          <button
            type="button"
            className={styles.backButton}
            onClick={() => dispatch({ type: "SET_VIEW", view: "character_select" })}
          >
            Zurueck
          </button>
          <button type="submit" className={styles.createButton}>
            Charakter erstellen
          </button>
        </div>
      </form>
    </div>
  );
}
