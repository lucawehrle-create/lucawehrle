import React from "react";
import { useGame } from "../context/GameContext.js";
import { createSession } from "../services/api.js";
import { NavBar } from "./NavBar.js";
import type { ScenarioTemplate } from "@aetheria/shared";
import styles from "./ScenarioSelect.module.css";

const GENRE_COLORS: Record<string, string> = {
  fantasy: "#51cf66",
  horror: "#dc3545",
  scifi: "#4dabf7",
  mystery: "#b197fc",
  comedy: "#ffd43b",
};

const GENRE_LABELS: Record<string, string> = {
  fantasy: "Fantasy",
  horror: "Horror",
  scifi: "Sci-Fi",
  mystery: "Mysterium",
  comedy: "Komoedie",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Anfaenger",
  medium: "Abenteurer",
  hard: "Veteran",
  legendary: "Legendaer",
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
        character: result.data.character,
      });
    } else {
      dispatch({ type: "SET_ERROR", error: result.error?.message ?? "Sitzung konnte nicht gestartet werden" });
    }
    dispatch({ type: "SET_LOADING", isLoading: false });
  }

  return (
    <div className={styles.page}>
      <NavBar
        back={{ label: "Heldenauswahl", onClick: () => dispatch({ type: "SET_VIEW", view: "character_select" }) }}
      />
      <div className={styles.container}>
        <h2 className={styles.title}>Waehle dein Abenteuer</h2>
        <p className={styles.subtitle}>
          Du spielst als <strong>{state.selectedCharacter?.name}</strong>
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
                  {GENRE_LABELS[scenario.genre] ?? scenario.genre}
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
      </div>
    </div>
  );
}
