import React from "react";
import { useGame } from "../context/GameContext.js";
import { NavBar } from "./NavBar.js";
import styles from "./Settings.module.css";

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

export function Settings() {
  const { state, dispatch } = useGame();
  const user = state.user;

  function handleLogout() {
    dispatch({ type: "LOGOUT" });
  }

  const energyPercent = user?.energy
    ? Math.max(0, Math.min(100, (user.energy.current / user.energy.max) * 100))
    : 0;

  const actionsPercent = user?.energy
    ? Math.max(0, Math.min(100, (user.energy.dailyActionsUsed / user.energy.dailyActionsMax) * 100))
    : 0;

  return (
    <div className={styles.page}>
      <NavBar
        back={{ label: "Zurueck", onClick: () => dispatch({ type: "SET_VIEW", view: "character_select" }) }}
      />
      <div className={styles.container}>
        <h2 className={styles.title}>Einstellungen</h2>

        {/* Account section */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Konto</h3>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Spielername</span>
            <span className={styles.rowValue}>{user?.username ?? "..."}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>E-Mail</span>
            <span className={styles.rowValue}>{user?.email ?? "..."}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Spieler-ID</span>
            <span className={styles.rowValueMono}>{user?.id ?? "..."}</span>
          </div>
        </section>

        {/* Energy section with visual bars */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Energie</h3>
          <div className={styles.energyRow}>
            <div className={styles.energyLabel}>
              <span className={styles.rowLabel}>Energie</span>
              <span className={styles.energyNumbers}>
                {user?.energy ? `${user.energy.current} / ${user.energy.max}` : "..."}
              </span>
            </div>
            <div className={styles.energyBar}>
              <div
                className={styles.energyFill}
                style={{ width: `${energyPercent}%` }}
              />
            </div>
          </div>
          <div className={styles.energyRow}>
            <div className={styles.energyLabel}>
              <span className={styles.rowLabel}>Taegliche Aktionen</span>
              <span className={styles.energyNumbers}>
                {user?.energy
                  ? `${user.energy.dailyActionsUsed} / ${user.energy.dailyActionsMax}`
                  : "..."}
              </span>
            </div>
            <div className={styles.energyBar}>
              <div
                className={`${styles.energyFill} ${styles.energyFillActions}`}
                style={{ width: `${actionsPercent}%` }}
              />
            </div>
          </div>
        </section>

        {/* Characters section with list */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Charaktere ({state.characters.length})
          </h3>
          {state.characters.length > 0 ? (
            <div className={styles.characterList}>
              {state.characters.map((char) => (
                <div key={char.id} className={styles.characterItem}>
                  <div className={styles.characterIcon}>
                    {CLASS_ICONS[char.characterClass] ?? "\u2728"}
                  </div>
                  <div className={styles.characterInfo}>
                    <span className={styles.characterName}>{char.name}</span>
                    <span className={styles.characterMeta}>
                      {CLASS_LABELS[char.characterClass] ?? char.characterClass} &middot; Stufe {char.level}
                    </span>
                  </div>
                  <span className={styles.characterXp}>
                    {char.experience} XP
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyHint}>Noch keine Charaktere erstellt</p>
          )}
        </section>

        {/* Keyboard shortcuts */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Tastenkuerzel</h3>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Inventar oeffnen</span>
            <kbd className={styles.kbd}>I</kbd>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Intro ueberspringen</span>
            <kbd className={styles.kbd}>Leertaste</kbd>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Abenteuer starten</span>
            <kbd className={styles.kbd}>Enter</kbd>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Schliessen</span>
            <kbd className={styles.kbd}>Esc</kbd>
          </div>
        </section>

        {/* Info section */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Ueber</h3>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Version</span>
            <span className={styles.rowValueMono}>0.1.0</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Engine</span>
            <span className={styles.rowValue}>Aetheria AI RPG Engine</span>
          </div>
        </section>

        {/* Logout */}
        <div className={styles.logoutSection}>
          <button className={styles.logoutButton} onClick={handleLogout}>
            Abmelden
          </button>
        </div>
      </div>
    </div>
  );
}
