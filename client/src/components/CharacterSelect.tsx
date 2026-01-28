import React from "react";
import { useGame } from "../context/GameContext.js";
import type { Character } from "@aetheria/shared";
import styles from "./CharacterSelect.module.css";

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
    <div className={styles.container}>
      <h2 className={styles.title}>Choose Your Hero</h2>
      <p className={styles.subtitle}>Select an existing character or forge a new one</p>

      <div className={styles.grid}>
        {state.characters.map((char) => (
          <button
            key={char.id}
            className={styles.card}
            onClick={() => handleSelectCharacter(char)}
          >
            <div className={styles.avatar}>
              <span className={styles.avatarIcon}>
                {getClassIcon(char.characterClass)}
              </span>
            </div>
            <h3 className={styles.charName}>{char.name}</h3>
            <p className={styles.charInfo}>
              {char.race} {char.characterClass}
            </p>
            <p className={styles.charLevel}>Level {char.level}</p>
            <div className={styles.stats}>
              <span>HP {char.hitPoints}/{char.maxHitPoints}</span>
              <span>AC {char.armorClass}</span>
            </div>
          </button>
        ))}

        <button className={styles.createCard} onClick={handleCreateNew}>
          <div className={styles.createIcon}>+</div>
          <h3 className={styles.charName}>Create New</h3>
          <p className={styles.charInfo}>Forge a new hero</p>
        </button>
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
