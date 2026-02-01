import React, { useState, useRef, useEffect, useCallback } from "react";
import { useGame } from "../context/GameContext.js";
import { submitAction, scanObject } from "../services/api.js";
import type { GameTurn, ActionOption } from "@aetheria/shared";
import { DiceRollDisplay } from "./DiceRollDisplay.js";
import { InventoryPanel } from "./InventoryPanel.js";
import { Typewriter } from "./Typewriter.js";
import { AtmosphericEffects } from "./AtmosphericEffects.js";
import { CharacterStatusBar } from "./CharacterStatusBar.js";
import { MoodTransition } from "./MoodTransition.js";
import styles from "./GameView.module.css";

const ACTION_TYPE_ICONS: Record<string, string> = {
  combat: "\u2694\uFE0F",
  social: "\uD83D\uDDE3\uFE0F",
  exploration: "\uD83E\uDDED",
  skill: "\uD83C\uDFAF",
  magic: "\u2728",
  item: "\uD83C\uDF92",
  defend: "\uD83D\uDEE1\uFE0F",
  stealth: "\uD83E\uDD77",
};

export function GameView() {
  const { state, dispatch } = useGame();
  const [freeText, setFreeText] = useState("");
  const [showInventory, setShowInventory] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const narrativeEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentTurn = state.turns[state.turns.length - 1];

  useEffect(() => {
    narrativeEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.turns.length]);

  // Keyboard shortcuts: 1-4 for action options, I for inventory
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept if user is typing in the input field
      if (document.activeElement === inputRef.current) return;
      if (isProcessing || !currentTurn) return;

      if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        setShowInventory((prev) => !prev);
        return;
      }

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= currentTurn.options.length) {
        e.preventDefault();
        handleOptionClick(currentTurn.options[num - 1]);
      }
    },
    [currentTurn, isProcessing],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

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
    setIsProcessing(true);

    const result = await scanObject(
      state.session.id,
      "placeholder-image-data",
      "base64"
    );

    if (result.success && result.data) {
      dispatch({ type: "SET_ERROR", error: null });
      alert(`Scanned: ${result.data.item.name}\n${result.data.item.description}`);
    } else {
      dispatch({ type: "SET_ERROR", error: result.error?.message ?? "Scan failed" });
    }
    setIsProcessing(false);
  }

  return (
    <div className={styles.container}>
      {/* Atmospheric background particles */}
      <AtmosphericEffects mood={state.mood} />
      {/* Mood transition flash */}
      <MoodTransition mood={state.mood} />

      {/* Header bar */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.sessionInfo}>
            <h2 className={styles.sessionTitle}>{state.session?.title}</h2>
            <span className={styles.turnCounter}>Turn {state.session?.turnCount ?? 0}</span>
          </div>
          {state.selectedCharacter && (
            <CharacterStatusBar character={state.selectedCharacter} />
          )}
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.iconButton}
            onClick={() => setShowInventory(!showInventory)}
            title="Inventory (I)"
          >
            <span className={styles.btnIcon}>{"\uD83C\uDF92"}</span> Inventar
          </button>
          <button className={styles.iconButton} onClick={handleScan} title="Scan Object (AR)">
            <span className={styles.btnIcon}>{"\uD83D\uDCF7"}</span> Scan
          </button>
          <div className={styles.energyBadge}>
            <span className={styles.energyIcon}>{"\u26A1"}</span>
            {state.user?.energy.dailyActionsMax !== undefined
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

        {/* Action options with keyboard shortcuts */}
        {currentTurn && !isProcessing && currentTurn.options.length > 0 && (
          <div className={styles.options}>
            {currentTurn.options.map((option, index) => (
              <button
                key={option.id}
                className={styles.optionButton}
                onClick={() => handleOptionClick(option)}
              >
                <div className={styles.optionHeader}>
                  <span className={styles.optionIcon}>
                    {ACTION_TYPE_ICONS[option.type] ?? "\u25B6\uFE0F"}
                  </span>
                  <span className={styles.optionType}>{option.type}</span>
                  <kbd className={styles.shortcutKey}>{index + 1}</kbd>
                </div>
                <span className={styles.optionText}>{option.text}</span>
              </button>
            ))}
          </div>
        )}

        {/* Free text input */}
        <form className={styles.freeTextForm} onSubmit={handleFreeTextSubmit}>
          <input
            ref={inputRef}
            className={styles.freeTextInput}
            type="text"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder={isProcessing ? "Die Geschichte entfaltet sich..." : "Oder beschreibe deine eigene Aktion..."}
            disabled={isProcessing}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={isProcessing || !freeText.trim()}
          >
            Los
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
          <button onClick={() => dispatch({ type: "SET_ERROR", error: null })}>OK</button>
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
          <span className={styles.playerLabel}>{"\u2694\uFE0F"} Du:</span> {turn.playerAction.text}
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

      {/* Narrative text - typewriter for latest turn only */}
      <div className={styles.narrative}>
        {isLatest ? (
          <Typewriter text={turn.narrative} speed={16} />
        ) : (
          turn.narrative
        )}
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
