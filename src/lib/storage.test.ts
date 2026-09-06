import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearProgress, loadProgress, saveProgress } from "./storage";
import type { Progress } from "./srs";

const KEY = "chinese-flashcards-progress-v1";

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
