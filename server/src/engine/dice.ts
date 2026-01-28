import type { DiceRoll, DiceType } from "@aetheria/shared";
import { v4 as uuidv4 } from "uuid";

/** Maximum face value for each dice type */
const DICE_FACES: Record<DiceType, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
};

/**
 * Rolls a single die of the given type.
 * Returns a value between 1 and the die's max face value (inclusive).
 */
export function rollDie(type: DiceType): number {
  const faces = DICE_FACES[type];
  return Math.floor(Math.random() * faces) + 1;
}

/**
 * Rolls multiple dice of the given type with an optional modifier.
 * Returns a complete DiceRoll result including critical detection.
 */
export function rollDice(
  type: DiceType,
  count: number,
  modifier: number,
  purpose: string,
  difficultyClass?: number
): DiceRoll {
  const results: number[] = [];
  for (let i = 0; i < count; i++) {
    results.push(rollDie(type));
  }

  const rawTotal = results.reduce((sum, val) => sum + val, 0);
  const total = rawTotal + modifier;

  const criticalHit = type === "d20" && count === 1 && results[0] === 20;
  const criticalFail = type === "d20" && count === 1 && results[0] === 1;

  let success: boolean | undefined;
  if (difficultyClass !== undefined) {
    if (criticalHit) {
      success = true;
    } else if (criticalFail) {
      success = false;
    } else {
      success = total >= difficultyClass;
    }
  }

  return {
    id: uuidv4(),
    diceType: type,
    count,
    results,
    modifier,
    total,
    purpose,
    success,
    criticalHit,
    criticalFail,
  };
}

/**
 * Performs an ability check: rolls 1d20 + ability modifier against a DC.
 */
export function abilityCheck(
  abilityModifier: number,
  difficultyClass: number,
  purpose: string
): DiceRoll {
  return rollDice("d20", 1, abilityModifier, purpose, difficultyClass);
}

/**
 * Rolls for attack: 1d20 + attack modifier vs armor class.
 */
export function attackRoll(
  attackModifier: number,
  targetArmorClass: number,
  purpose: string
): DiceRoll {
  return rollDice("d20", 1, attackModifier, purpose, targetArmorClass);
}

/**
 * Rolls damage dice.
 */
export function damageRoll(
  diceType: DiceType,
  count: number,
  modifier: number,
  purpose: string
): DiceRoll {
  return rollDice(diceType, count, modifier, purpose);
}

/**
 * Rolls a saving throw: 1d20 + save modifier vs DC.
 */
export function savingThrow(
  saveModifier: number,
  difficultyClass: number,
  purpose: string
): DiceRoll {
  return rollDice("d20", 1, saveModifier, purpose, difficultyClass);
}

/**
 * Generates standard ability scores: roll 4d6, drop lowest, for each ability.
 */
export function rollAbilityScores(): number[] {
  const scores: number[] = [];
  for (let i = 0; i < 6; i++) {
    const rolls = [rollDie("d6"), rollDie("d6"), rollDie("d6"), rollDie("d6")];
    rolls.sort((a, b) => a - b);
    // Drop lowest, sum remaining 3
    scores.push(rolls[1] + rolls[2] + rolls[3]);
  }
  return scores;
}
