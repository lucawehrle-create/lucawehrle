import React, { useState } from "react";
import { useGame } from "../context/GameContext.js";
import { registerUser, getUser, getCharacters, getScenarios } from "../services/api.js";
import styles from "./LoginScreen.module.css";

export function LoginScreen() {
  const { dispatch } = useGame();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  async function handleLogin() {
    dispatch({ type: "SET_LOADING", isLoading: true });

    // Check for existing session
    const existingId = localStorage.getItem("aetheria_user_id");
    if (existingId) {
      const result = await getUser(existingId);
      if (result.success && result.data) {
        dispatch({ type: "SET_USER", user: result.data });
        await loadUserData(result.data.id);
        dispatch({ type: "SET_VIEW", view: "character_select" });
        dispatch({ type: "SET_LOADING", isLoading: false });
        return;
      }
    }
    setIsRegistering(true);
    dispatch({ type: "SET_LOADING", isLoading: false });
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "SET_LOADING", isLoading: true });

    const result = await registerUser(username, email);
    if (result.success && result.data) {
      dispatch({ type: "SET_USER", user: result.data });
      await loadUserData(result.data.id);
      dispatch({ type: "SET_VIEW", view: "character_select" });
    } else {
      dispatch({ type: "SET_ERROR", error: result.error?.message ?? "Registration failed" });
    }
    dispatch({ type: "SET_LOADING", isLoading: false });
  }

  async function loadUserData(userId: string) {
    const [charResult, scenarioResult] = await Promise.all([
      getCharacters(userId),
      getScenarios(),
    ]);

    if (charResult.success && charResult.data) {
      dispatch({ type: "SET_CHARACTERS", characters: charResult.data });
    }
    if (scenarioResult.success && scenarioResult.data) {
      dispatch({ type: "SET_SCENARIOS", scenarios: scenarioResult.data });
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Aetheria AI</h1>
        <p className={styles.subtitle}>Infinite Immersive RPG</p>
        <p className={styles.tagline}>
          Every story is unique. Every choice matters. Powered by AI.
        </p>

        {!isRegistering ? (
          <button className={styles.enterButton} onClick={handleLogin}>
            Enter the Realm
          </button>
        ) : (
          <form className={styles.form} onSubmit={handleRegister}>
            <input
              type="text"
              placeholder="Choose your name, adventurer..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={styles.input}
              required
              minLength={2}
              maxLength={30}
            />
            <input
              type="email"
              placeholder="Your email (for save games)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              required
            />
            <button type="submit" className={styles.enterButton}>
              Begin Your Journey
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
