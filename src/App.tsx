import { useEffect, useMemo, useRef, useState } from "react";
import ChapterPicker from "./components/ChapterPicker";
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
  const [chapters, setChapters] = useState<string[]>([]);
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
      .filter((c) => chapters.length === 0 || chapters.includes(c.chapter))
      .filter(
        (c) =>
          q === "" ||
          c.sentence.includes(q) ||
          c.term.includes(q) ||
          c.answer.includes(q),
      )
      .filter((c) => mode === "all" || isDue(progress[c.id], now));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, chapters, query, mode, progress]);

  const safePos = deck.length === 0 ? 0 : Math.min(pos, deck.length - 1);
  const current = deck[safePos];

  const filtered = useMemo(() => {
    const q = query.trim();
    return cards.filter(
      (c) =>
        (chapters.length === 0 || chapters.includes(c.chapter)) &&
        (q === "" ||
          c.sentence.includes(q) ||
          c.term.includes(q) ||
          c.answer.includes(q)),
    );
  }, [chapters, query]);

  const learned = filtered.filter((c) => progress[c.id]?.last != null).length;
  const dueCount = filtered.filter((c) => isDue(progress[c.id], now)).length;
  const mastered = filtered.filter((c) => isMastered(progress[c.id])).length;
  const pct =
    filtered.length === 0 ? 0 : Math.round((learned / filtered.length) * 100);

  const chapterItems = useMemo(
    () =>
      chaptersData.map((ch) => {
        const list = cards.filter((c) => c.chapter === ch.name);
        return {
          name: ch.name,
          count: ch.count,
          learned: list.filter((c) => progress[c.id]?.last != null).length,
          due: list.filter((c) => isDue(progress[c.id], Date.now())).length,
        };
      }),
    [progress],
  );
  const totalLearned = cards.filter((c) => progress[c.id]?.last != null).length;
  const totalDue = cards.filter((c) => isDue(progress[c.id], now)).length;

  function go(delta: number) {
    if (deck.length === 0) return;
    setEnterDir(delta >= 0 ? 1 : -1);
    setFlash(null);
    setFlipped(false);
    setPos((p) => (p + delta + deck.length) % deck.length);
  }

  function jumpTo(index: number) {
    if (deck.length === 0) return;
    setEnterDir(index >= safePos ? 1 : -1);
    setFlash(null);
    setFlipped(false);
    setPos(index);
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
      <header className="topbar">
        <div className="masthead">
          <span className="seal" aria-hidden="true">
            文
          </span>
          <div>
            <h1>文言字詞卡</h1>
            <p className="subtitle">691 張古典字詞 · 章節篩選 · 間隔複習</p>
          </div>
        </div>
        <div className="top-due" title="待複習">
          <span className="top-due-num">{dueCount}</span>
          <span className="top-due-label">待複習</span>
        </div>
      </header>

      <div className="layout">
        <aside className="side" aria-label="篩選與進度">
          <section className="panel">
            <h2>篇目</h2>
            <ChapterPicker
              value={chapters}
              onChange={(v) => {
                setChapters(v);
                setPos(0);
                setFlipped(false);
              }}
              items={chapterItems}
              totalCount={cards.length}
              totalLearned={totalLearned}
              totalDue={totalDue}
            />
          </section>

          <section className="panel">
            <h2>搜尋與模式</h2>
            <label className="field">
              <span className="field-label">搜尋</span>
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
          </section>

          <section className="panel">
            <h2>進度</h2>
            <div className="stat-grid">
              <div className="stat">
                <span className="stat-num">
                  {learned}
                  <span className="stat-denom">/{filtered.length}</span>
                </span>
                <span className="stat-label">已學</span>
              </div>
              <div className="stat">
                <span className="stat-num">{dueCount}</span>
                <span className="stat-label">待複習</span>
              </div>
              <div className="stat">
                <span className="stat-num">{mastered}</span>
                <span className="stat-label">已掌握</span>
              </div>
            </div>
            <div
              className="bar"
              role="progressbar"
              aria-valuenow={learned}
              aria-valuemin={0}
              aria-valuemax={filtered.length}
              aria-label={`已學 ${pct}%`}
            >
              <div className="fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="pct">{pct}% 完成</p>
          </section>

          <section className="panel panel-quiet">
            <div className="side-actions">
              <button type="button" onClick={reshuffle}>
                洗牌
              </button>
              <button type="button" onClick={resetAll}>
                重置進度
              </button>
            </div>
            <p className="hints">
              空白鍵 翻面 · ← → 換卡 · 1 忘記 · 2 記得
            </p>
          </section>
        </aside>

        <main className="main" aria-live="polite">
          {current ? (
            <>
              <div className="deck-meta">
                <span className="deck-pos">
                  第 {safePos + 1} / {deck.length} 張
                </span>
                <span className="deck-chapter">
                  {current.chapter} #{current.num}
                </span>
              </div>
              <input
                className="scrub"
                type="range"
                min={1}
                max={Math.max(deck.length, 1)}
                value={deck.length === 0 ? 0 : safePos + 1}
                onChange={(e) => jumpTo(Number(e.target.value) - 1)}
                aria-label="跳到指定卡片"
              />
              <Flashcard
                card={current}
                flipped={flipped}
                onFlip={() => setFlipped((f) => !f)}
                cardKey={current.id}
                enterDir={enterDir}
                flash={flash}
              />
              <div className="nav">
                <button type="button" onClick={() => go(-1)} aria-label="上一張">
                  ← <span className="nav-text">上一張</span>
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => setFlipped((f) => !f)}
                >
                  {flipped ? "看題目" : "翻面看答案"}
                </button>
                <button type="button" onClick={() => go(1)} aria-label="下一張">
                  <span className="nav-text">下一張</span> →
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
                      <span className="grade-key">按鍵 {g.key}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="empty">
              <p>
                {filtered.length === 0
                  ? "沒有符合的卡，換個篩選條件試試。"
                  : learned === 0
                    ? "還沒開始學，去全部瀏覽刷第一輪吧。"
                    : "這組沒有待複習的卡，全部搞定。"}
              </p>
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
        </main>
      </div>
    </div>
  );
}
