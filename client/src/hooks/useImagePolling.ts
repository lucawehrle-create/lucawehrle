import { useState, useEffect, useRef } from "react";
import { getTurnImage, getCharacters } from "../services/api.js";

/**
 * Polls for a scene image that's being generated asynchronously.
 * Returns the imageUrl when available, or null while loading.
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
    // Reset when turn changes
    setImageUrl(initialUrl ?? null);
    setIsLoading(!initialUrl);
    attemptsRef.current = 0;
  }, [turnId, initialUrl]);

  useEffect(() => {
    if (!sessionId || !turnId || imageUrl) return;

    const maxAttempts = 15; // 15 * 2s = 30s max
    const interval = setInterval(async () => {
      attemptsRef.current++;
      if (attemptsRef.current > maxAttempts) {
        setIsLoading(false);
        clearInterval(interval);
        return;
      }

      try {
        const result = await getTurnImage(sessionId, turnId);
        if (result.success && result.data?.imageUrl) {
          setImageUrl(result.data.imageUrl);
          setIsLoading(false);
          clearInterval(interval);
        }
      } catch {
        // Ignore network errors, keep polling
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [sessionId, turnId, imageUrl]);

  return { imageUrl, isLoading };
}

/**
 * Polls for a character portrait that's being generated asynchronously.
 * Checks the characters list until the portraitUrl appears.
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

    const maxAttempts = 15;
    const interval = setInterval(async () => {
      attemptsRef.current++;
      if (attemptsRef.current > maxAttempts) {
        clearInterval(interval);
        return;
      }

      try {
        const result = await getCharacters(userId);
        if (result.success && result.data) {
          const char = result.data.find((c) => c.id === characterId);
          if (char?.portraitUrl) {
            setPortraitUrl(char.portraitUrl);
            clearInterval(interval);
          }
        }
      } catch {
        // Ignore, keep polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [userId, characterId, portraitUrl]);

  return portraitUrl;
}
