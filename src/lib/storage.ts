import type { Progress } from "./srs";
import { dayKeyOf, type DayStat } from "./stats";

const KEY = "chinese-flashcards-progress-v1";
const WRONG_KEY = "chinese-flashcards-wrong-v1";
const DAYS_KEY = "chinese-flashcards-days-v1";
const MAX_DAYS = 60;

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

export function loadWrongIds(): string[] {
  try {
    const raw = localStorage.getItem(WRONG_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

export function saveWrongIds(ids: string[]): void {
  try {
    localStorage.setItem(WRONG_KEY, JSON.stringify(ids));
  } catch {
    // storage full or unavailable, wrong list still works in memory
  }
}

export function clearWrongIds(): void {
  try {
    localStorage.removeItem(WRONG_KEY);
  } catch {
    // nothing to clear
  }
}

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function loadDayStats(): Record<string, DayStat> {
  try {
    const raw = localStorage.getItem(DAYS_KEY);
    if (!raw) return {};
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return {};
    const out: Record<string, DayStat> = {};
    for (const [k, v] of Object.entries(data)) {
      if (!DAY_KEY_PATTERN.test(k) || typeof v !== "object" || v === null)
        continue;
      const r = v as { reviews?: unknown; correct?: unknown };
      out[k] = {
        reviews: typeof r.reviews === "number" ? r.reviews : 0,
        correct: typeof r.correct === "number" ? r.correct : 0,
      };
    }
    return out;
  } catch {
    return {};
  }
}

/** Adds one review to today's tally, trims old days, persists, returns all. */
export function recordDayReview(
  correct: boolean,
  now = Date.now(),
): Record<string, DayStat> {
  const days = loadDayStats();
  const key = dayKeyOf(new Date(now));
  const s = days[key] ?? { reviews: 0, correct: 0 };
  days[key] = {
    reviews: s.reviews + 1,
    correct: s.correct + (correct ? 1 : 0),
  };
  const keys = Object.keys(days).sort();
  while (keys.length > MAX_DAYS) {
    const oldest = keys.shift();
    if (oldest === undefined) break;
    delete days[oldest];
  }
  try {
    localStorage.setItem(DAYS_KEY, JSON.stringify(days));
  } catch {
    // storage full or unavailable, counts still work in memory
  }
  return days;
}

export function clearDayStats(): void {
  try {
    localStorage.removeItem(DAYS_KEY);
  } catch {
    // nothing to clear
  }
}
