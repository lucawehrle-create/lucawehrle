import React from "react";
import type { Quest, QuestLog } from "@aetheria/shared";
import { getQuestProgress, getNextObjective, getDifficultyColor, getQuestIcon } from "@aetheria/shared";
import styles from "./QuestTracker.module.css";

interface QuestTrackerProps {
  questLog: QuestLog | null;
  onOpenQuests: () => void;
}

/**
 * Compact quest tracker widget for the game view.
 * Shows the current main quest and next objective.
 */
export function QuestTracker({ questLog, onOpenQuests }: QuestTrackerProps) {
  if (!questLog) return null;

  // Find the main quest (priority: "main" and status: "active")
  const mainQuest = questLog.activeQuests.find(
    (q) => q.priority === "main" && q.status === "active"
  );

  // If no main quest, show first active side quest
  const activeQuest = mainQuest ?? questLog.activeQuests.find((q) => q.status === "active");

  if (!activeQuest) {
    // No active quest - show minimal state
    return (
      <div className={styles.tracker} onClick={onOpenQuests}>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>{"\uD83D\uDCDC"}</span>
          <span className={styles.emptyText}>Keine aktive Quest</span>
        </div>
      </div>
    );
  }

  return (
    <QuestTrackerCard
      quest={activeQuest}
      onClick={onOpenQuests}
      isMain={activeQuest.priority === "main"}
    />
  );
}

interface QuestTrackerCardProps {
  quest: Quest;
  onClick: () => void;
  isMain: boolean;
}

function QuestTrackerCard({ quest, onClick, isMain }: QuestTrackerCardProps) {
  const progress = getQuestProgress(quest);
  const nextObjective = getNextObjective(quest);
  const difficultyColor = getDifficultyColor(quest.difficulty);
  const icon = getQuestIcon(quest.iconType);

  return (
    <div
      className={`${styles.tracker} ${isMain ? styles.trackerMain : styles.trackerSide}`}
      onClick={onClick}
      style={{ "--quest-color": difficultyColor } as React.CSSProperties}
    >
      {/* Quest header */}
      <div className={styles.header}>
        <span className={styles.icon}>{icon}</span>
        <div className={styles.titleArea}>
          <span className={styles.priority}>
            {isMain ? "Hauptquest" : "Nebenquest"}
          </span>
          <span className={styles.title}>{quest.title}</span>
        </div>
        <span className={styles.progressBadge}>{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${progress}%`, backgroundColor: difficultyColor }}
        />
      </div>

      {/* Current objective */}
      {nextObjective && (
        <div className={styles.objective}>
          <span className={styles.objectiveIcon}>
            {nextObjective.completed ? "\u2713" : "\u25B6"}
          </span>
          <span className={styles.objectiveText}>
            {nextObjective.description}
            {nextObjective.required > 1 && (
              <span className={styles.objectiveProgress}>
                {" "}({nextObjective.current}/{nextObjective.required})
              </span>
            )}
          </span>
        </div>
      )}

      {/* Hint to click */}
      <div className={styles.hint}>
        Klicken fuer Details <kbd className={styles.hintKey}>Q</kbd>
      </div>
    </div>
  );
}
