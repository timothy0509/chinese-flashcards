import { useEffect, useMemo, useState } from "react";
import Flashcard from "./components/Flashcard";
import cardsData from "./data/cards.json";
import chaptersData from "./data/chapters.json";
import {
  grade,
  initialProgress,
  isDue,
  isMastered,
  shuffle,
  type Card,
  type Progress,
} from "./lib/srs";
import { clearProgress, loadProgress, saveProgress } from "./lib/storage";

const cards = cardsData as Card[];
const byId = new Map(cards.map((c) => [c.id, c]));

type Mode = "all" | "due";

const GRADES = [
  { label: "忘記", q: 0 },
  { label: "困難", q: 3 },
  { label: "記得", q: 4 },
  { label: "簡單", q: 5 },
];

export default function App() {
  const [chapter, setChapter] = useState("全部");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("all");
  const [order, setOrder] = useState<string[]>(() =>
    shuffle(cards.map((c) => c.id)),
  );
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [progress, setProgress] = useState<Record<string, Progress>>(() =>
    loadProgress(),
  );

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const now = Date.now();

  const deck = useMemo(() => {
    const q = query.trim();
    return order
      .map((id) => byId.get(id))
      .filter((c): c is Card => c !== undefined)
      .filter((c) => chapter === "全部" || c.chapter === chapter)
      .filter(
        (c) =>
          q === "" ||
          c.sentence.includes(q) ||
          c.term.includes(q) ||
          c.answer.includes(q),
      )
      .filter((c) => mode === "all" || isDue(progress[c.id], now));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, chapter, query, mode, progress]);

  const safePos = deck.length === 0 ? 0 : Math.min(pos, deck.length - 1);
  const current = deck[safePos];

  const filtered = useMemo(() => {
    const q = query.trim();
    return cards.filter(
      (c) =>
        (chapter === "全部" || c.chapter === chapter) &&
        (q === "" ||
          c.sentence.includes(q) ||
          c.term.includes(q) ||
          c.answer.includes(q)),
    );
  }, [chapter, query]);

  const learned = filtered.filter((c) => progress[c.id]?.last != null).length;
  const dueCount = filtered.filter((c) => isDue(progress[c.id], now)).length;
  const mastered = filtered.filter((c) => isMastered(progress[c.id])).length;

  function go(delta: number) {
    if (deck.length === 0) return;
    setFlipped(false);
    setPos((p) => (p + delta + deck.length) % deck.length);
  }

  function reshuffle() {
    setOrder(shuffle(cards.map((c) => c.id)));
    setPos(0);
    setFlipped(false);
  }

  function answer(q: number) {
    if (!current) return;
    const t = Date.now();
    setProgress((p) => ({
      ...p,
      [current.id]: grade(p[current.id] ?? initialProgress(), q, t),
    }));
    setFlipped(false);
    setPos((p) => (deck.length <= 1 ? 0 : (p + 1) % deck.length));
  }

  function resetAll() {
    if (!window.confirm("確定清除所有學習進度？")) return;
    clearProgress();
    setProgress({});
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        if (current) setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") {
        go(1);
      } else if (e.key === "ArrowLeft") {
        go(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="page">
      <header>
        <h1>文言字詞卡</h1>
        <p className="sub">
          {cards.length} 張 · {chaptersData.length} 篇 · 進度存在這台瀏覽器
        </p>
      </header>

      <div className="toolbar">
        <select
          value={chapter}
          onChange={(e) => {
            setChapter(e.target.value);
            setPos(0);
            setFlipped(false);
          }}
          aria-label="章節篩選"
        >
          <option value="全部">全部篇目</option>
          {chaptersData.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}（{c.count}）
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPos(0);
            setFlipped(false);
          }}
          placeholder="搜尋原句、關鍵字、答案"
          aria-label="搜尋"
        />
        <div className="mode-row" role="group" aria-label="模式">
          <button
            type="button"
            className={mode === "all" ? "active" : ""}
            onClick={() => {
              setMode("all");
              setPos(0);
              setFlipped(false);
            }}
          >
            全部瀏覽
          </button>
          <button
            type="button"
            className={mode === "due" ? "active" : ""}
            onClick={() => {
              setMode("due");
              setPos(0);
              setFlipped(false);
            }}
          >
            今日複習
          </button>
        </div>
      </div>

      <div className="stats">
        <span>
          已學 {learned} / {filtered.length}
        </span>
        <span>待複習 {dueCount}</span>
        <span>已掌握 {mastered}</span>
        <div className="bar">
          <div
            className="fill"
            style={{
              width:
                filtered.length === 0
                  ? "0%"
                  : `${Math.round((learned / filtered.length) * 100)}%`,
            }}
          />
        </div>
      </div>

      {current ? (
        <>
          <Flashcard
            card={current}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
          />
          <p className="pos">
            第 {safePos + 1} / {deck.length} 張 · {current.chapter} #{current.num}
          </p>
          {flipped ? (
            <div className="grades">
              {GRADES.map((g) => (
                <button key={g.label} type="button" onClick={() => answer(g.q)}>
                  {g.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="nav">
              <button type="button" onClick={() => go(-1)}>
                上一張
              </button>
              <button type="button" onClick={() => setFlipped(true)}>
                翻面
              </button>
              <button type="button" onClick={() => go(1)}>
                下一張
              </button>
            </div>
          )}
          <div className="secondary">
            <button type="button" onClick={reshuffle}>
              洗牌
            </button>
            <button type="button" onClick={resetAll}>
              重置進度
            </button>
          </div>
        </>
      ) : (
        <div className="empty">
          <p>這組沒有待複習的卡，全部搞定。</p>
          <button
            type="button"
            onClick={() => {
              setMode("all");
              setPos(0);
            }}
          >
            回全部瀏覽
          </button>
        </div>
      )}
    </div>
  );
}
