import React from "react";
import type { Character, CombatantInfo } from "@aetheria/shared";
import styles from "./CombatHUD.module.css";

interface CombatHUDProps {
  combatState: CombatantInfo;
  character: Character;
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
    <div className={styles.combatHud}>
      <div className={styles.combatTitle}>{"\u2694\uFE0F"} Kampf {"\u2694\uFE0F"}</div>
      <div className={styles.combatants}>
        <div className={`${styles.combatant} ${styles.enemy} ${isDefeated ? styles.defeated : ""}`}>
          <span className={styles.combatantName}>{combatState.name}</span>
          <div className={styles.hpBarOuter}>
            <div
              className={styles.hpBarEnemy}
              style={{ width: `${enemyHpPercent}%` }}
            />
          </div>
          <div className={styles.stats}>
            <span>{combatState.hp}/{combatState.maxHp} HP</span>
            <span>AC {combatState.ac}</span>
          </div>
        </div>

        <span className={styles.vsIcon}>VS</span>

        <div className={`${styles.combatant} ${styles.player}`}>
          <span className={styles.combatantName}>{character.name}</span>
          <div className={styles.hpBarOuter}>
            <div
              className={styles.hpBarPlayer}
              style={{ width: `${playerHpPercent}%` }}
            />
          </div>
          <div className={styles.stats}>
            <span>AC {character.armorClass}</span>
            <span>{character.hitPoints}/{character.maxHitPoints} HP</span>
          </div>
        </div>
      </div>
    </div>
  );
}
