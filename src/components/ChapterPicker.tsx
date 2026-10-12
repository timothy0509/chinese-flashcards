import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Check, Minus, Search, X } from "lucide-react";
import { cn } from "../lib/cn";

type Item = {
  name: string;
  count: number;
  learned: number;
  due: number;
};

const GROUPS: { name: string; members: string[] }[] = [
  { name: "《唐詩三首》", members: ["《登樓》", "《山居秋暝》", "《月下獨酌》"] },
  {
    name: "《詞三首》",
    members: ["《念奴嬌．赤壁懷古》", "《聲聲慢》", "《青玉案．元夕》"],
  },
];

/** Collapse full groups for display, e.g. three 唐詩 members read as 《唐詩三首》. */
function displayNames(value: string[]): string[] {
  const rest = new Set(value);
  const out: string[] = [];
  for (const g of GROUPS) {
    if (g.members.every((m) => rest.has(m))) {
      out.push(g.name);
      for (const m of g.members) rest.delete(m);
    }
  }
  for (const v of value) if (rest.has(v)) out.push(v);
  return out;
}

const rowBase =
  "grid gap-2 cursor-pointer rounded-xl border p-3 text-left transition " +
  "shadow-none hover:shadow-soft bg-card";
const rowIdle = "border-line hover:border-muted";
const rowSelected =
  "border-accent bg-accent/10 shadow-[inset_3px_0_0_var(--color-accent)]";

const check =
  "flex-none grid size-[22px] place-items-center rounded-[7px] border-[1.5px] " +
  "border-line-strong leading-none text-accent-deep bg-card";
const checkOn = "border-accent bg-accent text-accent-ink";
const checkHalf = "border-accent bg-accent/15 text-accent-deep";

const count =
  "flex-none rounded-full border border-line bg-paper-soft px-2.5 py-0.5 " +
  "text-[0.75rem] text-muted";
const countOn = "border-accent/35 text-accent-deep";

const subBar = "flex items-center gap-2.5";
const bar = "h-[5px] flex-1 overflow-hidden rounded-full bg-line";
const barFill =
  "block h-full rounded-full bg-gradient-to-r from-accent to-accent-deep";
const stat = "flex-none text-[0.72rem] text-faint";

function fillWidth(count: number, learned: number) {
  return count === 0 ? "0%" : `${Math.round((learned / count) * 100)}%`;
}

export default function ChapterPicker({
  value,
  onChange,
  items,
  totalCount,
  totalLearned,
  totalDue,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  items: Item[];
  totalCount: number;
  totalLearned: number;
  totalDue: number;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState<string[]>(value);

  const isAll = value.length === 0;
  const selectedSet = new Set(value);

  const summary = isAll
    ? { name: "全部篇目", count: totalCount, learned: totalLearned, due: totalDue }
    : value.length === 1
      ? (() => {
          const found = items.find((c) => c.name === value[0]);
          return (
            found ?? { name: value[0], count: 0, learned: 0, due: 0 }
          );
        })()
      : (() => {
          const sel = items.filter((c) => selectedSet.has(c.name));
          return {
            name: `已選 ${value.length} 篇`,
            count: sel.reduce((a, c) => a + c.count, 0),
            learned: sel.reduce((a, c) => a + c.learned, 0),
            due: sel.reduce((a, c) => a + c.due, 0),
          };
        })();

  const q = filter.trim();
  const visible =
    q === "" ? items : items.filter((c) => c.name.includes(q));
  const visibleGroups =
    q === ""
      ? GROUPS
      : GROUPS.filter(
          (g) =>
            g.name.includes(q) || g.members.some((m) => m.includes(q)),
        );

  useEffect(() => {
    if (open) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function normalize(list: string[]): string[] {
    if (list.length === 0) return [];
    if (list.length >= items.length) return [];
    return list;
  }

  function toggle(name: string) {
    setDraft((d) => {
      const s = new Set(d);
      if (s.has(name)) s.delete(name);
      else s.add(name);
      return normalize([...s].filter((n) => items.some((c) => c.name === n)));
    });
  }

  function confirm() {
    onChange(normalize(draft));
    setOpen(false);
    setFilter("");
  }

  function clearDraft() {
    setDraft([]);
  }

  function toggleGroup(members: string[]) {
    setDraft((d) => {
      const s = new Set(d);
      if (members.every((m) => s.has(m))) {
        for (const m of members) s.delete(m);
      } else {
        for (const m of members) s.add(m);
      }
      return normalize([...s].filter((n) => items.some((c) => c.name === n)));
    });
  }

  function groupBlock(g: { name: string; members: string[] }, only?: string[]) {
    const wanted = only ?? g.members;
    const parts = items.filter((c) => wanted.includes(c.name));
    if (parts.length === 0) return null;
    const all = g.members.every((m) => draft.includes(m));
    const selectedCount = g.members.filter((m) => draft.includes(m)).length;
    const some = selectedCount > 0 && !all;
    const count = items
      .filter((c) => g.members.includes(c.name))
      .reduce((a, c) => a + c.count, 0);
    const learned = items
      .filter((c) => g.members.includes(c.name))
      .reduce((a, c) => a + c.learned, 0);
    const due = items
      .filter((c) => g.members.includes(c.name))
      .reduce((a, c) => a + c.due, 0);
    return (
      <section
        key={g.name}
        className={cn(
          "grid gap-2.5 rounded-btn border bg-paper-soft p-3 shadow-soft",
          all
            ? "border-accent shadow-[inset_0_3px_0_var(--color-accent)]"
            : some
              ? "border-accent shadow-[inset_0_3px_0_rgb(163_59_46/0.45)]"
              : "border-line-strong",
        )}
        aria-label={g.name}
      >
        <button
          type="button"
          role="option"
          aria-selected={all}
          className="w-full cursor-pointer border-0 bg-transparent px-0.5 py-1 text-left"
          onClick={() => toggleGroup(g.members)}
        >
          <span className="flex items-center gap-2.5">
            <span
              className={cn(
                check,
                all ? checkOn : some ? checkHalf : "",
              )}
              aria-hidden="true"
            >
              {all ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : some ? (
                <Minus className="size-3.5" strokeWidth={3} />
              ) : null}
            </span>
            <span className="grid min-w-0 flex-1 gap-px">
              <span
                className={cn(
                  "truncate font-serif text-[1rem] font-bold",
                  all && "text-accent-deep",
                )}
              >
                {g.name}
              </span>
              <span className="text-[0.74rem] tracking-[0.02em] text-muted">
                合集 · {g.members.length} 篇 ·{" "}
                {all
                  ? "全選中"
                  : some
                    ? `已選 ${selectedCount}/${g.members.length}`
                    : "全選"}
              </span>
            </span>
            <span className={cn(count, all && countOn)}>{count} 張</span>
          </span>
        </button>
        <span className={subBar}>
          <span className={bar} aria-hidden="true">
            <span
              className={barFill}
              style={{ width: fillWidth(count, learned) }}
            />
          </span>
          <span className={stat}>
            已學 {learned} · 待複習 {due}
          </span>
        </span>
        <div className="grid gap-2 min-[700px]:grid-cols-2">
          {parts.map((c) => row(c, true))}
        </div>
      </section>
    );
  }

  function row(c: Item, nested = false) {
    const checked = draft.includes(c.name);
    return (
      <button
        key={c.name}
        type="button"
        role="option"
        aria-selected={checked}
        className={cn(
          rowBase,
          checked ? rowSelected : rowIdle,
          nested &&
            "[&_.row-name]:text-[0.9rem] [&_.row-name]:font-semibold",
        )}
        onClick={() => toggle(c.name)}
      >
        <span className="flex items-center gap-2.5">
          <span
            className={cn(check, checked && checkOn)}
            aria-hidden="true"
          >
            {checked && <Check className="size-3.5" strokeWidth={3} />}
          </span>
          <span className="row-name min-w-0 flex-1 truncate font-serif text-[0.95rem] font-bold">
            {c.name}
          </span>
          <span className={cn(count, checked && countOn)}>{c.count} 張</span>
        </span>
        <span className={subBar}>
          <span className={bar} aria-hidden="true">
            <span
              className={barFill}
              style={{ width: fillWidth(c.count, c.learned) }}
            />
          </span>
          <span className={stat}>
            已學 {c.learned} · 待複習 {c.due}
          </span>
        </span>
      </button>
    );
  }

  const draftCount =
    draft.length === 0
      ? totalCount
      : items
          .filter((c) => draft.includes(c.name))
          .reduce((a, c) => a + c.count, 0);

  return (
    <div className="grid gap-2.5">
      <p
        className="m-0 grid gap-0.5 rounded-btn border border-line bg-paper-soft p-3"
        aria-live="polite"
      >
        <span className="font-serif font-bold text-[0.95rem]">
          {summary.name}
        </span>
        {!isAll && value.length > 1 && (
          <span className="line-clamp-2 text-[0.78rem] text-muted">
            {displayNames(value).join("、")}
          </span>
        )}
        <span className="text-[0.78rem] text-muted">
          {summary.count} 張 · 已學 {summary.learned} · 待複習 {summary.due}
        </span>
      </p>
      <button
        type="button"
        aria-haspopup="dialog"
        className="min-h-12 cursor-pointer rounded-btn border border-line-strong bg-card px-3 py-2.5 font-medium transition hover:border-ink hover:shadow-soft"
        onClick={() => setOpen(true)}
      >
        選擇篇目{isAll ? "" : `（${value.length}）`}
      </button>
      {open &&
        createPortal(
          <motion.div
              className="fixed inset-0 z-[60] grid place-items-center bg-[rgb(20_16_12/0.55)] p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.16 }}
              onClick={() => setOpen(false)}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="選擇篇目，可多選"
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="grid max-h-[min(86vh,720px)] w-[min(760px,100%)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-4 rounded-panel border border-line-strong bg-card p-6 shadow-lift"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="m-0 font-serif text-[1.05rem] tracking-[0.08em]">
                    選擇篇目
                    <span className="ml-2.5 font-sans text-[0.78rem] font-normal tracking-normal text-muted">
                      {draft.length === 0
                        ? "全部"
                        : `已選 ${draft.length} 篇 · ${draftCount} 張`}
                    </span>
                  </h3>
                  <button
                    type="button"
                    aria-label="關閉"
                    className="grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-btn border border-line-strong bg-card transition hover:border-ink"
                    onClick={() => setOpen(false)}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    placeholder="篩選篇目"
                    aria-label="篩選篇目"
                    autoFocus
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="min-h-11 w-full rounded-btn border border-line-strong bg-card px-3 py-2.5 pl-9 text-ink placeholder:text-faint"
                  />
                </div>
                <div
                  className="grid content-start gap-3 overflow-y-auto p-0.5"
                  role="listbox"
                  aria-multiselectable="true"
                  aria-label="篇目選擇，可多選"
                >
                  {q === ""
                    ? (() => {
                        const seen = new Set<string>();
                        const nodes: ReactNode[] = [];
                        for (const c of items) {
                          const g = GROUPS.find((gr) =>
                            gr.members.includes(c.name),
                          );
                          if (g) {
                            if (!seen.has(g.name)) {
                              seen.add(g.name);
                              nodes.push(groupBlock(g));
                            }
                            continue;
                          }
                          nodes.push(row(c));
                        }
                        return nodes;
                      })()
                    : (() => {
                        const nodes: ReactNode[] = [];
                        const added = new Set<string>();
                        for (const g of visibleGroups) {
                          const matching = g.members.filter((m) =>
                            items.some(
                              (c) => c.name === m && c.name.includes(q),
                            ),
                          );
                          if (g.name.includes(q)) {
                            nodes.push(groupBlock(g));
                          } else if (matching.length > 0) {
                            nodes.push(groupBlock(g, matching));
                          }
                          for (const m of g.members) added.add(m);
                          added.add(g.name);
                        }
                        for (const c of visible) {
                          if (!added.has(c.name)) nodes.push(row(c));
                        }
                        return nodes;
                      })()}
                  {visible.length === 0 && visibleGroups.length === 0 && (
                    <p className="mx-1 my-1 px-0.5 text-[0.82rem] text-muted">
                      沒有符合的篇目
                    </p>
                  )}
                </div>
                <div className="flex justify-between gap-2.5">
                  <button
                    type="button"
                    className="min-h-12 cursor-pointer rounded-btn border border-line-strong bg-card px-3 py-2.5 transition hover:border-ink"
                    onClick={clearDraft}
                  >
                    回到全部
                  </button>
                  <button
                    type="button"
                    className="min-h-12 flex-1 cursor-pointer rounded-btn border border-accent bg-accent px-3 py-2.5 font-semibold text-accent-ink transition hover:border-accent-deep hover:bg-accent-deep"
                    onClick={confirm}
                  >
                    確定{draft.length === 0 ? "（全部）" : `（${draft.length} 篇）`}
                  </button>
                </div>
              </motion.div>
            </motion.div>,
            document.body,
          )}
    </div>
  );
}
