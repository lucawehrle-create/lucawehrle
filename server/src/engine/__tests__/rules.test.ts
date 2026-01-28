import { describe, it, expect } from "vitest";
import {
  applyRacialBonuses,
  calculateMaxHP,
  calculateArmorClass,
  resolveSkillCheck,
  resolveCombatAttack,
  inferAbilityForAction,
  inferDifficulty,
} from "../rules.js";
import type { AbilityScores, Character, ActionOption } from "@aetheria/shared";

const baseAbilities: AbilityScores = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

function createTestCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: "test-char",
    userId: "test-user",
    name: "Test Hero",
    race: "human",
    characterClass: "warrior",
    level: 1,
    experience: 0,
    hitPoints: 12,
    maxHitPoints: 12,
    armorClass: 10,
    abilities: { ...baseAbilities, strength: 16, constitution: 14, ...overrides.abilities },
    appearance: {
      hairColor: "brown",
      hairStyle: "short",
      eyeColor: "blue",
      skinTone: "fair",
      height: "average",
      build: "muscular",
      distinguishingFeatures: [],
      clothing: "chain mail",
      equipment: ["longsword"],
    },
    backstory: "A brave warrior",
    traits: ["brave"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Rules Engine", () => {
  describe("applyRacialBonuses", () => {
    it("should apply human bonuses (+1 to all)", () => {
      const result = applyRacialBonuses(baseAbilities, "human");
      expect(result.strength).toBe(11);
      expect(result.dexterity).toBe(11);
      expect(result.constitution).toBe(11);
      expect(result.intelligence).toBe(11);
      expect(result.wisdom).toBe(11);
      expect(result.charisma).toBe(11);
    });

    it("should apply elf bonuses (+2 DEX, +1 INT)", () => {
      const result = applyRacialBonuses(baseAbilities, "elf");
      expect(result.dexterity).toBe(12);
      expect(result.intelligence).toBe(11);
      expect(result.strength).toBe(10); // no bonus
    });

    it("should apply dwarf bonuses (+2 CON, +1 WIS)", () => {
      const result = applyRacialBonuses(baseAbilities, "dwarf");
      expect(result.constitution).toBe(12);
      expect(result.wisdom).toBe(11);
    });

    it("should apply orc bonuses (+2 STR, +1 CON)", () => {
      const result = applyRacialBonuses(baseAbilities, "orc");
      expect(result.strength).toBe(12);
      expect(result.constitution).toBe(11);
    });
  });

  describe("calculateMaxHP", () => {
    it("should calculate level 1 warrior HP (d10 + CON mod)", () => {
      // CON 14 = +2 modifier, warrior d10 = 10 at level 1
      const hp = calculateMaxHP("warrior", 1, 14);
      expect(hp).toBe(12); // 10 + 2
    });

    it("should calculate level 1 mage HP (d6 + CON mod)", () => {
      // CON 10 = +0 modifier, mage d6 = 6 at level 1
      const hp = calculateMaxHP("mage", 1, 10);
      expect(hp).toBe(6); // 6 + 0
    });

    it("should calculate multi-level HP correctly", () => {
      // Level 3 warrior, CON 14 (+2 mod)
      // Level 1: 10 + 2 = 12
      // Level 2: 6 + 2 = 8 (avg d10 = ceil(10/2)+1 = 6)
      // Level 3: 6 + 2 = 8
      const hp = calculateMaxHP("warrior", 3, 14);
      expect(hp).toBe(28); // 12 + 8 + 8
    });

    it("should never return less than 1 HP", () => {
      // Very low CON (3 = -4 modifier) with d6 class
      const hp = calculateMaxHP("mage", 1, 3);
      expect(hp).toBeGreaterThanOrEqual(1);
    });
  });

  describe("calculateArmorClass", () => {
    it("should calculate unarmored AC as 10 + DEX mod", () => {
      const ac = calculateArmorClass(14, false); // DEX 14 = +2 mod
      expect(ac).toBe(12);
    });

    it("should cap DEX bonus at +2 with armor", () => {
      const ac = calculateArmorClass(20, true, 6); // DEX 20 = +5, but capped at +2
      expect(ac).toBe(18); // 10 + 6 + 2
    });

    it("should handle low DEX with armor", () => {
      const ac = calculateArmorClass(8, true, 5); // DEX 8 = -1 mod
      expect(ac).toBe(14); // 10 + 5 + min(-1, 2) = 14
    });
  });

  describe("resolveSkillCheck", () => {
    it("should return a dice roll result", () => {
      const character = createTestCharacter();
      const result = resolveSkillCheck(character, "strength", "medium", "Break door");
      expect(result.diceType).toBe("d20");
      expect(result.purpose).toBe("Break door");
      expect(result.success).toBeDefined();
    });

    it("should use proficiency bonus for primary ability", () => {
      // Warrior's primary is strength, should have proficiency bonus
      const character = createTestCharacter({ level: 1 });
      const result = resolveSkillCheck(character, "strength", "trivial", "Lift boulder");
      // Modifier should be STR mod (3) + proficiency (2) = 5
      expect(result.modifier).toBe(5);
    });

    it("should not add proficiency for non-primary ability", () => {
      const character = createTestCharacter({ level: 1 });
      const result = resolveSkillCheck(character, "charisma", "trivial", "Persuade guard");
      // Charisma is 10, mod is 0, no proficiency for warrior
      expect(result.modifier).toBe(0);
    });
  });

  describe("resolveCombatAttack", () => {
    it("should return attack roll and possible damage", () => {
      const character = createTestCharacter();
      const result = resolveCombatAttack(character, 12, "Slash goblin");
      expect(result.attackResult).toBeDefined();
      expect(result.attackResult.diceType).toBe("d20");

      if (result.attackResult.success) {
        expect(result.damageResult).toBeDefined();
        expect(result.damageResult!.diceType).toBe("d10"); // Warrior hit die
      } else {
        expect(result.damageResult).toBeUndefined();
      }
    });
  });

  describe("inferAbilityForAction", () => {
    it("should use option's required ability if specified", () => {
      const option: ActionOption = {
        id: "1",
        text: "test",
        type: "combat",
        requiredAbility: "wisdom",
      };
      expect(inferAbilityForAction(option, "warrior")).toBe("wisdom");
    });

    it("should infer combat actions use class primary ability", () => {
      const option: ActionOption = { id: "1", text: "test", type: "combat" };
      expect(inferAbilityForAction(option, "warrior")).toBe("strength");
      expect(inferAbilityForAction(option, "rogue")).toBe("dexterity");
    });

    it("should infer social actions use charisma", () => {
      const option: ActionOption = { id: "1", text: "test", type: "social" };
      expect(inferAbilityForAction(option, "warrior")).toBe("charisma");
    });

    it("should infer magic actions use intelligence", () => {
      const option: ActionOption = { id: "1", text: "test", type: "magic" };
      expect(inferAbilityForAction(option, "warrior")).toBe("intelligence");
    });
  });

  describe("inferDifficulty", () => {
    it("should use explicit DC if provided", () => {
      const option: ActionOption = { id: "1", text: "test", type: "combat", difficultyClass: 22 };
      expect(inferDifficulty(option, 1)).toBe("very_hard");
    });

    it("should scale difficulty with turn number", () => {
      const option: ActionOption = { id: "1", text: "test", type: "combat" };
      expect(inferDifficulty(option, 1)).toBe("easy");
      expect(inferDifficulty(option, 10)).toBe("medium");
      expect(inferDifficulty(option, 20)).toBe("hard");
      expect(inferDifficulty(option, 50)).toBe("very_hard");
    });
  });
});
