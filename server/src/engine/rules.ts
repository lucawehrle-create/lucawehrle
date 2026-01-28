import type {
  AbilityScores,
  Character,
  CharacterClass,
  CharacterRace,
  DiceRoll,
  DiceType,
  ActionOption,
  getAbilityModifier,
} from "@aetheria/shared";
import { abilityCheck, attackRoll, damageRoll, savingThrow } from "./dice.js";

/** Racial ability score bonuses */
const RACIAL_BONUSES: Record<CharacterRace, Partial<AbilityScores>> = {
  human: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
  elf: { dexterity: 2, intelligence: 1 },
  dwarf: { constitution: 2, wisdom: 1 },
  halfling: { dexterity: 2, charisma: 1 },
  orc: { strength: 2, constitution: 1 },
  tiefling: { charisma: 2, intelligence: 1 },
  dragonborn: { strength: 2, charisma: 1 },
};

/** Hit dice per class */
const CLASS_HIT_DICE: Record<CharacterClass, DiceType> = {
  warrior: "d10",
  mage: "d6",
  rogue: "d8",
  cleric: "d8",
  ranger: "d10",
  bard: "d8",
  paladin: "d10",
};

/** Primary ability for each class */
const CLASS_PRIMARY_ABILITY: Record<CharacterClass, keyof AbilityScores> = {
  warrior: "strength",
  mage: "intelligence",
  rogue: "dexterity",
  cleric: "wisdom",
  ranger: "dexterity",
  bard: "charisma",
  paladin: "strength",
};

/** Base armor class (unarmored) */
const BASE_ARMOR_CLASS = 10;

/** Proficiency bonus by level */
function getProficiencyBonus(level: number): number {
  if (level <= 4) return 2;
  if (level <= 8) return 3;
  if (level <= 12) return 4;
  if (level <= 16) return 5;
  return 6;
}

/** Calculate ability modifier: floor((score - 10) / 2) */
function calcModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Apply racial bonuses to base ability scores.
 */
export function applyRacialBonuses(
  base: AbilityScores,
  race: CharacterRace
): AbilityScores {
  const bonuses = RACIAL_BONUSES[race];
  return {
    strength: base.strength + (bonuses.strength ?? 0),
    dexterity: base.dexterity + (bonuses.dexterity ?? 0),
    constitution: base.constitution + (bonuses.constitution ?? 0),
    intelligence: base.intelligence + (bonuses.intelligence ?? 0),
    wisdom: base.wisdom + (bonuses.wisdom ?? 0),
    charisma: base.charisma + (bonuses.charisma ?? 0),
  };
}

/**
 * Calculate max HP for a character at a given level.
 * Level 1: max hit die + CON modifier
 * Subsequent levels: average hit die + CON modifier per level
 */
export function calculateMaxHP(
  characterClass: CharacterClass,
  level: number,
  constitution: number
): number {
  const hitDie = CLASS_HIT_DICE[characterClass];
  const hitDieMax = parseInt(hitDie.slice(1));
  const conMod = calcModifier(constitution);

  // Level 1: max hit die + CON mod
  let hp = hitDieMax + conMod;

  // Subsequent levels: average roll (rounded up) + CON mod per level
  const avgRoll = Math.ceil(hitDieMax / 2) + 1;
  for (let i = 2; i <= level; i++) {
    hp += avgRoll + conMod;
  }

  return Math.max(hp, 1);
}

/**
 * Calculate armor class for a character.
 */
export function calculateArmorClass(
  dexterity: number,
  hasArmor: boolean,
  armorBonus: number = 0
): number {
  const dexMod = calcModifier(dexterity);
  if (hasArmor) {
    return BASE_ARMOR_CLASS + armorBonus + Math.min(dexMod, 2);
  }
  return BASE_ARMOR_CLASS + dexMod;
}

/** Difficulty class labels */
export type DifficultyLevel =
  | "trivial"
  | "easy"
  | "medium"
  | "hard"
  | "very_hard"
  | "nearly_impossible";

/** Standard difficulty classes (D&D 5e) */
const DIFFICULTY_CLASSES: Record<DifficultyLevel, number> = {
  trivial: 5,
  easy: 10,
  medium: 15,
  hard: 20,
  very_hard: 25,
  nearly_impossible: 30,
};

/**
 * Resolve a skill check for an action.
 * Returns the dice roll result indicating success or failure.
 */
export function resolveSkillCheck(
  character: Character,
  abilityName: keyof AbilityScores,
  difficulty: DifficultyLevel,
  purpose: string
): DiceRoll {
  const abilityScore = character.abilities[abilityName];
  const modifier = calcModifier(abilityScore);
  const profBonus = getProficiencyBonus(character.level);
  // Assume proficiency if it's the class's primary ability
  const primaryAbility = CLASS_PRIMARY_ABILITY[character.characterClass];
  const totalModifier = primaryAbility === abilityName ? modifier + profBonus : modifier;
  const dc = DIFFICULTY_CLASSES[difficulty];

  return abilityCheck(totalModifier, dc, purpose);
}

/**
 * Resolve a combat attack by the player character.
 */
export function resolveCombatAttack(
  character: Character,
  targetAC: number,
  purpose: string
): { attackResult: DiceRoll; damageResult?: DiceRoll } {
  const primaryAbility = CLASS_PRIMARY_ABILITY[character.characterClass];
  const abilityScore = character.abilities[primaryAbility];
  const modifier = calcModifier(abilityScore);
  const profBonus = getProficiencyBonus(character.level);
  const attackMod = modifier + profBonus;

  const attackResult = attackRoll(attackMod, targetAC, purpose);

  let damageResult: DiceRoll | undefined;
  if (attackResult.success) {
    const damageDie = CLASS_HIT_DICE[character.characterClass];
    const diceCount = attackResult.criticalHit ? 2 : 1;
    damageResult = damageRoll(damageDie, diceCount, modifier, `${purpose} damage`);
  }

  return { attackResult, damageResult };
}

/**
 * Resolve a saving throw for the character.
 */
export function resolveSavingThrow(
  character: Character,
  abilityName: keyof AbilityScores,
  difficultyClass: number,
  purpose: string
): DiceRoll {
  const abilityScore = character.abilities[abilityName];
  const modifier = calcModifier(abilityScore);
  return savingThrow(modifier, difficultyClass, purpose);
}

/**
 * Determine which ability an action option requires, with a fallback.
 */
export function inferAbilityForAction(
  option: ActionOption,
  characterClass: CharacterClass
): keyof AbilityScores {
  if (option.requiredAbility) {
    return option.requiredAbility as keyof AbilityScores;
  }

  switch (option.type) {
    case "combat":
      return CLASS_PRIMARY_ABILITY[characterClass];
    case "social":
      return "charisma";
    case "exploration":
      return "wisdom";
    case "skill":
      return "dexterity";
    case "magic":
      return "intelligence";
    case "item":
      return "intelligence";
    default:
      return CLASS_PRIMARY_ABILITY[characterClass];
  }
}

/**
 * Determine difficulty for an action based on context.
 */
export function inferDifficulty(
  option: ActionOption,
  turnNumber: number
): DifficultyLevel {
  if (option.difficultyClass) {
    if (option.difficultyClass <= 5) return "trivial";
    if (option.difficultyClass <= 10) return "easy";
    if (option.difficultyClass <= 15) return "medium";
    if (option.difficultyClass <= 20) return "hard";
    if (option.difficultyClass <= 25) return "very_hard";
    return "nearly_impossible";
  }

  // Scale difficulty with progression
  if (turnNumber < 5) return "easy";
  if (turnNumber < 15) return "medium";
  if (turnNumber < 30) return "hard";
  return "very_hard";
}
