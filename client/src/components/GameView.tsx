import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useGame } from "../context/GameContext.js";
import type { GameNotification } from "../context/GameContext.js";
import { submitAction, scanObject } from "../services/api.js";
import { useSceneImage } from "../hooks/useImagePolling.js";
import type { GameTurn, ActionOption } from "@aetheria/shared";
import { DiceRollDisplay } from "./DiceRollDisplay.js";
import { InventoryPanel } from "./InventoryPanel.js";
import { Typewriter } from "./Typewriter.js";
import { AtmosphericEffects } from "./AtmosphericEffects.js";
import { CharacterStatusBar } from "./CharacterStatusBar.js";
import { CombatHUD } from "./CombatHUD.js";
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

const ACTION_TYPE_LABELS: Record<string, string> = {
  combat: "Kampf",
  social: "Dialog",
  exploration: "Erkundung",
  skill: "Geschick",
  magic: "Magie",
  item: "Gegenstand",
  defend: "Verteidigung",
  stealth: "Schleichen",
};

export function GameView() {
  const { state, dispatch } = useGame();
  const [freeText, setFreeText] = useState("");
  const [showInventory, setShowInventory] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const narrativeEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentTurn = state.turns[state.turns.length - 1];

  useEffect(() => {
    narrativeEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.turns.length]);

  // Auto-dismiss notifications with type-based timing
  useEffect(() => {
    if (state.notifications.length === 0) return;
    const notif = state.notifications[0];
    const delay = notif.type === "level_up" ? 8000
      : notif.type === "xp_gained" ? 3000
      : 5000;
    const timer = setTimeout(() => {
      dispatch({ type: "DISMISS_NOTIFICATION", id: notif.id });
    }, delay);
    return () => clearTimeout(timer);
  }, [state.notifications, dispatch]);

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
      dispatch({
        type: "PROCESS_EVENTS",
        events: result.data.events,
        inventory: result.data.inventory,
        character: result.data.character,
        xpGained: result.data.xpGained,
        diceRolls: result.data.turn.diceRolls,
      });
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
      dispatch({
        type: "PROCESS_EVENTS",
        events: result.data.events,
        inventory: result.data.inventory,
        character: result.data.character,
        xpGained: result.data.xpGained,
        diceRolls: result.data.turn.diceRolls,
      });
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
      alert(`Gescannt: ${result.data.item.name}\n${result.data.item.description}`);
    } else {
      dispatch({ type: "SET_ERROR", error: result.error?.message ?? "Scan fehlgeschlagen" });
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
          <button
            className={styles.menuButton}
            onClick={() => setShowLeaveConfirm(true)}
            title="Hauptmenue"
          >
            {"\u2190"}
          </button>
          <div className={styles.sessionInfo}>
            <h2 className={styles.sessionTitle}>{state.session?.title}</h2>
            <span className={styles.turnCounter}>Zug {state.session?.turnCount ?? 0}</span>
          </div>
          {state.selectedCharacter && (
            <CharacterStatusBar character={state.selectedCharacter} />
          )}
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.iconButton}
            onClick={() => setShowInventory(!showInventory)}
            title="Inventar (I)"
          >
            <span className={styles.btnIcon}>{"\uD83C\uDF92"}</span> Inventar
          </button>
          <button className={styles.iconButton} onClick={handleScan} title="Objekt scannen (AR)">
            <span className={styles.btnIcon}>{"\uD83D\uDCF7"}</span> Scan
          </button>
          <button
            className={styles.iconButton}
            onClick={() => dispatch({ type: "SET_VIEW", view: "settings" })}
            title="Einstellungen"
          >
            <span className={styles.btnIcon}>{"\u2699"}</span>
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
          {/* Combat HUD */}
          {state.combatState && state.selectedCharacter && (
            <CombatHUD
              combatState={state.combatState}
              character={state.selectedCharacter}
            />
          )}

          {state.turns.map((turn, index) => (
            <TurnDisplay
              key={turn.id}
              turn={turn}
              isLatest={index === state.turns.length - 1}
              sessionId={state.session?.id}
            />
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
                className={`${styles.optionButton} ${styles[`optionType_${option.type}`] ?? ""}`}
                onClick={() => handleOptionClick(option)}
              >
                <div className={styles.optionHeader}>
                  <span className={styles.optionIcon}>
                    {ACTION_TYPE_ICONS[option.type] ?? "\u25B6\uFE0F"}
                  </span>
                  <span className={styles.optionType}>
                    {ACTION_TYPE_LABELS[option.type] ?? option.type}
                  </span>
                  {option.difficultyClass && (
                    <span className={styles.dcBadge}>SG {option.difficultyClass}</span>
                  )}
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
          <>
            <div className={styles.loadingBar}>
              <div className={styles.loadingProgress} />
            </div>
            <LoadingFlavor />
          </>
        )}
      </div>

      {/* Game notifications (items, XP, level-up) */}
      {state.notifications.length > 0 && (
        <div className={styles.notificationStack}>
          {state.notifications.map((notif) => (
            <NotificationToast
              key={notif.id}
              notification={notif}
              onDismiss={() => dispatch({ type: "DISMISS_NOTIFICATION", id: notif.id })}
            />
          ))}
        </div>
      )}

      {/* Leave confirmation dialog */}
      {showLeaveConfirm && (
        <div className={styles.dialogOverlay} onClick={() => setShowLeaveConfirm(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.dialogTitle}>Abenteuer verlassen?</h3>
            <p className={styles.dialogText}>
              Dein Fortschritt in dieser Sitzung geht verloren. Bist du sicher?
            </p>
            <div className={styles.dialogActions}>
              <button
                className={styles.dialogCancel}
                onClick={() => setShowLeaveConfirm(false)}
              >
                Weiterspielen
              </button>
              <button
                className={styles.dialogConfirm}
                onClick={() => dispatch({ type: "LEAVE_GAME" })}
              >
                Verlassen
              </button>
            </div>
          </div>
        </div>
      )}

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

const NOTIF_ICONS: Record<GameNotification["type"], string> = {
  item_acquired: "\u2728",
  item_lost: "\uD83D\uDDD1\uFE0F",
  xp_gained: "\u2B50",
  level_up: "\uD83C\uDF89",
};

function NotificationToast({
  notification,
  onDismiss,
}: {
  notification: GameNotification;
  onDismiss: () => void;
}) {
  const isLevelUp = notification.type === "level_up";

  return (
    <div
      className={`${styles.itemNotification} ${isLevelUp ? styles.levelUpNotification : ""}`}
      style={{ borderLeftColor: notification.color ?? "#adb5bd" }}
      onClick={onDismiss}
    >
      <span className={styles.notifIcon}>{NOTIF_ICONS[notification.type]}</span>
      <div className={styles.notifContent}>
        {notification.subtext && (
          <span className={styles.notifLabel}>{notification.subtext}</span>
        )}
        <span className={styles.notifName} style={{ color: notification.color ?? "#adb5bd" }}>
          {notification.text}
        </span>
      </div>
    </div>
  );
}

const SCENE_LOADING_MESSAGES = [
  "Szene wird gemalt...",
  "Farben mischen sich...",
  "Licht und Schatten entstehen...",
  "Die Welt nimmt Gestalt an...",
  "Pinselstriche der Magie...",
];

function TurnDisplay({
  turn,
  isLatest,
  sessionId,
}: {
  turn: GameTurn;
  isLatest: boolean;
  sessionId: string | undefined;
}) {
  const paragraphs = turn.narrative.split(/\n\n+/).filter(Boolean);
  // Only poll for images when a new scene image is being generated (imagePrompt set)
  const expectsNewImage = isLatest && !!turn.imagePrompt;
  const { imageUrl, isLoading: imageLoading } = useSceneImage(
    expectsNewImage ? sessionId : undefined,
    expectsNewImage ? turn.id : undefined,
    turn.imageUrl,
  );
  const [imageRevealed, setImageRevealed] = useState(!!turn.imageUrl);
  const [shimmerMsgIndex, setShimmerMsgIndex] = useState(0);

  // Cycle through loading messages
  useEffect(() => {
    if (!imageLoading || imageUrl) return;
    const timer = setInterval(() => {
      setShimmerMsgIndex((i) => (i + 1) % SCENE_LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [imageLoading, imageUrl]);

  // Trigger cinematic reveal when image loads
  useEffect(() => {
    if (imageUrl && !imageRevealed) {
      // Small delay for smoother experience
      const timer = setTimeout(() => setImageRevealed(true), 200);
      return () => clearTimeout(timer);
    }
  }, [imageUrl, imageRevealed]);

  return (
    <div className={`${styles.turn} ${isLatest ? styles.latestTurn : ""}`}>
      {/* Player action */}
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

      {/* Narrative text */}
      <div className={styles.narrative}>
        {isLatest ? (
          <Typewriter text={turn.narrative} speed={16} />
        ) : (
          paragraphs.map((p, i) => <p key={i} className={styles.paragraph}>{p}</p>)
        )}
      </div>

      {/* Scene image with shimmer loading + cinematic fade-in */}
      <div className={styles.sceneImageContainer}>
        {isLatest && imageLoading && !imageUrl && (
          <div className={styles.imageShimmer}>
            <div className={styles.shimmerWave} />
            <span className={styles.shimmerIcon}>{"\uD83C\uDFA8"}</span>
            <span className={styles.shimmerText}>{SCENE_LOADING_MESSAGES[shimmerMsgIndex]}</span>
          </div>
        )}
        {imageUrl && (
          <div className={`${styles.sceneImage} ${imageRevealed ? styles.sceneImageRevealed : ""}`}>
            <img src={imageUrl} alt="Szene" loading="lazy" />
          </div>
        )}
      </div>
    </div>
  );
}

const LOADING_MESSAGES = [
  "Der Dungeon Master wuerfelt im Verborgenen...",
  "Die Schicksalsfaeden werden neu verwoben...",
  "Arkane Energien formen die naechste Szene...",
  "Die Welt reagiert auf deine Entscheidung...",
  "Alte Magie erwacht zum Leben...",
  "Der Pfad deines Abenteuers entfaltet sich...",
  "Etwas ruehrt sich in der Dunkelheit...",
  "Das Schicksal haelt den Atem an...",
  "Die Geschichte wird weitergesponnen...",
];

function LoadingFlavor() {
  const message = useMemo(
    () => LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)],
    [],
  );
  return <p className={styles.loadingFlavor}>{message}</p>;
}
