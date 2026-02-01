import React from "react";
import { GameProvider, useGame } from "./context/GameContext.js";
import { LoginScreen } from "./components/LoginScreen.js";
import { CharacterSelect } from "./components/CharacterSelect.js";
import { CharacterCreate } from "./components/CharacterCreate.js";
import { ScenarioSelect } from "./components/ScenarioSelect.js";
import { GameView } from "./components/GameView.js";
import { Settings } from "./components/Settings.js";
import styles from "./App.module.css";

function AppContent() {
  const { state } = useGame();

  return (
    <div className={styles.app}>
      {state.isLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Die Faeden des Schicksals werden gesponnen...</p>
        </div>
      )}

      {state.view === "login" && <LoginScreen />}
      {state.view === "character_select" && <CharacterSelect />}
      {state.view === "character_create" && <CharacterCreate />}
      {state.view === "scenario_select" && <ScenarioSelect />}
      {state.view === "game" && <GameView />}
      {state.view === "settings" && <Settings />}
    </div>
  );
}

export function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}
