import type {
  ObjectScanRequest,
  ObjectScanResponse,
  Item,
  ScannedObjectData,
  ItemRarity,
  ItemCategory,
} from "@aetheria/shared";
import { v4 as uuidv4 } from "uuid";
import type { AIService } from "../ai/ai-service.js";

/**
 * Scanner service for the AR Real-World Integration feature.
 * Handles photographing physical objects and transforming them into in-game items.
 *
 * Key requirement: Proportions and visual details (like stickers on a box)
 * must be accurately captured and reproduced in game graphics.
 */
export interface ScannerService {
  /** Scan a physical object and create an in-game item */
  scanObject(
    request: ObjectScanRequest,
    sessionId: string,
    turnId: string
  ): Promise<{ item: Item; scanResponse: ObjectScanResponse }>;
}

export class ObjectScannerService implements ScannerService {
  constructor(private aiService: AIService) {}

  async scanObject(
    request: ObjectScanRequest,
    sessionId: string,
    turnId: string
  ): Promise<{ item: Item; scanResponse: ObjectScanResponse }> {
    // Analyze the object using AI vision
    const scanResponse = await this.aiService.analyzeObject(request);

    // Create the scanned object data with full detail preservation
    const scanData: ScannedObjectData = {
      imageSource: request.format === "url" ? request.imageData : "[base64-data]",
      detectedLabel: scanResponse.detectedLabel,
      detailedDescription: scanResponse.detailedDescription,
      visualFeatures: scanResponse.visualFeatures,
      proportions: scanResponse.proportions,
      confidence: scanResponse.confidence,
      scanTimestamp: new Date().toISOString(),
    };

    // Build the visual description that preserves exact details
    // This is critical for the "Der Karton" scenario - stickers, proportions, etc.
    const visualDescription = this.buildDetailedVisualDescription(scanResponse);

    // Transform into a game item
    const item: Item = {
      id: uuidv4(),
      name: scanResponse.suggestedGameItem.name,
      description: scanResponse.suggestedGameItem.description,
      category: scanResponse.suggestedGameItem.category as ItemCategory,
      rarity: this.determineRarity(scanResponse.confidence),
      visualDescription,
      properties: {
        weight: (scanResponse.suggestedGameItem.properties.weight as number) ?? 1,
        value: (scanResponse.suggestedGameItem.properties.value as number) ?? 10,
        effects: Array.isArray(scanResponse.suggestedGameItem.properties.effects)
          ? (scanResponse.suggestedGameItem.properties.effects as Item["properties"]["effects"])
          : [],
      },
      scanData,
      acquiredAt: new Date().toISOString(),
      acquiredTurnId: turnId,
    };

    return { item, scanResponse };
  }

  /**
   * Build a highly detailed visual description that preserves the physical object's
   * exact appearance for consistent image generation.
   *
   * This ensures that a scanned cardboard box with specific stickers appears
   * in-game with those exact stickers and proportions, not as a generic box.
   */
  private buildDetailedVisualDescription(scan: ObjectScanResponse): string {
    const parts: string[] = [];

    // Core object description
    parts.push(scan.detailedDescription);

    // Proportions
    const { width, height, depth } = scan.proportions;
    parts.push(
      `Proportions: ${width.toFixed(1)} wide x ${height.toFixed(1)} tall x ${depth.toFixed(1)} deep (relative scale).`
    );

    // Visual features (stickers, markings, labels, etc.)
    if (scan.visualFeatures.length > 0) {
      parts.push(`Distinctive features: ${scan.visualFeatures.join(", ")}.`);
    }

    // Instruction for image generation to maintain fidelity
    parts.push(
      "IMPORTANT: Reproduce this object in the fantasy game world with exact visual fidelity - " +
      "all markings, labels, stickers, and proportions must match the real-world object precisely."
    );

    return parts.join(" ");
  }

  /**
   * Determine item rarity based on scan confidence and randomness.
   * Higher confidence scans yield better items (reward good photos).
   */
  private determineRarity(confidence: number): ItemRarity {
    const roll = Math.random();
    if (confidence > 0.9) {
      if (roll > 0.9) return "epic";
      if (roll > 0.6) return "rare";
      return "uncommon";
    }
    if (confidence > 0.7) {
      if (roll > 0.95) return "rare";
      if (roll > 0.5) return "uncommon";
      return "common";
    }
    return "common";
  }
}
