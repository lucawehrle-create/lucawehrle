import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./Typewriter.module.css";

interface TypewriterProps {
  text: string;
  speed?: number; // ms per character
  onComplete?: () => void;
  className?: string;
  /** Ref to the scroll container - if provided, will auto-scroll to keep cursor visible */
  scrollContainerRef?: React.RefObject<HTMLElement>;
}

export function Typewriter({ text, speed = 18, onComplete, className, scrollContainerRef }: TypewriterProps) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const cursorRef = useRef<HTMLSpanElement>(null);
  // Stable ref for onComplete to avoid re-triggering the effect on every render
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setDisplayedLength(0);
    setSkipped(false);
    lastTimeRef.current = 0;
  }, [text]);

  // Auto-scroll to keep cursor visible
  useEffect(() => {
    if (scrollContainerRef?.current && cursorRef.current) {
      // Scroll the container so the cursor is visible at the bottom
      const container = scrollContainerRef.current;
      const cursor = cursorRef.current;
      const cursorRect = cursor.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // If cursor is below the visible area, scroll down
      if (cursorRect.bottom > containerRect.bottom - 40) {
        container.scrollTop += cursorRect.bottom - containerRect.bottom + 60;
      }
    }
  }, [displayedLength, scrollContainerRef]);

  useEffect(() => {
    if (skipped) {
      setDisplayedLength(text.length);
      onCompleteRef.current?.();
      return;
    }

    if (displayedLength >= text.length) {
      onCompleteRef.current?.();
      return;
    }

    const step = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const elapsed = timestamp - lastTimeRef.current;

      if (elapsed >= speed) {
        lastTimeRef.current = timestamp;
        setDisplayedLength((prev) => {
          let next = prev + 1;
          // Skip through single spaces but not multiple
          if (next < text.length && text[next] === " " && text[next - 1] !== " ") {
            next++;
          }
          return Math.min(next, text.length);
        });
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [text, speed, displayedLength, skipped]);

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
      {isTyping && <span ref={cursorRef} className={styles.cursor}>|</span>}
      {isTyping && <span className={styles.skipHint}>Klicken zum Ueberspringen</span>}
    </span>
  );
}
