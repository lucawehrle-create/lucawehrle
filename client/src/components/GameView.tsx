import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useGame } from "../context/GameContext.js";
import type { GameNotification } from "../context/GameContext.js";
import { submitAction } from "../services/api.js";
import { useSceneImage } from "../hooks/useImagePolling.js";
import type { GameTurn, ActionOption } from "@aetheria/shared";
import { DiceRollDisplay } from "./DiceRollDisplay.js";
import { InventoryPanel } from "./InventoryPanel.js";
import { QuestPanel } from "./QuestPanel.js";
import { QuestTracker } from "./QuestTracker.js";
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
  const [showQuests, setShowQuests] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [pressedOptionIdx, setPressedOptionIdx] = useState<number | null>(null);
  const narrativeEndRef = useRef<HTMLDivElement>(null);
  const narrativeScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guard against duplicate submissions (e.g. rapid double-click before state update)
  const lastSubmitRef = useRef<string | null>(null);

  // Defensive: ensure turns is an array and get the last valid turn
  const turns = Array.isArray(state.turns) ? state.turns : [];
  const currentTurn = turns.length > 0 ? turns[turns.length - 1] : null;

  // --- Persistent scene image ---
  // Track the currently displayed scene image and cross-fade on change
  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const [prevSceneImage, setPrevSceneImage] = useState<string | null>(null);

  // Poll for new image only when the latest turn expects one (has imagePrompt)
  const expectsNewImage = !!currentTurn?.imagePrompt;
  const { imageUrl: polledImageUrl, isLoading: sceneImageLoading } = useSceneImage(
    expectsNewImage ? state.session?.id : undefined,
    expectsNewImage ? currentTurn?.id : undefined,
    currentTurn?.imageUrl,
  );

  // Update persistent scene image when a new one arrives (polled or reused)
  useEffect(() => {
    const newUrl = polledImageUrl || currentTurn?.imageUrl;
    if (newUrl && newUrl !== sceneImage) {
      setPrevSceneImage(sceneImage);
      setSceneImage(newUrl);
    }
  }, [polledImageUrl, currentTurn?.imageUrl]);

  useEffect(() => {
    narrativeEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length]);

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
        setShowQuests(false);
        return;
      }

      if (e.key === "q" || e.key === "Q") {
        e.preventDefault();
        setShowQuests((prev) => !prev);
        setShowInventory(false);
        return;
      }

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= currentTurn.options.length) {
        e.preventDefault();
        // Flash the pressed option button briefly
        setPressedOptionIdx(num - 1);
        setTimeout(() => setPressedOptionIdx(null), 200);
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
    // Deduplicate rapid clicks on the same option
    const submitKey = `option:${option.id}`;
    if (lastSubmitRef.current === submitKey) return;
    lastSubmitRef.current = submitKey;
    setIsProcessing(true);

    try {
      const result = await submitAction(state.session.id, {
        type: "option",
        optionId: option.id,
        text: option.text,
      });

      if (result.success && result.data?.turn?.narrative) {
        dispatch({ type: "ADD_TURN", turn: result.data.turn });
        dispatch({
          type: "PROCESS_EVENTS",
          events: result.data.events,
          inventory: result.data.inventory,
          character: result.data.character,
          xpGained: result.data.xpGained,
          diceRolls: result.data.turn.diceRolls,
          questLog: result.data.questLog,
        });
      } else {
        // Handle explicit errors (including INSUFFICIENT_ENERGY) and invalid responses
        let errorMsg = result.error?.message ?? "Aktion fehlgeschlagen";
        if (result.error?.code === "INSUFFICIENT_ENERGY") {
          errorMsg = "Energie aufgebraucht! Bitte warte bis morgen oder kaufe ein Energie-Paket.";
        } else if (result.success) {
          errorMsg = "Die Antwort des Servers war unvollstaendig. Bitte versuche es erneut.";
        }
        console.error("[GameView] Action failed:", result.error);
        dispatch({ type: "SET_ERROR", error: errorMsg });
      }
    } catch (err) {
      console.error("[GameView] Unexpected error:", err);
      dispatch({ type: "SET_ERROR", error: "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut." });
    } finally {
      setIsProcessing(false);
      lastSubmitRef.current = null;
    }
  }

  async function handleFreeTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!freeText.trim() || isProcessing || !state.session) return;
    // Deduplicate rapid form submissions of the same text
    const submitKey = `freetext:${freeText.trim()}`;
    if (lastSubmitRef.current === submitKey) return;
    lastSubmitRef.current = submitKey;
    setIsProcessing(true);

    const text = freeText;
    setFreeText("");

    try {
      const result = await submitAction(state.session.id, {
        type: "freetext",
        text,
      });

      if (result.success && result.data?.turn?.narrative) {
        dispatch({ type: "ADD_TURN", turn: result.data.turn });
        dispatch({
          type: "PROCESS_EVENTS",
          events: result.data.events,
          inventory: result.data.inventory,
          character: result.data.character,
          xpGained: result.data.xpGained,
          diceRolls: result.data.turn.diceRolls,
          questLog: result.data.questLog,
        });
      } else {
        // Handle explicit errors (including INSUFFICIENT_ENERGY) and invalid responses
        let errorMsg = result.error?.message ?? "Aktion fehlgeschlagen";
        if (result.error?.code === "INSUFFICIENT_ENERGY") {
          errorMsg = "Energie aufgebraucht! Bitte warte bis morgen oder kaufe ein Energie-Paket.";
        } else if (result.success) {
          errorMsg = "Die Antwort des Servers war unvollstaendig. Bitte versuche es erneut.";
        }
        console.error("[GameView] Free text action failed:", result.error);
        dispatch({ type: "SET_ERROR", error: errorMsg });
      }
    } catch (err) {
      console.error("[GameView] Unexpected error in free text:", err);
      dispatch({ type: "SET_ERROR", error: "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut." });
    } finally {
      setIsProcessing(false);
      lastSubmitRef.current = null;
    }
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
            className={`${styles.iconButton} ${showQuests ? styles.iconButtonActive : ""}`}
            onClick={() => { setShowQuests(!showQuests); setShowInventory(false); }}
            title="Quests (Q)"
          >
            <span className={styles.btnIcon}>{"\u2B50"}</span> Quests
            {state.questLog && state.questLog.activeQuests.filter(q => q.status === "active").length > 0 && (
              <span className={styles.questBadge}>
                {state.questLog.activeQuests.filter(q => q.status === "active").length}
              </span>
            )}
          </button>
          <button
            className={`${styles.iconButton} ${showInventory ? styles.iconButtonActive : ""}`}
            onClick={() => { setShowInventory(!showInventory); setShowQuests(false); }}
            title="Inventar (I)"
          >
            <span className={styles.btnIcon}>{"\uD83C\uDF92"}</span> Inventar
          </button>
          <button
            className={styles.iconButton}
            onClick={() => dispatch({ type: "SET_VIEW", view: "settings" })}
            title="Einstellungen"
          >
            <span className={styles.btnIcon}>{"\u2699"}</span>
          </button>
          <div className={`${styles.energyBadge} ${
            state.user?.energy && (state.user.energy.dailyActionsMax - state.user.energy.dailyActionsUsed) <= 3
              ? styles.energyLow : ""
          }`}>
            <span className={styles.energyIcon}>{"\u26A1"}</span>
            {state.user?.energy.dailyActionsMax !== undefined
              ? `${state.user.energy.dailyActionsUsed}/${state.user.energy.dailyActionsMax}`
              : "..."}
          </div>
        </div>
      </header>

      {/* Main content area – two-column layout */}
      <div className={styles.mainArea}>
        {/* Left: Scene image panel */}
        <div className={styles.sceneColumn}>
          <SceneImagePanel
            sceneImage={sceneImage}
            prevSceneImage={prevSceneImage}
            isLoading={expectsNewImage && sceneImageLoading && !polledImageUrl}
          />
          {/* Compact quest tracker overlay */}
          <div className={styles.questTrackerOverlay}>
            <QuestTracker
              questLog={state.questLog}
              onOpenQuests={() => { setShowQuests(true); setShowInventory(false); }}
            />
          </div>
        </div>

        {/* Right: Narrative + optional sidebar */}
        <div className={styles.narrativeColumn}>
          <div ref={narrativeScrollRef} className={styles.narrativeScroll}>
            {/* Combat HUD */}
            {state.combatState && state.selectedCharacter && (
              <CombatHUD
                combatState={state.combatState}
                character={state.selectedCharacter}
              />
            )}

            {turns.length === 0 ? (
              <div className={styles.emptyState}>
                <p>Lade Abenteuer...</p>
              </div>
            ) : (
              turns.map((turn, index) => (
                <React.Fragment key={turn.id}>
                  {index > 0 && (
                    <div className={styles.turnDivider}>
                      <span className={styles.dividerOrnament}>{"\u2726"}</span>
                    </div>
                  )}
                  <TurnDisplay
                    turn={turn}
                    isLatest={index === turns.length - 1}
                    scrollContainerRef={narrativeScrollRef}
                  />
                </React.Fragment>
              ))
            )}
            <div ref={narrativeEndRef} />
          </div>

          {/* Sidebar panels */}
          {showInventory && (
            <aside className={styles.sidebar}>
              <InventoryPanel onClose={() => setShowInventory(false)} />
            </aside>
          )}
          {showQuests && (
            <aside className={styles.sidebar}>
              <QuestPanel onClose={() => setShowQuests(false)} />
            </aside>
          )}
        </div>
      </div>

      {/* Action panel */}
      <div className={styles.actionPanel}>
        {/* Mood indicator border */}
        <div className={styles.moodBorder} />

        {/* Action options with keyboard shortcuts */}
        {currentTurn && currentTurn.options.length > 0 && (
          <div className={`${styles.options} ${isProcessing ? styles.optionsDisabled : ""}`}>
            {currentTurn.options.map((option, index) => (
              <button
                key={option.id}
                className={`${styles.optionButton} ${styles[`optionType_${option.type}`] ?? ""} ${pressedOptionIdx === index ? styles.optionPressed : ""}`}
                onClick={() => handleOptionClick(option)}
                disabled={isProcessing}
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
  quest_complete: "\uD83C\uDFC6",
  quest_start: "\uD83D\uDCDC",
  quest_progress: "\u2705",
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

/** Persistent scene image panel — stays visible and cross-fades on scene change. */
function SceneImagePanel({
  sceneImage,
  prevSceneImage,
  isLoading,
}: {
  sceneImage: string | null;
  prevSceneImage: string | null;
  isLoading: boolean;
}) {
  const [revealed, setRevealed] = useState(!!sceneImage);
  const [shimmerIdx, setShimmerIdx] = useState(0);

  // Reveal animation when image changes
  useEffect(() => {
    if (sceneImage) {
      setRevealed(false);
      const timer = setTimeout(() => setRevealed(true), 50);
      return () => clearTimeout(timer);
    }
  }, [sceneImage]);

  // Cycle shimmer messages while loading
  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => {
      setShimmerIdx((i) => (i + 1) % SCENE_LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isLoading]);

  return (
    <div className={styles.scenePanel}>
      {/* Previous image (fades out behind new one) */}
      {prevSceneImage && (
        <img
          src={prevSceneImage}
          alt=""
          className={styles.scenePanelImgPrev}
        />
      )}
      {/* Current scene image with cross-fade */}
      {sceneImage && (
        <img
          src={sceneImage}
          alt="Szene"
          className={`${styles.scenePanelImg} ${revealed ? styles.scenePanelImgRevealed : ""}`}
        />
      )}
      {/* Gradient overlay for blending into narrative */}
      <div className={styles.scenePanelGradient} />
      {/* Loading shimmer overlay */}
      {isLoading && !sceneImage && (
        <div className={styles.scenePanelShimmer}>
          <div className={styles.shimmerWave} />
          <span className={styles.shimmerIcon}>{"\uD83C\uDFA8"}</span>
          <span className={styles.shimmerText}>{SCENE_LOADING_MESSAGES[shimmerIdx]}</span>
        </div>
      )}
      {isLoading && sceneImage && (
        <div className={styles.scenePanelLoadingDot} title="Neue Szene wird geladen..." />
      )}
    </div>
  );
}

function TurnDisplay({
  turn,
  isLatest,
  scrollContainerRef,
}: {
  turn: GameTurn;
  isLatest: boolean;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
}) {
  // Defensive: ensure narrative exists
  const narrative = turn.narrative ?? "";
  const paragraphs = useMemo(
    () => narrative.split(/\n\n+/).filter(Boolean),
    [narrative],
  );
  const diceRolls = Array.isArray(turn.diceRolls) ? turn.diceRolls : [];

  // Don't render if turn has no content
  if (!narrative && !turn.playerAction) {
    return null;
  }

  return (
    <div className={`${styles.turn} ${isLatest ? styles.latestTurn : ""}`}>
      {/* Player action */}
      {turn.playerAction && (
        <div className={styles.playerAction}>
          <span className={styles.playerLabel}>{"\u2694\uFE0F"} Du:</span> {turn.playerAction.text}
        </div>
      )}

      {/* Dice rolls */}
      {diceRolls.length > 0 && (
        <div className={styles.diceRolls}>
          {diceRolls.map((roll) => (
            <DiceRollDisplay key={roll.id} roll={roll} />
          ))}
        </div>
      )}

      {/* Narrative text */}
      {narrative && (
        <div className={styles.narrative}>
          {isLatest ? (
            <Typewriter text={narrative} speed={16} scrollContainerRef={scrollContainerRef} />
          ) : (
            paragraphs.map((p, i) => <p key={i} className={styles.paragraph}>{p}</p>)
          )}
        </div>
      )}
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
