import React from "react";
import { useGame } from "../context/GameContext.js";
import { NavBar } from "./NavBar.js";
import styles from "./Settings.module.css";

export function Settings() {
  const { state, dispatch } = useGame();
  const user = state.user;

  function handleLogout() {
    dispatch({ type: "LOGOUT" });
  }

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

        {/* Energy section */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Energie</h3>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Taegliche Aktionen</span>
            <span className={styles.rowValue}>
              {user?.energy
                ? `${user.energy.dailyActionsUsed} / ${user.energy.dailyActionsMax} verbraucht`
                : "..."}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Energie</span>
            <span className={styles.rowValue}>
              {user?.energy
                ? `${user.energy.current} / ${user.energy.max}`
                : "..."}
            </span>
          </div>
        </section>

        {/* Characters section */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Charaktere</h3>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Erstellt</span>
            <span className={styles.rowValue}>{state.characters.length}</span>
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
