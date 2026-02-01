import React from "react";
import { useGame } from "../context/GameContext.js";
import { NavBar } from "./NavBar.js";
import type { Character } from "@aetheria/shared";
import styles from "./CharacterSelect.module.css";

const RACE_LABELS: Record<string, string> = {
  human: "Mensch", elf: "Elf", dwarf: "Zwerg", halfling: "Halbling",
  orc: "Ork", tiefling: "Tiefling", dragonborn: "Drachenblut",
};

const CLASS_LABELS: Record<string, string> = {
  warrior: "Krieger", mage: "Magier", rogue: "Schurke", cleric: "Kleriker",
  ranger: "Waldlaeufer", bard: "Barde", paladin: "Paladin",
};

export function CharacterSelect() {
  const { state, dispatch } = useGame();

  function handleSelectCharacter(character: Character) {
    dispatch({ type: "SELECT_CHARACTER", character });
    dispatch({ type: "SET_VIEW", view: "scenario_select" });
  }

  function handleCreateNew() {
    dispatch({ type: "SET_VIEW", view: "character_create" });
  }

  return (
    <div className={styles.page}>
      <NavBar />
      <div className={styles.container}>
        <h2 className={styles.title}>Waehle deinen Helden</h2>
        <p className={styles.subtitle}>Waehle einen bestehenden Charakter oder erschaffe einen neuen</p>

        <div className={styles.grid}>
          {state.characters.map((char) => (
            <button
              key={char.id}
              className={styles.card}
              onClick={() => handleSelectCharacter(char)}
            >
              {char.portraitUrl ? (
                <img src={char.portraitUrl} alt={char.name} className={styles.portraitImage} />
              ) : (
                <div className={styles.avatar}>
                  <span className={styles.avatarIcon}>
                    {getClassIcon(char.characterClass)}
                  </span>
                </div>
              )}
              <h3 className={styles.charName}>{char.name}</h3>
              <p className={styles.charInfo}>
                {RACE_LABELS[char.race] ?? char.race} {CLASS_LABELS[char.characterClass] ?? char.characterClass}
              </p>
              <p className={styles.charLevel}>Stufe {char.level}</p>
              <div className={styles.stats}>
                <span>HP {char.hitPoints}/{char.maxHitPoints}</span>
                <span>RK {char.armorClass}</span>
              </div>
            </button>
          ))}

          <button className={styles.createCard} onClick={handleCreateNew}>
            <div className={styles.createIcon}>+</div>
            <h3 className={styles.charName}>Neu erstellen</h3>
            <p className={styles.charInfo}>Erschaffe einen neuen Helden</p>
          </button>
        </div>
      </div>
    </div>
  );
}

function getClassIcon(characterClass: string): string {
  const icons: Record<string, string> = {
    warrior: "\u2694",
    mage: "\u2728",
    rogue: "\uD83D\uDDE1",
    cleric: "\u2720",
    ranger: "\uD83C\uDFF9",
    bard: "\uD83C\uDFB5",
    paladin: "\uD83D\uDEE1",
  };
  return icons[characterClass] ?? "\u2726";
}
