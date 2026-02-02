import React from "react";
import type { DiceRoll } from "@aetheria/shared";
import styles from "./DiceRollDisplay.module.css";

interface DiceRollDisplayProps {
  roll: DiceRoll;
}

export function DiceRollDisplay({ roll }: DiceRollDisplayProps) {
  const statusClass = roll.criticalHit
    ? styles.critical
    : roll.criticalFail
      ? styles.criticalFail
      : roll.success
        ? styles.success
        : roll.success === false
          ? styles.failure
          : "";

  const isDamage = roll.purpose.toLowerCase().includes("damage");

  return (
    <div className={`${styles.container} ${statusClass}`}>
      <div className={styles.diceIcon}>
        {getDiceSymbol(roll.diceType)}
      </div>
      <div className={styles.info}>
        <div className={styles.purpose}>{roll.purpose}</div>
        <div className={styles.details}>
          {roll.count > 1 ? `${roll.count}` : ""}
          {roll.diceType}
          {roll.modifier !== 0 ? ` ${roll.modifier > 0 ? "+" : ""}${roll.modifier}` : ""}
          {" = "}
          <strong className={styles.total}>{roll.total}</strong>
          {roll.results.length > 1 && (
            <span className={styles.individual}> ({roll.results.join(", ")})</span>
          )}
          {isDamage && <span className={styles.damageLabel}> Schaden</span>}
        </div>
      </div>
      {roll.success !== undefined && (
        <div className={styles.result}>
          {roll.criticalHit
            ? "KRIT!"
            : roll.criticalFail
              ? "PATZER!"
              : roll.success
                ? "Erfolg"
                : "Fehlschlag"}
        </div>
      )}
    </div>
  );
}

function getDiceSymbol(diceType: string): string {
  const symbols: Record<string, string> = {
    d4: "\u25B3",
    d6: "\u25A0",
    d8: "\u25C6",
    d10: "\u2B23",
    d12: "\u2B53",
    d20: "\u2B22",
    d100: "%",
  };
  return symbols[diceType] ?? "\u25CF";
}
