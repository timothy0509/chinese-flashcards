import { describe, expect, it } from "vitest";
import cardsData from "./cards.json";
import chaptersData from "./chapters.json";
import type { Card } from "../lib/srs";

const cards = cardsData as Card[];
const chapters = chaptersData as { name: string; count: number }[];

describe("flashcard data", () => {
  it("has cards with unique ids and no empty fields", () => {
    expect(cards.length).toBeGreaterThan(0);
    const ids = new Set(cards.map((c) => c.id));
    expect(ids.size).toBe(cards.length);
    for (const c of cards) {
      expect(c.id.trim()).not.toBe("");
      expect(c.chapter.trim()).not.toBe("");
      expect(c.sentence.trim()).not.toBe("");
      expect(c.term.trim()).not.toBe("");
      expect(c.answer.trim()).not.toBe("");
      expect(c.sentence).toContain(c.term);
    }
  });

  it("matches chapter counts", () => {
    const counts = new Map<string, number>();
    for (const c of cards) {
      counts.set(c.chapter, (counts.get(c.chapter) ?? 0) + 1);
    }
    expect(chapters.length).toBeGreaterThan(0);
    for (const ch of chapters) {
      expect(counts.get(ch.name)).toBe(ch.count);
    }
    expect([...counts.keys()].sort()).toEqual(
      chapters.map((c) => c.name).sort(),
    );
  });
});
