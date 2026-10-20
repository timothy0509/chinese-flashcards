import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDayStats,
  clearProgress,
  clearWrongIds,
  loadDayStats,
  loadProgress,
  loadWrongIds,
  recordDayReview,
  saveProgress,
  saveWrongIds,
} from "./storage";
import type { Progress } from "./srs";

const KEY = "chinese-flashcards-progress-v1";
const WRONG_KEY = "chinese-flashcards-wrong-v1";
const DAYS_KEY = "chinese-flashcards-days-v1";

function mockStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: vi.fn((k: string) => (store.has(k) ? store.get(k)! : null)),
    setItem: vi.fn((k: string, v: string) => {
      store.set(k, v);
    }),
    removeItem: vi.fn((k: string) => {
      store.delete(k);
    }),
  };
  vi.stubGlobal("localStorage", storage);
  return { store, storage };
}

describe("loadProgress", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty when nothing is stored", () => {
    mockStorage();
    expect(loadProgress()).toEqual({});
  });

  it("returns stored progress", () => {
    const { store } = mockStorage();
    const saved: Record<string, Progress> = {
      "1-1": { ef: 2.6, interval: 6, reps: 2, due: 123, last: 100 },
    };
    store.set(KEY, JSON.stringify(saved));
    expect(loadProgress()).toEqual(saved);
  });

  it("returns empty on corrupt JSON", () => {
    const { store } = mockStorage();
    store.set(KEY, "not-json{{{");
    expect(loadProgress()).toEqual({});
  });

  it("returns empty without localStorage", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(loadProgress()).toEqual({});
  });
});

describe("saveProgress", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists progress as JSON", () => {
    const { storage } = mockStorage();
    const data: Record<string, Progress> = {
      "1-1": { ef: 2.5, interval: 1, reps: 1, due: 200, last: 100 },
    };
    saveProgress(data);
    expect(storage.setItem).toHaveBeenCalledWith(KEY, JSON.stringify(data));
  });

  it("does not throw when storage fails", () => {
    const { storage } = mockStorage();
    storage.setItem.mockImplementation(() => {
      throw new Error("full");
    });
    expect(() =>
      saveProgress({ "1-1": { ef: 2.5, interval: 0, reps: 0, due: 0, last: null } }),
    ).not.toThrow();
  });
});

describe("clearProgress", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("removes the stored key", () => {
    const { store, storage } = mockStorage();
    store.set(KEY, "{}");
    clearProgress();
    expect(storage.removeItem).toHaveBeenCalledWith(KEY);
    expect(store.has(KEY)).toBe(false);
  });

  it("does not throw when storage fails", () => {
    const { storage } = mockStorage();
    storage.removeItem.mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => clearProgress()).not.toThrow();
  });
});

describe("wrong ids", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty when nothing is stored", () => {
    mockStorage();
    expect(loadWrongIds()).toEqual([]);
  });

  it("round-trips the wrong list", () => {
    const { store } = mockStorage();
    saveWrongIds(["1-1", "2-3"]);
    expect(store.get(WRONG_KEY)).toBe(JSON.stringify(["1-1", "2-3"]));
    expect(loadWrongIds()).toEqual(["1-1", "2-3"]);
  });

  it("drops non-string entries and corrupt JSON", () => {
    const { store } = mockStorage();
    store.set(WRONG_KEY, JSON.stringify(["1-1", 42, null]));
    expect(loadWrongIds()).toEqual(["1-1"]);
    store.set(WRONG_KEY, "not-json{{{");
    expect(loadWrongIds()).toEqual([]);
  });

  it("clears the wrong list", () => {
    const { store, storage } = mockStorage();
    store.set(WRONG_KEY, JSON.stringify(["1-1"]));
    clearWrongIds();
    expect(storage.removeItem).toHaveBeenCalledWith(WRONG_KEY);
    expect(loadWrongIds()).toEqual([]);
  });
});

describe("day stats", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts empty and records reviews into today", () => {
    mockStorage();
    expect(loadDayStats()).toEqual({});
    const at = new Date(2026, 9, 20, 12).getTime();
    const days = recordDayReview(true, at);
    expect(days["2026-10-20"]).toEqual({ reviews: 1, correct: 1 });
    recordDayReview(false, at);
    expect(loadDayStats()["2026-10-20"]).toEqual({ reviews: 2, correct: 1 });
  });

  it("drops malformed entries and trims old days", () => {
    const { store } = mockStorage();
    const many: Record<string, { reviews: number; correct: number }> = {
      junk: { reviews: 1, correct: 1 },
    };
    for (let i = 0; i < 61; i++) {
      const d = new Date(2026, 0, 1 + i);
      const m = `${d.getMonth() + 1}`.padStart(2, "0");
      const day = `${d.getDate()}`.padStart(2, "0");
      many[`${d.getFullYear()}-${m}-${day}`] = { reviews: 1, correct: 1 };
    }
    store.set(DAYS_KEY, JSON.stringify(many));
    expect(loadDayStats().junk).toBeUndefined();
    const at = new Date(2026, 9, 20, 12).getTime();
    const days = recordDayReview(true, at);
    expect(Object.keys(days)).toHaveLength(60);
    expect(days["2026-10-20"]).toEqual({ reviews: 1, correct: 1 });
  });

  it("clears the day stats", () => {
    const { store, storage } = mockStorage();
    store.set(
      DAYS_KEY,
      JSON.stringify({ "2026-10-20": { reviews: 2, correct: 1 } }),
    );
    clearDayStats();
    expect(storage.removeItem).toHaveBeenCalledWith(DAYS_KEY);
    expect(loadDayStats()).toEqual({});
  });
});
