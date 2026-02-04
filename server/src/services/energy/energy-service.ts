import type {
  User,
  EnergyState,
  EnergyCosts,
  SubscriptionTier,
  DEFAULT_ENERGY_COSTS,
  DAILY_FREE_ACTIONS,
} from "@aetheria/shared";

/** Action types that consume energy */
export type EnergyAction = "textGeneration" | "imageGeneration" | "objectScan" | "scenarioCreation";

/** Result of an energy check */
export interface EnergyCheckResult {
  allowed: boolean;
  reason?: string;
  currentEnergy: number;
  cost: number;
  remainingAfter?: number;
}

/**
 * Energy/monetization service implementing the Freemium model.
 *
 * Free tier: 30 actions/day, each generation costs energy.
 * Premium: Unlimited actions, access to better AI models.
 * Creator: Unlimited + scenario creation tools.
 */
export interface EnergyService {
  /** Check if a user has enough energy for an action */
  checkEnergy(user: User, action: EnergyAction): EnergyCheckResult;

  /** Consume energy for an action */
  consumeEnergy(user: User, action: EnergyAction): User;

  /** Recharge daily free energy (called at daily reset) */
  rechargeDailyEnergy(user: User): User;

  /** Add purchased energy to user's balance */
  addPurchasedEnergy(user: User, amount: number): User;

  /** Get energy costs for a subscription tier */
  getCosts(tier: SubscriptionTier): EnergyCosts;
}

/** Default energy costs per action */
const COSTS: EnergyCosts = {
  textGeneration: 1,
  imageGeneration: 2,
  objectScan: 3,
  scenarioCreation: 5,
};

/** Free daily actions per tier */
const FREE_ACTIONS: Record<SubscriptionTier, number> = {
  free: 30,
  premium: Infinity,
  creator: Infinity,
};

/** Max energy capacity per tier */
const MAX_ENERGY: Record<SubscriptionTier, number> = {
  free: 50,
  premium: 500,
  creator: 1000,
};

export class FreemiumEnergyService implements EnergyService {
  checkEnergy(user: User, action: EnergyAction): EnergyCheckResult {
    const cost = COSTS[action];

    // Premium and Creator have unlimited daily actions
    if (user.subscriptionTier !== "free") {
      return {
        allowed: true,
        currentEnergy: user.energy.current,
        cost: 0, // No energy cost for premium
        remainingAfter: user.energy.current,
      };
    }

    // Check daily action limit
    if (user.energy.dailyActionsUsed >= user.energy.dailyActionsMax) {
      // Check if they have purchased energy
      if (user.energy.current < cost) {
        return {
          allowed: false,
          reason: "Daily free actions exhausted and insufficient purchased energy. Purchase an Energy Pack to continue playing.",
          currentEnergy: user.energy.current,
          cost,
        };
      }
    }

    // Check purchased energy (for actions beyond free limit)
    const usingFreeAction = user.energy.dailyActionsUsed < user.energy.dailyActionsMax;

    if (usingFreeAction) {
      return {
        allowed: true,
        currentEnergy: user.energy.current,
        cost: 0,
        remainingAfter: user.energy.current,
      };
    }

    if (user.energy.current < cost) {
      return {
        allowed: false,
        reason: `Insufficient energy. This action costs ${cost} energy, but you only have ${user.energy.current}.`,
        currentEnergy: user.energy.current,
        cost,
      };
    }

    return {
      allowed: true,
      currentEnergy: user.energy.current,
      cost,
      remainingAfter: user.energy.current - cost,
    };
  }

  consumeEnergy(user: User, action: EnergyAction): User {
    const check = this.checkEnergy(user, action);
    if (!check.allowed) {
      throw new Error(check.reason ?? "Insufficient energy");
    }

    const updatedEnergy: EnergyState = { ...user.energy };

    if (user.subscriptionTier !== "free") {
      // Premium users don't consume energy
      return { ...user, energy: updatedEnergy };
    }

    const usingFreeAction = updatedEnergy.dailyActionsUsed < updatedEnergy.dailyActionsMax;

    if (usingFreeAction) {
      updatedEnergy.dailyActionsUsed += 1;
    } else {
      const cost = COSTS[action];
      updatedEnergy.current -= cost;
    }

    return { ...user, energy: updatedEnergy };
  }

  rechargeDailyEnergy(user: User): User {
    const maxDaily = FREE_ACTIONS[user.subscriptionTier];
    return {
      ...user,
      energy: {
        ...user.energy,
        dailyActionsUsed: 0,
        dailyActionsMax: maxDaily === Infinity ? Number.MAX_SAFE_INTEGER : maxDaily,
        lastRechargeAt: new Date().toISOString(),
      },
    };
  }

  addPurchasedEnergy(user: User, amount: number): User {
    const maxEnergy = MAX_ENERGY[user.subscriptionTier];
    return {
      ...user,
      energy: {
        ...user.energy,
        current: Math.min(user.energy.current + amount, maxEnergy),
      },
    };
  }

  getCosts(tier: SubscriptionTier): EnergyCosts {
    if (tier !== "free") {
      return { textGeneration: 0, imageGeneration: 0, objectScan: 0, scenarioCreation: 0 };
    }
    return { ...COSTS };
  }
}
