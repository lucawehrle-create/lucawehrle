import type {
  Quest,
  QuestLog,
  QuestTemplate,
  QuestObjective,
  QuestReward,
  QuestDifficulty,
  QuestPriority,
  QuestIconType,
  ObjectiveType,
} from "@aetheria/shared";
import { v4 as uuidv4 } from "uuid";

/** Built-in quest templates for variety */
const QUEST_TEMPLATES: QuestTemplate[] = [
  // === MAIN STORY QUESTS ===
  {
    id: "explore_dungeon",
    titlePattern: "Die Geheimnisse von {location}",
    descriptionPattern: "Erkunde {location} und entdecke, was sich dort verbirgt. Die Antworten, die du suchst, liegen im Verborgenen.",
    shortDescriptionPattern: "Erkunde {location}",
    priority: "main",
    iconType: "compass",
    difficulty: "standard",
    objectiveTemplates: [
      {
        type: "explore",
        descriptionPattern: "Erkunde {location}",
        targetPattern: "{location}",
        targetKeywords: ["erkund", "betret", "untersuch", "durchsuch", "weiter", "tiefer"],
        requiredMin: 1,
        requiredMax: 1,
      },
      {
        type: "investigate",
        descriptionPattern: "Finde Hinweise auf die Vergangenheit",
        targetPattern: "Hinweise",
        targetKeywords: ["hinweis", "entdeck", "find", "such", "spur"],
        requiredMin: 2,
        requiredMax: 3,
        optional: true,
      },
    ],
    baseRewards: { experienceMin: 50, experienceMax: 100, goldMin: 10, goldMax: 30 },
    tags: ["exploration", "mystery", "dungeon"],
    weight: 12,
  },
  {
    id: "investigate_mystery",
    titlePattern: "Das Raetsel von {target}",
    descriptionPattern: "Seltsame Ereignisse rund um {target} erfordern Nachforschungen. Sprich mit Zeugen und folge den Hinweisen.",
    shortDescriptionPattern: "Untersuche {target}",
    priority: "main",
    iconType: "scroll",
    difficulty: "standard",
    objectiveTemplates: [
      {
        type: "investigate",
        descriptionPattern: "Sammle Hinweise ueber {target}",
        targetPattern: "{target}",
        targetKeywords: ["hinweis", "spur", "untersuch", "find", "entdeck", "such"],
        requiredMin: 2,
        requiredMax: 3,
      },
      {
        type: "talk",
        descriptionPattern: "Befrage Zeugen",
        targetPattern: "Zeugen",
        targetKeywords: ["sprech", "frag", "red", "befrag", "dialog", "unterhalt"],
        requiredMin: 1,
        requiredMax: 2,
      },
    ],
    baseRewards: { experienceMin: 75, experienceMax: 125, goldMin: 15, goldMax: 40 },
    tags: ["mystery", "investigation", "dialogue"],
    weight: 10,
  },

  // === COMBAT QUESTS ===
  {
    id: "clear_enemies",
    titlePattern: "Bedrohung durch {target}",
    descriptionPattern: "{target} terrorisieren die Gegend. Stelle dich ihnen und befreie das Land von dieser Plage.",
    shortDescriptionPattern: "Besiege {target}",
    priority: "side",
    iconType: "sword",
    difficulty: "challenging",
    objectiveTemplates: [
      {
        type: "defeat",
        descriptionPattern: "Besiege {target}",
        targetPattern: "{target}",
        targetKeywords: ["angreif", "kaempf", "besieg", "toet", "vernicht", "attackier"],
        requiredMin: 2,
        requiredMax: 3,
      },
    ],
    baseRewards: { experienceMin: 100, experienceMax: 175, goldMin: 25, goldMax: 60 },
    tags: ["combat", "danger", "monster"],
    minTurn: 3,
    weight: 8,
  },
  {
    id: "boss_hunt",
    titlePattern: "Jagd auf {target}",
    descriptionPattern: "{target} ist eine legendaere Bedrohung. Spuere das Versteck auf und stelle dich dem Kampf deines Lebens.",
    shortDescriptionPattern: "Finde und besiege {target}",
    priority: "main",
    iconType: "skull",
    difficulty: "epic",
    objectiveTemplates: [
      {
        type: "explore",
        descriptionPattern: "Finde das Versteck",
        targetPattern: "Versteck",
        targetKeywords: ["such", "find", "versteck", "hoehle", "lager", "unterschlupf"],
        requiredMin: 1,
        requiredMax: 1,
      },
      {
        type: "defeat",
        descriptionPattern: "Besiege {target}",
        targetPattern: "{target}",
        targetKeywords: ["angreif", "kaempf", "besieg", "toet", "stell"],
        requiredMin: 1,
        requiredMax: 1,
      },
    ],
    baseRewards: { experienceMin: 200, experienceMax: 350, goldMin: 75, goldMax: 150 },
    tags: ["combat", "boss", "epic"],
    minTurn: 8,
    weight: 5,
  },

  // === COLLECTION QUESTS ===
  {
    id: "gather_materials",
    titlePattern: "Sammle {target}",
    descriptionPattern: "Ein Auftraggeber benoetigt dringend {target}. Die Gegend sollte reich an diesen Ressourcen sein.",
    shortDescriptionPattern: "Sammle {target}",
    priority: "side",
    iconType: "gem",
    difficulty: "simple",
    objectiveTemplates: [
      {
        type: "collect",
        descriptionPattern: "Sammle {target}",
        targetPattern: "{target}",
        targetKeywords: ["sammel", "nimm", "heb auf", "find", "pflück", "ernt"],
        requiredMin: 3,
        requiredMax: 5,
      },
    ],
    baseRewards: { experienceMin: 30, experienceMax: 60, goldMin: 15, goldMax: 35 },
    tags: ["exploration", "collection", "safe"],
    weight: 8,
  },

  // === SOCIAL QUESTS ===
  {
    id: "deliver_message",
    titlePattern: "Botschaft fuer {target}",
    descriptionPattern: "Eine wichtige Nachricht muss {target} erreichen. Finde die Person und ueberbringe die Botschaft.",
    shortDescriptionPattern: "Finde {target}",
    priority: "side",
    iconType: "speech",
    difficulty: "simple",
    objectiveTemplates: [
      {
        type: "deliver",
        descriptionPattern: "Finde {target}",
        targetPattern: "{target}",
        targetKeywords: ["such", "find", "treff", "begegn"],
        requiredMin: 1,
        requiredMax: 1,
      },
      {
        type: "talk",
        descriptionPattern: "Ueberbringe die Nachricht",
        targetPattern: "{target}",
        targetKeywords: ["sprech", "sag", "erzaehl", "uebergib", "mitteil"],
        requiredMin: 1,
        requiredMax: 1,
      },
    ],
    baseRewards: { experienceMin: 40, experienceMax: 70, goldMin: 20, goldMax: 45 },
    tags: ["dialogue", "social", "safe"],
    weight: 7,
  },
  {
    id: "escort_npc",
    titlePattern: "Beschuetze {target}",
    descriptionPattern: "{target} braucht sicheres Geleit durch gefaehrliches Gebiet. Halte Angreifer fern.",
    shortDescriptionPattern: "Begleite {target} sicher",
    priority: "side",
    iconType: "shield",
    difficulty: "challenging",
    objectiveTemplates: [
      {
        type: "escort",
        descriptionPattern: "Beschuetze {target}",
        targetPattern: "{target}",
        targetKeywords: ["beschuetz", "begleit", "führ", "geleit", "eskort"],
        requiredMin: 1,
        requiredMax: 1,
      },
      {
        type: "defeat",
        descriptionPattern: "Wehre Angreifer ab",
        targetPattern: "Angreifer",
        targetKeywords: ["angreif", "kaempf", "wehr ab", "verteidig"],
        requiredMin: 1,
        requiredMax: 2,
        optional: true,
      },
    ],
    baseRewards: { experienceMin: 100, experienceMax: 150, goldMin: 35, goldMax: 70 },
    tags: ["escort", "combat", "danger"],
    minTurn: 5,
    weight: 5,
  },

  // === SURVIVAL QUESTS ===
  {
    id: "survive_area",
    titlePattern: "Ueberlebe in {location}",
    descriptionPattern: "{location} ist toedlich. Halte durch, bis du einen Ausweg findest oder Hilfe eintrifft.",
    shortDescriptionPattern: "Ueberlebe in {location}",
    priority: "main",
    iconType: "star",
    difficulty: "challenging",
    objectiveTemplates: [
      {
        type: "survive",
        descriptionPattern: "Ueberlebe {required} Runden",
        targetPattern: "Runden",
        targetKeywords: ["runde", "zug", "durchhalt", "ueberle", "wart"],
        requiredMin: 3,
        requiredMax: 4,
      },
      {
        type: "explore",
        descriptionPattern: "Finde einen Ausweg",
        targetPattern: "Ausweg",
        targetKeywords: ["ausweg", "flucht", "ausgang", "entkommen"],
        requiredMin: 1,
        requiredMax: 1,
        optional: true,
      },
    ],
    baseRewards: { experienceMin: 80, experienceMax: 130, goldMin: 25, goldMax: 55 },
    tags: ["survival", "danger", "exploration"],
    minTurn: 5,
    weight: 4,
  },
];

/** Context-specific quest targets based on narrative */
const QUEST_TARGETS: Record<string, { names: string[]; keywords: string[] }> = {
  monster: {
    names: ["die Goblins", "die Woelfe", "die Skelette", "die Banditen", "die Orks", "die Kobolde", "die Spinnen"],
    keywords: ["goblin", "wolf", "skelett", "bandit", "ork", "kobold", "spinne", "monster", "kreatur"],
  },
  boss: {
    names: ["der Schattenlord", "die Hexenkoenigin", "der gefallene Ritter", "das Monstrum", "der dunkle Magier"],
    keywords: ["schattenlord", "hexe", "ritter", "monstrum", "magier", "boss", "fuehrer", "anf\u00fchrer"],
  },
  npc: {
    names: ["der alte Weise", "die Haendlerin", "der verletzte Reisende", "die Dorfaelteste", "der Bote"],
    keywords: ["weise", "haendl", "reisend", "aeltest", "bote", "npc", "person"],
  },
  location: {
    names: ["der verlassenen Ruine", "dem dunklen Wald", "den alten Minen", "der Hoehle", "dem Turm"],
    keywords: ["ruine", "wald", "mine", "hoehle", "turm", "ort", "gebaeude", "dungeon"],
  },
  item: {
    names: ["Heilkraeuter", "seltene Pilze", "alte Muenzen", "Kristalle", "magische Komponenten"],
    keywords: ["kraut", "pilz", "muenz", "kristall", "komponent", "material", "ressource"],
  },
};

/** NPC givers with titles */
const QUEST_GIVERS = [
  { name: "Meister Aldric", title: "Dorfaeltester" },
  { name: "Elara die Weise", title: "Wandernde Magierin" },
  { name: "Kaptain Vorn", title: "Wachhauptmann" },
  { name: "Tilda Kupferschmied", title: "Schmiedin" },
  { name: "Der geheimnisvolle Fremde", title: "Unbekannter" },
];

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
      totalGoldFromQuests: 0,
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

  /** Get the main active quest (for tracker display) */
  getMainQuest(): Quest | null {
    return this.questLog.activeQuests.find((q) => q.status === "active" && q.priority === "main") ?? null;
  }

  /**
   * Generate a new quest based on current game context.
   */
  generateQuest(
    mood: string,
    turnNumber: number,
    narrativeContext: string,
    preferPriority?: QuestPriority,
  ): Quest | null {
    // Filter templates that match context
    let eligibleTemplates = QUEST_TEMPLATES.filter((template) => {
      if (template.minTurn && turnNumber < template.minTurn) return false;
      if (preferPriority && template.priority !== preferPriority) return false;
      return template.tags.some((tag) => tag === mood || narrativeContext.toLowerCase().includes(tag));
    });

    // Fallback to exploration if nothing matches
    if (eligibleTemplates.length === 0) {
      eligibleTemplates = QUEST_TEMPLATES.filter((t) =>
        t.tags.includes("exploration") && (!t.minTurn || turnNumber >= t.minTurn)
      );
      if (eligibleTemplates.length === 0) return null;
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

    const targetData = QUEST_TARGETS[targetType] ?? QUEST_TARGETS.location;
    const target = targetData.names[Math.floor(Math.random() * targetData.names.length)];
    const locationData = QUEST_TARGETS.location;
    const location = locationData.names[Math.floor(Math.random() * locationData.names.length)];

    // Pick a random quest giver
    const giver = QUEST_GIVERS[Math.floor(Math.random() * QUEST_GIVERS.length)];

    // Replace placeholders
    const title = template.titlePattern.replace("{target}", target).replace("{location}", location);
    const description = template.descriptionPattern.replace("{target}", target).replace("{location}", location);
    const shortDescription = template.shortDescriptionPattern.replace("{target}", target).replace("{location}", location);

    // Generate objectives with keywords
    const objectives: QuestObjective[] = template.objectiveTemplates.map((objTemplate, index) => {
      const required = Math.floor(
        Math.random() * (objTemplate.requiredMax - objTemplate.requiredMin + 1)
      ) + objTemplate.requiredMin;

      // Combine template keywords with target-specific keywords
      const targetKeywords = [
        ...objTemplate.targetKeywords,
        ...targetData.keywords,
      ];

      return {
        id: `obj_${index}`,
        type: objTemplate.type,
        description: objTemplate.descriptionPattern
          .replace("{target}", target)
          .replace("{location}", location)
          .replace("{required}", required.toString()),
        target: objTemplate.targetPattern.replace("{target}", target).replace("{location}", location),
        targetKeywords,
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
      epic: 2.5,
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

    return {
      id: uuidv4(),
      title,
      description,
      shortDescription,
      giver: giver.name,
      giverTitle: giver.title,
      location,
      status: "available",
      priority: template.priority,
      iconType: template.iconType,
      difficulty: template.difficulty,
      objectives,
      rewards: { experience, gold },
      tags: template.tags,
    };
  }

  /** Start a quest (mark as active). */
  startQuest(questId: string, turnNumber: number): Quest | null {
    const quest = this.questLog.activeQuests.find((q) => q.id === questId);
    if (!quest) return null;

    quest.status = "active";
    quest.turnStarted = turnNumber;
    return quest;
  }

  /** Add a generated quest to the pool. */
  addQuest(quest: Quest): void {
    this.questLog.activeQuests.push(quest);
  }

  /**
   * Update quest progress based on player action.
   * Uses keyword matching for better detection.
   */
  updateProgress(
    actionType: ObjectiveType,
    contextText: string,
    amount: number = 1,
  ): { quest: Quest; objective: QuestObjective; newlyCompleted: boolean }[] {
    const updates: { quest: Quest; objective: QuestObjective; newlyCompleted: boolean }[] = [];
    const contextLower = contextText.toLowerCase();

    for (const quest of this.questLog.activeQuests) {
      if (quest.status !== "active") continue;

      for (const objective of quest.objectives) {
        if (objective.completed) continue;
        if (objective.type !== actionType) continue;

        // Check if any keyword matches
        const hasMatch = objective.targetKeywords.some((kw) => contextLower.includes(kw.toLowerCase()));

        if (hasMatch) {
          const wasCompleted = objective.completed;
          objective.current = Math.min(objective.current + amount, objective.required);
          objective.completed = objective.current >= objective.required;

          updates.push({
            quest,
            objective,
            newlyCompleted: !wasCompleted && objective.completed,
          });
        }
      }
    }

    return updates;
  }

  /**
   * Check and complete any quests that have all objectives done.
   * Returns list of completed quests with their rewards.
   */
  checkCompletedQuests(turnNumber: number): Quest[] {
    const completed: Quest[] = [];

    for (let i = this.questLog.activeQuests.length - 1; i >= 0; i--) {
      const quest = this.questLog.activeQuests[i];
      if (quest.status !== "active") continue;

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
        this.questLog.totalGoldFromQuests += quest.rewards.gold ?? 0;

        completed.push(quest);
      }
    }

    return completed;
  }

  /** Fail a quest. */
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

  /** Check for timed-out quests. */
  checkTimedOutQuests(turnNumber: number): Quest[] {
    const failed: Quest[] = [];

    for (const quest of [...this.questLog.activeQuests]) {
      if (quest.status !== "active" || !quest.timeLimit || !quest.turnStarted) continue;

      if (turnNumber - quest.turnStarted >= quest.timeLimit) {
        const failedQuest = this.failQuest(quest.id, turnNumber);
        if (failedQuest) failed.push(failedQuest);
      }
    }

    return failed;
  }

  /** Get a summary of active quests for AI context. */
  getQuestSummary(): string {
    const active = this.questLog.activeQuests.filter((q) => q.status === "active");

    if (active.length === 0) {
      return "Keine aktiven Quests.";
    }

    return active.map((quest) => {
      const nextObj = quest.objectives.find((o) => !o.completed && !o.optional);
      const progress = nextObj ? `Naechstes Ziel: ${nextObj.description} (${nextObj.current}/${nextObj.required})` : "Fast abgeschlossen!";
      return `- [${quest.priority.toUpperCase()}] ${quest.title}: ${progress}`;
    }).join("\n");
  }

  /** Serialize quest log for storage. */
  serialize(): string {
    return JSON.stringify(this.questLog);
  }

  /** Deserialize quest log from storage. */
  static deserialize(data: string): QuestLog {
    return JSON.parse(data) as QuestLog;
  }
}
