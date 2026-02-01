import React from "react";
import { useGame } from "../context/GameContext.js";
import styles from "./NavBar.module.css";

interface NavBarProps {
  /** Optional back button config */
  back?: {
    label: string;
    onClick: () => void;
  };
}

export function NavBar({ back }: NavBarProps) {
  const { state, dispatch } = useGame();

  return (
    <nav className={styles.nav}>
      <div className={styles.left}>
        {back && (
          <button className={styles.backBtn} onClick={back.onClick} title={back.label}>
            {"\u2190"}
          </button>
        )}
        <button
          className={styles.logo}
          onClick={() => dispatch({ type: "SET_VIEW", view: "character_select" })}
          title="Hauptmenue"
        >
          Aetheria AI
        </button>
      </div>
      <div className={styles.right}>
        {state.user && (
          <span className={styles.username}>{state.user.username}</span>
        )}
        <button
          className={styles.iconBtn}
          onClick={() => dispatch({ type: "SET_VIEW", view: "settings" })}
          title="Einstellungen"
        >
          {"\u2699"}
        </button>
      </div>
    </nav>
  );
}
