import React, { useState, useRef, useEffect } from "react";
import { useGame } from "../context/GameContext.js";
import { submitAction, scanObject } from "../services/api.js";
import type { GameTurn, ActionOption } from "@aetheria/shared";
import { DiceRollDisplay } from "./DiceRollDisplay.js";
import { InventoryPanel } from "./InventoryPanel.js";
import styles from "./GameView.module.css";

export function GameView() {
  const { state, dispatch } = useGame();
  const [freeText, setFreeText] = useState("");
  const [showInventory, setShowInventory] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const narrativeEndRef = useRef<HTMLDivElement>(null);

  const currentTurn = state.turns[state.turns.length - 1];

  useEffect(() => {
    narrativeEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.turns.length]);

  async function handleOptionClick(option: ActionOption) {
    if (isProcessing || !state.session) return;
    setIsProcessing(true);

    const result = await submitAction(state.session.id, {
      type: "option",
      optionId: option.id,
      text: option.text,
    });

    if (result.success && result.data) {
      dispatch({ type: "ADD_TURN", turn: result.data.turn });
    } else {
      dispatch({ type: "SET_ERROR", error: result.error?.message ?? "Action failed" });
    }
    setIsProcessing(false);
  }

  async function handleFreeTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!freeText.trim() || isProcessing || !state.session) return;
    setIsProcessing(true);

    const text = freeText;
    setFreeText("");

    const result = await submitAction(state.session.id, {
      type: "freetext",
      text,
    });

    if (result.success && result.data) {
      dispatch({ type: "ADD_TURN", turn: result.data.turn });
    } else {
      dispatch({ type: "SET_ERROR", error: result.error?.message ?? "Action failed" });
    }
    setIsProcessing(false);
  }

  async function handleScan() {
    if (!state.session) return;
    // In a real app, this would open the camera.
    // For demo, we simulate with a placeholder.
    setIsProcessing(true);

    const result = await scanObject(
      state.session.id,
      "placeholder-image-data",
      "base64"
    );

    if (result.success && result.data) {
      dispatch({
        type: "SET_ERROR",
        error: null,
      });
      // Show the scanned item notification
      alert(`Scanned: ${result.data.item.name}\n${result.data.item.description}`);
    } else {
      dispatch({ type: "SET_ERROR", error: result.error?.message ?? "Scan failed" });
    }
    setIsProcessing(false);
  }

  return (
    <div className={styles.container}>
      {/* Header bar */}
      <header className={styles.header}>
        <div className={styles.sessionInfo}>
          <h2 className={styles.sessionTitle}>{state.session?.title}</h2>
          <span className={styles.turnCounter}>Turn {state.session?.turnCount ?? 0}</span>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.iconButton}
            onClick={() => setShowInventory(!showInventory)}
            title="Inventory"
          >
            Inventory
          </button>
          <button className={styles.iconButton} onClick={handleScan} title="Scan Object (AR)">
            Scan
          </button>
          <div className={styles.energyBadge}>
            Energy: {state.user?.energy.dailyActionsMax !== undefined
              ? `${state.user.energy.dailyActionsUsed}/${state.user.energy.dailyActionsMax}`
              : "..."}
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className={styles.mainArea}>
        {/* Narrative scroll */}
        <div className={styles.narrativeScroll}>
          {state.turns.map((turn, index) => (
            <TurnDisplay key={turn.id} turn={turn} isLatest={index === state.turns.length - 1} />
          ))}
          <div ref={narrativeEndRef} />
        </div>

        {/* Inventory sidebar */}
        {showInventory && (
          <aside className={styles.sidebar}>
            <InventoryPanel onClose={() => setShowInventory(false)} />
          </aside>
        )}
      </div>

      {/* Action panel */}
      <div className={styles.actionPanel}>
        {/* Mood indicator border */}
        <div className={styles.moodBorder} />

        {/* Action options */}
        {currentTurn && !isProcessing && (
          <div className={styles.options}>
            {currentTurn.options.map((option) => (
              <button
                key={option.id}
                className={styles.optionButton}
                onClick={() => handleOptionClick(option)}
              >
                <span className={styles.optionType}>{option.type}</span>
                <span className={styles.optionText}>{option.text}</span>
              </button>
            ))}
          </div>
        )}

        {/* Free text input */}
        <form className={styles.freeTextForm} onSubmit={handleFreeTextSubmit}>
          <input
            className={styles.freeTextInput}
            type="text"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder={isProcessing ? "The story unfolds..." : "Or type your own action..."}
            disabled={isProcessing}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={isProcessing || !freeText.trim()}
          >
            Act
          </button>
        </form>

        {isProcessing && (
          <div className={styles.loadingBar}>
            <div className={styles.loadingProgress} />
          </div>
        )}
      </div>

      {/* Error display */}
      {state.error && (
        <div className={styles.errorBanner}>
          <span>{state.error}</span>
          <button onClick={() => dispatch({ type: "SET_ERROR", error: null })}>Dismiss</button>
        </div>
      )}
    </div>
  );
}

function TurnDisplay({ turn, isLatest }: { turn: GameTurn; isLatest: boolean }) {
  return (
    <div className={`${styles.turn} ${isLatest ? styles.latestTurn : ""}`}>
      {/* Player action (if not the first turn) */}
      {turn.playerAction && (
        <div className={styles.playerAction}>
          <span className={styles.playerLabel}>You:</span> {turn.playerAction.text}
        </div>
      )}

      {/* Dice rolls */}
      {turn.diceRolls.length > 0 && (
        <div className={styles.diceRolls}>
          {turn.diceRolls.map((roll) => (
            <DiceRollDisplay key={roll.id} roll={roll} />
          ))}
        </div>
      )}

      {/* Narrative text */}
      <div className={styles.narrative}>
        {turn.narrative}
      </div>

      {/* Scene image */}
      {turn.imageUrl && (
        <div className={styles.sceneImage}>
          <img src={turn.imageUrl} alt="Scene" loading="lazy" />
        </div>
      )}
    </div>
  );
}
