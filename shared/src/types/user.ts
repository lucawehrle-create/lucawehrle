/** User subscription tier */
export type SubscriptionTier = "free" | "premium" | "creator";

/** User account */
export interface User {
  id: string;
  username: string;
  email: string;
  subscriptionTier: SubscriptionTier;
  energy: EnergyState;
  createdAt: string;
  lastActiveAt: string;
}

/** Energy system state for monetization */
export interface EnergyState {
  current: number;
  max: number;
  /** ISO timestamp of last free energy recharge */
  lastRechargeAt: string;
  /** Number of free daily actions used */
  dailyActionsUsed: number;
  /** Max free daily actions (default 10 for free tier) */
  dailyActionsMax: number;
}

/** Energy cost definitions per action type */
export interface EnergyCosts {
  textGeneration: number;
  imageGeneration: number;
  objectScan: number;
  scenarioCreation: number;
}

/** Default energy costs */
export const DEFAULT_ENERGY_COSTS: EnergyCosts = {
  textGeneration: 1,
  imageGeneration: 2,
  objectScan: 3,
  scenarioCreation: 5,
};

/** Daily free actions per subscription tier */
export const DAILY_FREE_ACTIONS: Record<SubscriptionTier, number> = {
  free: 10,
  premium: Infinity,
  creator: Infinity,
};

/** Energy pack purchasable by the user */
export interface EnergyPack {
  id: string;
  name: string;
  energyAmount: number;
  priceUSD: number;
}

/** Available energy packs */
export const ENERGY_PACKS: EnergyPack[] = [
  { id: "pack_small", name: "Small Energy Pack", energyAmount: 20, priceUSD: 0.99 },
  { id: "pack_medium", name: "Medium Energy Pack", energyAmount: 60, priceUSD: 2.49 },
  { id: "pack_large", name: "Large Energy Pack", energyAmount: 150, priceUSD: 4.99 },
  { id: "pack_mega", name: "Mega Energy Pack", energyAmount: 500, priceUSD: 12.99 },
];
