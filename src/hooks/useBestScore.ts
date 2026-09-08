import { useState } from "react";

function readNumber(storageKey: string): number | null {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function writeNumber(storageKey: string, value: number): void {
  try {
    localStorage.setItem(storageKey, String(value));
  } catch {
    // localStorage unavailable (private browsing, disabled storage) — score just won't persist
  }
}

export function useBestScore(key: string, betterIs: "higher" | "lower") {
  const [last, setLast] = useState<number | null>(() => readNumber(`game-last:${key}`));
  const [best, setBest] = useState<number | null>(() => readNumber(`game-best:${key}`));

  function submit(value: number) {
    setLast(value);
    writeNumber(`game-last:${key}`, value);
    try {
      localStorage.setItem("games:last-played", key);
    } catch {
      // localStorage unavailable — the games summary just won't default to this game
    }
    setBest((prev) => {
      const isBetter = prev === null || (betterIs === "higher" ? value > prev : value < prev);
      if (!isBetter) return prev;
      writeNumber(`game-best:${key}`, value);
      return value;
    });
  }

  return { last, best, submit };
}
