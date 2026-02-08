import type {
  Quest,
  QuestLog,
  QuestTemplate,
  QuestObjective,
  QuestReward,
  QuestStatus,
  QuestDifficulty,
  ObjectiveType,
  isQuestComplete,
} from "@aetheria/shared";
import { v4 as uuidv4 } from "uuid";

/** Built-in quest templates for variety */
const QUEST_TEMPLATES: QuestTemplate[] = [
  // Exploration quests
  {
    id: "explore_dungeon",
    titlePattern: "Die Geheimnisse von {location}",
    descriptionPattern: "Erkunde {location} und entdecke, was sich dort verbirgt.",
    difficulty: "standard",
    objectiveTemplates: [
      {
        type: "explore",
        descriptionPattern: "Erkunde {location}",
        targetPattern: "{location}",
        requiredMin: 1,
        requiredMax: 1,
      },
      {
        type: "investigate",
        descriptionPattern: "Finde Hinweise auf die Vergangenheit",
        targetPattern: "Hinweise",
        requiredMin: 2,
        requiredMax: 3,
        optional: true,
      },
    ],
    baseRewards: {
      experienceMin: 50,
      experienceMax: 100,
      goldMin: 10,
      goldMax: 30,
    },
    tags: ["exploration", "mystery", "dungeon"],
    weight: 10,
  },
  {
    id: "investigate_mystery",
    titlePattern: "Das Raetsel von {target}",
    descriptionPattern: "Untersuche die seltsamen Ereignisse rund um {target}.",
    difficulty: "standard",
    objectiveTemplates: [
      {
        type: "investigate",
        descriptionPattern: "Finde Hinweise ueber {target}",
        targetPattern: "{target}",
        requiredMin: 3,
        requiredMax: 4,
      },
      {
        type: "talk",
        descriptionPattern: "Befrage Zeugen",
        targetPattern: "Zeugen",
        requiredMin: 1,
        requiredMax: 2,
      },
    ],
    baseRewards: {
      experienceMin: 75,
      experienceMax: 125,
      goldMin: 15,
      goldMax: 40,
    },
    tags: ["mystery", "investigation", "dialogue"],
    weight: 8,
  },

  // Combat quests
  {
    id: "clear_enemies",
    titlePattern: "Bedrohung durch {target}",
    descriptionPattern: "Besiege die {target}, die diese Gegend unsicher machen.",
    difficulty: "challenging",
    objectiveTemplates: [
      {
        type: "defeat",
        descriptionPattern: "Besiege {target}",
        targetPattern: "{target}",
        requiredMin: 2,
        requiredMax: 4,
      },
    ],
    baseRewards: {
      experienceMin: 100,
      experienceMax: 175,
      goldMin: 25,
      goldMax: 60,
    },
    tags: ["combat", "danger", "monster"],
    minTurn: 3,
    weight: 8,
  },
  {
    id: "boss_hunt",
    titlePattern: "Jagd auf {target}",
    descriptionPattern: "Spuere {target} auf und stelle dich der Herausforderung.",
    difficulty: "epic",
    objectiveTemplates: [
      {
        type: "explore",
        descriptionPattern: "Finde das Versteck von {target}",
        targetPattern: "Versteck",
        requiredMin: 1,
        requiredMax: 1,
      },
      {
        type: "defeat",
        descriptionPattern: "Besiege {target}",
        targetPattern: "{target}",
        requiredMin: 1,
        requiredMax: 1,
      },
    ],
    baseRewards: {
      experienceMin: 200,
      experienceMax: 300,
      goldMin: 75,
      goldMax: 150,
    },
    tags: ["combat", "boss", "epic"],
    minTurn: 10,
    weight: 4,
  },

  // Collection quests
  {
    id: "gather_materials",
    titlePattern: "Sammle {target}",
    descriptionPattern: "Finde und sammle {target} fuer einen wichtigen Zweck.",
    difficulty: "simple",
    objectiveTemplates: [
      {
        type: "collect",
        descriptionPattern: "Sammle {target}",
        targetPattern: "{target}",
        requiredMin: 3,
        requiredMax: 5,
      },
    ],
    baseRewards: {
      experienceMin: 30,
      experienceMax: 60,
      goldMin: 10,
      goldMax: 25,
    },
    tags: ["exploration", "collection", "safe"],
    weight: 6,
  },

  // Social quests
  {
    id: "deliver_message",
    titlePattern: "Botschaft an {target}",
    descriptionPattern: "Ueberbringe eine wichtige Nachricht an {target}.",
    difficulty: "simple",
    objectiveTemplates: [
      {
        type: "deliver",
        descriptionPattern: "Finde {target}",
        targetPattern: "{target}",
        requiredMin: 1,
        requiredMax: 1,
      },
      {
        type: "talk",
        descriptionPattern: "Sprich mit {target}",
        targetPattern: "{target}",
        requiredMin: 1,
        requiredMax: 1,
      },
    ],
    baseRewards: {
      experienceMin: 40,
      experienceMax: 70,
      goldMin: 15,
      goldMax: 35,
    },
    tags: ["dialogue", "social", "safe"],
    weight: 7,
  },
  {
    id: "escort_npc",
    titlePattern: "Beschuetze {target}",
    descriptionPattern: "Begleite {target} sicher durch gefaehrliches Gebiet.",
    difficulty: "challenging",
    objectiveTemplates: [
      {
        type: "escort",
        descriptionPattern: "Beschuetze {target}",
        targetPattern: "{target}",
        requiredMin: 1,
        requiredMax: 1,
      },
      {
        type: "defeat",
        descriptionPattern: "Wehre Angreifer ab",
        targetPattern: "Angreifer",
        requiredMin: 1,
        requiredMax: 3,
        optional: true,
      },
    ],
    baseRewards: {
      experienceMin: 100,
      experienceMax: 150,
      goldMin: 30,
      goldMax: 60,
    },
    tags: ["escort", "combat", "danger"],
    minTurn: 5,
    weight: 5,
  },

  // Survival quests
  {
    id: "survive_area",
    titlePattern: "Ueberlebe in {location}",
    descriptionPattern: "Halte durch in {location}, bis Hilfe kommt oder du einen Ausweg findest.",
    difficulty: "challenging",
    objectiveTemplates: [
      {
        type: "survive",
        descriptionPattern: "Ueberlebe {required} Runden",
        targetPattern: "Runden",
        requiredMin: 3,
        requiredMax: 5,
      },
      {
        type: "explore",
        descriptionPattern: "Finde einen sicheren Ort",
        targetPattern: "Sicherer Ort",
        requiredMin: 1,
        requiredMax: 1,
        optional: true,
      },
    ],
    baseRewards: {
      experienceMin: 80,
      experienceMax: 130,
      goldMin: 20,
      goldMax: 45,
    },
    tags: ["survival", "danger", "exploration"],
    minTurn: 5,
    weight: 5,
  },
];

/** Context-specific quest targets based on narrative */
const QUEST_TARGETS: Record<string, string[]> = {
  monster: ["Goblins", "Wölfe", "Skelette", "Banditen", "Orks", "Kobolde", "Trolle", "Spinnen"],
  boss: ["der Schattenlord", "die Hexenkönigin", "der gefallene Ritter", "das Monstrum", "der dunkle Magier"],
  npc: ["der alte Weise", "die Händlerin", "der verletzte Reisende", "die Dorfälteste", "der Bote"],
  location: ["der verlassenen Ruine", "dem dunklen Wald", "den alten Minen", "der Höhle", "dem Turm"],
  item: ["Heilkräuter", "seltene Pilze", "alte Münzen", "Kristalle", "magische Komponenten"],
};

/**
 * Manages quest creation, tracking, and completion for a game session.
 */
export class QuestManager {
  private questLog: QuestLog;

  constructor(sessionId: string, existingLog?: QuestLog) {
    this.questLog = existingLog ?? {
      sessionId,
      activeQuests: [],
      completedQuests: [],
      failedQuests: [],
      totalQuestsCompleted: 0,
      totalExperienceFromQuests: 0,
    };
  }

  /** Get the current quest log */
  getQuestLog(): QuestLog {
    return this.questLog;
  }

  /** Get active quests */
  getActiveQuests(): Quest[] {
    return this.questLog.activeQuests;
  }

  /** Get a specific quest by ID */
  getQuest(questId: string): Quest | undefined {
    return (
      this.questLog.activeQuests.find((q) => q.id === questId) ??
      this.questLog.completedQuests.find((q) => q.id === questId)
    );
  }

  /**
   * Generate a new quest based on current game context.
   * Returns a quest that fits the narrative mood and turn number.
   */
  generateQuest(
    mood: string,
    turnNumber: number,
    narrativeContext: string,
  ): Quest | null {
    // Filter templates that match context
    const eligibleTemplates = QUEST_TEMPLATES.filter((template) => {
      // Check turn requirement
      if (template.minTurn && turnNumber < template.minTurn) {
        return false;
      }
      // Check tag matching with mood
      return template.tags.some((tag) => tag === mood || narrativeContext.toLowerCase().includes(tag));
    });

    if (eligibleTemplates.length === 0) {
      // Fallback to exploration quest
      const fallbackTemplates = QUEST_TEMPLATES.filter((t) =>
        t.tags.includes("exploration") && (!t.minTurn || turnNumber >= t.minTurn)
      );
      if (fallbackTemplates.length === 0) return null;
      return this.instantiateQuest(fallbackTemplates[0], turnNumber, narrativeContext);
    }

    // Weighted random selection
    const totalWeight = eligibleTemplates.reduce((sum, t) => sum + t.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedTemplate = eligibleTemplates[0];

    for (const template of eligibleTemplates) {
      random -= template.weight;
      if (random <= 0) {
        selectedTemplate = template;
        break;
      }
    }

    return this.instantiateQuest(selectedTemplate, turnNumber, narrativeContext);
  }

  /**
   * Create a quest instance from a template.
   */
  private instantiateQuest(
    template: QuestTemplate,
    turnNumber: number,
    narrativeContext: string,
  ): Quest {
    // Pick appropriate target based on template tags
    const targetType = template.tags.includes("combat") ? "monster"
      : template.tags.includes("boss") ? "boss"
      : template.tags.includes("dialogue") ? "npc"
      : template.tags.includes("collection") ? "item"
      : "location";

    const targets = QUEST_TARGETS[targetType] ?? QUEST_TARGETS.location;
    const target = targets[Math.floor(Math.random() * targets.length)];
    const location = QUEST_TARGETS.location[Math.floor(Math.random() * QUEST_TARGETS.location.length)];

    // Replace placeholders in title and description
    const title = template.titlePattern
      .replace("{target}", target)
      .replace("{location}", location);
    const description = template.descriptionPattern
      .replace("{target}", target)
      .replace("{location}", location);

    // Generate objectives
    const objectives: QuestObjective[] = template.objectiveTemplates.map((objTemplate, index) => {
      const required = Math.floor(
        Math.random() * (objTemplate.requiredMax - objTemplate.requiredMin + 1)
      ) + objTemplate.requiredMin;

      return {
        id: `obj_${index}`,
        type: objTemplate.type,
        description: objTemplate.descriptionPattern
          .replace("{target}", target)
          .replace("{location}", location)
          .replace("{required}", required.toString()),
        target: objTemplate.targetPattern
          .replace("{target}", target)
          .replace("{location}", location),
        current: 0,
        required,
        completed: false,
        optional: objTemplate.optional,
      };
    });

    // Calculate rewards based on difficulty
    const difficultyMultiplier: Record<QuestDifficulty, number> = {
      simple: 0.75,
      standard: 1.0,
      challenging: 1.5,
      epic: 2.0,
    };
    const multiplier = difficultyMultiplier[template.difficulty];

    const experience = Math.floor(
      (Math.random() * (template.baseRewards.experienceMax - template.baseRewards.experienceMin) +
        template.baseRewards.experienceMin) * multiplier
    );

    const gold = template.baseRewards.goldMin && template.baseRewards.goldMax
      ? Math.floor(
          (Math.random() * (template.baseRewards.goldMax - template.baseRewards.goldMin) +
            template.baseRewards.goldMin) * multiplier
        )
      : undefined;

    const rewards: QuestReward = {
      experience,
      gold,
    };

    return {
      id: uuidv4(),
      title,
      description,
      status: "available",
      difficulty: template.difficulty,
      objectives,
      rewards,
      tags: template.tags,
    };
  }

  /**
   * Start a quest (mark as active).
   */
  startQuest(questId: string, turnNumber: number): Quest | null {
    const questIndex = this.questLog.activeQuests.findIndex(
      (q) => q.id === questId && q.status === "available"
    );

    if (questIndex === -1) {
      // Maybe it was just generated - check if it exists as available
      const quest = this.questLog.activeQuests.find((q) => q.id === questId);
      if (quest) {
        quest.status = "active";
        quest.turnStarted = turnNumber;
        return quest;
      }
      return null;
    }

    const quest = this.questLog.activeQuests[questIndex];
    quest.status = "active";
    quest.turnStarted = turnNumber;
    return quest;
  }

  /**
   * Add a generated quest to the available pool.
   */
  addQuest(quest: Quest): void {
    this.questLog.activeQuests.push(quest);
  }

  /**
   * Update quest progress based on player action.
   * Returns list of objectives that were advanced.
   */
  updateProgress(
    actionType: ObjectiveType,
    target: string,
    amount: number = 1,
  ): { quest: Quest; objective: QuestObjective }[] {
    const updates: { quest: Quest; objective: QuestObjective }[] = [];

    for (const quest of this.questLog.activeQuests) {
      if (quest.status !== "active") continue;

      for (const objective of quest.objectives) {
        if (objective.completed) continue;
        if (objective.type !== actionType) continue;

        // Check if target matches (fuzzy matching)
        const targetLower = target.toLowerCase();
        const objTargetLower = objective.target.toLowerCase();

        if (
          targetLower.includes(objTargetLower) ||
          objTargetLower.includes(targetLower) ||
          this.isSimilarTarget(targetLower, objTargetLower)
        ) {
          objective.current = Math.min(objective.current + amount, objective.required);

          if (objective.current >= objective.required) {
            objective.completed = true;
          }

          updates.push({ quest, objective });
        }
      }
    }

    return updates;
  }

  /**
   * Fuzzy matching for similar targets.
   */
  private isSimilarTarget(a: string, b: string): boolean {
    // Check for common keywords
    const keywords = ["goblin", "wolf", "skelett", "bandit", "ork", "spinne", "troll"];
    for (const keyword of keywords) {
      if (a.includes(keyword) && b.includes(keyword)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check and complete any quests that have all objectives done.
   * Returns list of completed quests.
   */
  checkCompletedQuests(turnNumber: number): Quest[] {
    const completed: Quest[] = [];

    for (let i = this.questLog.activeQuests.length - 1; i >= 0; i--) {
      const quest = this.questLog.activeQuests[i];
      if (quest.status !== "active") continue;

      // Check if all required objectives are complete
      const requiredComplete = quest.objectives
        .filter((obj) => !obj.optional)
        .every((obj) => obj.completed);

      if (requiredComplete) {
        quest.status = "completed";
        quest.turnCompleted = turnNumber;

        // Move to completed list
        this.questLog.activeQuests.splice(i, 1);
        this.questLog.completedQuests.push(quest);
        this.questLog.totalQuestsCompleted++;
        this.questLog.totalExperienceFromQuests += quest.rewards.experience;

        completed.push(quest);
      }
    }

    return completed;
  }

  /**
   * Fail a quest (e.g., time limit exceeded).
   */
  failQuest(questId: string, turnNumber: number): Quest | null {
    const questIndex = this.questLog.activeQuests.findIndex(
      (q) => q.id === questId && q.status === "active"
    );

    if (questIndex === -1) return null;

    const quest = this.questLog.activeQuests[questIndex];
    quest.status = "failed";
    quest.turnCompleted = turnNumber;

    this.questLog.activeQuests.splice(questIndex, 1);
    this.questLog.failedQuests.push(quest);

    return quest;
  }

  /**
   * Check for timed-out quests.
   */
  checkTimedOutQuests(turnNumber: number): Quest[] {
    const failed: Quest[] = [];

    for (const quest of this.questLog.activeQuests) {
      if (quest.status !== "active") continue;
      if (!quest.timeLimit || !quest.turnStarted) continue;

      if (turnNumber - quest.turnStarted >= quest.timeLimit) {
        const failedQuest = this.failQuest(quest.id, turnNumber);
        if (failedQuest) {
          failed.push(failedQuest);
        }
      }
    }

    return failed;
  }

  /**
   * Get a summary of active quests for AI context.
   */
  getQuestSummary(): string {
    const active = this.questLog.activeQuests.filter((q) => q.status === "active");

    if (active.length === 0) {
      return "Keine aktiven Quests.";
    }

    return active.map((quest) => {
      const progress = quest.objectives
        .filter((obj) => !obj.optional)
        .map((obj) => `${obj.description}: ${obj.current}/${obj.required}`)
        .join(", ");

      return `- ${quest.title}: ${progress}`;
    }).join("\n");
  }

  /**
   * Serialize quest log for storage.
   */
  serialize(): string {
    return JSON.stringify(this.questLog);
  }

  /**
   * Deserialize quest log from storage.
   */
  static deserialize(data: string): QuestLog {
    return JSON.parse(data) as QuestLog;
  }
}
