import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./Typewriter.module.css";

interface TypewriterProps {
  text: string;
  speed?: number; // ms per character
  onComplete?: () => void;
  className?: string;
}

export function Typewriter({ text, speed = 18, onComplete, className }: TypewriterProps) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    setDisplayedLength(0);
    setSkipped(false);
    lastTimeRef.current = 0;
  }, [text]);

  useEffect(() => {
    if (skipped) {
      setDisplayedLength(text.length);
      onComplete?.();
      return;
    }

    if (displayedLength >= text.length) {
      onComplete?.();
      return;
    }

    const step = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const elapsed = timestamp - lastTimeRef.current;

      if (elapsed >= speed) {
        lastTimeRef.current = timestamp;
        setDisplayedLength((prev) => {
          let next = prev + 1;
          // Skip faster through whitespace
          while (next < text.length && text[next] === " ") {
            next++;
          }
          return next;
        });
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [text, speed, displayedLength, skipped, onComplete]);

  const handleClick = useCallback(() => {
    if (displayedLength < text.length) {
      setSkipped(true);
      cancelAnimationFrame(rafRef.current);
    }
  }, [displayedLength, text.length]);

  const isTyping = displayedLength < text.length && !skipped;

  return (
    <span className={`${className ?? ""} ${isTyping ? styles.typingArea : ""}`} onClick={handleClick}>
      {text.slice(0, displayedLength)}
      {isTyping && <span className={styles.cursor}>|</span>}
      {isTyping && <span className={styles.skipHint}>Klicken zum Ueberspringen</span>}
    </span>
  );
}
