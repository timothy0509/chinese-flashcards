import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowLeftRight, ArrowRight, CalendarDays, Check, Flame, ListX, Play, RotateCcw, Search, Shuffle, Trash2, X } from "lucide-react";
import ChapterPicker from "./components/ChapterPicker";
import Flashcard from "./components/Flashcard";
import cardsData from "./data/cards.json";
import chaptersData from "./data/chapters.json";
import {
  DAY,
  grade,
  initialProgress,
  isDue,
  isMastered,
  requeueAfterFail,
  shuffle,
  type Card,
  type Progress,
} from "./lib/srs";
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
} from "./lib/storage";
import { dayKeyOf, last7Bars, streakOf } from "./lib/stats";
import { cn } from "./lib/cn";

const cards = cardsData as Card[];
const byId = new Map(cards.map((c) => [c.id, c]));

type Mode = "all" | "due" | "wrong";

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
  const [wrongIds, setWrongIds] = useState<string[]>(() => loadWrongIds());
  const wrongSet = useMemo(() => new Set(wrongIds), [wrongIds]);
  const [dayStats, setDayStats] = useState(() => loadDayStats());
  // Recall direction: forward recalls the meaning, reverse recalls the term.
  const [direction, setDirection] = useState<"forward" | "reverse">("forward");
  // Strict review session (due / wrong modes). queue[0] is the current card.
  // A remembered card leaves the queue, a forgotten one goes back in after
  // a gap so the learner must retrieve it again. Browse mode ("all") stays
  // free and keeps using deck / pos.
  const [queue, setQueue] = useState<string[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionStats, setSessionStats] = useState<{
    tries: Record<string, number>;
    firstOk: number;
    done: number;
  }>({ tries: {}, firstOk: 0, done: 0 });
  const strict = mode !== "all";
  const reduce = useReducedMotion();

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  useEffect(() => {
    saveWrongIds(wrongIds);
  }, [wrongIds]);

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
      .filter((c) => {
        if (mode === "due") return isDue(progress[c.id], now);
        if (mode === "wrong") return wrongSet.has(c.id);
        return true;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, chapters, query, mode, progress, wrongSet]);

  const safePos = deck.length === 0 ? 0 : Math.min(pos, deck.length - 1);
  const browseCurrent = deck[safePos];

  function matchFilters(
    c: Card,
    q: string,
    chapterList: string[],
    ids?: Set<string>,
  ): boolean {
    if (chapterList.length > 0 && !chapterList.includes(c.chapter)) return false;
    if (
      q !== "" &&
      !c.sentence.includes(q) &&
      !c.term.includes(q) &&
      !c.answer.includes(q)
    )
      return false;
    if (ids && !ids.has(c.id)) return false;
    return true;
  }

  function buildSession(
    nextMode: Mode,
    idsInOrder: string[],
    chapterList: string[],
    q: string,
    prog: Record<string, Progress>,
    wrong: Set<string>,
  ) {
    const t = Date.now();
    const ids = idsInOrder.filter((id) => {
      const c = byId.get(id);
      if (!c || !matchFilters(c, q, chapterList)) return false;
      if (nextMode === "due") return isDue(prog[c.id], t);
      if (nextMode === "wrong") return wrong.has(c.id);
      return true;
    });
    setQueue(ids);
    setSessionTotal(ids.length);
    setSessionStats({ tries: {}, firstOk: 0, done: 0 });
    setPos(0);
    setFlipped(false);
    setFlash(null);
    setEnterDir(1);
  }

  const strictCurrent =
    strict && queue.length > 0 ? byId.get(queue[0]) : undefined;
  const current = strict ? strictCurrent : browseCurrent;
  const sessionLeft = queue.length;
  const sessionRate =
    sessionTotal === 0
      ? 0
      : Math.round((sessionStats.firstOk / sessionTotal) * 100);

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
  const wrongCount = filtered.filter((c) => wrongSet.has(c.id)).length;
  const wrongCards = useMemo(() => {
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
      .filter((c) => wrongSet.has(c.id));
  }, [order, chapters, query, wrongSet]);
  const pct =
    filtered.length === 0 ? 0 : Math.round((learned / filtered.length) * 100);

  // Daily progress: today, streak, week, forecast.
  const todayKey = dayKeyOf(new Date(now));
  const today = dayStats[todayKey] ?? { reviews: 0, correct: 0 };
  const todayRate =
    today.reviews === 0 ? 0 : Math.round((today.correct / today.reviews) * 100);
  const streak = streakOf(dayStats, new Date(now));
  const week = last7Bars(dayStats, new Date(now));
  const weekMax = Math.max(1, ...week.map((w) => w.reviews));
  const dueSoon = filtered.filter((c) => {
    const p = progress[c.id];
    return p && p.last !== null && !isDue(p, now) && p.due <= now + DAY;
  }).length;
  const learning = learned - mastered;

  function cardStatus(p: Progress | undefined, t: number): string {
    if (!p || p.last === null) return "新卡 · 先在心中猜猜看";
    if (isMastered(p)) return `已掌握 · 已連對 ${p.reps} 次`;
    if (p.reps === 0) return "上次沒想起來 · 加強中";
    if (p.due <= t) return `已連對 ${p.reps} 次 · 到期了，正是時候`;
    const days = Math.floor((p.due - t) / DAY);
    if (days >= 1) return `已連對 ${p.reps} 次 · ${days} 天後到期`;
    const hrs = Math.max(1, Math.round((p.due - t) / 3_600_000));
    return `已連對 ${p.reps} 次 · ${hrs} 小時後到期`;
  }

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

  function switchMode(m: Mode) {
    setMode(m);
    if (m !== "all") {
      buildSession(m, order, chapters, query.trim(), progress, wrongSet);
    } else {
      setPos(0);
      setFlipped(false);
      setFlash(null);
      setEnterDir(1);
    }
  }

  function reshuffle() {
    const next = shuffle(cards.map((c) => c.id));
    setOrder(next);
    if (strict) {
      buildSession(mode, next, chapters, query.trim(), progress, wrongSet);
    } else {
      setPos(0);
      setFlash(null);
      setEnterDir(1);
      setFlipped(false);
    }
  }

  function recordWrong(id: string, q: number) {
    if (q < 3) {
      setWrongIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    } else {
      setWrongIds((prev) =>
        prev.includes(id) ? prev.filter((w) => w !== id) : prev,
      );
    }
  }

  function answer(q: number) {
    if (!current || flashTimer.current !== null) return;
    const id = current.id;
    setFlash(q >= 3 ? "good" : "bad");
    recordWrong(id, q);
    setDayStats(recordDayReview(q >= 3));
    if (strict) {
      setSessionStats((s) => {
        const tries = (s.tries[id] ?? 0) + 1;
        return {
          tries: { ...s.tries, [id]: tries },
          firstOk: s.firstOk + (q >= 3 && tries === 1 ? 1 : 0),
          done: s.done + (q >= 3 ? 1 : 0),
        };
      });
      flashTimer.current = window.setTimeout(() => {
        flashTimer.current = null;
        const t = Date.now();
        setProgress((p) => ({
          ...p,
          [id]: grade(p[id] ?? initialProgress(), q, t),
        }));
        setQueue((prev) => {
          const [, ...rest] = prev;
          if (q < 3) return requeueAfterFail(rest, id);
          return rest;
        });
        setFlash(null);
        setEnterDir(1);
        setFlipped(false);
      }, 380);
      return;
    }
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

  function startWrongReview() {
    if (wrongCards.length === 0) return;
    setMode("wrong");
    buildSession(
      "wrong",
      order,
      chapters,
      query.trim(),
      progress,
      wrongSet,
    );
  }

  function retrySession() {
    buildSession(mode, order, chapters, query.trim(), progress, wrongSet);
  }

  function jumpToWrong(id: string) {
    setMode("wrong");
    const trimmed = query.trim();
    const ids = order.filter((cid) => {
      const c = byId.get(cid);
      if (!c || !matchFilters(c, trimmed, chapters)) return false;
      return wrongSet.has(cid) || cid === id;
    });
    // Put the tapped card first so review starts there.
    const head = ids.filter((cid) => cid !== id);
    const target = byId.get(id);
    const ordered =
      target && matchFilters(target, trimmed, chapters)
        ? [id, ...head]
        : ids;
    setQueue(ordered);
    setSessionTotal(ordered.length);
    setSessionStats({ tries: {}, firstOk: 0, done: 0 });
    setFlipped(false);
    setFlash(null);
    setEnterDir(1);
  }

  function removeWrong(id: string) {
    setWrongIds((prev) => prev.filter((w) => w !== id));
  }

  function clearWrongs() {
    if (wrongIds.length === 0) return;
    if (!window.confirm(`確定清除 ${wrongIds.length} 張錯題？`)) return;
    clearWrongIds();
    setWrongIds([]);
    if (mode === "wrong") setMode("all");
    setPos(0);
  }

  function resetAll() {
    if (!window.confirm("確定清除所有學習進度（含每日紀錄）？")) return;
    clearProgress();
    clearDayStats();
    setProgress({});
    setDayStats({});
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
        if (!strict) go(1);
      } else if (e.key === "ArrowLeft") {
        if (!strict) go(-1);
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
        <div className="flex flex-none items-center gap-2">
          <div
            title="連續學習天數"
            className="flex items-baseline gap-2 rounded-panel border border-line bg-card px-3.5 py-2 shadow-soft"
          >
            <span className="inline-flex items-baseline gap-1 font-serif text-[1.5rem] leading-none font-black text-accent-deep">
              <Flame className="size-4 translate-y-[1px]" aria-hidden="true" />
              {streak}
            </span>
            <span className="text-[0.8rem] text-muted">天</span>
          </div>
          <div
            title="錯題"
            className="flex items-baseline gap-2 rounded-panel border border-line bg-card px-3.5 py-2 shadow-soft"
          >
            <span className="font-serif text-[1.5rem] leading-none font-black text-accent-deep">
              {wrongIds.length}
            </span>
            <span className="text-[0.8rem] text-muted">錯題</span>
          </div>
          <div
            title="待複習"
            className="flex items-baseline gap-2 rounded-panel border border-line bg-card px-3.5 py-2 shadow-soft"
          >
            <span className="font-serif text-[1.5rem] leading-none font-black text-accent-deep">
              {dueCount}
            </span>
            <span className="text-[0.8rem] text-muted">待複習</span>
          </div>
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
                if (strict) {
                  buildSession(
                    mode,
                    order,
                    v,
                    query.trim(),
                    progress,
                    wrongSet,
                  );
                } else {
                  setPos(0);
                  setFlipped(false);
                }
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
                    const v = e.target.value;
                    setQuery(v);
                    if (strict) {
                      buildSession(
                        mode,
                        order,
                        chapters,
                        v.trim(),
                        progress,
                        wrongSet,
                      );
                    } else {
                      setPos(0);
                      setFlipped(false);
                    }
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
              className="grid grid-cols-3 rounded-btn border border-line-strong bg-paper-soft p-[3px]"
            >
              {(
                [
                  ["all", "全部瀏覽"],
                  ["due", "今日複習"],
                  ["wrong", `錯題${wrongCount > 0 ? ` ${wrongCount}` : ""}`],
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
                    switchMode(m);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid gap-1.5">
              <span className="flex items-center gap-1.5 text-[0.78rem] tracking-[0.08em] text-muted">
                <ArrowLeftRight className="size-3.5" aria-hidden="true" />
                考法
              </span>
              <div
                role="group"
                aria-label="考法"
                className="grid grid-cols-2 rounded-btn border border-line-strong bg-paper-soft p-[3px]"
              >
                {(
                  [
                    ["forward", "釋義"],
                    ["reverse", "回想"],
                  ] as const
                ).map(([d, label]) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={direction === d}
                    title={
                      d === "forward"
                        ? "看文句猜字義"
                        : "看字義回想是哪個字"
                    }
                    className={cn(
                      "min-h-10 cursor-pointer rounded-xl border-0 px-3 py-2 text-[0.9rem] font-medium transition-colors",
                      direction === d
                        ? "bg-ink text-paper shadow-[0_2px_8px_rgb(43_38_32/0.25)] dark:bg-accent dark:text-[#231210] dark:shadow-none"
                        : "bg-transparent text-muted hover:text-ink",
                    )}
                    onClick={() => {
                      setDirection(d);
                      setFlipped(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="m-0 text-[0.76rem] leading-relaxed text-faint">
                {direction === "forward"
                  ? "看文句，想字義。先在心中回答再翻面。"
                  : "看字義，想是哪個字。句中挖空處就是答案。"}
              </p>
            </div>
          </motion.section>

          <motion.section className={panel} {...panelIn(2)}>
            <h2 className={panelTitle}>進度</h2>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  [`${learned}`, `/${filtered.length}`, "已學"],
                  [`${dueCount}`, "", "待複習"],
                  [`${mastered}`, "", "已掌握"],
                  [`${wrongCount}`, "", "錯題"],
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
              aria-label={`已學 ${pct}%，已掌握 ${mastered} 張`}
              className="flex h-2.5 gap-px overflow-hidden rounded-full border border-black/5 bg-line dark:border-white/5"
            >
              {filtered.length > 0 && (
                <>
                  <div
                    className="h-full bg-accent/35"
                    style={{ width: `${(learning / filtered.length) * 100}%` }}
                  />
                  <div
                    className="h-full bg-gradient-to-r from-accent to-accent-deep"
                    style={{ width: `${(mastered / filtered.length) * 100}%` }}
                  />
                </>
              )}
            </div>
            <div className="m-0 flex items-baseline justify-between gap-2 text-[0.82rem] text-muted">
              <span>
                學習中 {learning} · 已掌握 {mastered}
              </span>
              <span>{pct}% 已學</span>
            </div>
            <div className="grid gap-1 rounded-btn border border-line bg-paper-soft px-3 py-2">
              <span className="flex items-center gap-1.5 text-[0.78rem] text-muted">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                {today.reviews === 0
                  ? "今天還沒複習，刷一輪點個火吧"
                  : `今日 ${today.reviews} 張 · 答對 ${todayRate}%`}
                <span className="ml-auto">明日到期 {dueSoon}</span>
              </span>
              <div
                className="flex h-11 items-end gap-1.5"
                role="img"
                aria-label={`近 7 天共複習 ${week.reduce((a, w) => a + w.reviews, 0)} 張`}
              >
                {week.map((w) => (
                  <div key={w.key} className="grid min-w-0 flex-1 gap-1" title={`${w.key} · ${w.reviews} 張 · 答對 ${w.correct} 張`}>
                    <div className="flex h-7 items-end rounded-[4px] bg-line/60">
                      <div
                        className={
                          w.isToday
                            ? "w-full rounded-[4px] bg-gradient-to-t from-accent to-accent-deep"
                            : "w-full rounded-[4px] bg-accent/40"
                        }
                        style={{ height: `${Math.max(w.reviews === 0 ? 0 : 12, (w.reviews / weekMax) * 100)}%` }}
                      />
                    </div>
                    <span
                      className={
                        w.isToday
                          ? "text-center text-[0.68rem] font-bold text-accent-deep"
                          : "text-center text-[0.68rem] text-faint"
                      }
                    >
                      {w.isToday ? "今" : w.weekday}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.section className={panel} {...panelIn(3)}>
            <div className="flex items-center justify-between gap-2">
              <h2 className={panelTitle}>錯題本</h2>
              <span className="text-[0.78rem] text-muted">{wrongCards.length} 張</span>
            </div>
            {wrongCards.length === 0 ? (
              <p className="m-0 flex items-center gap-2 text-[0.85rem] leading-relaxed text-faint">
                <ListX className="size-4 flex-none" aria-hidden="true" />
                還沒有錯題，按「忘記」的卡會自動收進來。
              </p>
            ) : (
              <>
                <ul className="m-0 grid max-h-[260px] list-none gap-1.5 overflow-y-auto p-0">
                  {wrongCards.slice(0, 30).map((c) => (
                    <li key={c.id}>
                      <div className="group flex items-center gap-2 rounded-xl border border-line bg-paper-soft px-2.5 py-2 text-left">
                        <button
                          type="button"
                          onClick={() => jumpToWrong(c.id)}
                          title={`${c.sentence}`}
                          className="grid min-w-0 flex-1 cursor-pointer gap-0.5 border-0 bg-transparent p-0 text-left"
                        >
                          <span className="truncate font-serif text-[0.92rem] font-bold text-ink">
                            {c.term}
                            <span className="ml-2 font-sans text-[0.72rem] font-normal text-faint">
                              {c.chapter} #{c.num}
                            </span>
                          </span>
                          <span className="truncate text-[0.78rem] text-muted">
                            {c.sentence}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeWrong(c.id)}
                          aria-label={`移除錯題 ${c.term}`}
                          title="已記得，移出錯題"
                          className="grid size-8 flex-none cursor-pointer place-items-center rounded-lg border border-transparent bg-transparent text-faint transition hover:border-line-strong hover:text-ink"
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                {wrongCards.length > 30 && (
                  <p className="m-0 text-[0.78rem] text-faint">
                    還有 {wrongCards.length - 30} 張沒列出，先進錯題模式慢慢刷。
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={startWrongReview}
                    disabled={wrongCards.length === 0}
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-btn border border-accent bg-accent px-3 py-2 text-[0.9rem] font-semibold text-accent-ink transition hover:border-accent-deep hover:bg-accent-deep disabled:opacity-60"
                  >
                    <Play className="mr-1.5 inline size-4" aria-hidden="true" />
                    {mode === "wrong" ? "繼續刷錯題" : "開始錯題複習"}
                  </button>
                  <button
                    type="button"
                    onClick={clearWrongs}
                    disabled={wrongIds.length === 0}
                    className={cn(quietBtn, "inline-flex items-center justify-center disabled:opacity-60")}
                  >
                    <Trash2 className="mr-1.5 inline size-4 -translate-y-px" aria-hidden="true" />
                    清除錯題
                  </button>
                </div>
                {mode === "wrong" && (
                  <button
                    type="button"
                    onClick={() => switchMode("all")}
                    className="min-h-10 cursor-pointer rounded-btn border-0 bg-transparent px-2 py-1 text-[0.82rem] text-muted transition hover:text-ink"
                  >
                    離開錯題模式，回全部瀏覽
                  </button>
                )}
              </>
            )}
          </motion.section>

          <motion.section
            className="grid gap-3 rounded-panel border border-dashed border-line-strong p-4"
            {...panelIn(4)}
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
              {strict
                ? "空白鍵 翻面 · 1 忘記 · 2 記得 · 答完才往下走"
                : "空白鍵 翻面 · ← → 換卡 · 1 忘記 · 2 記得"}
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
                  {strict
                    ? `${mode === "wrong" ? "錯題" : "今日複習"} · 還剩 ${sessionLeft} 張 · 已完成 ${sessionStats.done}/${sessionTotal}`
                    : `第 ${safePos + 1} / ${deck.length} 張`}
                </span>
                <span className="truncate text-[0.82rem] whitespace-nowrap text-muted">
                  {current.chapter} #{current.num}
                </span>
              </div>
              {strict && sessionTotal > 0 && (
                <div
                  role="progressbar"
                  aria-valuenow={sessionStats.done}
                  aria-valuemin={0}
                  aria-valuemax={sessionTotal}
                  aria-label={`本輪已完成 ${sessionStats.done}/${sessionTotal}`}
                  className="mb-3 h-1.5 overflow-hidden rounded-full bg-line"
                >
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent-deep"
                    animate={{
                      width: `${(sessionStats.done / sessionTotal) * 100}%`,
                    }}
                    transition={{ type: "spring", stiffness: 160, damping: 24 }}
                  />
                </div>
              )}
              {!strict && (
                <input
                  className="scrubber"
                  type="range"
                  min={1}
                  max={Math.max(deck.length, 1)}
                  value={deck.length === 0 ? 0 : safePos + 1}
                  onChange={(e) => jumpTo(Number(e.target.value) - 1)}
                  aria-label="跳到指定卡片"
                />
              )}
              <Flashcard
                card={current}
                flipped={flipped}
                onFlip={() => setFlipped((f) => !f)}
                cardKey={`${current.id}-${direction}`}
                enterDir={enterDir}
                flash={flash}
                direction={direction}
              />
              <p className="m-0 mt-2 text-center text-[0.78rem] text-faint">
                {cardStatus(progress[current.id], now)}
              </p>
              {strict ? (
                <div className="mt-3.5 grid gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFlipped((f) => !f)}
                    className="min-h-[52px] w-full cursor-pointer rounded-btn border border-accent bg-accent px-6 py-3 text-[1rem] font-semibold text-accent-ink transition hover:border-accent-deep hover:bg-accent-deep active:translate-y-px"
                  >
                    {flipped ? "看題目" : "心中答完，看答案"}
                  </button>
                  <p className="m-0 text-center text-[0.78rem] text-faint">
                    答完才能往下走 · 忘記的卡稍後會再出現
                  </p>
                </div>
              ) : (
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
              )}
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
          ) : strict ? (
            <div className="border-line-strong rounded-panel border-dashed bg-card px-4 py-14 text-center font-serif">
              {sessionTotal === 0 ? (
                <>
                  <p className="mt-0 mb-4 text-[1.1rem] text-muted">
                    {mode === "wrong"
                      ? wrongIds.length === 0
                        ? "錯題本是空的，把忘記的卡收進來再複習。"
                        : "這組篩選下沒有錯題，換個篇目或搜尋試試。"
                      : "這組沒有待複習的卡，全部搞定。"}
                  </p>
                  <button
                    type="button"
                    onClick={() => switchMode("all")}
                    className="min-h-11 cursor-pointer rounded-btn border border-line-strong bg-card px-3 py-2.5 transition hover:border-ink hover:shadow-soft"
                  >
                    回全部瀏覽
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-0 mb-2 text-[1.4rem] font-black text-ink">
                    {mode === "wrong" ? "錯題清光了" : "本輪複習完成"}
                  </p>
                  <p className="mt-0 mb-2 text-[1.05rem] text-muted">
                    共 {sessionTotal} 張 · 一次答對 {sessionStats.firstOk} 張（{sessionRate}%）
                  </p>
                  <p className="mt-0 mb-2 text-[0.9rem] text-muted">
                    連續學習 {streak} 天 · 今日累計 {today.reviews} 張
                  </p>
                  <p className="mx-auto mt-0 mb-6 max-w-[26em] text-[0.85rem] leading-relaxed text-faint">
                    {sessionStats.firstOk === sessionTotal
                      ? "全部一次答對，記憶很穩。明天再回來看，間隔拉開效果更好。"
                      : "忘記的卡已經排回隊列剛才重答過了。同一批多刷一次，答對率會再上去。"}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={retrySession}
                      className="inline-flex min-h-11 cursor-pointer items-center rounded-btn border border-accent bg-accent px-4 py-2.5 font-semibold text-accent-ink transition hover:border-accent-deep hover:bg-accent-deep"
                    >
                      <RotateCcw className="mr-1.5 inline size-4" aria-hidden="true" />
                      再刷一次
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode("all")}
                      className="min-h-11 cursor-pointer rounded-btn border border-line-strong bg-card px-3 py-2.5 transition hover:border-ink hover:shadow-soft"
                    >
                      回全部瀏覽
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="border-line-strong rounded-panel border-dashed bg-card px-4 py-14 text-center font-serif">
              <p className="mt-0 mb-4 text-[1.1rem] text-muted">
                {filtered.length === 0
                  ? "沒有符合的卡，換個篩選條件試試。"
                  : learned === 0
                    ? "還沒開始學，去全部瀏覽刷第一輪吧。"
                    : "這組沒有待複習的卡，全部搞定。"}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {wrongCards.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={startWrongReview}
                      className="inline-flex min-h-11 cursor-pointer items-center rounded-btn border border-accent bg-accent px-4 py-2.5 font-semibold text-accent-ink transition hover:border-accent-deep hover:bg-accent-deep"
                    >
                      <Play className="mr-1.5 inline size-4" aria-hidden="true" />
                      複習 {wrongCards.length} 張錯題
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode("all")}
                      className="min-h-11 cursor-pointer rounded-btn border border-line-strong bg-card px-3 py-2.5 transition hover:border-ink hover:shadow-soft"
                    >
                      回全部瀏覽
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => switchMode("all")}
                    className="min-h-11 cursor-pointer rounded-btn border border-line-strong bg-card px-3 py-2.5 transition hover:border-ink hover:shadow-soft"
                  >
                    回全部瀏覽
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.main>
      </div>
    </div>
  );
}
