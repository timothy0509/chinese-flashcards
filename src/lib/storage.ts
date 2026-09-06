import type { Progress } from "./srs";

const KEY = "chinese-flashcards-progress-v1";

export function loadProgress(): Record<string, Progress> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, Progress>;
    return typeof data === "object" && data !== null ? data : {};
  } catch {
    return {};
  }
}

export function saveProgress(p: Record<string, Progress>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage full or unavailable, study session still works in memory
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
