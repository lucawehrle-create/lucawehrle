import type {
  SafetyCheckRequest,
  SafetyCheckResponse,
  SafetyFlag,
} from "@aetheria/shared";

/**
 * Content safety service interface.
 * Implements NSFW/content filtering to comply with app store policies.
 * Prevents the AI from generating extremely violent, illegal, or harmful content.
 */
export interface SafetyService {
  /** Check content for safety violations */
  checkContent(request: SafetyCheckRequest): Promise<SafetyCheckResponse>;
}

/** Blocked keyword patterns organized by category */
interface BlockPattern {
  pattern: RegExp;
  category: SafetyFlag["category"];
  severity: SafetyFlag["severity"];
  description: string;
}

/**
 * Rule-based content safety filter.
 * Uses keyword matching and pattern detection to flag unsafe content.
 * Production would integrate with a dedicated moderation API (OpenAI Moderation, Perspective API).
 */
export class ContentSafetyService implements SafetyService {
  private readonly blockPatterns: BlockPattern[] = [
    // Extreme violence
    {
      pattern: /\b(dismember|disembowel|mutilat|torture\s+in\s+detail|gore\s+description)\b/i,
      category: "violence",
      severity: "high",
      description: "Extremely graphic violence detected",
    },
    // Sexual content
    {
      pattern: /\b(explicit\s+sexual|pornograph|sexually\s+explicit)\b/i,
      category: "sexual",
      severity: "high",
      description: "Explicit sexual content detected",
    },
    // Hate speech
    {
      pattern: /\b(racial\s+slur|ethnic\s+cleansing|genocide\s+glorif)\b/i,
      category: "hate",
      severity: "high",
      description: "Hate speech detected",
    },
    // Self-harm
    {
      pattern: /\b(suicide\s+instruction|self.harm\s+method|detailed\s+self.harm)\b/i,
      category: "self_harm",
      severity: "high",
      description: "Self-harm content detected",
    },
    // Illegal activities
    {
      pattern: /\b(bomb\s+making|drug\s+manufactur|weapon\s+assembly\s+guide)\b/i,
      category: "illegal",
      severity: "high",
      description: "Illegal activity instructions detected",
    },
    // Minor safety
    {
      pattern: /\b(child\s+abuse|minor\s+exploitation)\b/i,
      category: "minors",
      severity: "high",
      description: "Content involving minors detected",
    },
  ];

  /** Words/phrases that warrant a warning but not a block */
  private readonly warnPatterns: BlockPattern[] = [
    {
      pattern: /\b(blood\s+spray|viscera|entrails)\b/i,
      category: "violence",
      severity: "medium",
      description: "Graphic violence detected",
    },
    {
      pattern: /\b(seductive|intimate\s+encounter|passionate\s+embrace)\b/i,
      category: "sexual",
      severity: "low",
      description: "Suggestive content detected",
    },
  ];

  async checkContent(request: SafetyCheckRequest): Promise<SafetyCheckResponse> {
    const flags: SafetyFlag[] = [];
    const content = request.content;

    // Check block patterns (high severity)
    for (const pattern of this.blockPatterns) {
      if (pattern.pattern.test(content)) {
        flags.push({
          category: pattern.category,
          severity: pattern.severity,
          description: pattern.description,
        });
      }
    }

    // Check warning patterns (medium/low severity)
    for (const pattern of this.warnPatterns) {
      if (pattern.pattern.test(content)) {
        flags.push({
          category: pattern.category,
          severity: pattern.severity,
          description: pattern.description,
        });
      }
    }

    const hasHighSeverity = flags.some((f) => f.severity === "high");

    if (hasHighSeverity) {
      return {
        safe: false,
        flags,
        filteredContent: this.sanitizeContent(content),
      };
    }

    return {
      safe: true,
      flags,
    };
  }

  /**
   * Sanitize content by replacing blocked patterns with safe alternatives.
   */
  private sanitizeContent(content: string): string {
    let sanitized = content;

    for (const pattern of this.blockPatterns) {
      sanitized = sanitized.replace(pattern.pattern, "[content filtered]");
    }

    return sanitized;
  }
}
