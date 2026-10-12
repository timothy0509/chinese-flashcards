import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Search, Shuffle, X } from "lucide-react";
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
import { cn } from "./lib/cn";

const cards = cardsData as Card[];
const byId = new Map(cards.map((c) => [c.id, c]));

type Mode = "all" | "due";

const GRADES = [
  { label: "忘記", q: 0, key: "1", icon: X, kind: "forget" as const },
  { label: "記得", q: 4, key: "2", icon: Check, kind: "remember" as const },
];

const panel =
  "grid gap-3 rounded-panel border border-line bg-card p-4 shadow-soft";
const panelTitle =
  "m-0 font-serif text-[0.85rem] font-bold tracking-[0.2em] text-muted";
const quietBtn =
  "min-h-11 cursor-pointer rounded-btn border border-dashed border-line-strong " +
  "bg-transparent px-3 py-2 text-[0.9rem] text-muted transition " +
  "hover:border-solid hover:border-ink hover:text-ink hover:shadow-soft";

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
  const reduce = useReducedMotion();

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

  const panelIn = (i: number) => ({
    initial: reduce ? undefined : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay: reduce ? 0 : 0.06 * i, ease: "easeOut" as const },
  });

  return (
    <div className="mx-auto max-w-[1060px] px-5 pt-7 pb-18 max-sm:px-3.5 max-sm:pt-5">
      <header className="flex items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            aria-hidden="true"
            className="grid size-[46px] flex-none place-items-center rounded-[9px] bg-accent font-serif text-[1.5rem] leading-none font-black text-accent-ink shadow-soft select-none"
          >
            文
          </span>
          <div>
            <h1 className="m-0 font-serif text-[clamp(1.5rem,4vw,1.9rem)] leading-tight font-black tracking-[0.12em]">
              文言字詞卡
            </h1>
            <p className="mt-0.5 mb-0 text-[0.82rem] tracking-[0.02em] text-muted max-sm:hidden">
              691 張古典字詞 · 章節篩選 · 間隔複習
            </p>
          </div>
        </div>
        <div
          title="待複習"
          className="flex flex-none items-baseline gap-2 rounded-panel border border-line bg-card px-3.5 py-2 shadow-soft"
        >
          <span className="font-serif text-[1.5rem] leading-none font-black text-accent-deep">
            {dueCount}
          </span>
          <span className="text-[0.8rem] text-muted">待複習</span>
        </div>
      </header>

      <div className="mt-5 grid items-start gap-5 min-[960px]:grid-cols-[300px_minmax(0,1fr)] min-[960px]:gap-6">
        <aside
          aria-label="篩選與進度"
          className="order-2 grid min-w-0 gap-3.5 min-[960px]:order-1 min-[960px]:sticky min-[960px]:top-5"
        >
          <motion.section className={panel} {...panelIn(0)}>
            <h2 className={panelTitle}>篇目</h2>
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
          </motion.section>

          <motion.section className={panel} {...panelIn(1)}>
            <h2 className={panelTitle}>搜尋與模式</h2>
            <label className="grid gap-1.5">
              <span className="text-[0.78rem] tracking-[0.08em] text-muted">
                搜尋
              </span>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint"
                />
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
                  className="min-h-12 w-full rounded-btn border border-line-strong bg-card py-3 pr-3.5 pl-10 text-ink transition-colors placeholder:text-faint hover:border-muted"
                />
              </div>
            </label>
            <div
              role="group"
              aria-label="模式"
              className="grid grid-cols-2 rounded-btn border border-line-strong bg-paper-soft p-[3px]"
            >
              {(
                [
                  ["all", "全部瀏覽"],
                  ["due", "今日複習"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  className={cn(
                    "min-h-11 cursor-pointer rounded-xl border-0 px-3 py-2.5 font-medium transition-colors",
                    mode === m
                      ? "bg-ink text-paper shadow-[0_2px_8px_rgb(43_38_32/0.25)] dark:bg-accent dark:text-[#231210] dark:shadow-none"
                      : "bg-transparent text-muted hover:text-ink",
                  )}
                  onClick={() => {
                    setMode(m);
                    setPos(0);
                    setFlipped(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </motion.section>

          <motion.section className={panel} {...panelIn(2)}>
            <h2 className={panelTitle}>進度</h2>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  [`${learned}`, `/${filtered.length}`, "已學"],
                  [`${dueCount}`, "", "待複習"],
                  [`${mastered}`, "", "已掌握"],
                ] as const
              ).map(([num, denom, label]) => (
                <div key={label} className="grid justify-items-center gap-0.5">
                  <span className="font-serif text-[1.45rem] leading-tight font-black">
                    {num}
                    {denom && (
                      <span className="text-[0.8rem] font-normal text-muted">
                        {denom}
                      </span>
                    )}
                  </span>
                  <span className="text-[0.75rem] text-muted">{label}</span>
                </div>
              ))}
            </div>
            <div
              role="progressbar"
              aria-valuenow={learned}
              aria-valuemin={0}
              aria-valuemax={filtered.length}
              aria-label={`已學 ${pct}%`}
              className="h-2.5 overflow-hidden rounded-full border border-black/5 bg-line dark:border-white/5"
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-deep"
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            <p className="m-0 text-right text-[0.82rem] text-muted">
              {pct}% 完成
            </p>
          </motion.section>

          <motion.section
            className="grid gap-3 rounded-panel border border-dashed border-line-strong p-4"
            {...panelIn(3)}
          >
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" className={quietBtn} onClick={reshuffle}>
                <Shuffle className="mr-1.5 inline size-4 -translate-y-px" aria-hidden="true" />
                洗牌
              </button>
              <button type="button" className={quietBtn} onClick={resetAll}>
                <RotateCcw className="mr-1.5 inline size-4 -translate-y-px" aria-hidden="true" />
                重置進度
              </button>
            </div>
            <p className="m-0 text-[0.78rem] leading-relaxed text-faint">
              空白鍵 翻面 · ← → 換卡 · 1 忘記 · 2 記得
            </p>
          </motion.section>
        </aside>

        <motion.main
          aria-live="polite"
          className="order-1 flex min-w-0 w-full max-w-[640px] flex-col mx-auto min-[960px]:order-2 min-[960px]:mx-0 min-[960px]:max-w-none"
          {...panelIn(0)}
        >
          {current ? (
            <>
              <div className="mt-0.5 mb-2 flex items-baseline justify-between gap-3">
                <span className="font-bold text-[0.95rem]">
                  第 {safePos + 1} / {deck.length} 張
                </span>
                <span className="truncate text-[0.82rem] whitespace-nowrap text-muted">
                  {current.chapter} #{current.num}
                </span>
              </div>
              <input
                className="scrubber"
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
              <div className="mt-3.5 grid grid-cols-[1fr_auto_1fr] gap-2.5">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="上一張"
                  className="min-h-[52px] cursor-pointer justify-self-start rounded-btn border border-line-strong bg-transparent px-4 py-2.5 font-medium whitespace-nowrap text-muted transition hover:border-ink hover:text-ink hover:shadow-soft active:translate-y-px"
                >
                  <ArrowLeft className="inline size-4 -translate-y-px" aria-hidden="true" />
                  <span className="ml-1.5 max-sm:hidden">上一張</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFlipped((f) => !f)}
                  className="min-h-[52px] min-w-[min(260px,60vw)] cursor-pointer rounded-btn border border-accent bg-accent px-6 py-3 text-[1rem] font-semibold text-accent-ink transition hover:border-accent-deep hover:bg-accent-deep active:translate-y-px max-sm:min-w-0 max-sm:px-4"
                >
                  {flipped ? "看題目" : "翻面看答案"}
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="下一張"
                  className="min-h-[52px] cursor-pointer justify-self-end rounded-btn border border-line-strong bg-transparent px-4 py-2.5 font-medium whitespace-nowrap text-muted transition hover:border-ink hover:text-ink hover:shadow-soft active:translate-y-px"
                >
                  <span className="mr-1.5 max-sm:hidden">下一張</span>
                  <ArrowRight className="inline size-4 -translate-y-px" aria-hidden="true" />
                </button>
              </div>
              {flipped && (
                <motion.div
                  initial={reduce ? undefined : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="mt-3.5 grid grid-cols-2 gap-2.5"
                >
                  {GRADES.map((g) => (
                    <button
                      key={g.label}
                      type="button"
                      disabled={flash !== null}
                      onClick={() => answer(g.q)}
                      className={cn(
                        "min-h-[52px] cursor-pointer rounded-btn border px-3 py-2 font-medium transition active:translate-y-px disabled:opacity-60",
                        g.kind === "forget"
                          ? "border-accent/45 bg-card text-accent-deep hover:border-accent hover:shadow-soft"
                          : "border-accent bg-accent text-accent-ink hover:border-accent-deep hover:bg-accent-deep hover:shadow-soft",
                      )}
                    >
                      <g.icon className="mr-1.5 inline size-4 -translate-y-px" aria-hidden="true" />
                      {g.label}
                      <span className="block text-[0.72rem] opacity-60">
                        按鍵 {g.key}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </>
          ) : (
            <div className="border-line-strong rounded-panel border-dashed bg-card px-4 py-14 text-center font-serif">
              <p className="mt-0 mb-4 text-[1.1rem] text-muted">
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
                className="min-h-11 cursor-pointer rounded-btn border border-line-strong bg-card px-3 py-2.5 transition hover:border-ink hover:shadow-soft"
              >
                回全部瀏覽
              </button>
            </div>
          )}
        </motion.main>
      </div>
    </div>
  );
}
