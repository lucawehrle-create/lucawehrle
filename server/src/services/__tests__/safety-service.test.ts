import { describe, it, expect } from "vitest";
import { ContentSafetyService } from "../safety/safety-service.js";

describe("ContentSafetyService", () => {
  const service = new ContentSafetyService();

  describe("checkContent", () => {
    it("should pass safe fantasy content", async () => {
      const result = await service.checkContent({
        content: "You draw your sword and prepare for battle against the dragon.",
        contentType: "text",
      });
      expect(result.safe).toBe(true);
      expect(result.flags).toHaveLength(0);
    });

    it("should pass standard RPG combat descriptions", async () => {
      const result = await service.checkContent({
        content: "The warrior swings his blade, striking the goblin. The creature falls to the ground.",
        contentType: "text",
      });
      expect(result.safe).toBe(true);
    });

    it("should flag extreme violence", async () => {
      const result = await service.checkContent({
        content: "The creature proceeds to dismember the victim in graphic detail.",
        contentType: "text",
      });
      expect(result.safe).toBe(false);
      expect(result.flags.some((f) => f.category === "violence")).toBe(true);
      expect(result.filteredContent).toBeDefined();
    });

    it("should flag explicit sexual content", async () => {
      const result = await service.checkContent({
        content: "The scene becomes explicit sexual in nature.",
        contentType: "text",
      });
      expect(result.safe).toBe(false);
      expect(result.flags.some((f) => f.category === "sexual")).toBe(true);
    });

    it("should flag illegal activity instructions", async () => {
      const result = await service.checkContent({
        content: "Here are instructions for bomb making techniques.",
        contentType: "text",
      });
      expect(result.safe).toBe(false);
      expect(result.flags.some((f) => f.category === "illegal")).toBe(true);
    });

    it("should provide filtered content for blocked content", async () => {
      const result = await service.checkContent({
        content: "The villain proceeds to dismember the hero in a gruesome scene.",
        contentType: "text",
      });
      expect(result.safe).toBe(false);
      expect(result.filteredContent).toBeDefined();
      expect(result.filteredContent).toContain("[content filtered]");
    });

    it("should detect medium severity warnings without blocking", async () => {
      const result = await service.checkContent({
        content: "Blood spray covered the walls of the ancient tomb.",
        contentType: "text",
      });
      // Medium severity shouldn't block, just flag
      expect(result.safe).toBe(true);
      expect(result.flags.length).toBeGreaterThan(0);
      expect(result.flags[0].severity).toBe("medium");
    });

    it("should handle image prompt content type", async () => {
      const result = await service.checkContent({
        content: "A peaceful village with a happy market scene",
        contentType: "image_prompt",
      });
      expect(result.safe).toBe(true);
    });

    it("should handle empty content", async () => {
      const result = await service.checkContent({
        content: "",
        contentType: "text",
      });
      expect(result.safe).toBe(true);
      expect(result.flags).toHaveLength(0);
    });
  });
});
