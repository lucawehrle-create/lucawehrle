import React from "react";
import type { Character, CombatantInfo } from "@aetheria/shared";
import styles from "./CombatHUD.module.css";

interface CombatHUDProps {
  combatState: CombatantInfo;
  character: Character;
}

/** Returns a CSS color based on HP percentage */
function hpColor(percent: number): string {
  if (percent > 60) return "#51cf66";
  if (percent > 30) return "#ffd43b";
  return "#ff6b6b";
}

/** Returns a bar gradient based on HP percentage */
function hpGradient(percent: number): string {
  if (percent > 60) return "linear-gradient(90deg, #37b24d, #51cf66)";
  if (percent > 30) return "linear-gradient(90deg, #e67700, #ffd43b)";
  return "linear-gradient(90deg, #c92a2a, #ff6b6b)";
}

export function CombatHUD({ combatState, character }: CombatHUDProps) {
  const enemyHpPercent = combatState.maxHp > 0
    ? Math.max(0, Math.min(100, (combatState.hp / combatState.maxHp) * 100))
    : 0;
  const playerHpPercent = character.maxHitPoints > 0
    ? Math.max(0, Math.min(100, (character.hitPoints / character.maxHitPoints) * 100))
    : 0;
  const isDefeated = combatState.hp <= 0;

  return (
    <div className={`${styles.combatHud} ${isDefeated ? styles.combatHudDefeated : ""}`}>
      {/* Combat header */}
      <div className={styles.combatHeader}>
        <div className={styles.combatHeaderLine} />
        <span className={styles.combatTitle}>{"\u2694\uFE0F"} Kampf {"\u2694\uFE0F"}</span>
        <div className={styles.combatHeaderLine} />
      </div>

      <div className={styles.combatants}>
        {/* Enemy combatant */}
        <div className={`${styles.combatant} ${styles.enemy} ${isDefeated ? styles.defeated : ""}`}>
          <div className={styles.combatantHeader}>
            <span className={styles.combatantLabel}>Gegner</span>
            <span className={styles.acBadge}>
              {"\uD83D\uDEE1\uFE0F"} {combatState.ac}
            </span>
          </div>
          <span className={styles.combatantName}>{combatState.name}</span>
          <div className={styles.hpSection}>
            <div className={styles.hpBarOuter}>
              <div
                className={styles.hpBarFill}
                style={{
                  width: `${enemyHpPercent}%`,
                  background: isDefeated ? "#555" : hpGradient(enemyHpPercent),
                }}
              />
            </div>
            <span
              className={styles.hpText}
              style={{ color: isDefeated ? "#777" : hpColor(enemyHpPercent) }}
            >
              {combatState.hp}/{combatState.maxHp} HP
            </span>
          </div>

          {/* Defeated banner */}
          {isDefeated && (
            <div className={styles.defeatedBanner}>
              {"\uD83D\uDC80"} Besiegt
            </div>
          )}
        </div>

        {/* VS divider */}
        <div className={styles.vsDivider}>
          <span className={styles.vsIcon}>VS</span>
        </div>

        {/* Player combatant */}
        <div className={`${styles.combatant} ${styles.player}`}>
          <div className={styles.combatantHeader}>
            <span className={styles.combatantLabel}>Du</span>
            <span className={styles.acBadge}>
              {"\uD83D\uDEE1\uFE0F"} {character.armorClass}
            </span>
          </div>
          <span className={styles.combatantName}>{character.name}</span>
          <div className={styles.hpSection}>
            <div className={styles.hpBarOuter}>
              <div
                className={styles.hpBarFill}
                style={{
                  width: `${playerHpPercent}%`,
                  background: hpGradient(playerHpPercent),
                }}
              />
            </div>
            <span
              className={styles.hpText}
              style={{ color: hpColor(playerHpPercent) }}
            >
              {character.hitPoints}/{character.maxHitPoints} HP
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
