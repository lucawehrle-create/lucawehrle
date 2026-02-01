/** Item rarity tiers */
export type ItemRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "artifact";

/** Item category */
export type ItemCategory =
  | "weapon"
  | "armor"
  | "potion"
  | "scroll"
  | "key"
  | "quest"
  | "material"
  | "food"
  | "tool"
  | "scanned_object";

/** A game item, either generated or scanned from real world */
export interface Item {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  /** Visual prompt for consistent image generation of this item */
  visualDescription: string;
  /** Generated image URL or base64 data URI */
  imageUrl?: string;
  properties: ItemProperties;
  /** If scanned from real world, stores the original scan data */
  scanData?: ScannedObjectData;
  acquiredAt: string;
  acquiredTurnId: string;
}

/** Mechanical properties of an item */
export interface ItemProperties {
  damage?: string;
  defense?: number;
  healing?: number;
  uses?: number;
  maxUses?: number;
  weight: number;
  value: number;
  effects: ItemEffect[];
}

/** Special effects an item can apply */
export interface ItemEffect {
  type: "buff" | "debuff" | "heal" | "damage" | "utility" | "narrative";
  target: "self" | "enemy" | "ally" | "environment";
  description: string;
  magnitude?: number;
  duration?: number;
}

/** Data from a real-world object scan (AR feature) */
export interface ScannedObjectData {
  /** Original photo data (base64 or URL) */
  imageSource: string;
  /** AI-detected label of the object */
  detectedLabel: string;
  /** Detailed description preserving proportions and visual details */
  detailedDescription: string;
  /** Specific visual features (stickers, labels, markings, colors) */
  visualFeatures: string[];
  /** Estimated proportions */
  proportions: {
    width: number;
    height: number;
    depth: number;
    unit: "relative";
  };
  /** Confidence score of the detection (0-1) */
  confidence: number;
  scanTimestamp: string;
}

/** Player inventory state */
export interface Inventory {
  characterId: string;
  items: Item[];
  gold: number;
  maxSlots: number;
  equippedWeapon?: string;
  equippedArmor?: string;
}
