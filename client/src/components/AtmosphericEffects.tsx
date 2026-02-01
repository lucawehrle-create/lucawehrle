import React, { useMemo } from "react";
import type { SceneMood } from "@aetheria/shared";
import styles from "./AtmosphericEffects.module.css";

interface AtmosphericEffectsProps {
  mood: SceneMood;
}

interface Particle {
  id: number;
  left: string;
  delay: string;
  duration: string;
  size: string;
  opacity: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 8}s`,
    duration: `${4 + Math.random() * 8}s`,
    size: `${2 + Math.random() * 4}px`,
    opacity: 0.2 + Math.random() * 0.5,
  }));
}

const MOOD_CONFIG: Record<SceneMood, { className: string; count: number }> = {
  combat: { className: styles.embers, count: 20 },
  danger: { className: styles.embers, count: 15 },
  exploration: { className: styles.fireflies, count: 12 },
  safe: { className: styles.dust, count: 8 },
  dialogue: { className: styles.dust, count: 6 },
  mystery: { className: styles.mist, count: 10 },
  celebration: { className: styles.sparkles, count: 18 },
  sorrow: { className: styles.rain, count: 25 },
};

export function AtmosphericEffects({ mood }: AtmosphericEffectsProps) {
  const config = MOOD_CONFIG[mood] ?? MOOD_CONFIG.exploration;
  const particles = useMemo(() => generateParticles(config.count), [config.count]);

  return (
    <div className={`${styles.container} ${config.className}`} aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className={styles.particle}
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.duration,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
          }}
        />
      ))}
    </div>
  );
}
