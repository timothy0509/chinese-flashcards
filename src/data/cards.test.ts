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
      if (c.occurrence !== undefined) {
        const total = c.sentence.split(c.term).length - 1;
        expect(total).toBeGreaterThan(1);
        expect(c.occurrence).toBeGreaterThanOrEqual(0);
        expect(c.occurrence).toBeLessThan(total);
      }
    }
  });

  it("pins a single occurrence where repeated terms differ", () => {
    const byId = new Map(cards.map((c) => [c.id, c]));
    // 未始 (adverb 曾經) vs 乎始 (verb 開始): same sentence, same term,
    // different answers, so each card must point at its own 始.
    expect(byId.get("2-60")?.occurrence).toBe(0);
    expect(byId.get("2-61")?.occurrence).toBe(1);
    // 使 (verb 派遣) vs 使者 (envoy): only the first 使 is the verb.
    expect(byId.get("8-95")?.occurrence).toBe(0);
    // 不辟 (avoid) vs 機辟 (trap part): only the first 辟 is the verb.
    expect(byId.get("11-47")?.occurrence).toBe(0);
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
