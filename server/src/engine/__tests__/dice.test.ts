import { describe, it, expect } from "vitest";
import {
  rollDie,
  rollDice,
  abilityCheck,
  attackRoll,
  damageRoll,
  savingThrow,
  rollAbilityScores,
} from "../dice.js";

describe("Dice System", () => {
  describe("rollDie", () => {
    it("should return a value between 1 and the die's max face", () => {
      for (let i = 0; i < 100; i++) {
        const result = rollDie("d20");
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(20);
      }
    });

    it("should return values in correct range for d4", () => {
      for (let i = 0; i < 50; i++) {
        const result = rollDie("d4");
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(4);
      }
    });

    it("should return values in correct range for d6", () => {
      for (let i = 0; i < 50; i++) {
        const result = rollDie("d6");
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(6);
      }
    });

    it("should return values in correct range for d100", () => {
      for (let i = 0; i < 50; i++) {
        const result = rollDie("d100");
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("rollDice", () => {
    it("should roll the correct number of dice", () => {
      const result = rollDice("d6", 3, 0, "test");
      expect(result.results).toHaveLength(3);
      expect(result.count).toBe(3);
    });

    it("should add modifier to total", () => {
      const result = rollDice("d6", 1, 5, "test");
      expect(result.total).toBe(result.results[0] + 5);
      expect(result.modifier).toBe(5);
    });

    it("should handle negative modifiers", () => {
      const result = rollDice("d6", 1, -2, "test");
      expect(result.total).toBe(result.results[0] - 2);
    });

    it("should detect critical hit on natural 20", () => {
      // Run many times to hit a nat 20 eventually
      let foundCrit = false;
      for (let i = 0; i < 1000; i++) {
        const result = rollDice("d20", 1, 0, "test", 10);
        if (result.results[0] === 20) {
          expect(result.criticalHit).toBe(true);
          expect(result.success).toBe(true);
          foundCrit = true;
          break;
        }
      }
      // Statistical near-certainty of hitting at least one nat 20 in 1000 rolls
      expect(foundCrit).toBe(true);
    });

    it("should detect critical fail on natural 1", () => {
      let foundFumble = false;
      for (let i = 0; i < 1000; i++) {
        const result = rollDice("d20", 1, 0, "test", 10);
        if (result.results[0] === 1) {
          expect(result.criticalFail).toBe(true);
          expect(result.success).toBe(false);
          foundFumble = true;
          break;
        }
      }
      expect(foundFumble).toBe(true);
    });

    it("should evaluate success against difficulty class", () => {
      const result = rollDice("d20", 1, 10, "test", 5);
      // With +10 modifier, even rolling a 1 gives 11, which beats DC 5
      // But natural 1 is always a fail
      if (result.results[0] === 1) {
        expect(result.success).toBe(false);
      } else {
        expect(result.success).toBe(true);
      }
    });

    it("should not set success when no DC is provided", () => {
      const result = rollDice("d6", 1, 0, "test");
      expect(result.success).toBeUndefined();
    });

    it("should assign a unique ID", () => {
      const r1 = rollDice("d20", 1, 0, "test");
      const r2 = rollDice("d20", 1, 0, "test");
      expect(r1.id).toBeDefined();
      expect(r2.id).toBeDefined();
      expect(r1.id).not.toBe(r2.id);
    });

    it("should store the purpose string", () => {
      const result = rollDice("d20", 1, 0, "Attack on goblin");
      expect(result.purpose).toBe("Attack on goblin");
    });
  });

  describe("abilityCheck", () => {
    it("should roll d20 with modifier against DC", () => {
      const result = abilityCheck(3, 15, "Strength check");
      expect(result.diceType).toBe("d20");
      expect(result.count).toBe(1);
      expect(result.modifier).toBe(3);
      expect(result.purpose).toBe("Strength check");
      expect(result.success).toBeDefined();
    });
  });

  describe("attackRoll", () => {
    it("should roll d20 for attack", () => {
      const result = attackRoll(5, 14, "Sword attack");
      expect(result.diceType).toBe("d20");
      expect(result.modifier).toBe(5);
      expect(result.purpose).toBe("Sword attack");
    });
  });

  describe("damageRoll", () => {
    it("should roll specified damage dice", () => {
      const result = damageRoll("d8", 2, 3, "Longsword damage");
      expect(result.diceType).toBe("d8");
      expect(result.count).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.modifier).toBe(3);
      expect(result.total).toBe(result.results[0] + result.results[1] + 3);
    });
  });

  describe("savingThrow", () => {
    it("should roll d20 for saving throw", () => {
      const result = savingThrow(2, 13, "Dexterity save");
      expect(result.diceType).toBe("d20");
      expect(result.modifier).toBe(2);
    });
  });

  describe("rollAbilityScores", () => {
    it("should generate 6 ability scores", () => {
      const scores = rollAbilityScores();
      expect(scores).toHaveLength(6);
    });

    it("should produce scores in valid range (3-18 before modifiers)", () => {
      for (let trial = 0; trial < 50; trial++) {
        const scores = rollAbilityScores();
        for (const score of scores) {
          // Min: 1+1+1 = 3 (three lowest d6 rolls after dropping the lowest)
          // Max: 6+6+6 = 18 (three highest d6 rolls)
          expect(score).toBeGreaterThanOrEqual(3);
          expect(score).toBeLessThanOrEqual(18);
        }
      }
    });
  });
});
