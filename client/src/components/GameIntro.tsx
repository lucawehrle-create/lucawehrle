import { useState, useEffect, useMemo, useCallback } from "react";
import { useGame } from "../context/GameContext.js";
import { AtmosphericEffects } from "./AtmosphericEffects.js";
import styles from "./GameIntro.module.css";

const CLASS_ICONS: Record<string, string> = {
  warrior: "\u2694\uFE0F",
  mage: "\u2728",
  rogue: "\uD83D\uDDE1\uFE0F",
  ranger: "\uD83C\uDFF9",
  cleric: "\u271D\uFE0F",
  paladin: "\uD83D\uDEE1\uFE0F",
  bard: "\uD83C\uDFB6",
  druid: "\uD83C\uDF3F",
  monk: "\uD83E\uDD4B",
  warlock: "\uD83D\uDD2E",
};

const CLASS_LABELS: Record<string, string> = {
  warrior: "Krieger",
  mage: "Magier",
  rogue: "Schurke",
  ranger: "Waldlaeufer",
  cleric: "Kleriker",
  paladin: "Paladin",
  bard: "Barde",
  druid: "Druide",
  monk: "Moench",
  warlock: "Hexenmeister",
};

const RACE_LABELS: Record<string, string> = {
  human: "Mensch",
  elf: "Elf",
  dwarf: "Zwerg",
  halfling: "Halbling",
  orc: "Ork",
  tiefling: "Tiefling",
  dragonborn: "Drachenbluetiger",
  gnome: "Gnom",
};

const ABILITY_LABELS: Record<string, string> = {
  strength: "STR",
  dexterity: "GES",
  constitution: "KON",
  intelligence: "INT",
  wisdom: "WEI",
  charisma: "CHA",
};

const INTRO_LINES = [
  "Die Sterne haben sich ausgerichtet...",
  "Das Schicksal hat dich erwählt...",
  "Eine neue Legende beginnt...",
  "Die Prophezeiung erfüllt sich...",
  "Die alten Götter beobachten...",
];

export function GameIntro() {
  const { state, dispatch } = useGame();
  const { selectedCharacter: character, session, turns, journeyNarrative } = state;

  const [phase, setPhase] = useState<"fade_in" | "portrait" | "story" | "ready">("fade_in");
  const [journeyRevealed, setJourneyRevealed] = useState(0);

  const introLine = useMemo(
    () => INTRO_LINES[Math.floor(Math.random() * INTRO_LINES.length)],
    []
  );

  const firstTurn = turns[0];
  const scenario = state.scenarios.find(s => s.id === session?.scenario);

  // The journey narrative (AI-generated) takes priority over static backstory
  const storyText = journeyNarrative || character?.backstory || "";

  // Phase transitions
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Fade in -> Portrait
    timers.push(setTimeout(() => setPhase("portrait"), 1500));
    // Portrait -> Story
    timers.push(setTimeout(() => setPhase("story"), 3500));
    // Story -> Ready
    timers.push(setTimeout(() => setPhase("ready"), 6000));

    return () => timers.forEach(clearTimeout);
  }, []);

  // Typewriter effect for journey narrative
  useEffect(() => {
    if (phase !== "story" && phase !== "ready") return;
    if (!storyText) return;

    const words = storyText.split(" ");
    if (journeyRevealed >= words.length) return;

    const timer = setTimeout(() => {
      setJourneyRevealed(prev => Math.min(prev + 1, words.length));
    }, 70);

    return () => clearTimeout(timer);
  }, [phase, journeyRevealed, storyText]);

  const handleBeginAdventure = useCallback(() => {
    dispatch({ type: "SET_VIEW", view: "game" });
  }, [dispatch]);

  // Keyboard support: Enter to start when ready
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && phase === "ready") {
        handleBeginAdventure();
      }
      if (e.key === "Escape" || e.key === " ") {
        setPhase("ready");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, handleBeginAdventure]);

  if (!character || !session) {
    return null;
  }

  const storyWords = storyText.split(" ");
  const visibleStory = storyWords.slice(0, journeyRevealed).join(" ");

  return (
    <div className={styles.container} data-phase={phase}>
      <AtmosphericEffects mood="mystery" />

      {/* Cinematic bars */}
      <div className={styles.cinematicTop} />
      <div className={styles.cinematicBottom} />

      {/* Intro text */}
      <div className={`${styles.introText} ${phase !== "fade_in" ? styles.introTextHidden : ""}`}>
        <span className={styles.introLine}>{introLine}</span>
      </div>

      {/* Main content */}
      <div className={styles.content}>
        {/* Portrait section */}
        <div className={`${styles.portraitSection} ${phase === "fade_in" ? styles.hidden : ""}`}>
          <div className={styles.portraitFrame}>
            {character.portraitUrl ? (
              <img
                src={character.portraitUrl}
                alt={character.name}
                className={styles.portrait}
              />
            ) : (
              <div className={styles.portraitPlaceholder}>
                <span className={styles.portraitIcon}>
                  {CLASS_ICONS[character.characterClass] ?? "\u2728"}
                </span>
              </div>
            )}
            <div className={styles.portraitGlow} />
          </div>

          {/* Character name and title */}
          <h1 className={styles.characterName}>{character.name}</h1>
          <p className={styles.characterTitle}>
            {RACE_LABELS[character.race] ?? character.race} {CLASS_LABELS[character.characterClass] ?? character.characterClass}
            <span className={styles.levelBadge}>Stufe {character.level}</span>
          </p>
        </div>

        {/* Story section */}
        <div className={`${styles.storySection} ${phase === "fade_in" || phase === "portrait" ? styles.hidden : ""}`}>
          {/* Journey narrative - "How you got here" */}
          <div className={styles.backstoryCard}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.titleIcon}>{"\uD83D\uDDFA\uFE0F"}</span>
              {journeyNarrative ? "Wie du hierher kamst" : "Deine Geschichte"}
            </h2>
            <p className={styles.backstory}>
              {visibleStory}
              {journeyRevealed < storyWords.length && (
                <span className={styles.cursor}>|</span>
              )}
            </p>
          </div>

          {/* Character traits */}
          {character.traits.length > 0 && (
            <div className={styles.traitsCard}>
              <h3 className={styles.cardTitle}>Charakterzüge</h3>
              <div className={styles.traits}>
                {character.traits.map((trait, i) => (
                  <span key={i} className={styles.trait}>{trait}</span>
                ))}
              </div>
            </div>
          )}

          {/* Stats overview */}
          <div className={styles.statsCard}>
            <h3 className={styles.cardTitle}>Attribute</h3>
            <div className={styles.statsGrid}>
              {Object.entries(character.abilities).map(([key, value]) => (
                <div key={key} className={styles.statItem}>
                  <span className={styles.statLabel}>{ABILITY_LABELS[key] ?? key}</span>
                  <span className={styles.statValue}>{value}</span>
                  <span className={styles.statMod}>
                    {Math.floor((value - 10) / 2) >= 0 ? "+" : ""}
                    {Math.floor((value - 10) / 2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Scenario info */}
          {scenario && (
            <div className={styles.scenarioCard}>
              <h3 className={styles.cardTitle}>{"\u2694\uFE0F"} Dein Abenteuer</h3>
              <h4 className={styles.scenarioTitle}>{scenario.title}</h4>
              <p className={styles.scenarioDesc}>{scenario.description}</p>
            </div>
          )}

          {/* Begin button - now inside story section */}
          <div className={`${styles.actionSection} ${phase !== "ready" ? styles.hidden : ""}`}>
            <button className={styles.beginButton} onClick={handleBeginAdventure}>
              <span className={styles.beginIcon}>{"\u2694\uFE0F"}</span>
              Abenteuer beginnen
              <span className={styles.beginGlow} />
            </button>
            <p className={styles.hint}>Drücke Enter oder klicke um zu starten</p>
          </div>
        </div>
      </div>

      {/* Scene preview */}
      {firstTurn?.imageUrl && (
        <div className={`${styles.scenePreview} ${phase === "ready" ? styles.scenePreviewVisible : ""}`}>
          <img src={firstTurn.imageUrl} alt="Szene" className={styles.sceneImage} />
          <div className={styles.sceneGradient} />
        </div>
      )}

      {/* Skip hint */}
      {phase !== "ready" && (
        <button className={styles.skipButton} onClick={() => setPhase("ready")}>
          Überspringen
        </button>
      )}
    </div>
  );
}
