import { describe, expect, it } from "vitest";
import {
  DAY,
  grade,
  initialProgress,
  isDue,
  isMastered,
  shuffle,
  type Progress,
} from "./srs";

function progress(over: Partial<Progress> = {}): Progress {
  return { ef: 2.5, interval: 0, reps: 0, due: 0, last: null, ...over };
}

describe("initialProgress", () => {
  it("returns a fresh unseen card", () => {
    expect(initialProgress()).toEqual({
      ef: 2.5,
      interval: 0,
      reps: 0,
      due: 0,
      last: null,
    });
  });
});

describe("isDue", () => {
  it("treats unseen cards as not due", () => {
    expect(isDue(undefined, 1000)).toBe(false);
    expect(isDue(progress(), 1000)).toBe(false);
  });

  it("compares due against now", () => {
    expect(isDue(progress({ last: 500, due: 1000 }), 1000)).toBe(true);
    expect(isDue(progress({ last: 500, due: 1001 }), 1000)).toBe(false);
  });
});

describe("isMastered", () => {
  it("requires a review history and 3 reps", () => {
    expect(isMastered(undefined)).toBe(false);
    expect(isMastered(progress())).toBe(false);
    expect(isMastered(progress({ last: 1, reps: 2 }))).toBe(false);
    expect(isMastered(progress({ last: 1, reps: 3 }))).toBe(true);
  });
});

describe("grade", () => {
  it("resets the streak on failure", () => {
    const now = 1_000_000;
    const next = grade(progress({ ef: 2.5, reps: 2, interval: 6 }), 0, now);
    expect(next.reps).toBe(0);
    expect(next.interval).toBe(1);
    expect(next.due).toBe(now + DAY);
    expect(next.last).toBe(now);
  });

  it("grows the interval 1, 6, then ef-scaled", () => {
    const now = 1_000_000;
    const first = grade(progress(), 5, now);
    expect(first.reps).toBe(1);
    expect(first.interval).toBe(1);

    const second = grade(first, 5, now);
    expect(second.reps).toBe(2);
    expect(second.interval).toBe(6);

    const third = grade(second, 5, now);
    expect(third.reps).toBe(3);
    expect(third.interval).toBe(Math.round(6 * third.ef));
    expect(third.due).toBe(now + third.interval * DAY);
  });

  it("rewards a perfect recall with +0.1 ef", () => {
    const next = grade(progress({ ef: 2.5 }), 5, 1000);
    expect(next.ef).toBeCloseTo(2.6, 10);
  });

  it("never drops ef below 1.3", () => {
    const next = grade(progress({ ef: 1.3 }), 0, 1000);
    expect(next.ef).toBe(1.3);
  });
});

describe("shuffle", () => {
  it("keeps every element and leaves the input alone", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    expect(out).not.toBe(input);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});
