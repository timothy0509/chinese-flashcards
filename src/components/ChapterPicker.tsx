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
  function pick(v: string) {
    onChange(v);
  }

  return (
    <div className="chapter-list" role="listbox" aria-label="篇目選擇">
      <button
        type="button"
        role="option"
        aria-selected={value === "全部"}
        className={`chapter-item${value === "全部" ? " selected" : ""}`}
        onClick={() => pick("全部")}
      >
        <span className="chapter-top">
          <span className="chapter-name">全部篇目</span>
          <span className="chapter-count">{totalCount}</span>
        </span>
        <span className="chapter-sub">
          <span
            className="chapter-bar"
            aria-hidden="true"
          >
            <span
              className="chapter-fill"
              style={{
                width:
                  totalCount === 0
                    ? "0%"
                    : `${Math.round((totalLearned / totalCount) * 100)}%`,
              }}
            />
          </span>
          <span className="chapter-stat">
            已學 {totalLearned} · 待複習 {totalDue}
          </span>
        </span>
      </button>
      {items.map((c) => (
        <button
          key={c.name}
          type="button"
          role="option"
          aria-selected={value === c.name}
          className={`chapter-item${value === c.name ? " selected" : ""}`}
          onClick={() => pick(c.name)}
        >
          <span className="chapter-top">
            <span className="chapter-name">{c.name}</span>
            <span className="chapter-count">{c.count}</span>
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
      ))}
    </div>
  );
}
