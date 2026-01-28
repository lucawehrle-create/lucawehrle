import { describe, it, expect } from "vitest";
import { FreemiumEnergyService } from "../energy/energy-service.js";
import type { User } from "@aetheria/shared";

function createTestUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    username: "testhero",
    email: "test@aetheria.ai",
    subscriptionTier: "free",
    energy: {
      current: 10,
      max: 50,
      lastRechargeAt: new Date().toISOString(),
      dailyActionsUsed: 0,
      dailyActionsMax: 10,
    },
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("FreemiumEnergyService", () => {
  const service = new FreemiumEnergyService();

  describe("checkEnergy", () => {
    it("should allow free actions within daily limit", () => {
      const user = createTestUser();
      const result = service.checkEnergy(user, "textGeneration");
      expect(result.allowed).toBe(true);
      expect(result.cost).toBe(0); // Free action
    });

    it("should allow premium users unlimited actions", () => {
      const user = createTestUser({ subscriptionTier: "premium" });
      const result = service.checkEnergy(user, "textGeneration");
      expect(result.allowed).toBe(true);
      expect(result.cost).toBe(0);
    });

    it("should allow creator users unlimited actions", () => {
      const user = createTestUser({ subscriptionTier: "creator" });
      const result = service.checkEnergy(user, "imageGeneration");
      expect(result.allowed).toBe(true);
    });

    it("should block free users who exceeded daily limit with no purchased energy", () => {
      const user = createTestUser({
        energy: {
          current: 0,
          max: 50,
          lastRechargeAt: new Date().toISOString(),
          dailyActionsUsed: 10,
          dailyActionsMax: 10,
        },
      });
      const result = service.checkEnergy(user, "textGeneration");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it("should allow over-limit actions if user has purchased energy", () => {
      const user = createTestUser({
        energy: {
          current: 20,
          max: 50,
          lastRechargeAt: new Date().toISOString(),
          dailyActionsUsed: 10,
          dailyActionsMax: 10,
        },
      });
      const result = service.checkEnergy(user, "textGeneration");
      expect(result.allowed).toBe(true);
      expect(result.cost).toBe(1);
    });

    it("should block if insufficient purchased energy for expensive actions", () => {
      const user = createTestUser({
        energy: {
          current: 1,
          max: 50,
          lastRechargeAt: new Date().toISOString(),
          dailyActionsUsed: 10,
          dailyActionsMax: 10,
        },
      });
      // Object scan costs 3 energy
      const result = service.checkEnergy(user, "objectScan");
      expect(result.allowed).toBe(false);
    });
  });

  describe("consumeEnergy", () => {
    it("should increment daily actions used for free users within limit", () => {
      const user = createTestUser();
      const updated = service.consumeEnergy(user, "textGeneration");
      expect(updated.energy.dailyActionsUsed).toBe(1);
      expect(updated.energy.current).toBe(10); // No purchased energy consumed
    });

    it("should deduct purchased energy for over-limit actions", () => {
      const user = createTestUser({
        energy: {
          current: 20,
          max: 50,
          lastRechargeAt: new Date().toISOString(),
          dailyActionsUsed: 10,
          dailyActionsMax: 10,
        },
      });
      const updated = service.consumeEnergy(user, "textGeneration");
      expect(updated.energy.current).toBe(19); // Cost 1 for text gen
    });

    it("should not consume energy for premium users", () => {
      const user = createTestUser({ subscriptionTier: "premium" });
      const updated = service.consumeEnergy(user, "textGeneration");
      expect(updated.energy.current).toBe(10); // No change
    });

    it("should throw on insufficient energy", () => {
      const user = createTestUser({
        energy: {
          current: 0,
          max: 50,
          lastRechargeAt: new Date().toISOString(),
          dailyActionsUsed: 10,
          dailyActionsMax: 10,
        },
      });
      expect(() => service.consumeEnergy(user, "textGeneration")).toThrow();
    });
  });

  describe("rechargeDailyEnergy", () => {
    it("should reset daily actions to 0", () => {
      const user = createTestUser({
        energy: {
          current: 5,
          max: 50,
          lastRechargeAt: new Date().toISOString(),
          dailyActionsUsed: 8,
          dailyActionsMax: 10,
        },
      });
      const updated = service.rechargeDailyEnergy(user);
      expect(updated.energy.dailyActionsUsed).toBe(0);
      expect(updated.energy.current).toBe(5); // Purchased energy unchanged
    });

    it("should update lastRechargeAt timestamp", () => {
      const user = createTestUser();
      const before = new Date().toISOString();
      const updated = service.rechargeDailyEnergy(user);
      expect(updated.energy.lastRechargeAt >= before).toBe(true);
    });
  });

  describe("addPurchasedEnergy", () => {
    it("should add energy to user's balance", () => {
      const user = createTestUser({ energy: { ...createTestUser().energy, current: 5 } });
      const updated = service.addPurchasedEnergy(user, 20);
      expect(updated.energy.current).toBe(25);
    });

    it("should cap energy at max for free tier", () => {
      const user = createTestUser({ energy: { ...createTestUser().energy, current: 45 } });
      const updated = service.addPurchasedEnergy(user, 100);
      expect(updated.energy.current).toBe(50); // Max for free tier
    });

    it("should have higher cap for premium tier", () => {
      const user = createTestUser({
        subscriptionTier: "premium",
        energy: { ...createTestUser().energy, current: 450 },
      });
      const updated = service.addPurchasedEnergy(user, 100);
      expect(updated.energy.current).toBe(500); // Max for premium tier
    });
  });

  describe("getCosts", () => {
    it("should return zero costs for premium tier", () => {
      const costs = service.getCosts("premium");
      expect(costs.textGeneration).toBe(0);
      expect(costs.imageGeneration).toBe(0);
      expect(costs.objectScan).toBe(0);
    });

    it("should return standard costs for free tier", () => {
      const costs = service.getCosts("free");
      expect(costs.textGeneration).toBe(1);
      expect(costs.imageGeneration).toBe(2);
      expect(costs.objectScan).toBe(3);
      expect(costs.scenarioCreation).toBe(5);
    });
  });
});
