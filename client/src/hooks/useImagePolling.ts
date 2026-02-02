import { useState, useEffect, useRef } from "react";
import { getTurnImage, getCharacters } from "../services/api.js";

/**
 * Polls for a scene image with exponential backoff.
 * Starts at 500ms, doubles each attempt up to 4s cap, max 45s total.
 */
export function useSceneImage(
  sessionId: string | undefined,
  turnId: string | undefined,
  initialUrl: string | undefined,
): { imageUrl: string | null; isLoading: boolean } {
  const [imageUrl, setImageUrl] = useState<string | null>(initialUrl ?? null);
  const [isLoading, setIsLoading] = useState(!initialUrl);
  const attemptsRef = useRef(0);

  useEffect(() => {
    setImageUrl(initialUrl ?? null);
    setIsLoading(!initialUrl);
    attemptsRef.current = 0;
  }, [turnId, initialUrl]);

  useEffect(() => {
    if (!sessionId || !turnId || imageUrl) return;

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout>;
    const maxTime = 45_000;
    const startTime = Date.now();

    async function poll() {
      try {
        const result = await getTurnImage(sessionId!, turnId!);
        if (!cancelled && result.success && result.data?.imageUrl) {
          setImageUrl(result.data.imageUrl);
          setIsLoading(false);
          return;
        }
      } catch {
        // Ignore network errors, keep polling
      }
      attemptsRef.current++;
      const elapsed = Date.now() - startTime;
      if (!cancelled && elapsed < maxTime) {
        // Exponential backoff: 500ms, 1s, 2s, 4s (capped)
        const delay = Math.min(4000, 500 * Math.pow(2, attemptsRef.current - 1));
        timerId = setTimeout(poll, delay);
      } else if (!cancelled) {
        setIsLoading(false);
      }
    }

    timerId = setTimeout(poll, 500);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [sessionId, turnId, imageUrl]);

  return { imageUrl, isLoading };
}

/**
 * Polls for a character portrait with exponential backoff.
 * Starts at 2s, doubles up to 8s cap, max 45s total.
 */
export function useCharacterPortrait(
  userId: string | undefined,
  characterId: string | undefined,
  initialUrl: string | undefined,
): string | null {
  const [portraitUrl, setPortraitUrl] = useState<string | null>(initialUrl ?? null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    setPortraitUrl(initialUrl ?? null);
    attemptsRef.current = 0;
  }, [characterId, initialUrl]);

  useEffect(() => {
    if (!userId || !characterId || portraitUrl) return;

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout>;
    const maxTime = 45_000;
    const startTime = Date.now();

    async function poll() {
      attemptsRef.current++;
      try {
        const result = await getCharacters(userId!);
        if (!cancelled && result.success && result.data) {
          const char = result.data.find((c) => c.id === characterId);
          if (char?.portraitUrl) {
            setPortraitUrl(char.portraitUrl);
            return;
          }
        }
      } catch {
        // Ignore, keep polling
      }
      const elapsed = Date.now() - startTime;
      if (!cancelled && elapsed < maxTime) {
        const delay = Math.min(8000, 2000 * Math.pow(2, attemptsRef.current - 1));
        timerId = setTimeout(poll, delay);
      }
    }

    timerId = setTimeout(poll, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [userId, characterId, portraitUrl]);

  return portraitUrl;
}
