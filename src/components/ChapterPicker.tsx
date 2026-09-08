import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

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

  function groupRow(g: { name: string; members: string[] }) {
    const parts = items.filter((c) => g.members.includes(c.name));
    const all = g.members.every((m) => draft.includes(m));
    const some = !all && g.members.some((m) => draft.includes(m));
    const count = parts.reduce((a, c) => a + c.count, 0);
    const learned = parts.reduce((a, c) => a + c.learned, 0);
    const due = parts.reduce((a, c) => a + c.due, 0);
    return (
      <button
        key={g.name}
        type="button"
        role="option"
        aria-selected={all}
        className={`chapter-item chapter-group${all ? " selected" : ""}${some ? " partial" : ""}`}
        onClick={() => toggleGroup(g.members)}
      >
        <span className="chapter-top">
          <span className="chapter-check" aria-hidden="true">
            {all ? "✓" : some ? "–" : ""}
          </span>
          <span className="chapter-name">{g.name}（全選）</span>
          <span className="chapter-count">{count} 張</span>
        </span>
        <span className="chapter-sub">
          <span className="chapter-bar" aria-hidden="true">
            <span
              className="chapter-fill"
              style={{
                width:
                  count === 0
                    ? "0%"
                    : `${Math.round((learned / count) * 100)}%`,
              }}
            />
          </span>
          <span className="chapter-stat">
            已學 {learned} · 待複習 {due}
          </span>
        </span>
      </button>
    );
  }

  function row(c: Item) {
    const checked = draft.includes(c.name);
    return (
      <button
        key={c.name}
        type="button"
        role="option"
        aria-selected={checked}
        className={`chapter-item${checked ? " selected" : ""}`}
        onClick={() => toggle(c.name)}
      >
        <span className="chapter-top">
          <span className="chapter-check" aria-hidden="true">
            {checked ? "✓" : ""}
          </span>
          <span className="chapter-name">{c.name}</span>
          <span className="chapter-count">{c.count} 張</span>
        </span>
        <span className="chapter-sub">
          <span className="chapter-bar" aria-hidden="true">
            <span
              className="chapter-fill"
              style={{
                width:
                  c.count === 0
                    ? "0%"
                    : `${Math.round((c.learned / c.count) * 100)}%`,
              }}
            />
          </span>
          <span className="chapter-stat">
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
    <div className="chapter-picker">
      <p className="chapter-current" aria-live="polite">
        <span className="chapter-name">{summary.name}</span>
        {!isAll && value.length > 1 && (
          <span className="chapter-current-list">
            {displayNames(value).join("、")}
          </span>
        )}
        <span className="chapter-current-sub">
          {summary.count} 張 · 已學 {summary.learned} · 待複習 {summary.due}
        </span>
      </p>
      <button
        type="button"
        className="chapter-open-btn"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        選擇篇目{isAll ? "" : `（${value.length}）`}
      </button>
      {open &&
        createPortal(
          <div className="chapter-overlay" onClick={() => setOpen(false)}>
            <div
              className="chapter-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="選擇篇目，可多選"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="chapter-dialog-head">
                <h3>
                  選擇篇目
                  <span className="chapter-dialog-count">
                    {draft.length === 0
                      ? "全部"
                      : `已選 ${draft.length} 篇 · ${draftCount} 張`}
                  </span>
                </h3>
                <button
                  type="button"
                  className="chapter-close"
                  aria-label="關閉"
                  onClick={() => setOpen(false)}
                >
                  ✕
                </button>
              </div>
              <input
                className="chapter-filter"
                type="search"
                placeholder="篩選篇目"
                aria-label="篩選篇目"
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <div
                className="chapter-list"
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
                        if (g && !seen.has(g.name)) {
                          seen.add(g.name);
                          nodes.push(groupRow(g));
                        }
                        nodes.push(row(c));
                      }
                      return nodes;
                    })()
                  : (() => {
                      const nodes: ReactNode[] = [];
                      for (const g of visibleGroups) {
                        if (g.name.includes(q)) {
                          nodes.push(groupRow(g));
                        }
                      }
                      for (const c of visible) nodes.push(row(c));
                      return nodes;
                    })()}
                {visible.length === 0 && visibleGroups.length === 0 && (
                  <p className="chapter-none">沒有符合的篇目</p>
                )}
              </div>
              <div className="chapter-dialog-foot">
                <button type="button" onClick={clearDraft}>
                  回到全部
                </button>
                <button
                  type="button"
                  className="chapter-confirm"
                  onClick={confirm}
                >
                  確定{draft.length === 0 ? "（全部）" : `（${draft.length} 篇）`}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
