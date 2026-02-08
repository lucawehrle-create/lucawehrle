import React from "react";
import { useGame } from "../context/GameContext.js";
import type { Quest, QuestObjective, QuestDifficulty, QuestPriority } from "@aetheria/shared";
import { getQuestProgress, getQuestIcon } from "@aetheria/shared";
import styles from "./QuestPanel.module.css";

const DIFFICULTY_LABELS: Record<QuestDifficulty, string> = {
  simple: "Einfach",
  standard: "Standard",
  challenging: "Anspruchsvoll",
  epic: "Episch",
};

const DIFFICULTY_COLORS: Record<QuestDifficulty, string> = {
  simple: "#51cf66",
  standard: "#339af0",
  challenging: "#b197fc",
  epic: "#ffd43b",
};

interface QuestPanelProps {
  onClose: () => void;
}

export function QuestPanel({ onClose }: QuestPanelProps) {
  const { state } = useGame();
  const questLog = state.questLog;

  const activeQuests = questLog?.activeQuests.filter((q) => q.status === "active") ?? [];
  const availableQuests = questLog?.activeQuests.filter((q) => q.status === "available") ?? [];
  const completedQuests = questLog?.completedQuests ?? [];

  // Sort active quests: main quests first, then by difficulty
  const sortedActiveQuests = [...activeQuests].sort((a, b) => {
    if (a.priority === "main" && b.priority !== "main") return -1;
    if (a.priority !== "main" && b.priority === "main") return 1;
    const diffOrder = { epic: 0, challenging: 1, standard: 2, simple: 3 };
    return diffOrder[a.difficulty] - diffOrder[b.difficulty];
  });

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>Quest-Log</h3>
        <button className={styles.closeButton} onClick={onClose}>
          Schliessen
        </button>
      </div>

      {questLog && (
        <>
          <div className={styles.statsBar}>
            <span className={styles.stat}>
              <span className={styles.statLabel}>Abgeschlossen</span>
              <span className={styles.statValue}>{questLog.totalQuestsCompleted}</span>
            </span>
            <span className={styles.stat}>
              <span className={styles.statLabel}>XP verdient</span>
              <span className={styles.statValue}>{questLog.totalExperienceFromQuests}</span>
            </span>
          </div>

          <div className={styles.scrollArea}>
            {sortedActiveQuests.length > 0 && (
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Aktive Quests</h4>
                <div className={styles.questList}>
                  {sortedActiveQuests.map((quest) => (
                    <QuestCard key={quest.id} quest={quest} />
                  ))}
                </div>
              </div>
            )}

            {availableQuests.length > 0 && (
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Verfuegbare Quests</h4>
                <div className={styles.questList}>
                  {availableQuests.map((quest) => (
                    <QuestCard key={quest.id} quest={quest} />
                  ))}
                </div>
              </div>
            )}

            {completedQuests.length > 0 && (
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Abgeschlossene Quests</h4>
                <div className={styles.questList}>
                  {completedQuests.slice(-5).reverse().map((quest) => (
                    <QuestCard key={quest.id} quest={quest} />
                  ))}
                </div>
              </div>
            )}

            {sortedActiveQuests.length === 0 && availableQuests.length === 0 && completedQuests.length === 0 && (
              <p className={styles.emptyMessage}>
                Keine Quests verfuegbar. Erkunde die Welt, um neue Aufgaben zu finden!
              </p>
            )}
          </div>
        </>
      )}

      {!questLog && (
        <p className={styles.emptyMessage}>Quest-Log wird geladen...</p>
      )}
    </div>
  );
}

function QuestCard({ quest }: { quest: Quest }) {
  const [expanded, setExpanded] = React.useState(quest.status === "active");
  const progress = getQuestProgress(quest);
  const difficultyColor = DIFFICULTY_COLORS[quest.difficulty];
  const isCompleted = quest.status === "completed";
  const icon = getQuestIcon(quest.iconType);

  return (
    <div
      className={`${styles.questCard} ${expanded ? styles.questCardExpanded : ""} ${isCompleted ? styles.questCardCompleted : ""}`}
      style={{ borderLeftColor: difficultyColor }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className={styles.questHeader}>
        <div className={styles.questTitleArea}>
          <span
            className={`${styles.questPriority} ${quest.priority === "main" ? styles.questPriorityMain : styles.questPrioritySide}`}
          >
            {quest.priority === "main" ? "Hauptquest" : "Nebenquest"}
          </span>
          <span className={styles.questTitle}>
            <span className={styles.questIcon}>{icon}</span>
            {quest.title}
          </span>
        </div>
        <span className={styles.questDifficulty} style={{ color: difficultyColor }}>
          {DIFFICULTY_LABELS[quest.difficulty]}
        </span>
      </div>

      {quest.status === "active" && (
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%`, backgroundColor: difficultyColor }}
          />
          <span className={styles.progressText}>{progress}%</span>
        </div>
      )}

      {expanded && (
        <>
          {quest.giver && (
            <div className={styles.questGiver}>
              {quest.giver}
              {quest.giverTitle && ` - ${quest.giverTitle}`}
            </div>
          )}

          <p className={styles.questDescription}>{quest.description}</p>

          <div className={styles.objectives}>
            <h5 className={styles.objectivesTitle}>Ziele</h5>
            {quest.objectives.map((obj) => (
              <ObjectiveRow key={obj.id} objective={obj} />
            ))}
          </div>

          {quest.rewards && (
            <div className={styles.rewards}>
              <span className={styles.rewardLabel}>Belohnung:</span>
              <span className={styles.rewardXP}>{quest.rewards.experience} XP</span>
              {quest.rewards.gold && (
                <span className={styles.rewardGold}>{quest.rewards.gold} Gold</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ObjectiveRow({ objective }: { objective: QuestObjective }) {
  const isComplete = objective.completed;

  return (
    <div className={`${styles.objective} ${isComplete ? styles.objectiveComplete : ""}`}>
      <span className={styles.objectiveCheck}>
        {isComplete ? "\u2713" : "\u25CB"}
      </span>
      <span className={styles.objectiveText}>
        {objective.description}
        {!isComplete && objective.required > 1 && (
          <span className={styles.objectiveProgress}>
            {" "}({objective.current}/{objective.required})
          </span>
        )}
      </span>
      {objective.optional && (
        <span className={styles.optionalBadge}>Optional</span>
      )}
    </div>
  );
}
