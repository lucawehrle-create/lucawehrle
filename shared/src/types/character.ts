/** Character race options available in Aetheria */
export type CharacterRace =
  | "human"
  | "elf"
  | "dwarf"
  | "halfling"
  | "orc"
  | "tiefling"
  | "dragonborn";

/** Character class archetypes */
export type CharacterClass =
  | "warrior"
  | "mage"
  | "rogue"
  | "cleric"
  | "ranger"
  | "bard"
  | "paladin";

/** Core ability scores (D&D 5e inspired) */
export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

/** Visual appearance descriptor for consistent image generation */
export interface CharacterAppearance {
  hairColor: string;
  hairStyle: string;
  eyeColor: string;
  skinTone: string;
  height: "short" | "average" | "tall";
  build: "slim" | "average" | "muscular" | "heavy";
  distinguishingFeatures: string[];
  clothing: string;
  equipment: string[];
}

/** Player character definition */
export interface Character {
  id: string;
  userId: string;
  name: string;
  race: CharacterRace;
  characterClass: CharacterClass;
  level: number;
  experience: number;
  hitPoints: number;
  maxHitPoints: number;
  armorClass: number;
  abilities: AbilityScores;
  appearance: CharacterAppearance;
  portraitUrl?: string;
  backstory: string;
  traits: string[];
  createdAt: string;
  updatedAt: string;
}

/** Ability modifier calculation: floor((score - 10) / 2) */
export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Experience thresholds per level (simplified D&D 5e) */
export const LEVEL_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
};
