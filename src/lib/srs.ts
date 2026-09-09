export interface Card {
  id: string;
  chapter: string;
  num: number;
  sentence: string;
  term: string;
  answer: string;
}

export interface Progress {
  ef: number;
  interval: number;
  reps: number;
  due: number;
  last: number | null;
}

export const DAY = 86_400_000;

export function initialProgress(): Progress {
  return { ef: 2.5, interval: 0, reps: 0, due: 0, last: null };
}

export function isDue(p: Progress | undefined, now: number): boolean {
  if (!p || p.last === null) return false;
  return p.due <= now;
}

export function isMastered(p: Progress | undefined): boolean {
  return !!p && p.last !== null && p.reps >= 3;
}

/** SM-2 grading. q is 0-5. Returns updated progress. */
export function grade(prev: Progress, q: number, now: number): Progress {
  const ef = Math.max(
    1.3,
    prev.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );
  if (q < 3) {
    return { ef, interval: 1, reps: 0, due: now + DAY, last: now };
  }
  const reps = prev.reps + 1;
  const interval =
    reps === 1 ? 1 : reps === 2 ? 6 : Math.round(prev.interval * ef);
  return { ef, interval, reps, due: now + interval * DAY, last: now };
}

export function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
