import { useEffect, useRef, useState } from "react";

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
  const rootRef = useRef<HTMLDivElement>(null);

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
    function onDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
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
          <span className="chapter-count">{count}</span>
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
    <div className="chapter-picker" ref={rootRef}>
      <button
        type="button"
        className="chapter-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="chapter-trigger-text">
          <span className="chapter-name">{selected.name}</span>
          <span className="chapter-trigger-sub">
            {selected.count} 張 · 已學 {selected.learned}
          </span>
        </span>
        <span className="chapter-chev" aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className="chapter-menu">
          <input
            className="chapter-filter"
            type="search"
            placeholder="篩選篇目"
            aria-label="篩選篇目"
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
      )}
    </div>
  );
}
