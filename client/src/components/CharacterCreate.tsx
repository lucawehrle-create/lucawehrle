import React, { useState } from "react";
import { useGame } from "../context/GameContext.js";
import { createCharacter, getCharacters } from "../services/api.js";
import type { CreateCharacterRequest } from "@aetheria/shared";
import styles from "./CharacterCreate.module.css";

const RACES = ["human", "elf", "dwarf", "halfling", "orc", "tiefling", "dragonborn"] as const;
const CLASSES = ["warrior", "mage", "rogue", "cleric", "ranger", "bard", "paladin"] as const;

const CLASS_DESCRIPTIONS: Record<string, string> = {
  warrior: "Masters of martial combat, warriors excel in close-quarters fighting with heavy armor and weapons.",
  mage: "Wielders of arcane magic, mages command devastating spells but are fragile in melee combat.",
  rogue: "Stealthy and cunning, rogues rely on agility, trickery, and precision strikes.",
  cleric: "Divine spellcasters who heal allies and smite foes with the power of their faith.",
  ranger: "Skilled trackers and archers who thrive in the wilderness with both blade and bow.",
  bard: "Charismatic performers whose magical music inspires allies and confounds enemies.",
  paladin: "Holy warriors who combine martial prowess with divine magic and unwavering resolve.",
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
      backstory: backstory || `A brave ${race} ${charClass} seeking adventure.`,
      traits: ["brave", "curious"],
    };

    const result = await createCharacter(state.user.id, data);
    if (result.success && result.data) {
      // Reload characters
      const charResult = await getCharacters(state.user.id);
      if (charResult.success && charResult.data) {
        dispatch({ type: "SET_CHARACTERS", characters: charResult.data });
      }
      dispatch({ type: "SELECT_CHARACTER", character: result.data });
      dispatch({ type: "SET_VIEW", view: "scenario_select" });
    } else {
      dispatch({ type: "SET_ERROR", error: result.error?.message ?? "Failed to create character" });
    }
    dispatch({ type: "SET_LOADING", isLoading: false });
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Forge Your Hero</h2>

      <form className={styles.form} onSubmit={handleCreate}>
        <div className={styles.field}>
          <label className={styles.label}>Name</label>
          <input
            className={styles.input}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your character's name..."
            required
            minLength={2}
            maxLength={30}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Race</label>
          <div className={styles.optionGrid}>
            {RACES.map((r) => (
              <button
                key={r}
                type="button"
                className={`${styles.optionButton} ${race === r ? styles.selected : ""}`}
                onClick={() => setRace(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Class</label>
          <div className={styles.optionGrid}>
            {CLASSES.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.optionButton} ${charClass === c ? styles.selected : ""}`}
                onClick={() => setCharClass(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <p className={styles.classDesc}>{CLASS_DESCRIPTIONS[charClass]}</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Backstory (optional)</label>
          <textarea
            className={styles.textarea}
            value={backstory}
            onChange={(e) => setBackstory(e.target.value)}
            placeholder="What is your character's story? The AI will weave it into the narrative..."
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
            Back
          </button>
          <button type="submit" className={styles.createButton}>
            Create Character
          </button>
        </div>
      </form>
    </div>
  );
}
