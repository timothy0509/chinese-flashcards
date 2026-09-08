import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Item = {
  name: string;
  count: number;
  learned: number;
  due: number;
};

export default function ChapterPicker({
  value,
  onChange,
  items,
  totalCount,
  totalLearned,
  totalDue,
}: {
  value: string;
  onChange: (v: string) => void;
  items: Item[];
  totalCount: number;
  totalLearned: number;
  totalDue: number;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const selected =
    value === "全部"
      ? { name: "全部篇目", count: totalCount, learned: totalLearned, due: totalDue }
      : (() => {
          const found = items.find((c) => c.name === value);
          return found ?? { name: value, count: 0, learned: 0, due: 0 };
        })();

  const q = filter.trim();
  const visible =
    q === "" ? items : items.filter((c) => c.name.includes(q));

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
  }, [open ]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setFilter("");
  }

  function row(name: string, count: number, learned: number, due: number, isAll: boolean) {
    const v = isAll ? "全部" : name;
    const label = isAll ? "全部篇目" : name;
    return (
      <button
        key={v}
        type="button"
        role="option"
        aria-selected={value === v}
        className={`chapter-item${value === v ? " selected" : ""}`}
        onClick={() => pick(v)}
      >
        <span className="chapter-top">
          <span className="chapter-name">{label}</span>
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

  return (
    <div className="chapter-picker">
      <p className="chapter-current" aria-live="polite">
        <span className="chapter-name">{selected.name}</span>
        <span className="chapter-current-sub">
          {selected.count} 張 · 已學 {selected.learned} · 待複習 {selected.due}
        </span>
      </p>
      <button
        type="button"
        className="chapter-open-btn"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        選擇篇目
      </button>
      {open &&
        createPortal(
          <div className="chapter-overlay" onClick={() => setOpen(false)}>
            <div
              className="chapter-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="選擇篇目"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="chapter-dialog-head">
                <h3>選擇篇目</h3>
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
              <div className="chapter-list" role="listbox" aria-label="篇目選擇">
                {row("全部篇目", totalCount, totalLearned, totalDue, true)}
                {visible.map((c) => row(c.name, c.count, c.learned, c.due, false))}
                {visible.length === 0 && (
                  <p className="chapter-none">沒有符合的篇目</p>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
