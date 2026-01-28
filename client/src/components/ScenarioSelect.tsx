import React from "react";
import { useGame } from "../context/GameContext.js";
import { createSession } from "../services/api.js";
import type { ScenarioTemplate } from "@aetheria/shared";
import styles from "./ScenarioSelect.module.css";

const GENRE_COLORS: Record<string, string> = {
  fantasy: "#51cf66",
  horror: "#dc3545",
  scifi: "#4dabf7",
  mystery: "#b197fc",
  comedy: "#ffd43b",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Novice",
  medium: "Adventurer",
  hard: "Veteran",
  legendary: "Legendary",
};

export function ScenarioSelect() {
  const { state, dispatch } = useGame();

  async function handleSelectScenario(scenario: ScenarioTemplate) {
    if (!state.selectedCharacter) return;
    dispatch({ type: "SET_LOADING", isLoading: true });

    const result = await createSession({
      characterId: state.selectedCharacter.id,
      scenarioId: scenario.id,
    });

    if (result.success && result.data) {
      dispatch({
        type: "START_SESSION",
        session: result.data.session,
        turn: result.data.turn,
      });
    } else {
      dispatch({ type: "SET_ERROR", error: result.error?.message ?? "Failed to start session" });
    }
    dispatch({ type: "SET_LOADING", isLoading: false });
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Choose Your Adventure</h2>
      <p className={styles.subtitle}>
        Playing as <strong>{state.selectedCharacter?.name}</strong>
      </p>

      <div className={styles.grid}>
        {state.scenarios.map((scenario) => (
          <button
            key={scenario.id}
            className={styles.card}
            onClick={() => handleSelectScenario(scenario)}
          >
            <div className={styles.header}>
              <span
                className={styles.genre}
                style={{ color: GENRE_COLORS[scenario.genre] ?? "#6c63ff" }}
              >
                {scenario.genre}
              </span>
              <span className={styles.difficulty}>
                {DIFFICULTY_LABELS[scenario.difficulty]}
              </span>
            </div>
            <h3 className={styles.scenarioTitle}>{scenario.title}</h3>
            <p className={styles.description}>{scenario.description}</p>
            <div className={styles.tags}>
              {scenario.tags.map((tag) => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <button
        className={styles.backButton}
        onClick={() => dispatch({ type: "SET_VIEW", view: "character_select" })}
      >
        Back to Character Selection
      </button>
    </div>
  );
}
