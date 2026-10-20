import { describe, expect, it } from "vitest";
import { dayKeyOf, last7Bars, streakOf } from "./stats";

function day(reviews: number, correct = reviews) {
  return { reviews, correct };
}

describe("dayKeyOf", () => {
  it("formats a local YYYY-MM-DD key", () => {
    expect(dayKeyOf(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dayKeyOf(new Date(2026, 10, 20))).toBe("2026-11-20");
  });
});

describe("streakOf", () => {
  it("counts consecutive days through today", () => {
    const days = {
      "2026-10-18": day(5),
      "2026-10-19": day(3),
      "2026-10-20": day(1),
    };
    expect(streakOf(days, new Date(2026, 9, 20))).toBe(3);
  });

  it("keeps yesterday's streak alive when today is quiet", () => {
    const days = {
      "2026-10-18": day(5),
      "2026-10-19": day(3),
    };
    expect(streakOf(days, new Date(2026, 9, 20))).toBe(2);
  });

  it("breaks on a skipped day", () => {
    const days = {
      "2026-10-18": day(5),
      "2026-10-20": day(1),
    };
    expect(streakOf(days, new Date(2026, 9, 20))).toBe(1);
  });

  it("is zero with no history", () => {
    expect(streakOf({}, new Date(2026, 9, 20))).toBe(0);
  });
});

describe("last7Bars", () => {
  it("returns seven days ending today in order", () => {
    const days = { "2026-10-20": day(4, 3) };
    const bars = last7Bars(days, new Date(2026, 9, 20));
    expect(bars).toHaveLength(7);
    expect(bars[6]?.key).toBe("2026-10-20");
    expect(bars[6]?.reviews).toBe(4);
    expect(bars[6]?.correct).toBe(3);
    expect(bars[6]?.isToday).toBe(true);
    expect(bars[0]?.key).toBe("2026-10-14");
    expect(bars[0]?.reviews).toBe(0);
    expect(bars[0]?.isToday).toBe(false);
  });
});
