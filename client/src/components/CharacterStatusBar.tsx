import React from "react";
import type { Character } from "@aetheria/shared";
import styles from "./CharacterStatusBar.module.css";

const CLASS_ICONS: Record<string, string> = {
  warrior: "\u2694\uFE0F",
  mage: "\u2728",
  rogue: "\uD83D\uDDE1\uFE0F",
  cleric: "\u2719",
  ranger: "\uD83C\uDFF9",
  bard: "\uD83C\uDFB5",
  paladin: "\uD83D\uDEE1\uFE0F",
};

interface CharacterStatusBarProps {
  character: Character;
}

export function CharacterStatusBar({ character }: CharacterStatusBarProps) {
  const hpPercent = Math.max(0, Math.min(100, (character.hitPoints / character.maxHitPoints) * 100));
  const hpColor = hpPercent > 60 ? "#51cf66" : hpPercent > 30 ? "#ffd43b" : "#dc3545";
  const icon = CLASS_ICONS[character.characterClass] ?? "\u2B22";

  return (
    <div className={styles.bar}>
      <span className={styles.classIcon}>{icon}</span>
      <div className={styles.nameBlock}>
        <span className={styles.name}>{character.name}</span>
        <span className={styles.meta}>Lv.{character.level} {character.race} {character.characterClass}</span>
      </div>
      <div className={styles.hpBlock}>
        <div className={styles.hpBarOuter}>
          <div
            className={styles.hpBarInner}
            style={{ width: `${hpPercent}%`, background: hpColor }}
          />
        </div>
        <span className={styles.hpText}>{character.hitPoints}/{character.maxHitPoints}</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.statLabel}>AC</span>
        <span className={styles.statValue}>{character.armorClass}</span>
      </div>
    </div>
  );
}
