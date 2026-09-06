import { useEffect, useMemo, useRef, useState } from "react";
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
  { label: "忘記", q: 0, key: "1", className: "grade-forget" },
  { label: "記得", q: 4, key: "2", className: "grade-remember" },
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
  const [enterDir, setEnterDir] = useState<1 | -1>(1);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const flashTimer = useRef<number | null>(null);
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
    setEnterDir(delta >= 0 ? 1 : -1);
    setFlash(null);
    setFlipped(false);
    setPos((p) => (p + delta + deck.length) % deck.length);
  }

  function reshuffle() {
    setOrder(shuffle(cards.map((c) => c.id)));
    setPos(0);
    setFlash(null);
    setEnterDir(1);
    setFlipped(false);
  }

  function answer(q: number) {
    if (!current || flashTimer.current !== null) return;
    const id = current.id;
    setFlash(q >= 3 ? "good" : "bad");
    flashTimer.current = window.setTimeout(() => {
      flashTimer.current = null;
      const t = Date.now();
      setProgress((p) => ({
        ...p,
        [id]: grade(p[id] ?? initialProgress(), q, t),
      }));
      setFlash(null);
      setEnterDir(1);
      setFlipped(false);
      setPos((p) => (deck.length <= 1 ? 0 : (p + 1) % deck.length));
    }, 380);
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
      } else if (flipped && !flash && ["1", "2"].includes(e.key)) {
        const g = GRADES[Number(e.key) - 1];
        if (g) answer(g.q);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="page">
      <header>
        <div className="masthead">
          <span className="seal" aria-hidden="true">
            文
          </span>
          <h1>文言字詞卡</h1>
        </div>
        <div className="rule" aria-hidden="true">
          <span className="rule-dot" />
        </div>
      </header>

      <div className="toolbar">
        <div className="toolbar-row">
          <label className="field">
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
          </label>
          <label className="field">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPos(0);
                setFlipped(false);
              }}
              placeholder="搜尋原句、關鍵字、答案"
              aria-label="搜尋"
              type="search"
            />
          </label>
        </div>
        <div className="mode-row" role="group" aria-label="模式">
          <button
            type="button"
            className={mode === "all" ? "active" : ""}
            aria-pressed={mode === "all"}
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
            aria-pressed={mode === "due"}
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
        <span className="chip">
          已學 <strong>{learned}</strong> / {filtered.length}
        </span>
        <span className="chip">
          待複習 <strong>{dueCount}</strong>
        </span>
        <span className="chip">
          已掌握 <strong>{mastered}</strong>
        </span>
        <div className="bar" role="progressbar" aria-valuenow={learned} aria-valuemin={0} aria-valuemax={filtered.length}>
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
            cardKey={current.id}
            enterDir={enterDir}
            flash={flash}
          />
          <p className="pos">
            第 {safePos + 1} / {deck.length} 張 · {current.chapter} #{current.num}
          </p>
          <div className="nav">
            <button type="button" onClick={() => go(-1)}>
              上一張
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => setFlipped((f) => !f)}
            >
              {flipped ? "看題目" : "翻面"}
            </button>
            <button type="button" onClick={() => go(1)}>
              下一張
            </button>
          </div>
          {flipped && (
            <div className="grade-row">
              {GRADES.map((g) => (
                <button
                  key={g.label}
                  type="button"
                  className={g.className}
                  disabled={flash !== null}
                  onClick={() => answer(g.q)}
                >
                  {g.label}
                  <span className="grade-key">{g.key}</span>
                </button>
              ))}
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
