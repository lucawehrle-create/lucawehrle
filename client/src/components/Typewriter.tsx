import React, { useState, useEffect, useRef } from "react";
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
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    setDisplayedLength(0);
    setSkipped(false);
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

    intervalRef.current = setInterval(() => {
      setDisplayedLength((prev) => {
        // Skip faster through whitespace
        let next = prev + 1;
        while (next < text.length && text[next] === " ") {
          next++;
        }
        if (next >= text.length) {
          clearInterval(intervalRef.current);
        }
        return next;
      });
    }, speed);

    return () => clearInterval(intervalRef.current);
  }, [text, speed, displayedLength, skipped, onComplete]);

  function handleClick() {
    if (displayedLength < text.length) {
      setSkipped(true);
      clearInterval(intervalRef.current);
    }
  }

  const isTyping = displayedLength < text.length && !skipped;

  return (
    <span className={className} onClick={handleClick} title={isTyping ? "Click to skip" : ""}>
      {text.slice(0, displayedLength)}
      {isTyping && <span className={styles.cursor}>|</span>}
    </span>
  );
}
