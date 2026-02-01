import React, { useState, useEffect, useRef } from "react";
import type { SceneMood } from "@aetheria/shared";
import styles from "./MoodTransition.module.css";

interface MoodTransitionProps {
  mood: SceneMood;
}

export function MoodTransition({ mood }: MoodTransitionProps) {
  const [flash, setFlash] = useState(false);
  const prevMood = useRef(mood);

  useEffect(() => {
    if (prevMood.current !== mood) {
      prevMood.current = mood;
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(timer);
    }
  }, [mood]);

  if (!flash) return null;

  return <div className={styles.overlay} aria-hidden="true" />;
}
