import { describe, it, expect } from "vitest";
import { getAbilityModifier, LEVEL_THRESHOLDS } from "../types/character.js";

describe("Character Utilities", () => {
  describe("getAbilityModifier", () => {
    it("should return 0 for score of 10", () => {
      expect(getAbilityModifier(10)).toBe(0);
    });

    it("should return 0 for score of 11", () => {
      expect(getAbilityModifier(11)).toBe(0);
    });

    it("should return -1 for score of 8", () => {
      expect(getAbilityModifier(8)).toBe(-1);
    });

    it("should return +3 for score of 16", () => {
      expect(getAbilityModifier(16)).toBe(3);
    });

    it("should return +5 for score of 20", () => {
      expect(getAbilityModifier(20)).toBe(5);
    });

    it("should return -5 for score of 1", () => {
      expect(getAbilityModifier(1)).toBe(-5);
    });

    it("should handle edge case of score 0", () => {
      expect(getAbilityModifier(0)).toBe(-5);
    });
  });

  describe("LEVEL_THRESHOLDS", () => {
    it("should have thresholds for levels 1-20", () => {
      for (let level = 1; level <= 20; level++) {
        expect(LEVEL_THRESHOLDS[level]).toBeDefined();
      }
    });

    it("should start at 0 XP for level 1", () => {
      expect(LEVEL_THRESHOLDS[1]).toBe(0);
    });

    it("should be monotonically increasing", () => {
      for (let level = 2; level <= 20; level++) {
        expect(LEVEL_THRESHOLDS[level]).toBeGreaterThan(LEVEL_THRESHOLDS[level - 1]);
      }
    });
  });
});
